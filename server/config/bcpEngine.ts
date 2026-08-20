/**
 * Bylaw Change Proposal (BCP) Workflow Engine
 *
 * Implements the complete BCP lifecycle as defined in Bylaws §17.2:
 *
 * Draft → Submitted → Under Review → Agenda Placed → Debating → Voting → Adopted/Rejected → Effective
 *
 * Key rules (all configurable via governance engine):
 * - B-17.2.1: Proposers = SupCo, EBTO, or 2 Permanent LCs
 * - B-17.2.2: Deadline = 3 weeks before NGA
 * - B-17.2.3: Discussed only under "Changes to constitution & bylaws" agenda item
 * - B-17.2.5: Legal consequence explanation by EB, SupCo, CCC
 * - B-17.2.6: Requires 2/3 majority
 * - B-17.2.7: Effective immediately after NGA (unless specified)
 * - B-17.2.8: Cannot reopen same agenda item in same NGA
 *
 * Usage:
 *   import { submitBCP, reviewBCP, voteBCP, activateBCP } from "./bcpEngine";
 *
 *   const bcp = await submitBCP({
 *     documentId: bylawsDocumentId,
 *     proposedByType: "ebto",
 *     proposedById: presidentId,
 *     title: "Amend voting entitlement for Candidate LCs",
 *     affectedClauses: ["BYLAW-8.7.2"],
 *     oldText: "Each Candidate LC ... has no votes in all plenary sessions and 1 vote in all elections.",
 *     proposedText: "Each Candidate LC ... has 1 vote in all plenary sessions and 2 votes in all elections.",
 *   });
 *
 *   await reviewBCP(bcp.id, { legalImpact: "...", governanceImpact: "..." });
 *   await voteBCP(bcp.id, { yes: 25, no: 5, abstain: 2 });
 *   await activateBCP(bcp.id);
 */

import { eq, and, desc, sql } from "drizzle-orm";
import {
  governanceDocuments,
  governanceClauses,
  governanceRules,
  governanceAmendments,
  governanceDecisions,
} from "../../drizzle/schema.governance_rules";
import { getDb } from "../db";
import { logAuditEvent } from "./auditService";
import { evaluateMajority, recordDecision } from "./governanceRulesEngine";

// ============================================================================
// Types
// ============================================================================

export interface SubmitBCPInput {
  documentId: number;
  proposedByType: "supco" | "ebto" | "lc";
  proposedById?: number;
  proposerNames?: string[];
  title: string;
  description?: string;
  affectedClauses: string[]; // e.g., ["BYLAW-8.7.1", "BYLAW-8.7.2"]
  oldText: string;
  proposedText: string;
  justification?: string;
  effectiveDate?: Date; // If different from immediate
  createdBy?: number;
}

export interface ReviewBCPInput {
  legalImpact?: string;
  governanceImpact?: string;
  operationalImpact?: string;
  financialImpact?: string;
  implementationImpact?: string;
  reviewedBy?: number;
}

export interface VoteBCPResult {
  yes: number;
  no: number;
  abstain: number;
  totalEligible: number;
}

export interface BCPStatusResult {
  bcp: any;
  canVote: boolean;
  canEdit: boolean;
  canWithdraw: boolean;
  deadlinePassed: boolean;
  daysUntilDeadline: number | null;
  validationErrors: string[];
}

// ============================================================================
// BCP Submission
// ============================================================================

/**
 * Submit a Bylaw Change Proposal.
 */
export async function submitBCP(
  input: SubmitBCPInput
): Promise<{ id: number; proposalId: string } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Validate proposer eligibility
    const proposerValid = await validateProposer(
      input.proposedByType,
      input.proposedById,
      input.proposerNames
    );

    if (!proposerValid.valid) {
      console.warn(`[BCP] Proposer validation failed: ${proposerValid.reason}`);
      return null;
    }

    // Validate deadline (3 weeks before NGA)
    const deadlineCheck = await validateBCPDeadline(input.documentId);
    if (!deadlineCheck.valid) {
      console.warn(`[BCP] Deadline validation failed: ${deadlineCheck.reason}`);
      // Allow submission but flag as late
    }

    // Validate affected clauses exist
    const clausesValid = await validateAffectedClauses(
      input.documentId,
      input.affectedClauses
    );
    if (!clausesValid.valid) {
      console.warn(`[BCP] Clause validation failed: ${clausesValid.reason}`);
      return null;
    }

    // Generate proposal ID
    const year = new Date().getFullYear();
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(governanceAmendments)
      .where(
        and(
          eq(governanceAmendments.type, "bylaw_change"),
          sql`YEAR(${governanceAmendments.createdAt}) = ${year}`
        )
      );
    const sequence = (countResult?.count ?? 0) + 1;
    const proposalId = `BCP-${year}-${String(sequence).padStart(3, "0")}`;

    // Get deadline (3 weeks before NGA)
    const deadline = await getBCPDeadline(input.documentId);

    // Create the BCP
    const [result] = await db.insert(governanceAmendments).values({
      documentId: input.documentId,
      proposalId,
      type: "bylaw_change",
      proposedByType: input.proposedByType,
      proposedById: input.proposedById,
      proposerNames: input.proposerNames?.join(", "),
      title: input.title,
      description: input.description,
      affectedClauses: input.affectedClauses,
      oldText: input.oldText,
      proposedText: input.proposedText,
      status: "submitted",
      submittedAt: new Date(),
      deadline,
      createdBy: input.createdBy,
    });

    const id = Number((result as any)[0].insertId);

    await logAuditEvent({
      userId: input.createdBy,
      action: "governance.bcp_submitted",
      entityType: "governance_amendment",
      entityId: id,
      after: {
        proposalId,
        title: input.title,
        affectedClauses: input.affectedClauses,
        proposedByType: input.proposedByType,
      },
    });

    console.log(`[BCP] Submitted: ${proposalId} "${input.title}"`);
    return { id, proposalId };
  } catch (error) {
    console.error("[BCP] Failed to submit:", error);
    return null;
  }
}

/**
 * Validate proposer eligibility for BCP.
 * B-17.2.1: SupCo, EBTO, or 2 Permanent LCs
 */
async function validateProposer(
  proposedByType: string,
  proposedById?: number,
  proposerNames?: string[]
): Promise<{ valid: boolean; reason?: string }> {
  switch (proposedByType) {
    case "supco":
      // SupCo can always propose
      return { valid: true };
    case "ebto":
      // EBTO can always propose
      return { valid: true };
    case "lc":
      // Must be 2 Permanent LCs
      if (!proposerNames || proposerNames.length < 2) {
        return {
          valid: false,
          reason: "BCP by LC requires at least 2 Permanent Local Councils (Bylaws §17.2.1)",
        };
      }
      return { valid: true };
    default:
      return {
        valid: false,
        reason: `Invalid proposer type: ${proposedByType}. Must be "supco", "ebto", or "lc"`,
      };
  }
}

/**
 * Validate BCP deadline.
 * B-17.2.2: Must be submitted at least 3 weeks before NGA
 */
async function validateBCPDeadline(
  documentId: number
): Promise<{ valid: boolean; reason?: string; deadline?: Date }> {
  const deadline = await getBCPDeadline(documentId);

  if (!deadline) {
    return { valid: false, reason: "Could not determine NGA date" };
  }

  const now = new Date();
  const daysUntilDeadline = Math.ceil(
    (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilDeadline < 0) {
    return {
      valid: false,
      reason: `Deadline has passed (${Math.abs(daysUntilDeadline)} days ago). Deadline was: ${deadline.toISOString()}`,
      deadline,
    };
  }

  return { valid: true, deadline };
}

/**
 * Get BCP deadline (3 weeks before NGA).
 */
async function getBCPDeadline(documentId: number): Promise<Date | null> {
  // In production, this would resolve the actual NGA date
  // For now, use the governance parameter
  const db = getDb();
  if (!db) return null;

  try {
    // Find the NGA date window from parameters
    // B-6.3: NGA between July 20 and August 20
    const currentYear = new Date().getFullYear();
    const ngaDate = new Date(currentYear, 6, 20); // July 20

    // B-17.2.2: 3 weeks before NGA
    const deadline = new Date(ngaDate);
    deadline.setDate(deadline.getDate() - 21);

    return deadline;
  } catch {
    return null;
  }
}

/**
 * Validate affected clauses exist in the document.
 */
async function validateAffectedClauses(
  documentId: number,
  clauseIds: string[]
): Promise<{ valid: boolean; reason?: string }> {
  const db = getDb();
  if (!db) return { valid: false, reason: "Database not available" };

  for (const clauseId of clauseIds) {
    const [clause] = await db
      .select()
      .from(governanceClauses)
      .where(
        and(
          eq(governanceClauses.documentId, documentId),
          eq(governanceClauses.clauseId, clauseId),
          eq(governanceClauses.status, "active")
        )
      )
      .limit(1);

    if (!clause) {
      return {
        valid: false,
        reason: `Clause "${clauseId}" not found in document or not active`,
      };
    }
  }

  return { valid: true };
}

// ============================================================================
// BCP Review
// ============================================================================

/**
 * Add impact analysis review to a BCP.
 * B-17.2.5: EB, SupCo, and CCC must explain legal consequences
 */
export async function reviewBCP(
  bcpId: number,
  input: ReviewBCPInput
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [bcp] = await db
      .select()
      .from(governanceAmendments)
      .where(eq(governanceAmendments.id, bcpId))
      .limit(1);

    if (!bcp) return false;

    // Must be in reviewable status
    if (bcp.status !== "submitted" && bcp.status !== "under_review") {
      console.warn(`[BCP] Cannot review BCP in status "${bcp.status}"`);
      return false;
    }

    await db
      .update(governanceAmendments)
      .set({
        status: "under_review",
        legalImpact: input.legalImpact ?? bcp.legalImpact,
        governanceImpact: input.governanceImpact ?? bcp.governanceImpact,
        operationalImpact: input.operationalImpact ?? bcp.operationalImpact,
        financialImpact: input.financialImpact ?? bcp.financialImpact,
        implementationImpact: input.implementationImpact ?? bcp.implementationImpact,
        updatedAt: new Date(),
      })
      .where(eq(governanceAmendments.id, bcpId));

    await logAuditEvent({
      userId: input.reviewedBy,
      action: "governance.bcp_reviewed",
      entityType: "governance_amendment",
      entityId: bcpId,
      after: {
        legalImpact: input.legalImpact,
        governanceImpact: input.governanceImpact,
      },
    });

    return true;
  } catch (error) {
    console.error("[BCP] Failed to review:", error);
    return false;
  }
}

// ============================================================================
// BCP Agenda Placement
// ============================================================================

/**
 * Place BCP on the NGA agenda.
 * B-17.2.3: Must be under "Changes to constitution & bylaws"
 */
export async function placeOnAgenda(
  bcpId: number,
  meetingId: number,
  placedBy?: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [bcp] = await db
      .select()
      .from(governanceAmendments)
      .where(eq(governanceAmendments.id, bcpId))
      .limit(1);

    if (!bcp) return false;

    // Must be under review or submitted
    if (bcp.status !== "under_review" && bcp.status !== "submitted") {
      console.warn(`[BCP] Cannot place on agenda in status "${bcp.status}"`);
      return false;
    }

    await db
      .update(governanceAmendments)
      .set({
        status: "agenda_placed",
        metadata: {
          ...((bcp.metadata as Record<string, unknown>) ?? {}),
          meetingId,
          agendaItem: "Changes to the constitution & bylaws",
        },
        updatedAt: new Date(),
      })
      .where(eq(governanceAmendments.id, bcpId));

    await logAuditEvent({
      userId: placedBy,
      action: "governance.bcp_agenda_placed",
      entityType: "governance_amendment",
      entityId: bcpId,
      after: { meetingId },
    });

    return true;
  } catch (error) {
    console.error("[BCP] Failed to place on agenda:", error);
    return false;
  }
}

// ============================================================================
// BCP Voting
// ============================================================================

/**
 * Vote on a BCP.
 * B-17.2.6: Requires 2/3 majority
 */
export async function voteBCP(
  bcpId: number,
  votes: VoteBCPResult
): Promise<{ adopted: boolean; decisionId: string } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [bcp] = await db
      .select()
      .from(governanceAmendments)
      .where(eq(governanceAmendments.id, bcpId))
      .limit(1);

    if (!bcp) return null;

    // Must be in voting status
    if (bcp.status !== "debating" && bcp.status !== "agenda_placed") {
      console.warn(`[BCP] Cannot vote in status "${bcp.status}"`);
      return null;
    }

    // Evaluate majority using the governance engine
    // B-17.2.6: BCPs require 2/3 majority
    const majorityResult = await evaluateMajority(
      {
        yes: votes.yes,
        no: votes.no,
        abstain: votes.abstain,
      },
      "two_thirds"
    );

    const adopted = majorityResult.adopted;

    // Update BCP status
    await db
      .update(governanceAmendments)
      .set({
        status: adopted ? "adopted" : "rejected",
        votedAt: new Date(),
        voteResult: {
          yes: votes.yes,
          no: votes.no,
          abstain: votes.abstain,
          required: majorityResult.threshold,
          method: "two_thirds",
          adopted,
        },
        updatedAt: new Date(),
      })
      .where(eq(governanceAmendments.id, bcpId));

    // Record decision
    const year = new Date().getFullYear();
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(governanceDecisions)
      .where(sql`YEAR(${governanceDecisions.decidedAt}) = ${year}`);
    const decisionSequence = (countResult?.count ?? 0) + 1;
    const decisionId = `DEC-${year}-NGA-${String(decisionSequence).padStart(3, "0")}`;

    await recordDecision({
      decisionId,
      type: adopted ? "bcp_adopted" : "bcp_rejected",
      title: `BCP: ${bcp.title}`,
      description: bcp.description ?? undefined,
      amendmentId: bcpId,
      proposedByType: bcp.proposedByType ?? undefined,
      proposedById: bcp.proposedById ?? undefined,
      voteResult: {
        yes: votes.yes,
        no: votes.no,
        abstain: votes.abstain,
        invalid: 0,
        totalEligible: votes.totalEligible,
        quorumMet: true,
        threshold: majorityResult.threshold,
        method: "two_thirds",
        adopted,
      },
      decidedAt: new Date(),
    });

    await logAuditEvent({
      action: adopted ? "governance.bcp_adopted" : "governance.bcp_rejected",
      entityType: "governance_amendment",
      entityId: bcpId,
      after: {
        decisionId,
        adopted,
        votes: { yes: votes.yes, no: votes.no, abstain: votes.abstain },
        calculation: majorityResult.calculation,
      },
    });

    console.log(`[BCP] ${bcp.proposalId}: ${adopted ? "ADOPTED" : "REJECTED"} (${majorityResult.calculation})`);
    return { adopted, decisionId };
  } catch (error) {
    console.error("[BCP] Failed to vote:", error);
    return null;
  }
}

// ============================================================================
// BCP Activation
// ============================================================================

/**
 * Activate an adopted BCP (make it effective).
 * B-17.2.7: Changes effective immediately after NGA (unless specified)
 */
export async function activateBCP(
  bcpId: number,
  effectiveDate?: Date
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [bcp] = await db
      .select()
      .from(governanceAmendments)
      .where(eq(governanceAmendments.id, bcpId))
      .limit(1);

    if (!bcp) return false;

    // Must be adopted
    if (bcp.status !== "adopted") {
      console.warn(`[BCP] Cannot activate BCP in status "${bcp.status}"`);
      return false;
    }

    const effectiveAt = effectiveDate ?? new Date();

    // 1. Supersede affected clauses
    for (const clauseId of (bcp.affectedClauses as string[]) ?? []) {
      await supersedeClause(clauseId, bcp.documentId, bcp.proposedText ?? "", effectiveAt);
    }

    // 2. Update BCP status
    await db
      .update(governanceAmendments)
      .set({
        status: "effective",
        effectiveAt,
        updatedAt: new Date(),
      })
      .where(eq(governanceAmendments.id, bcpId));

    await logAuditEvent({
      action: "governance.bcp_activated",
      entityType: "governance_amendment",
      entityId: bcpId,
      after: { effectiveAt, affectedClauses: bcp.affectedClauses },
    });

    console.log(`[BCP] ${bcp.proposalId}: Activated effective ${effectiveAt.toISOString()}`);
    return true;
  } catch (error) {
    console.error("[BCP] Failed to activate:", error);
    return false;
  }
}

/**
 * Supersede a clause with new text.
 */
async function supersedeClause(
  clauseIdentifier: string,
  documentId: number,
  newContent: string,
  effectiveAt: Date
): Promise<void> {
  const db = getDb();
  if (!db) return;

  // Find the current active clause
  const [currentClause] = await db
    .select()
    .from(governanceClauses)
    .where(
      and(
        eq(governanceClauses.documentId, documentId),
        eq(governanceClauses.clauseId, clauseIdentifier),
        eq(governanceClauses.status, "active")
      )
    )
    .limit(1);

  if (!currentClause) {
    console.warn(`[BCP] Clause "${clauseIdentifier}" not found for supersession`);
    return;
  }

  // Get next version number
  const [maxVersion] = await db
    .select({ maxVersion: governanceClauses.version })
    .from(governanceClauses)
    .where(eq(governanceClauses.clauseId, clauseIdentifier))
    .orderBy(desc(governanceClauses.version))
    .limit(1);

  const nextVersion = (maxVersion?.maxVersion ?? 0) + 1;

  // Mark current clause as superseded
  await db
    .update(governanceClauses)
    .set({
      status: "superseded",
      effectiveUntil: effectiveAt,
      updatedAt: new Date(),
    })
    .where(eq(governanceClauses.id, currentClause.id));

  // Create new clause version
  const [newClauseResult] = await db.insert(governanceClauses).values({
    documentId,
    clauseId: clauseIdentifier,
    title: currentClause.title,
    content: newContent,
    section: currentClause.section,
    subsection: currentClause.subsection,
    clauseNumber: currentClause.clauseNumber,
    version: nextVersion,
    status: "active",
    effectiveFrom: effectiveAt,
    supersededByClauseId: undefined,
    sourcePage: currentClause.sourcePage,
  });

  const newClauseId = Number((newClauseResult as any)[0].insertId);

  // Update the superseded clause to point to the new one
  await db
    .update(governanceClauses)
    .set({ supersededByClauseId: newClauseId })
    .where(eq(governanceClauses.id, currentClause.id));

  console.log(`[BCP] Clause "${clauseIdentifier}" superseded: v${currentClause.version} → v${nextVersion}`);
}

// ============================================================================
// BCP Withdrawal
// ============================================================================

/**
 * Withdraw a BCP.
 */
export async function withdrawBCP(
  bcpId: number,
  userId: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [bcp] = await db
      .select()
      .from(governanceAmendments)
      .where(eq(governanceAmendments.id, bcpId))
      .limit(1);

    if (!bcp) return false;

    // Only the proposer can withdraw
    if (bcp.proposedById !== userId) {
      console.warn("[BCP] Only the proposer can withdraw a BCP");
      return false;
    }

    // Cannot withdraw if already voted on
    if (["adopted", "rejected", "effective"].includes(bcp.status)) {
      console.warn(`[BCP] Cannot withdraw BCP in status "${bcp.status}"`);
      return false;
    }

    await db
      .update(governanceAmendments)
      .set({
        status: "withdrawn",
        updatedAt: new Date(),
      })
      .where(eq(governanceAmendments.id, bcpId));

    await logAuditEvent({
      userId,
      action: "governance.bcp_withdrawn",
      entityType: "governance_amendment",
      entityId: bcpId,
    });

    return true;
  } catch (error) {
    console.error("[BCP] Failed to withdraw:", error);
    return false;
  }
}

// ============================================================================
// BCP Status Query
// ============================================================================

/**
 * Get BCP status with validation info.
 */
export async function getBCPStatus(
  bcpId: number
): Promise<BCPStatusResult | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [bcp] = await db
      .select()
      .from(governanceAmendments)
      .where(eq(governanceAmendments.id, bcpId))
      .limit(1);

    if (!bcp) return null;

    const editableStatuses = ["draft", "submitted"];
    const votableStatuses = ["agenda_placed", "debating"];
    const withdrawableStatuses = ["draft", "submitted", "under_review", "agenda_placed"];

    let deadlinePassed = false;
    let daysUntilDeadline: number | null = null;

    if (bcp.deadline) {
      const now = new Date();
      const deadline = new Date(bcp.deadline);
      daysUntilDeadline = Math.ceil(
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      deadlinePassed = daysUntilDeadline < 0;
    }

    const validationErrors: string[] = [];
    if (!bcp.affectedClauses || (bcp.affectedClauses as string[]).length === 0) {
      validationErrors.push("No affected clauses specified");
    }
    if (!bcp.oldText) {
      validationErrors.push("Old text not provided");
    }
    if (!bcp.proposedText) {
      validationErrors.push("Proposed text not provided");
    }

    return {
      bcp,
      canVote: votableStatuses.includes(bcp.status),
      canEdit: editableStatuses.includes(bcp.status),
      canWithdraw: withdrawableStatuses.includes(bcp.status),
      deadlinePassed,
      daysUntilDeadline,
      validationErrors,
    };
  } catch (error) {
    console.error("[BCP] Failed to get status:", error);
    return null;
  }
}

/**
 * List all BCPs for a document.
 */
export async function listBCPs(
  documentId: number,
  options: { status?: string; limit?: number } = {}
): Promise<any[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const conditions = [eq(governanceAmendments.documentId, documentId)];
    if (options.status) {
      conditions.push(eq(governanceAmendments.status, options.status as any));
    }

    return await db
      .select()
      .from(governanceAmendments)
      .where(and(...conditions))
      .orderBy(desc(governanceAmendments.createdAt))
      .limit(options.limit ?? 50);
  } catch (error) {
    console.error("[BCP] Failed to list:", error);
    return [];
  }
}
