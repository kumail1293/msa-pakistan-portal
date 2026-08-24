/**
 * Membership Termination Engine
 * Implements B-6.23: Termination of Membership
 * 
 * Key Rules:
 * - B-6.23.1: Voluntary resignation
 * - B-6.23.2: Conduct-based termination (requires show-cause + judging panel)
 * - B-6.23.3: Non-payment of dues
 * - B-6.23.4: Prolonged inactivity
 * - B-6.23.5: Disciplinary action
 * - Due process: show-cause notice, response, judging panel, appeal
 * - Only the EB can decide on termination
 * - Appeal process available
 */

import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import { getConfigNumber } from "./configService";
import {
  membershipTerminations,
  type MembershipTermination,
  type InsertMembershipTermination,
} from "../../drizzle/schema.proxy_oath_termination";

// ============================================================================
// TYPES
// ============================================================================

export interface TerminationInitiationRequest {
  userId: number;
  organizationId?: number;
  type: "voluntary_resignation" | "conduct_based" | "non_payment" | "inactivity" | "disciplinary";
  initiatedBy?: number;
  reason: string;
  evidence?: string[];
}

export interface ShowCauseResponse {
  terminationId: number;
  response: string;
  evidence?: string[];
}

export interface JudgingPanelDecision {
  terminationId: number;
  panelMemberIds: number[];
  decision: "terminate" | "warn" | "suspend" | "dismiss";
  reason: string;
}

export interface AppealRequest {
  terminationId: number;
  grounds: string;
  appealPanelMemberIds: number[];
}

export interface AppealDecision {
  terminationId: number;
  decision: "upheld" | "reversed" | "modified";
  reason: string;
}

// ============================================================================
// MEMBERSHIP TERMINATION ENGINE
// ============================================================================

export const membershipTerminationEngine = {
  // ------------------------------------------------------------------
  // INITIATE TERMINATION (B-6.23)
  // ------------------------------------------------------------------
  initiateTermination: async (request: TerminationInitiationRequest): Promise<MembershipTermination> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const now = new Date();
    
    // For voluntary resignation, skip show-cause
    const initialStatus = request.type === "voluntary_resignation"
      ? "judging_panel_assigned"
      : "initiated";

    const termination: InsertMembershipTermination = {
      userId: request.userId,
      organizationId: request.organizationId,
      type: request.type,
      initiatedBy: request.initiatedBy,
      initiationReason: request.reason,
      initiationEvidence: request.evidence ?? [],
      status: initialStatus,
      initiatedAt: now,
      metadata: { initiatedByType: "manual" },
    };

    const [result] = await db
      .insert(membershipTerminations)
      .values(termination);

    const [inserted] = await db
      .select()
      .from(membershipTerminations)
      .where(eq(membershipTerminations.id, Number(result.insertId)))
      .limit(1);

    return inserted;
  },

  // ------------------------------------------------------------------
  // ISSUE SHOW-CAUSE NOTICE (B-6.23.2)
  // ------------------------------------------------------------------
  issueShowCause: async (
    terminationId: number,
    deadline: Date
  ): Promise<MembershipTermination> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const termination = await getTerminationOrThrow(terminationId);

    if (termination.status !== "initiated") {
      throw new Error(`Cannot issue show-cause in status '${termination.status}'. Expected 'initiated'.`);
    }

    if (termination.type === "voluntary_resignation") {
      throw new Error("Show-cause is not applicable for voluntary resignation.");
    }

    await db
      .update(membershipTerminations)
      .set({
        status: "show_cause_issued",
        showCauseIssuedAt: new Date(),
        showCauseDeadline: deadline,
      })
      .where(eq(membershipTerminations.id, terminationId));

    const [updated] = await db
      .select()
      .from(membershipTerminations)
      .where(eq(membershipTerminations.id, terminationId))
      .limit(1);

    return updated;
  },

  // ------------------------------------------------------------------
  // SUBMIT SHOW-CAUSE RESPONSE
  // ------------------------------------------------------------------
  submitShowCauseResponse: async (request: ShowCauseResponse): Promise<MembershipTermination> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const termination = await getTerminationOrThrow(request.terminationId);

    if (termination.status !== "show_cause_issued") {
      throw new Error(`Cannot submit show-cause response in status '${termination.status}'.`);
    }

    const now = new Date();
    if (termination.showCauseDeadline && now > termination.showCauseDeadline) {
      throw new Error("Show-cause response deadline has passed.");
    }

    await db
      .update(membershipTerminations)
      .set({
        status: "show_cause_response_received",
        showCauseResponse: request.response,
        showCauseResponseAt: now,
      })
      .where(eq(membershipTerminations.id, request.terminationId));

    const [updated] = await db
      .select()
      .from(membershipTerminations)
      .where(eq(membershipTerminations.id, request.terminationId))
      .limit(1);

    return updated;
  },

  // ------------------------------------------------------------------
  // ASSIGN JUDGING PANEL
  // ------------------------------------------------------------------
  assignJudgingPanel: async (
    terminationId: number,
    panelMemberIds: number[]
  ): Promise<MembershipTermination> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const termination = await getTerminationOrThrow(terminationId);

    if (!["initiated", "show_cause_response_received"].includes(termination.status)) {
      throw new Error(`Cannot assign judging panel in status '${termination.status}'.`);
    }

    await db
      .update(membershipTerminations)
      .set({
        status: "judging_panel_assigned",
        judgingPanelMemberIds: panelMemberIds,
      })
      .where(eq(membershipTerminations.id, terminationId));

    const [updated] = await db
      .select()
      .from(membershipTerminations)
      .where(eq(membershipTerminations.id, terminationId))
      .limit(1);

    return updated;
  },

  // ------------------------------------------------------------------
  // JUDGING PANEL DECISION (B-6.23.2)
  // ------------------------------------------------------------------
  submitJudgingPanelDecision: async (decision: JudgingPanelDecision): Promise<MembershipTermination> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const termination = await getTerminationOrThrow(decision.terminationId);

    if (!["judging_panel_assigned", "judging_panel_hearing"].includes(termination.status)) {
      throw new Error(`Cannot submit panel decision in status '${termination.status}'.`);
    }

    await db
      .update(membershipTerminations)
      .set({
        status: "judging_panel_decision",
        judgingPanelMemberIds: decision.panelMemberIds,
        judgingPanelDecisionAt: new Date(),
        judgingPanelDecision: decision.decision,
        judgingPanelReason: decision.reason,
      })
      .where(eq(membershipTerminations.id, decision.terminationId));

    // If decision is "dismiss" (no termination), auto-finalize
    if (decision.decision === "dismiss") {
      await db
        .update(membershipTerminations)
        .set({
          status: "finalized",
          finalizedAt: new Date(),
          effectiveDate: new Date(),
        })
        .where(eq(membershipTerminations.id, decision.terminationId));
    }

    const [updated] = await db
      .select()
      .from(membershipTerminations)
      .where(eq(membershipTerminations.id, decision.terminationId))
      .limit(1);

    return updated;
  },

  // ------------------------------------------------------------------
  // FILE APPEAL (B-6.23.3)
  // ------------------------------------------------------------------
  fileAppeal: async (request: AppealRequest): Promise<MembershipTermination> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const termination = await getTerminationOrThrow(request.terminationId);

    if (termination.status !== "judging_panel_decision") {
      throw new Error(`Cannot file appeal in status '${termination.status}'.`);
    }

    if (!termination.appealEligible) {
      throw new Error("This termination is not eligible for appeal.");
    }

    if (termination.judgingPanelDecisionAt) {
      const appealDeadlineDays = await getConfigNumber("member.appealDeadlineDays", 7);
      const deadline = new Date(termination.judgingPanelDecisionAt);
      deadline.setDate(deadline.getDate() + appealDeadlineDays);
      if (new Date() > deadline) {
        throw new Error(`Appeal deadline has passed (${appealDeadlineDays} days from panel decision).`);
      }
    }

    await db
      .update(membershipTerminations)
      .set({
        status: "appeal_pending",
        appealFiledAt: new Date(),
        appealGrounds: request.grounds,
        appealPanelMemberIds: request.appealPanelMemberIds,
      })
      .where(eq(membershipTerminations.id, request.terminationId));

    const [updated] = await db
      .select()
      .from(membershipTerminations)
      .where(eq(membershipTerminations.id, request.terminationId))
      .limit(1);

    return updated;
  },

  // ------------------------------------------------------------------
  // APPEAL DECISION
  // ------------------------------------------------------------------
  submitAppealDecision: async (decision: AppealDecision): Promise<MembershipTermination> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const termination = await getTerminationOrThrow(decision.terminationId);

    if (termination.status !== "appeal_pending" && termination.status !== "appeal_hearing") {
      throw new Error(`Cannot submit appeal decision in status '${termination.status}'.`);
    }

    await db
      .update(membershipTerminations)
      .set({
        status: "appeal_decision",
        appealDecisionAt: new Date(),
        appealDecision: decision.decision,
        appealReason: decision.reason,
      })
      .where(eq(membershipTerminations.id, decision.terminationId));

    const [updated] = await db
      .select()
      .from(membershipTerminations)
      .where(eq(membershipTerminations.id, decision.terminationId))
      .limit(1);

    return updated;
  },

  // ------------------------------------------------------------------
  // FINALIZE TERMINATION
  // ------------------------------------------------------------------
  finalizeTermination: async (
    terminationId: number,
    effectiveDate?: Date
  ): Promise<MembershipTermination> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const termination = await getTerminationOrThrow(terminationId);

    if (!["appeal_decision", "judging_panel_decision"].includes(termination.status)) {
      throw new Error(`Cannot finalize in status '${termination.status}'.`);
    }

    await db
      .update(membershipTerminations)
      .set({
        status: "finalized",
        finalizedAt: new Date(),
        effectiveDate: effectiveDate ?? new Date(),
      })
      .where(eq(membershipTerminations.id, terminationId));

    const [updated] = await db
      .select()
      .from(membershipTerminations)
      .where(eq(membershipTerminations.id, terminationId))
      .limit(1);

    return updated;
  },

  // ------------------------------------------------------------------
  // REVERSE TERMINATION
  // ------------------------------------------------------------------
  reverseTermination: async (
    terminationId: number,
    reversedBy: number,
    reason: string
  ): Promise<MembershipTermination> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const termination = await getTerminationOrThrow(terminationId);

    if (termination.status !== "finalized") {
      throw new Error(`Can only reverse finalized terminations. Current status: '${termination.status}'.`);
    }

    await db
      .update(membershipTerminations)
      .set({
        status: "reversed",
        reversedAt: new Date(),
        reversedBy,
        reversalReason: reason,
      })
      .where(eq(membershipTerminations.id, terminationId));

    const [updated] = await db
      .select()
      .from(membershipTerminations)
      .where(eq(membershipTerminations.id, terminationId))
      .limit(1);

    return updated;
  },

  // ------------------------------------------------------------------
  // GET TERMINATION BY ID
  // ------------------------------------------------------------------
  getTermination: async (id: number): Promise<MembershipTermination | undefined> => {
    const db = getDb();
    if (!db) return undefined;

    return db
      .select()
      .from(membershipTerminations)
      .where(eq(membershipTerminations.id, id))
      .then((rows) => rows[0]);
  },

  // ------------------------------------------------------------------
  // GET TERMINATIONS FOR USER
  // ------------------------------------------------------------------
  getTerminationsForUser: async (userId: number): Promise<MembershipTermination[]> => {
    const db = getDb();
    if (!db) return [];

    return db
      .select()
      .from(membershipTerminations)
      .where(eq(membershipTerminations.userId, userId));
  },

  // ------------------------------------------------------------------
  // GET PENDING TERMINATIONS
  // ------------------------------------------------------------------
  getPendingTerminations: async (organizationId?: number): Promise<MembershipTermination[]> => {
    const db = getDb();
    if (!db) return [];

    const conditions = [
      sql`${membershipTerminations.status} NOT IN ('finalized', 'reversed', 'dismissed')`,
    ];

    if (organizationId) {
      conditions.push(eq(membershipTerminations.organizationId, organizationId));
    }

    return db
      .select()
      .from(membershipTerminations)
      .where(and(...conditions));
  },

  // ------------------------------------------------------------------
  // VALIDATE INITIATION
  // ------------------------------------------------------------------
  validateTerminationInitiation: (type: string, reason: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!reason || reason.trim().length < 10) {
      errors.push("Termination reason must be at least 10 characters.");
    }

    const validTypes = [
      "voluntary_resignation", "conduct_based", "non_payment",
      "inactivity", "disciplinary",
    ];

    if (!validTypes.includes(type)) {
      errors.push(`Invalid termination type: '${type}'.`);
    }

    return { valid: errors.length === 0, errors };
  },

  // ------------------------------------------------------------------
  // GET TERMINATION TIMELINE
  // ------------------------------------------------------------------
  getTerminationTimeline: async (terminationId: number): Promise<Array<{
    timestamp: Date;
    action: string;
    actor?: number;
    details: string;
  }>> => {
    const termination = await getTerminationOrThrow(terminationId);

    const timeline: Array<{
      timestamp: Date;
      action: string;
      actor?: number;
      details: string;
    }> = [
      {
        timestamp: termination.initiatedAt,
        action: "initiated",
        actor: termination.initiatedBy ?? undefined,
        details: `Termination initiated: ${termination.initiationReason}`,
      },
    ];

    if (termination.showCauseIssuedAt) {
      timeline.push({
        timestamp: termination.showCauseIssuedAt,
        action: "show_cause_issued",
        details: "Show-cause notice issued to member.",
      });
    }

    if (termination.showCauseResponseAt) {
      timeline.push({
        timestamp: termination.showCauseResponseAt,
        action: "show_cause_response",
        details: "Member submitted show-cause response.",
      });
    }

    if (termination.judgingPanelDecisionAt) {
      timeline.push({
        timestamp: termination.judgingPanelDecisionAt,
        action: "panel_decision",
        details: `Judging panel decided: ${termination.judgingPanelDecision}. ${termination.judgingPanelReason}`,
      });
    }

    if (termination.appealFiledAt) {
      timeline.push({
        timestamp: termination.appealFiledAt,
        action: "appeal_filed",
        details: `Appeal filed: ${termination.appealGrounds}`,
      });
    }

    if (termination.appealDecisionAt) {
      timeline.push({
        timestamp: termination.appealDecisionAt,
        action: "appeal_decision",
        details: `Appeal decided: ${termination.appealDecision}. ${termination.appealReason}`,
      });
    }

    if (termination.finalizedAt) {
      timeline.push({
        timestamp: termination.finalizedAt,
        action: "finalized",
        details: "Termination finalized.",
      });
    }

    if (termination.reversedAt) {
      timeline.push({
        timestamp: termination.reversedAt,
        action: "reversed",
        actor: termination.reversedBy ?? undefined,
        details: `Termination reversed: ${termination.reversalReason}`,
      });
    }

    return timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  },
};

// ============================================================================
// HELPERS
// ============================================================================

async function getTerminationOrThrow(id: number): Promise<MembershipTermination> {
  const db = getDb();
  if (!db) throw new Error("Database not configured.");

  const termination = await db
    .select()
    .from(membershipTerminations)
    .where(eq(membershipTerminations.id, id))
    .then((rows) => rows[0]);

  if (!termination) {
    throw new Error(`Membership termination ${id} not found.`);
  }

  return termination;
}

export default membershipTerminationEngine;
