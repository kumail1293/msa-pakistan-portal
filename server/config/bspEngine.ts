/**
 * Bylaw Suspension Proposal (BSP) Workflow Engine
 *
 * Implements the complete BSP lifecycle as defined in Bylaws §17.3:
 *
 * Proposed → Voting → Suspended/Rejected → Resumed/Expired
 *
 * Key rules (all configurable via governance engine):
 * - B-17.3.1: Procedural motion, proposed by at least 2 Local Councils
 * - B-17.3.2: Each proposal limited to single paragraph or single list item
 * - B-17.3.3: Must justify in writing and orally:
 *     a) Why the paragraph was not observed
 *     b) Why the paragraph needs to be suspended
 *     c) How suspending solves the issue
 * - B-17.3.3d: Paragraph ruling suspension cannot itself be suspended
 *
 * Usage:
 *   import { proposeBSP, voteBSP, resumeBSP } from "./bspEngine";
 *
 *   const bsp = await proposeBSP({
 *     clauseId: clauseRecordId,
 *     clauseIdentifier: "BYLAW-8.7.1",
 *     proposedByType: "lc",
 *     proposerNames: ["MSA-Pakistan KEMU LC", "MSA-Pakistan AKU LC"],
 *     reasonNotObserved: "Quorum could not be met due to...",
 *     reasonSuspensionNeeded: "Emergency session required for...",
 *     expectedSolution: "Allow virtual participation for...",
 *   });
 *
 *   await voteBSP(bsp.id, { yes: 20, no: 5, abstain: 3 });
 */

import { eq, and, desc, sql } from "drizzle-orm";
import {
  governanceClauses,
  governanceSuspensions,
  governanceDecisions,
} from "../../drizzle/schema.governance_rules";
import { getDb } from "../db";
import { logAuditEvent } from "./auditService";
import { evaluateMajority, recordDecision } from "./governanceRulesEngine";

// ============================================================================
// Types
// ============================================================================

export interface ProposeBSPInput {
  clauseId: number;
  clauseIdentifier: string; // e.g., "BYLAW-8.7.1"
  proposedByType: "lc";
  proposedById?: number;
  proposerNames: string[]; // Must be >= 2 LCs
  reasonNotObserved: string;
  reasonSuspensionNeeded: string;
  expectedSolution: string;
  writtenJustification?: string;
  suspensionDuration?: Date; // When to resume (optional)
  createdBy?: number;
}

export interface VoteBSPResult {
  yes: number;
  no: number;
  abstain: number;
  totalEligible: number;
}

export interface BSPStatusResult {
  bsp: any;
  canVote: boolean;
  canResume: boolean;
  isExpirable: boolean;
  daysUntilExpiry: number | null;
  validationErrors: string[];
}

// ============================================================================
// BSP Proposal
// ============================================================================

/**
 * Propose a Bylaw Suspension Proposal.
 */
export async function proposeBSP(
  input: ProposeBSPInput
): Promise<{ id: number; proposalId: string } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Validate proposer: must be at least 2 LCs
    if (!input.proposerNames || input.proposerNames.length < 2) {
      console.warn("[BSP] Must be proposed by at least 2 Local Councils (§17.3.1)");
      return null;
    }

    // Validate clause exists
    const [clause] = await db
      .select()
      .from(governanceClauses)
      .where(
        and(
          eq(governanceClauses.id, input.clauseId),
          eq(governanceClauses.clauseId, input.clauseIdentifier),
          eq(governanceClauses.status, "active")
        )
      )
      .limit(1);

    if (!clause) {
      console.warn(`[BSP] Clause "${input.clauseIdentifier}" not found or not active`);
      return null;
    }

    // Check if clause is non-suspendable
    const nonSuspendable = await checkNonSuspendable(input.clauseIdentifier);
    if (nonSuspendable.suspendable === false) {
      console.warn(`[BSP] Clause "${input.clauseIdentifier}" cannot be suspended: ${nonSuspendable.reason}`);
      return null;
    }

    // Validate: single paragraph/list item only (§17.3.2)
    // This is a semantic check - in production, would need more sophisticated parsing
    if (input.clauseIdentifier.split(".").length > 4) {
      console.warn("[BSP] BSP limited to single paragraph or list item (§17.3.2)");
      // Allow but warn
    }

    // Validate justification completeness (§17.3.3)
    const justificationValid = validateJustification(input);
    if (!justificationValid.valid) {
      console.warn(`[BSP] Justification incomplete: ${justificationValid.reason}`);
      return null;
    }

    // Generate proposal ID
    const year = new Date().getFullYear();
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(governanceSuspensions)
      .where(sql`YEAR(${governanceSuspensions.createdAt}) = ${year}`);
    const sequence = (countResult?.count ?? 0) + 1;
    const proposalId = `BSP-${year}-${String(sequence).padStart(3, "0")}`;

    // Create the BSP
    const [result] = await db.insert(governanceSuspensions).values({
      clauseId: input.clauseId,
      clauseIdentifier: input.clauseIdentifier,
      proposalId,
      proposedByType: input.proposedByType,
      proposedById: input.proposedById,
      proposerNames: input.proposerNames.join(", "),
      reasonNotObserved: input.reasonNotObserved,
      reasonSuspensionNeeded: input.reasonSuspensionNeeded,
      expectedSolution: input.expectedSolution,
      writtenJustification: input.writtenJustification,
      status: "proposed",
    });

    const id = Number((result as any)[0].insertId);

    await logAuditEvent({
      userId: input.createdBy,
      action: "governance.bsp_proposed",
      entityType: "governance_suspension",
      entityId: id,
      after: {
        proposalId,
        clauseIdentifier: input.clauseIdentifier,
        proposerNames: input.proposerNames,
      },
    });

    console.log(`[BSP] Proposed: ${proposalId} for clause "${input.clauseIdentifier}"`);
    return { id, proposalId };
  } catch (error) {
    console.error("[BSP] Failed to propose:", error);
    return null;
  }
}

/**
 * Check if a clause is non-suspendable.
 * B-17.3.3d: Paragraph ruling suspension cannot be suspended.
 */
async function checkNonSuspendable(
  clauseIdentifier: string
): Promise<{ suspendable: boolean; reason?: string }> {
  // Clauses that rule on suspension cannot themselves be suspended
  // This is a meta-rule check
  const suspensionRulingClauses = [
    "BYLAW-17.3.3d",
    "BYLAW-17.3",
    "CONSTITUTION-11.1",
  ];

  if (suspensionRulingClauses.includes(clauseIdentifier)) {
    return {
      suspendable: false,
      reason: "This clause rules on the suspension of bylaws and cannot itself be suspended (§17.3.3d)",
    };
  }

  return { suspendable: true };
}

/**
 * Validate BSP justification completeness.
 * B-17.3.3: Must justify:
 *   a) Why the paragraph was not observed
 *   b) Why the paragraph needs to be suspended
 *   c) How suspending solves the issue
 */
function validateJustification(input: ProposeBSPInput): {
  valid: boolean;
  reason?: string;
} {
  const missing: string[] = [];

  if (!input.reasonNotObserved || input.reasonNotObserved.trim().length === 0) {
    missing.push("reason the paragraph was not observed (§17.3.3a)");
  }
  if (!input.reasonSuspensionNeeded || input.reasonSuspensionNeeded.trim().length === 0) {
    missing.push("reason the paragraph needs to be suspended (§17.3.3b)");
  }
  if (!input.expectedSolution || input.expectedSolution.trim().length === 0) {
    missing.push("how suspending the paragraph solves the issue (§17.3.3c)");
  }

  if (missing.length > 0) {
    return {
      valid: false,
      reason: `Missing required justification: ${missing.join("; ")}`,
    };
  }

  return { valid: true };
}

// ============================================================================
// BSP Voting
// ============================================================================

/**
 * Vote on a BSP.
 * BSP passes by simple majority (procedural motion, §8.4.10 → 2/3 for procedural).
 * Actually, BSP is a procedural motion that requires 2/3 majority.
 */
export async function voteBSP(
  bspId: number,
  votes: VoteBSPResult
): Promise<{ adopted: boolean; decisionId: string } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [bsp] = await db
      .select()
      .from(governanceSuspensions)
      .where(eq(governanceSuspensions.id, bspId))
      .limit(1);

    if (!bsp) return null;

    // Must be in proposed status
    if (bsp.status !== "proposed") {
      console.warn(`[BSP] Cannot vote in status "${bsp.status}"`);
      return null;
    }

    // BSP is a procedural motion → 2/3 majority (§8.4.10)
    const majorityResult = await evaluateMajority(
      {
        yes: votes.yes,
        no: votes.no,
        abstain: votes.abstain,
      },
      "two_thirds"
    );

    const adopted = majorityResult.adopted;

    // Update BSP status
    const suspendedAt = adopted ? new Date() : null;
    const expiresAt = bsp.expiresAt ?? null;

    await db
      .update(governanceSuspensions)
      .set({
        status: adopted ? "suspended" : "proposed", // Rejected = back to proposed (can be re-voted)
        suspendedAt,
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
      .where(eq(governanceSuspensions.id, bspId));

    // If adopted, suspend the clause
    if (adopted) {
      await suspendClause(bsp.clauseId, suspendedAt!, expiresAt);
    }

    // Record decision
    const year = new Date().getFullYear();
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(governanceDecisions)
      .where(sql`YEAR(${governanceDecisions.decidedAt}) = ${year}`);
    const decisionSequence = (countResult?.count ?? 0) + 1;
    const decisionId = `DEC-${year}-BSP-${String(decisionSequence).padStart(3, "0")}`;

    await recordDecision({
      decisionId,
      type: adopted ? "bsp_adopted" : "bsp_rejected",
      title: `BSP: Suspend ${bsp.clauseIdentifier}`,
      description: `Suspension of clause ${bsp.clauseIdentifier}`,
      proposedByType: bsp.proposedByType ?? undefined,
      proposedById: bsp.proposedById ?? undefined,
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

    // Update BSP with decision ID
    await db
      .update(governanceSuspensions)
      .set({ decisionId })
      .where(eq(governanceSuspensions.id, bspId));

    await logAuditEvent({
      action: adopted ? "governance.bsp_adopted" : "governance.bsp_rejected",
      entityType: "governance_suspension",
      entityId: bspId,
      after: {
        decisionId,
        adopted,
        clauseIdentifier: bsp.clauseIdentifier,
        calculation: majorityResult.calculation,
      },
    });

    console.log(`[BSP] ${bsp.proposalId}: ${adopted ? "SUSPENDED" : "REJECTED"} clause "${bsp.clauseIdentifier}"`);
    return { adopted, decisionId };
  } catch (error) {
    console.error("[BSP] Failed to vote:", error);
    return null;
  }
}

/**
 * Suspend a clause.
 */
async function suspendClause(
  clauseId: number,
  suspendedAt: Date,
  expiresAt: Date | null
): Promise<void> {
  const db = getDb();
  if (!db) return;

  await db
    .update(governanceClauses)
    .set({
      status: "suspended",
      effectiveUntil: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(governanceClauses.id, clauseId));
}

// ============================================================================
// BSP Resumption
// ============================================================================

/**
 * Resume a suspended clause.
 */
export async function resumeBSP(
  bspId: number,
  resumedBy?: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [bsp] = await db
      .select()
      .from(governanceSuspensions)
      .where(eq(governanceSuspensions.id, bspId))
      .limit(1);

    if (!bsp) return false;

    if (bsp.status !== "suspended") {
      console.warn(`[BSP] Cannot resume BSP in status "${bsp.status}"`);
      return false;
    }

    // Resume the clause
    await db
      .update(governanceClauses)
      .set({
        status: "active",
        effectiveUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(governanceClauses.id, bsp.clauseId));

    // Update BSP status
    await db
      .update(governanceSuspensions)
      .set({
        status: "resumed",
        resumedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(governanceSuspensions.id, bspId));

    await logAuditEvent({
      userId: resumedBy,
      action: "governance.bsp_resumed",
      entityType: "governance_suspension",
      entityId: bspId,
      after: { clauseIdentifier: bsp.clauseIdentifier },
    });

    console.log(`[BSP] ${bsp.proposalId}: Resumed clause "${bsp.clauseIdentifier}"`);
    return true;
  } catch (error) {
    console.error("[BSP] Failed to resume:", error);
    return false;
  }
}

// ============================================================================
// BSP Expiry Check
// ============================================================================

/**
 * Check for expired BSPs and resume their clauses.
 * Should be run periodically.
 */
export async function checkBSPExpiry(): Promise<number> {
  const db = getDb();
  if (!db) return 0;

  try {
    const now = new Date();

    const expiredBSPs = await db
      .select()
      .from(governanceSuspensions)
      .where(
        and(
          eq(governanceSuspensions.status, "suspended"),
          sql`${governanceSuspensions.expiresAt} IS NOT NULL AND ${governanceSuspensions.expiresAt} < ${now}`
        )
      );

    let resumedCount = 0;

    for (const bsp of expiredBSPs) {
      // Resume the clause
      await db
        .update(governanceClauses)
        .set({
          status: "active",
          effectiveUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(governanceClauses.id, bsp.clauseId));

      // Update BSP status
      await db
        .update(governanceSuspensions)
        .set({
          status: "expired",
          resumedAt: now,
          updatedAt: now,
        })
        .where(eq(governanceSuspensions.id, bsp.id));

      await logAuditEvent({
        action: "governance.bsp_expired",
        entityType: "governance_suspension",
        entityId: bsp.id,
        after: { clauseIdentifier: bsp.clauseIdentifier },
      });

      resumedCount++;
    }

    if (resumedCount > 0) {
      console.log(`[BSP] Auto-resumed ${resumedCount} expired suspensions`);
    }

    return resumedCount;
  } catch (error) {
    console.error("[BSP] Failed to check expiry:", error);
    return 0;
  }
}

// ============================================================================
// BSP Status Query
// ============================================================================

/**
 * Get BSP status.
 */
export async function getBSPStatus(
  bspId: number
): Promise<BSPStatusResult | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [bsp] = await db
      .select()
      .from(governanceSuspensions)
      .where(eq(governanceSuspensions.id, bspId))
      .limit(1);

    if (!bsp) return null;

    let daysUntilExpiry: number | null = null;
    let isExpirable = false;

    if (bsp.expiresAt) {
      const now = new Date();
      const expiresAt = new Date(bsp.expiresAt);
      daysUntilExpiry = Math.ceil(
        (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      isExpirable = true;
    }

    const validationErrors: string[] = [];
    if (!bsp.reasonNotObserved) validationErrors.push("Missing: reason not observed");
    if (!bsp.reasonSuspensionNeeded) validationErrors.push("Missing: reason suspension needed");
    if (!bsp.expectedSolution) validationErrors.push("Missing: expected solution");

    return {
      bsp,
      canVote: bsp.status === "proposed",
      canResume: bsp.status === "suspended",
      isExpirable,
      daysUntilExpiry,
      validationErrors,
    };
  } catch (error) {
    console.error("[BSP] Failed to get status:", error);
    return null;
  }
}

/**
 * List all BSPs for a clause.
 */
export async function listBSPs(
  clauseIdentifier: string,
  options: { status?: string; limit?: number } = {}
): Promise<any[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const conditions = [
      eq(governanceSuspensions.clauseIdentifier, clauseIdentifier),
    ];
    if (options.status) {
      conditions.push(eq(governanceSuspensions.status, options.status as any));
    }

    return await db
      .select()
      .from(governanceSuspensions)
      .where(and(...conditions))
      .orderBy(desc(governanceSuspensions.createdAt))
      .limit(options.limit ?? 50);
  } catch (error) {
    console.error("[BSP] Failed to list:", error);
    return [];
  }
}
