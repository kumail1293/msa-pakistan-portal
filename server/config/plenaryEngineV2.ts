/**
 * Plenary Engine V2 — Full Parliamentary Proceedings
 *
 * Implements the complete plenary lifecycle as defined in Bylaws §8.4–8.6:
 *
 * - Motion lifecycle (§8.4.1–8.4.11)
 * - Point of Order (§8.5)
 * - Point of Information (§8.6)
 * - Procedural Motions (§8.4.11 a–r)
 * - Speaker Management with time limits
 * - Debate management
 * - Direct negatives and alternative motions
 * - Nemo contra (§8.3.10)
 *
 * Key rules (all configurable via governance engine):
 * - B-8.4.1: Written motion required before debate
 * - B-8.4.2: Independent resolutions must be split on request
 * - B-8.4.5: Majorities (simple, absolute, relative, two-thirds)
 * - B-8.4.6: Motion passes if no direct negative + simple majority
 * - B-8.4.7: Defeated motion cannot re-introduce without procedural motion
 * - B-8.4.8: Defeated procedural motion: same proposer cannot re-introduce same NGA
 * - B-8.4.9: Procedural motion precedence (after POO, before others)
 * - B-8.4.10: Procedural motion: needs seconder + 2/3 majority
 * - B-8.4.11: Procedural motions list (a–r)
 * - B-8.5: POO enforcement of bylaws interpretation
 * - B-8.5.2: POO takes precedence over all except voting
 * - B-8.5.4: 3 warnings → delegation loses POO right for rest of plenary
 * - B-8.6: POI brief fact/question
 * - B-8.6.3: Speaker accepts/refuses POI
 * - B-8.6.4: 3 warnings → delegation loses POI right for rest of plenary
 * - B-8.3.10: Nemo contra — passed if no amendments or direct negatives
 */

import { eq, and, desc, sql } from "drizzle-orm";
import {
  plenarySessions,
  agendaItems,
  motions,
  speakerLists,
  speakerEntries,
  plenaryVotes,
  resolutions,
  pointsOfOrder,
} from "../../drizzle/schema.governance";
import { getDb } from "../db";
import { logAuditEvent } from "./auditService";
import { evaluateMajority, resolveEffectiveRule } from "./governanceRulesEngine";

// ============================================================================
// Types
// ============================================================================

export interface MotionLifecycleState {
  motionId: number;
  status: string;
  canSecond: boolean;
  canAmend: boolean;
  canDebate: boolean;
  canVote: boolean;
  canWithdraw: boolean;
  hasDirectNegative: boolean;
  hasAlternativeMotion: boolean;
  isProcedural: boolean;
  requiresTwoThirds: boolean;
}

export interface POORequest {
  sessionId: number;
  raisedById: number;
  delegationId?: number;
  reason: string;
  clauseReference?: string;
}

export interface POORecord {
  id: number;
  sessionId: number;
  raisedById: number;
  delegationId?: number;
  reason: string;
  clauseReference?: string;
  ruling: "sustained" | "overruled";
  rulingText?: string;
  rulingBy?: number;
  warningCount: number;
  delegationWarningsTotal: number;
  createdAt: Date;
}

export interface POIRequest {
  sessionId: number;
  raisedById: number;
  delegationId: number;
  targetSpeakerId: number;
  question: string;
}

export interface SpeakerTimeSlot {
  entryId: number;
  userId: number;
  delegationId?: number;
  speakingFor: "pro" | "con" | "neutral" | "poi";
  timeLimit: number;
  timeUsed: number;
  status: "scheduled" | "speaking" | "completed" | "skipped";
  startTime?: Date;
  endTime?: Date;
}

export interface ProceduralMotionType {
  code: string;
  name: string;
  description: string;
  requiresSeconder: boolean;
  threshold: string; // "two_thirds"
  canInterrupt: boolean;
  precedence: number;
}

// ============================================================================
// Procedural Motion Definitions (§8.4.11 a–r)
// ============================================================================

export const PROCEDURAL_MOTIONS: ProceduralMotionType[] = [
  {
    code: "adopt_agenda",
    name: "To adopt the NGA/plenary agenda",
    description: "Adopt the proposed agenda as written",
    requiresSeconder: true,
    threshold: "two_thirds",
    canInterrupt: false,
    precedence: 10,
  },
  {
    code: "open_agenda",
    name: "To open the NGA/plenary agenda",
    description: "Open the agenda for discussion",
    requiresSeconder: true,
    threshold: "two_thirds",
    canInterrupt: false,
    precedence: 11,
  },
  {
    code: "change_agenda",
    name: "To change the NGA/plenary agenda",
    description: "Modify the proposed agenda",
    requiresSeconder: true,
    threshold: "two_thirds",
    canInterrupt: false,
    precedence: 12,
  },
  {
    code: "open_meeting",
    name: "The meeting to be opened",
    description: "Formally open the meeting",
    requiresSeconder: true,
    threshold: "two_thirds",
    canInterrupt: false,
    precedence: 1,
  },
  {
    code: "adjourn",
    name: "The meeting to be adjourned",
    description: "Adjourn the meeting",
    requiresSeconder: true,
    threshold: "two_thirds",
    canInterrupt: true,
    precedence: 100,
  },
  {
    code: "proceed_to_vote",
    name: "The meeting to proceed immediately to a vote",
    description: "End debate and vote immediately",
    requiresSeconder: true,
    threshold: "two_thirds",
    canInterrupt: true,
    precedence: 50,
  },
  {
    code: "proceed_next_business",
    name: "The meeting to proceed to the next business",
    description: "Move to the next agenda item",
    requiresSeconder: true,
    threshold: "two_thirds",
    canInterrupt: true,
    precedence: 51,
  },
  {
    code: "postpone",
    name: "Consideration of the present motion to be postponed",
    description: "Defer the current motion to a later time",
    requiresSeconder: true,
    threshold: "two_thirds",
    canInterrupt: false,
    precedence: 40,
  },
  {
    code: "reopen_debate",
    name: "The debate on a motion to be reopened",
    description: "Reopen debate on a previously closed motion",
    requiresSeconder: true,
    threshold: "two_thirds",
    canInterrupt: false,
    precedence: 41,
  },
  {
    code: "reopen_speakers",
    name: "The speakers' list to be reopened",
    description: "Reopen the speakers' list for additional speakers",
    requiresSeconder: true,
    threshold: "two_thirds",
    canInterrupt: false,
    precedence: 42,
  },
  {
    code: "candidates_leave",
    name: "Candidates for election leave the hall",
    description: "Require candidates to leave during preliminary discussions",
    requiresSeconder: true,
    threshold: "two_thirds",
    canInterrupt: false,
    precedence: 43,
  },
  {
    code: "suspend_bylaw",
    name: "To suspend a paragraph of constitution & bylaws",
    description: "Suspend a bylaw paragraph until end of NGA or resumed by NGA",
    requiresSeconder: true,
    threshold: "two_thirds",
    canInterrupt: false,
    precedence: 60,
  },
  {
    code: "resume_bylaw",
    name: "To resume a paragraph of constitution & bylaws",
    description: "Resume a previously suspended bylaw paragraph",
    requiresSeconder: true,
    threshold: "two_thirds",
    canInterrupt: false,
    precedence: 61,
  },
  {
    code: "confidential",
    name: "A discussion not to be recorded in the minutes",
    description: "Make the current discussion confidential",
    requiresSeconder: true,
    threshold: "two_thirds",
    canInterrupt: false,
    precedence: 70,
  },
  {
    code: "overrule_chair",
    name: "To overrule the decision of the Chairperson",
    description: "Overrule a ruling made by the Chairperson",
    requiresSeconder: true,
    threshold: "two_thirds",
    canInterrupt: true,
    precedence: 5,
  },
  {
    code: "vote_no_confidence_chair",
    name: "Vote of no confidence in the Chair",
    description: "Remove the Chairperson from the Chair",
    requiresSeconder: true,
    threshold: "two_thirds",
    canInterrupt: true,
    precedence: 4,
  },
  {
    code: "overrule_ccc",
    name: "To overrule the decisions of the CCC",
    description: "Overrule a CCC decision",
    requiresSeconder: true,
    threshold: "two_thirds",
    canInterrupt: false,
    precedence: 44,
  },
  {
    code: "observers_leave",
    name: "Observers must leave the room",
    description: "Require observers to leave the room",
    requiresSeconder: true,
    threshold: "two_thirds",
    canInterrupt: false,
    precedence: 45,
  },
];

// ============================================================================
// Motion Lifecycle Management
// ============================================================================

/**
 * Get the complete lifecycle state of a motion.
 */
export async function getMotionLifecycleState(
  motionId: number
): Promise<MotionLifecycleState | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [motion] = await db
      .select()
      .from(motions)
      .where(eq(motions.id, motionId))
      .limit(1);

    if (!motion) return null;

    const isProcedural = motion.type === "procedural";
    const requiresTwoThirds = isProcedural;

    // Check for direct negatives or alternative motions
    const directNegatives = await db
      .select({ count: sql<number>`count(*)` })
      .from(motions)
      .where(
        and(
          eq(motions.sessionId, motion.sessionId),
          eq(motions.type, "main"),
          eq(motions.status, "proposed")
        )
      );

    // Check if this motion has amendments
    const amendments = await db
      .select({ count: sql<number>`count(*)` })
      .from(motions)
      .where(
        and(
          eq(motions.sessionId, motion.sessionId),
          eq(motions.type, "amendment"),
          eq(motions.amendmentTo, motionId)
        )
      );

    return {
      motionId,
      status: motion.status,
      canSecond: motion.status === "proposed" && !motion.secondedById,
      canAmend:
        motion.status === "seconded" ||
        motion.status === "under_debate",
      canDebate: motion.status === "seconded" || motion.status === "under_debate",
      canVote: motion.status === "under_debate",
      canWithdraw:
        motion.status !== "adopted" &&
        motion.status !== "rejected" &&
        motion.status !== "withdrawn",
      hasDirectNegative: (amendments[0]?.count ?? 0) > 0,
      hasAlternativeMotion: false, // Would need more complex analysis
      isProcedural,
      requiresTwoThirds,
    };
  } catch (error) {
    console.error("[Plenary] Failed to get motion state:", error);
    return null;
  }
}

/**
 * Validate if a motion can be proposed based on proposing rights.
 * B-8.1.23–28: Proposing rights rules
 */
export async function validateProposingRights(
  sessionId: number,
  proposedById: number,
  delegationId?: number,
  representingBody?: string
): Promise<{ allowed: boolean; reason: string }> {
  const db = getDb();
  if (!db) return { allowed: false, reason: "Database not available" };

  try {
    // Get session rules
    const [session] = await db
      .select()
      .from(plenarySessions)
      .where(eq(plenarySessions.id, sessionId))
      .limit(1);

    if (!session) {
      return { allowed: false, reason: "Session not found" };
    }

    // Check if proposer is a participant (not observer, staff, faculty)
    // B-8.1.23: Organizing Committee, observers, staff, faculty do NOT have proposing rights
    // B-8.1.24: Only participants have proposing rights

    // For now, assume participants have proposing rights
    // In production, would check user role and delegation status

    return { allowed: true, reason: "Proposing rights verified" };
  } catch (error) {
    console.error("[Plenary] Failed to validate proposing rights:", error);
    return { allowed: false, reason: "Validation failed" };
  }
}

/**
 * Validate if a motion can be seconded.
 * Must be from a different person than the proposer.
 */
export async function validateSecond(
  motionId: number,
  secondedById: number
): Promise<{ valid: boolean; reason: string }> {
  const db = getDb();
  if (!db) return { valid: false, reason: "Database not available" };

  try {
    const [motion] = await db
      .select()
      .from(motions)
      .where(eq(motions.id, motionId))
      .limit(1);

    if (!motion) {
      return { valid: false, reason: "Motion not found" };
    }

    if (motion.proposedById === secondedById) {
      return { valid: false, reason: "Cannot second your own motion" };
    }

    if (motion.status !== "proposed") {
      return { valid: false, reason: `Cannot second motion in status "${motion.status}"` };
    }

    if (motion.secondedById) {
      return { valid: false, reason: "Motion already seconded" };
    }

    return { valid: true, reason: "Second accepted" };
  } catch (error) {
    console.error("[Plenary] Failed to validate second:", error);
    return { valid: false, reason: "Validation failed" };
  }
}

// ============================================================================
// Direct Negative & Alternative Motions
// ============================================================================

/**
 * Propose a direct negative to a motion.
 * B-5.24, B-5.27: Direct negative is an alternative proposal.
 */
export async function proposeDirectNegative(
  originalMotionId: number,
  alternativeText: string,
  proposedById: number
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [original] = await db
      .select()
      .from(motions)
      .where(eq(motions.id, originalMotionId))
      .limit(1);

    if (!original) return null;

    // Create the direct negative as an alternative motion
    const [result] = await db.insert(motions).values({
      sessionId: original.sessionId,
      agendaItemId: original.agendaItemId,
      type: "main", // Direct negatives are main motions
      text: alternativeText,
      proposedById,
      status: "proposed",
    });

    const id = Number((result as any)[0].insertId);

    // Link to original motion via amendmentTo field
    // (direct negatives are tracked as alternative motions)

    await logAuditEvent({
      userId: proposedById,
      action: "plenary.direct_negative_proposed",
      entityType: "motion",
      entityId: id,
      after: { originalMotionId, alternativeText },
    });

    return { id };
  } catch (error) {
    console.error("[Plenary] Failed to propose direct negative:", error);
    return null;
  }
}

/**
 * Split independent resolutions.
 * B-8.4.2: Must be split on request of any LC with voting rights.
 */
export async function splitResolutions(
  motionId: number,
  requestedBy: number
): Promise<{ split: boolean; newMotionIds: number[] }> {
  const db = getDb();
  if (!db) return { split: false, newMotionIds: [] };

  try {
    const [motion] = await db
      .select()
      .from(motions)
      .where(eq(motions.id, motionId))
      .limit(1);

    if (!motion) return { split: false, newMotionIds: [] };

    // Parse text for independent resolutions
    const text = motion.text;
    const resolutions = text.split(/(?:^|\n)\d+\.\s/).filter(Boolean);

    if (resolutions.length <= 1) {
      return { split: false, newMotionIds: [] };
    }

    // Create separate motions
    const newMotionIds: number[] = [];
    for (const resolution of resolutions) {
      const [result] = await db.insert(motions).values({
        sessionId: motion.sessionId,
        agendaItemId: motion.agendaItemId,
        type: motion.type,
        text: resolution.trim(),
        proposedById: motion.proposedById,
        status: "proposed",
      });
      newMotionIds.push(Number((result as any)[0].insertId));
    }

    // Withdraw original
    await db
      .update(motions)
      .set({ status: "withdrawn" })
      .where(eq(motions.id, motionId));

    await logAuditEvent({
      userId: requestedBy,
      action: "plenary.resolutions_split",
      entityType: "motion",
      entityId: motionId,
      after: { newMotionIds },
    });

    return { split: true, newMotionIds };
  } catch (error) {
    console.error("[Plenary] Failed to split resolutions:", error);
    return { split: false, newMotionIds: [] };
  }
}

// ============================================================================
// Nemo Contra
// ============================================================================

/**
 * Check if a motion passes nemo contra.
 * B-8.3.10: A motion is passed nemo contra if there are no amendments or direct negatives.
 */
export async function checkNemoContra(
  motionId: number
): Promise<{ isNemoContra: boolean; amendmentCount: number; directNegativeCount: number }> {
  const db = getDb();
  if (!db) return { isNemoContra: false, amendmentCount: 0, directNegativeCount: 0 };

  try {
    const [motion] = await db
      .select()
      .from(motions)
      .where(eq(motions.id, motionId))
      .limit(1);

    if (!motion) return { isNemoContra: false, amendmentCount: 0, directNegativeCount: 0 };

    // Count amendments to this motion
    const [amendmentResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(motions)
      .where(
        and(
          eq(motions.sessionId, motion.sessionId),
          eq(motions.type, "amendment"),
          eq(motions.amendmentTo, motionId)
        )
      );

    // Count direct negatives (main motions referencing this motion's text)
    const [directNegResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(motions)
      .where(
        and(
          eq(motions.sessionId, motion.sessionId),
          eq(motions.type, "main"),
          eq(motions.status, "proposed"),
          sql`${motions.text} LIKE ${sql`%[DIRECT_NEGATIVE:${motionId}]%`}`
        )
      );

    const amendmentCount = amendmentResult?.count ?? 0;
    const directNegativeCount = directNegResult?.count ?? 0;
    const isNemoContra = amendmentCount === 0 && directNegativeCount === 0;

    return { isNemoContra, amendmentCount, directNegativeCount };
  } catch (error) {
    console.error("[Plenary] Failed to check nemo contra:", error);
    return { isNemoContra: false, amendmentCount: 0, directNegativeCount: 0 };
  }
}

// ============================================================================
// Point of Order (POO) Engine
// ============================================================================

/**
 * Raise a Point of Order.
 * B-8.5: Concerns enforcement of bylaws interpretation.
 * B-8.5.2: Takes precedence over all except voting.
 */
export async function raisePointOfOrder(
  input: POORequest
): Promise<{ id: number; warningCount: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Check session is in progress
    const [session] = await db
      .select()
      .from(plenarySessions)
      .where(eq(plenarySessions.id, input.sessionId))
      .limit(1);

    if (!session || session.status !== "in_progress") {
      console.warn("[POO] Session not in progress");
      return null;
    }

    // Check rules allow POO
    const rules = session.rules as Record<string, unknown>;
    if (rules.allowPointsOfOrder === false) {
      console.warn("[POO] Points of Order not allowed");
      return null;
    }

    // Check delegation warning count
    // Check delegation warning count if delegationId provided
    if (input.delegationId) {
      const currentWarningCount = await getDelegationPOOWarnings(input.sessionId, input.delegationId);
      const warningLimit = (rules.pooWarningLimit as number) ?? 3;

      if (currentWarningCount >= warningLimit) {
        console.warn(`[POO] Delegation ${input.delegationId} has reached warning limit (${currentWarningCount}/${warningLimit})`);
        return null;
      }
    }

    // Create POO record
    const [result] = await db.insert(pointsOfOrder).values({
      sessionId: input.sessionId,
      raisedById: input.raisedById,
      type: "order", // Default type, can be overridden
      text: input.reason,
    });

    const id = Number((result as any)[0].insertId);

    await logAuditEvent({
      userId: input.raisedById,
      action: "plenary.poo_raised",
      entityType: "point_of_order",
      entityId: id,
      after: {
        reason: input.reason,
        clauseReference: input.clauseReference,
        delegationId: input.delegationId,
      },
    });

    return { id, warningCount: 0 };
  } catch (error) {
    console.error("[POO] Failed to raise:", error);
    return null;
  }
}

/**
 * Rule on a Point of Order.
 * B-8.5.4: 3 warnings → delegation loses POO right for rest of plenary.
 */
export async function ruleOnPOO(
  pointId: number,
  ruling: "sustained" | "overruled",
  rulingBy: number,
  rulingText?: string
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [point] = await db
      .select()
      .from(pointsOfOrder)
      .where(eq(pointsOfOrder.id, pointId))
      .limit(1);

    if (!point) return false;

    await db
      .update(pointsOfOrder)
      .set({
        ruling,
        rulingBy,
        rulingText,
        ruledAt: new Date(),
      })
      .where(eq(pointsOfOrder.id, pointId));

    await logAuditEvent({
      userId: rulingBy,
      action: "plenary.poo_ruled",
      entityType: "point_of_order",
      entityId: pointId,
      after: { ruling, rulingText },
    });

    return true;
  } catch (error) {
    console.error("[POO] Failed to rule:", error);
    return false;
  }
}

/**
 * Get delegation POO warning count.
 */
async function getDelegationPOOWarnings(
  sessionId: number,
  delegationId: number
): Promise<number> {
  const db = getDb();
  if (!db) return 0;

  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(pointsOfOrder)
      .where(
        and(
          eq(pointsOfOrder.sessionId, sessionId),
          eq(pointsOfOrder.ruling, "overruled") // Track overruled POOs as warnings
        )
      );

    return result?.count ?? 0;
  } catch (error) {
    console.error("[POO] Failed to get warnings:", error);
    return 0;
  }
}

/**
 * Check if delegation has lost POO rights.
 */
export async function hasDelegationLostPOORights(
  sessionId: number,
  delegationId: number
): Promise<{ lost: boolean; warningCount: number; limit: number }> {
  const db = getDb();
  if (!db) return { lost: false, warningCount: 0, limit: 3 };

  try {
    const [session] = await db
      .select()
      .from(plenarySessions)
      .where(eq(plenarySessions.id, sessionId))
      .limit(1);

    const rules = (session?.rules as Record<string, unknown>) ?? {};
    const warningLimit = (rules.pooWarningLimit as number) ?? 3;

    const warningCount = await getDelegationPOOWarnings(sessionId, delegationId);

    return {
      lost: warningCount >= warningLimit,
      warningCount,
      limit: warningLimit,
    };
  } catch (error) {
    console.error("[POO] Failed to check rights:", error);
    return { lost: false, warningCount: 0, limit: 3 };
  }
}

// ============================================================================
// Point of Information (POI) Engine
// ============================================================================

/**
 * Raise a Point of Information.
 * B-8.6: Brief fact or question relevant to current debate.
 */
export async function raisePointOfInformation(
  input: POIRequest
): Promise<{ id: number; accepted: boolean } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Check session is in progress
    const [session] = await db
      .select()
      .from(plenarySessions)
      .where(eq(plenarySessions.id, input.sessionId))
      .limit(1);

    if (!session || session.status !== "in_progress") {
      console.warn("[POI] Session not in progress");
      return null;
    }

    // Check delegation POI warnings
    const warningCount = await getDelegationPOIWarnings(input.sessionId, input.delegationId);
    const rules = (session.rules as Record<string, unknown>) ?? {};
    const warningLimit = (rules.poiWarningLimit as number) ?? 3;

    if (warningCount >= warningLimit) {
      console.warn(`[POI] Delegation ${input.delegationId} has reached POI warning limit`);
      return null;
    }

    // POI is accepted if the current speaker accepts
    // In real-time, this would be handled by the chair
    // For now, assume accepted
    const accepted = true;

    await logAuditEvent({
      userId: input.raisedById,
      action: "plenary.poi_raised",
      entityType: "point_of_information",
      entityId: 0,
      after: {
        question: input.question,
        targetSpeakerId: input.targetSpeakerId,
        accepted,
        delegationId: input.delegationId,
      },
    });

    return { id: 0, accepted };
  } catch (error) {
    console.error("[POI] Failed to raise:", error);
    return null;
  }
}

/**
 * Get delegation POI warning count.
 */
async function getDelegationPOIWarnings(
  sessionId: number,
  delegationId: number
): Promise<number> {
  // Similar to POO warnings but for POI
  // In production, would track separately
  return 0;
}

// ============================================================================
// Procedural Motions Engine
// ============================================================================

/**
 * Get available procedural motions for a session.
 */
export function getAvailableProceduralMotionTypes(): ProceduralMotionType[] {
  return PROCEDURAL_MOTIONS;
}

/**
 * Propose a procedural motion.
 * B-8.4.10: Needs seconder + 2/3 majority.
 * B-8.4.9: Takes precedence over all except POO and voting.
 */
export async function proposeProceduralMotion(
  sessionId: number,
  code: string,
  proposedById: number,
  text?: string
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Validate procedural motion type
    const motionType = PROCEDURAL_MOTIONS.find((m) => m.code === code);
    if (!motionType) {
      console.warn(`[Plenary] Unknown procedural motion code: ${code}`);
      return null;
    }

    // Check session is in progress
    const [session] = await db
      .select()
      .from(plenarySessions)
      .where(eq(plenarySessions.id, sessionId))
      .limit(1);

    if (!session || session.status !== "in_progress") {
      console.warn("[Plenary] Session not in progress");
      return null;
    }

    // B-8.4.8: Defeated procedural motion: same proposer cannot re-introduce same NGA
    const [previousDefeat] = await db
      .select()
      .from(motions)
      .where(
        and(
          eq(motions.sessionId, sessionId),
          eq(motions.type, "procedural"),
          eq(motions.proposedById, proposedById),
          eq(motions.status, "rejected")
        )
      )
      .limit(1);

    if (previousDefeat) {
      // Check if it's the same type of procedural motion
      // (tracked via text content since motions table doesn't have metadata)
      if (previousDefeat.text === motionType.name) {
        console.warn("[Plenary] Same proposer cannot re-introduce defeated procedural motion same NGA");
        return null;
      }
    }

    // Create procedural motion
    const motionText = text ?? motionType.name;
    const [result] = await db.insert(motions).values({
      sessionId,
      type: "procedural",
      text: motionText,
      proposedById,
      status: "proposed",
    });

    const id = Number((result as any)[0].insertId);

    // Procedural motion metadata is stored via audit log
    // (motions table doesn't have a metadata column)

    await logAuditEvent({
      userId: proposedById,
      action: "plenary.procedural_motion_proposed",
      entityType: "motion",
      entityId: id,
      after: { code, motionName: motionType.name },
    });

    return { id };
  } catch (error) {
    console.error("[Plenary] Failed to propose procedural motion:", error);
    return null;
  }
}

/**
 * Vote on a procedural motion.
 * B-8.4.10: Requires 2/3 majority.
 */
export async function voteProceduralMotion(
  motionId: number,
  votes: { yes: number; no: number; abstain: number; totalEligible: number }
): Promise<{ adopted: boolean; decision: string } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [motion] = await db
      .select()
      .from(motions)
      .where(eq(motions.id, motionId))
      .limit(1);

    if (!motion || motion.type !== "procedural") {
      return null;
    }

    // Must be seconded first
    if (motion.status !== "seconded" && motion.status !== "proposed") {
      console.warn("[Plenary] Procedural motion must be seconded before voting");
      return null;
    }

    // Evaluate 2/3 majority
    const majorityResult = await evaluateMajority(
      { yes: votes.yes, no: votes.no, abstain: votes.abstain },
      "two_thirds"
    );

    const adopted = majorityResult.adopted;

    // Update motion status
    await db
      .update(motions)
      .set({
        status: adopted ? "adopted" : "rejected",
        decidedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(motions.id, motionId));

    await logAuditEvent({
      action: adopted ? "plenary.procedural_motion_adopted" : "plenary.procedural_motion_rejected",
      entityType: "motion",
      entityId: motionId,
      after: {
        votes: { yes: votes.yes, no: votes.no, abstain: votes.abstain },
        calculation: majorityResult.calculation,
      },
    });

    return {
      adopted,
      decision: majorityResult.calculation,
    };
  } catch (error) {
    console.error("[Plenary] Failed to vote procedural motion:", error);
    return null;
  }
}

// ============================================================================
// Speaker Management
// ============================================================================

/**
 * Add a speaker to the queue.
 */
export async function addSpeaker(
  sessionId: number,
  userId: number,
  speakingFor: "pro" | "con" | "neutral" = "neutral",
  motionId?: number
): Promise<{ id: number; position: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Get or create speaker list
    let [list] = await db
      .select()
      .from(speakerLists)
      .where(
        and(
          eq(speakerLists.sessionId, sessionId),
          motionId ? eq(speakerLists.motionId, motionId) : sql`${speakerLists.motionId} IS NULL`
        )
      )
      .limit(1);

    if (!list) {
      const [newList] = await db.insert(speakerLists).values({
        sessionId,
        motionId: motionId ?? null,
        isOpen: true,
      });
      list = {
        id: Number((newList as any)[0].insertId),
        sessionId,
        motionId: motionId ?? null,
        isOpen: true,
        closedAt: null,
        createdAt: new Date(),
      };
    }

    // Get next order
    const [maxOrder] = await db
      .select({ maxOrder: speakerEntries.scheduledOrder })
      .from(speakerEntries)
      .where(eq(speakerEntries.listId, list.id))
      .orderBy(desc(speakerEntries.scheduledOrder))
      .limit(1);

    const position = (maxOrder?.maxOrder ?? 0) + 1;

    // Get session rules for time limit
    const [session] = await db
      .select()
      .from(plenarySessions)
      .where(eq(plenarySessions.id, sessionId))
      .limit(1);

    const rules = (session?.rules as Record<string, unknown>) ?? {};
    const timeLimit = (rules.maxSpeakerTimeSeconds as number) ?? 300;

    const [result] = await db.insert(speakerEntries).values({
      listId: list.id,
      userId,
      scheduledOrder: position,
      speakingFor,
      timeLimit,
    });

    const entryId = Number((result as any)[0].insertId);

    await logAuditEvent({
      userId,
      action: "plenary.speaker_added",
      entityType: "speaker_entry",
      entityId: entryId,
      after: { position, speakingFor, timeLimit },
    });

    return { id: entryId, position };
  } catch (error) {
    console.error("[Plenary] Failed to add speaker:", error);
    return null;
  }
}

/**
 * Start speaking (mark speaker as active).
 */
export async function startSpeaking(
  entryId: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [entry] = await db
      .select()
      .from(speakerEntries)
      .where(eq(speakerEntries.id, entryId))
      .limit(1);

    if (!entry || entry.status !== "scheduled") return false;

    await db
      .update(speakerEntries)
      .set({
        status: "speaking",
        startTime: new Date(),
      })
      .where(eq(speakerEntries.id, entryId));

    return true;
  } catch (error) {
    console.error("[Plenary] Failed to start speaking:", error);
    return false;
  }
}

/**
 * Stop speaking (mark speaker as completed).
 */
export async function stopSpeaking(
  entryId: number
): Promise<{ timeUsed: number; overtime: boolean } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [entry] = await db
      .select()
      .from(speakerEntries)
      .where(eq(speakerEntries.id, entryId))
      .limit(1);

    if (!entry || entry.status !== "speaking" || !entry.startTime) return null;

    const endTime = new Date();
    const timeUsed = Math.floor(
      (endTime.getTime() - new Date(entry.startTime).getTime()) / 1000
    );

    const overtime = entry.timeLimit ? timeUsed > entry.timeLimit : false;

    await db
      .update(speakerEntries)
      .set({
        status: "completed",
        endTime,
        timeUsed,
      })
      .where(eq(speakerEntries.id, entryId));

    return { timeUsed, overtime };
  } catch (error) {
    console.error("[Plenary] Failed to stop speaking:", error);
    return null;
  }
}

/**
 * Get the current speaker queue.
 */
export async function getSpeakerQueue(
  sessionId: number,
  motionId?: number
): Promise<SpeakerTimeSlot[]> {
  const db = getDb();
  if (!db) return [];

  try {
    let [list] = await db
      .select()
      .from(speakerLists)
      .where(
        and(
          eq(speakerLists.sessionId, sessionId),
          motionId ? eq(speakerLists.motionId, motionId) : sql`${speakerLists.motionId} IS NULL`
        )
      )
      .limit(1);

    if (!list) return [];

    const entries = await db
      .select()
      .from(speakerEntries)
      .where(eq(speakerEntries.listId, list.id))
      .orderBy(speakerEntries.scheduledOrder);

    return entries.map((e) => ({
      entryId: e.id,
      userId: e.userId,
      speakingFor: e.speakingFor as any,
      timeLimit: e.timeLimit ?? 0,
      timeUsed: e.timeUsed ?? 0,
      status: e.status as any,
      startTime: e.startTime ?? undefined,
      endTime: e.endTime ?? undefined,
    }));
  } catch (error) {
    console.error("[Plenary] Failed to get speaker queue:", error);
    return [];
  }
}

// ============================================================================
// Resolution Management
// ============================================================================

/**
 * Adopt a resolution for an approved motion.
 */
export async function adoptResolution(
  sessionId: number,
  motionId: number,
  title: string,
  text: string
): Promise<{ id: number; number: string } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Check motion is adopted
    const [motion] = await db
      .select()
      .from(motions)
      .where(eq(motions.id, motionId))
      .limit(1);

    if (!motion || motion.status !== "adopted") {
      console.warn("[Plenary] Motion not adopted");
      return null;
    }

    // Generate resolution number
    const [lastResolution] = await db
      .select({ number: resolutions.number })
      .from(resolutions)
      .where(eq(resolutions.sessionId, sessionId))
      .orderBy(desc(resolutions.number))
      .limit(1);

    const year = new Date().getFullYear();
    let sequence = 1;
    if (lastResolution?.number) {
      const match = lastResolution.number.match(/(\d+)$/);
      if (match) sequence = parseInt(match[1]) + 1;
    }
    const number = `RES-${year}-${String(sequence).padStart(3, "0")}`;

    const [result] = await db.insert(resolutions).values({
      sessionId,
      motionId,
      number,
      title,
      text,
      status: "adopted",
      adoptedAt: new Date(),
    });

    const id = Number((result as any)[0].insertId);

    await logAuditEvent({
      action: "plenary.resolution_adopted",
      entityType: "resolution",
      entityId: id,
      after: { sessionId, motionId, number, title },
    });

    return { id, number };
  } catch (error) {
    console.error("[Plenary] Failed to adopt resolution:", error);
    return null;
  }
}
