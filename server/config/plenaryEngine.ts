/**
 * Plenary/Parliamentary Engine
 *
 * Handles institutional proceedings in the style of WHO, UN, IFMSA assemblies.
 * Completely separate from the Elections Engine.
 *
 * Usage:
 *   import { createSession, proposeMotion, castVote, adoptResolution } from "./plenaryEngine";
 *
 *   const session = await createSession({
 *     title: "Annual General Assembly 2025",
 *     type: "annual",
 *     chairId: presidentId,
 *     secretaryId: secretaryId,
 *   });
 *
 *   const motion = await proposeMotion({
 *     sessionId: session.id,
 *     type: "main",
 *     text: "That this assembly approves the annual budget",
 *   });
 *
 *   await castVote({
 *     sessionId: session.id,
 *     motionId: motion.id,
 *     vote: "yes",
 *     voterId: memberId,
 *   });
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

// ============================================================================
// Types
// ============================================================================

export interface CreateSessionInput {
  title: string;
  description?: string;
  type: "regular" | "special" | "emergency" | "annual";
  organizationId?: number;
  scheduledStart: Date;
  scheduledEnd: Date;
  chairId: number;
  secretaryId: number;
  quorumRequired?: number;
  totalEligibleVoters?: number;
  rules?: Partial<ParliamentaryRules>;
  createdById?: number;
}

export interface ParliamentaryRules {
  quorumPercentage: number;
  defaultVotingMethod: string;
  allowedVotingMethods: string[];
  maxSpeakerTimeSeconds: number;
  maxSpeakersPerSide: number;
  allowClosingStatements: boolean;
  allowAmendments: boolean;
  amendmentRequiresSecond: boolean;
  allowClosureOfDebate: boolean;
  allowSuspensionOfRules: boolean;
  allowAdjournment: boolean;
  allowPointsOfOrder: boolean;
  chairRulingBinding: boolean;
  appealAllowed: boolean;
  adoptionThreshold: number;
  amendmentThreshold: number;
  maxSessionDurationHours: number;
  maxDebateTimePerItemMinutes: number;
  requireRollCall: boolean;
  publishMinutes: boolean;
}

export interface ProposeMotionInput {
  sessionId: number;
  agendaItemId?: number;
  type: "main" | "amendment" | "procedural" | "point_of_order" | "closure" | "adjournment";
  text: string;
  proposedById: number;
  amendmentTo?: number;
  amendmentPosition?: "before" | "after" | "replace";
}

export interface CastVoteInput {
  sessionId: number;
  motionId: number;
  voterId: number;
  vote: "yes" | "no" | "abstain";
}

// ============================================================================
// Default Parliamentary Rules
// ============================================================================

export const DEFAULT_PARLIAMENTARY_RULES: ParliamentaryRules = {
  quorumPercentage: 50,
  defaultVotingMethod: "simple_majority",
  allowedVotingMethods: ["simple_majority", "absolute_majority", "two_thirds", "secret_ballot", "roll_call"],
  maxSpeakerTimeSeconds: 300, // 5 minutes
  maxSpeakersPerSide: 5,
  allowClosingStatements: true,
  allowAmendments: true,
  amendmentRequiresSecond: true,
  allowClosureOfDebate: true,
  allowSuspensionOfRules: true,
  allowAdjournment: true,
  allowPointsOfOrder: true,
  chairRulingBinding: true,
  appealAllowed: true,
  adoptionThreshold: 50,
  amendmentThreshold: 50,
  maxSessionDurationHours: 4,
  maxDebateTimePerItemMinutes: 60,
  requireRollCall: false,
  publishMinutes: true,
};

// ============================================================================
// Session Management
// ============================================================================

/**
 * Create a new plenary session.
 */
export async function createSession(
  input: CreateSessionInput
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const rules = { ...DEFAULT_PARLIAMENTARY_RULES, ...input.rules };

    const [result] = await db.insert(plenarySessions).values({
      title: input.title,
      description: input.description,
      type: input.type,
      organizationId: input.organizationId,
      status: "proposed",
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
      chairId: input.chairId,
      secretaryId: input.secretaryId,
      quorumRequired: rules.quorumPercentage,
      totalEligibleVoters: input.totalEligibleVoters,
      rules,
      createdById: input.createdById,
    });

    const sessionId = Number((result as any)[0].insertId);

    await logAuditEvent({
      userId: input.createdById,
      action: "plenary.session_created",
      entityType: "plenary_session",
      entityId: sessionId,
      after: { title: input.title, type: input.type },
    });

    console.log(`[Plenary] Created session "${input.title}" (#${sessionId}).`);
    return { id: sessionId };
  } catch (error) {
    console.error("[Plenary] Failed to create session:", error);
    return null;
  }
}

/**
 * Get session details.
 */
export async function getSession(
  sessionId: number
): Promise<{
  session: any;
  agendaItems: any[];
  motions: any[];
  resolutions: any[];
} | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [session] = await db
      .select()
      .from(plenarySessions)
      .where(eq(plenarySessions.id, sessionId))
      .limit(1);

    if (!session) return null;

    const items = await db
      .select()
      .from(agendaItems)
      .where(eq(agendaItems.sessionId, sessionId))
      .orderBy(agendaItems.order);

    const sessionMotions = await db
      .select()
      .from(motions)
      .where(eq(motions.sessionId, sessionId))
      .orderBy(desc(motions.proposedAt));

    const sessionResolutions = await db
      .select()
      .from(resolutions)
      .where(eq(resolutions.sessionId, sessionId))
      .orderBy(resolutions.number);

    return { session, agendaItems: items, motions: sessionMotions, resolutions: sessionResolutions };
  } catch (error) {
    console.error("[Plenary] Failed to get session:", error);
    return null;
  }
}

/**
 * Start a session.
 */
export async function startSession(
  sessionId: number,
  userId: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [session] = await db
      .select()
      .from(plenarySessions)
      .where(eq(plenarySessions.id, sessionId))
      .limit(1);

    if (!session || session.status !== "scheduled") return false;

    await db
      .update(plenarySessions)
      .set({
        status: "in_progress",
        actualStart: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(plenarySessions.id, sessionId));

    await logAuditEvent({
      userId,
      action: "plenary.session_started",
      entityType: "plenary_session",
      entityId: sessionId,
    });

    return true;
  } catch (error) {
    console.error("[Plenary] Failed to start session:", error);
    return false;
  }
}

/**
 * Adjourn a session.
 */
export async function adjournSession(
  sessionId: number,
  userId: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [session] = await db
      .select()
      .from(plenarySessions)
      .where(eq(plenarySessions.id, sessionId))
      .limit(1);

    if (!session || session.status !== "in_progress") return false;

    await db
      .update(plenarySessions)
      .set({
        status: "adjourned",
        updatedAt: new Date(),
      })
      .where(eq(plenarySessions.id, sessionId));

    await logAuditEvent({
      userId,
      action: "plenary.session_adjourned",
      entityType: "plenary_session",
      entityId: sessionId,
    });

    return true;
  } catch (error) {
    console.error("[Plenary] Failed to adjourn session:", error);
    return false;
  }
}

/**
 * Complete a session.
 */
export async function completeSession(
  sessionId: number,
  userId: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [session] = await db
      .select()
      .from(plenarySessions)
      .where(eq(plenarySessions.id, sessionId))
      .limit(1);

    if (!session) return false;

    await db
      .update(plenarySessions)
      .set({
        status: "completed",
        actualEnd: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(plenarySessions.id, sessionId));

    await logAuditEvent({
      userId,
      action: "plenary.session_completed",
      entityType: "plenary_session",
      entityId: sessionId,
    });

    return true;
  } catch (error) {
    console.error("[Plenary] Failed to complete session:", error);
    return false;
  }
}

// ============================================================================
// Agenda Management
// ============================================================================

/**
 * Add an agenda item to a session.
 */
export async function addAgendaItem(
  sessionId: number,
  title: string,
  proposedById: number,
  options: {
    description?: string;
    type?: string;
    timeAllotted?: number;
  } = {}
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Get next order number
    const [maxOrder] = await db
      .select({ maxOrder: agendaItems.order })
      .from(agendaItems)
      .where(eq(agendaItems.sessionId, sessionId))
      .orderBy(desc(agendaItems.order))
      .limit(1);

    const order = (maxOrder?.maxOrder ?? 0) + 1;

    const [result] = await db.insert(agendaItems).values({
      sessionId,
      order,
      title,
      description: options.description,
      type: (options.type ?? "regular") as any,
      proposedById,
      timeAllotted: options.timeAllotted,
    });

    const itemId = Number((result as any)[0].insertId);

    await logAuditEvent({
      userId: proposedById,
      action: "plenary.agenda_item_added",
      entityType: "agenda_item",
      entityId: itemId,
      after: { sessionId, title, order },
    });

    return { id: itemId };
  } catch (error) {
    console.error("[Plenary] Failed to add agenda item:", error);
    return null;
  }
}

/**
 * Update agenda item status.
 */
export async function updateAgendaItemStatus(
  itemId: number,
  status: string
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .update(agendaItems)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(agendaItems.id, itemId));

    return true;
  } catch (error) {
    console.error("[Plenary] Failed to update agenda item:", error);
    return false;
  }
}

// ============================================================================
// Motion Management
// ============================================================================

/**
 * Propose a motion.
 */
export async function proposeMotion(
  input: ProposeMotionInput
): Promise<{ id: number } | null> {
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
      console.warn("[Plenary] Session is not in progress.");
      return null;
    }

    // Check rules allow this motion type
    const rules = session.rules as ParliamentaryRules;
    if (input.type === "amendment" && !rules.allowAmendments) {
      console.warn("[Plenary] Amendments are not allowed.");
      return null;
    }

    const [result] = await db.insert(motions).values({
      sessionId: input.sessionId,
      agendaItemId: input.agendaItemId,
      type: input.type as any,
      text: input.text,
      proposedById: input.proposedById,
      amendmentTo: input.amendmentTo,
      amendmentPosition: input.amendmentPosition as any,
      status: "proposed",
    });

    const motionId = Number((result as any)[0].insertId);

    await logAuditEvent({
      userId: input.proposedById,
      action: "plenary.motion_proposed",
      entityType: "motion",
      entityId: motionId,
      after: { sessionId: input.sessionId, type: input.type },
    });

    console.log(`[Plenary] Motion proposed (#${motionId}).`);
    return { id: motionId };
  } catch (error) {
    console.error("[Plenary] Failed to propose motion:", error);
    return null;
  }
}

/**
 * Second a motion.
 */
export async function secondMotion(
  motionId: number,
  secondedById: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [motion] = await db
      .select()
      .from(motions)
      .where(eq(motions.id, motionId))
      .limit(1);

    if (!motion || motion.status !== "proposed") return false;
    if (motion.proposedById === secondedById) {
      console.warn("[Plenary] Cannot second your own motion.");
      return false;
    }

    await db
      .update(motions)
      .set({
        secondedById,
        secondedAt: new Date(),
        status: "seconded",
        updatedAt: new Date(),
      })
      .where(eq(motions.id, motionId));

    await logAuditEvent({
      userId: secondedById,
      action: "plenary.motion_seconded",
      entityType: "motion",
      entityId: motionId,
    });

    return true;
  } catch (error) {
    console.error("[Plenary] Failed to second motion:", error);
    return false;
  }
}

/**
 * Start debate on a motion.
 */
export async function startDebate(
  motionId: number,
  userId: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [motion] = await db
      .select()
      .from(motions)
      .where(eq(motions.id, motionId))
      .limit(1);

    if (!motion || motion.status !== "seconded") return false;

    await db
      .update(motions)
      .set({
        status: "under_debate",
        debateStartedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(motions.id, motionId));

    // Create speaker list
    await db.insert(speakerLists).values({
      sessionId: motion.sessionId,
      motionId,
      isOpen: true,
    });

    await logAuditEvent({
      userId,
      action: "plenary.debate_started",
      entityType: "motion",
      entityId: motionId,
    });

    return true;
  } catch (error) {
    console.error("[Plenary] Failed to start debate:", error);
    return false;
  }
}

/**
 * Withdraw a motion.
 */
export async function withdrawMotion(
  motionId: number,
  userId: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [motion] = await db
      .select()
      .from(motions)
      .where(eq(motions.id, motionId))
      .limit(1);

    if (!motion || motion.proposedById !== userId) return false;
    if (motion.status === "adopted" || motion.status === "rejected") return false;

    await db
      .update(motions)
      .set({
        status: "withdrawn",
        updatedAt: new Date(),
      })
      .where(eq(motions.id, motionId));

    await logAuditEvent({
      userId,
      action: "plenary.motion_withdrawn",
      entityType: "motion",
      entityId: motionId,
    });

    return true;
  } catch (error) {
    console.error("[Plenary] Failed to withdraw motion:", error);
    return false;
  }
}

// ============================================================================
// Speaker Management
// ============================================================================

/**
 * Add a speaker to the speaker list.
 */
export async function addSpeaker(
  sessionId: number,
  userId: number,
  speakingFor: "pro" | "con" | "neutral" = "neutral",
  motionId?: number
): Promise<{ id: number } | null> {
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
      list = { id: Number((newList as any)[0].insertId), sessionId, motionId: motionId ?? null, isOpen: true, closedAt: null, createdAt: new Date() };
    }

    // Get next order
    const [maxOrder] = await db
      .select({ maxOrder: speakerEntries.scheduledOrder })
      .from(speakerEntries)
      .where(eq(speakerEntries.listId, list.id))
      .orderBy(desc(speakerEntries.scheduledOrder))
      .limit(1);

    const order = (maxOrder?.maxOrder ?? 0) + 1;

    // Get session rules for time limit
    const [session] = await db
      .select()
      .from(plenarySessions)
      .where(eq(plenarySessions.id, sessionId))
      .limit(1);

    const rules = (session?.rules as ParliamentaryRules) ?? DEFAULT_PARLIAMENTARY_RULES;

    const [result] = await db.insert(speakerEntries).values({
      listId: list.id,
      userId,
      scheduledOrder: order,
      speakingFor,
      timeLimit: rules.maxSpeakerTimeSeconds,
    });

    const entryId = Number((result as any)[0].insertId);
    return { id: entryId };
  } catch (error) {
    console.error("[Plenary] Failed to add speaker:", error);
    return null;
  }
}

/**
 * Start speaking (mark speaker as speaking).
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
): Promise<{ timeUsed: number } | null> {
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
    const timeUsed = Math.floor((endTime.getTime() - new Date(entry.startTime).getTime()) / 1000);

    await db
      .update(speakerEntries)
      .set({
        status: "completed",
        endTime,
        timeUsed,
      })
      .where(eq(speakerEntries.id, entryId));

    return { timeUsed };
  } catch (error) {
    console.error("[Plenary] Failed to stop speaking:", error);
    return null;
  }
}

// ============================================================================
// Voting
// ============================================================================

/**
 * Cast a vote on a motion.
 */
export async function castVote(
  input: CastVoteInput
): Promise<{ success: boolean; adopted?: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    // Check session is in progress
    const [session] = await db
      .select()
      .from(plenarySessions)
      .where(eq(plenarySessions.id, input.sessionId))
      .limit(1);

    if (!session || session.status !== "in_progress") {
      return { success: false, error: "Session is not in progress" };
    }

    // Check motion is in voting state
    const [motion] = await db
      .select()
      .from(motions)
      .where(eq(motions.id, input.motionId))
      .limit(1);

    if (!motion || motion.status !== "voting") {
      return { success: false, error: "Motion is not in voting state" };
    }

    // Check quorum
    const rules = session.rules as ParliamentaryRules;
    const quorumRequired = Math.ceil(
      (session.totalEligibleVoters ?? 0) * (rules.quorumPercentage / 100)
    );

    // For now, assume quorum is met (in production, check actual attendance)
    const quorumMet = true;

    // Record vote
    // In a real implementation, this would be part of a larger vote aggregation
    // For now, we'll create a vote record
    
    // Check if user already voted (simplified)
    // In production, use a separate votes table for individual votes

    // Get existing votes for this motion
    const [existingVote] = await db
      .select()
      .from(plenaryVotes)
      .where(eq(plenaryVotes.motionId, input.motionId))
      .limit(1);

    let votes: Array<{ voterId: number; vote: "yes" | "no" | "abstain" | "absent"; weight?: number }> = [];
    let result = { yes: 0, no: 0, abstain: 0, absent: 0, adopted: false, requiredThreshold: rules.adoptionThreshold };

    if (existingVote) {
      // Parse existing votes
      votes = (existingVote.votes as any[]) ?? [];
      
      // Check if user already voted
      if (votes.some((v) => v.voterId === input.voterId)) {
        return { success: false, error: "Already voted" };
      }

      // Add new vote
      votes.push({ voterId: input.voterId, vote: input.vote as "yes" | "no" | "abstain" | "absent" });
      
      // Recalculate result
      result = calculateVoteResult(votes, session.totalEligibleVoters ?? 0, rules);
    } else {
      // First vote
      votes = [{ voterId: input.voterId, vote: input.vote as "yes" | "no" | "abstain" | "absent" }];
      result = calculateVoteResult(votes, session.totalEligibleVoters ?? 0, rules);

      // Create vote record
      await db.insert(plenaryVotes).values({
        sessionId: input.sessionId,
        motionId: input.motionId,
        method: rules.defaultVotingMethod,
        totalEligible: session.totalEligibleVoters ?? 0,
        totalVoted: 1,
        quorumMet,
        votes,
        result,
        startedAt: new Date(),
      });
    }

    // Update existing vote record
    if (existingVote) {
      await db
        .update(plenaryVotes)
        .set({
          votes,
          result,
          totalVoted: votes.length,
        })
        .where(eq(plenaryVotes.id, existingVote.id));
    }

    await logAuditEvent({
      userId: input.voterId,
      action: "plenary.vote_cast",
      entityType: "motion",
      entityId: input.motionId,
      after: { vote: input.vote },
    });

    return { success: true, adopted: result.adopted };
  } catch (error) {
    console.error("[Plenary] Failed to cast vote:", error);
    return { success: false, error: "Internal error" };
  }
}

/**
 * Calculate vote result.
 */
function calculateVoteResult(
  votes: Array<{ voterId: number; vote: string }>,
  totalEligible: number,
  rules: ParliamentaryRules
): {
  yes: number;
  no: number;
  abstain: number;
  absent: number;
  adopted: boolean;
  requiredThreshold: number;
} {
  const yes = votes.filter((v) => v.vote === "yes").length;
  const no = votes.filter((v) => v.vote === "no").length;
  const abstain = votes.filter((v) => v.vote === "abstain").length;
  const absent = totalEligible - votes.length;

  // Calculate if adopted based on voting method
  let adopted = false;
  const totalVotes = yes + no; // Excluding abstentions

  switch (rules.defaultVotingMethod) {
    case "simple_majority":
      adopted = totalVotes > 0 && yes > totalVotes / 2;
      break;
    case "absolute_majority":
      adopted = yes > totalEligible / 2;
      break;
    case "two_thirds":
      adopted = totalVotes > 0 && yes >= (totalVotes * 2) / 3;
      break;
    case "consensus":
      adopted = no === 0;
      break;
    case "unanimity":
      adopted = no === 0 && abstain === 0;
      break;
    default:
      adopted = totalVotes > 0 && yes > totalVotes / 2;
  }

  return {
    yes,
    no,
    abstain,
    absent,
    adopted,
    requiredThreshold: rules.adoptionThreshold,
  };
}

// ============================================================================
// Resolution Management
// ============================================================================

/**
 * Adopt a resolution for a motion.
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
    const [vote] = await db
      .select()
      .from(plenaryVotes)
      .where(eq(plenaryVotes.motionId, motionId))
      .limit(1);

    if (!vote || !(vote.result as any).adopted) {
      console.warn("[Plenary] Motion has not been adopted.");
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

    // Update motion status
    await db
      .update(motions)
      .set({
        status: "adopted",
        decidedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(motions.id, motionId));

    // Create resolution
    const [result] = await db.insert(resolutions).values({
      sessionId,
      motionId: motionId as number,
      number,
      title,
      text,
      status: "adopted",
      adoptedAt: new Date(),
    });

    const resolutionId = Number((result as any)[0].insertId);

    await logAuditEvent({
      action: "plenary.resolution_adopted",
      entityType: "resolution",
      entityId: resolutionId,
      after: { sessionId, motionId, number, title },
    });

    console.log(`[Plenary] Resolution adopted: ${number} "${title}".`);
    return { id: resolutionId, number };
  } catch (error) {
    console.error("[Plenary] Failed to adopt resolution:", error);
    return null;
  }
}

/**
 * Get resolutions for a session.
 */
export async function getResolutions(
  sessionId: number
): Promise<any[]> {
  const db = getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(resolutions)
      .where(eq(resolutions.sessionId, sessionId))
      .orderBy(resolutions.number);
  } catch (error) {
    console.error("[Plenary] Failed to get resolutions:", error);
    return [];
  }
}

// ============================================================================
// Points of Order
// ============================================================================

/**
 * Raise a point of order.
 */
export async function raisePointOfOrder(
  sessionId: number,
  raisedById: number,
  type: "order" | "relevance" | "quorum" | "division" | "appeal",
  text: string,
  motionId?: number
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [result] = await db.insert(pointsOfOrder).values({
      sessionId,
      raisedById,
      motionId,
      type,
      text,
    });

    const pointId = Number((result as any)[0].insertId);

    await logAuditEvent({
      userId: raisedById,
      action: "plenary.point_of_order_raised",
      entityType: "point_of_order",
      entityId: pointId,
      after: { sessionId, type },
    });

    return { id: pointId };
  } catch (error) {
    console.error("[Plenary] Failed to raise point of order:", error);
    return null;
  }
}

/**
 * Rule on a point of order.
 */
export async function ruleOnPoint(
  pointId: number,
  rulingBy: number,
  ruling: "sustained" | "overruled",
  rulingText?: string
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .update(pointsOfOrder)
      .set({
        rulingBy,
        ruling,
        rulingText,
        ruledAt: new Date(),
      })
      .where(eq(pointsOfOrder.id, pointId));

    await logAuditEvent({
      userId: rulingBy,
      action: "plenary.point_of_order_ruled",
      entityType: "point_of_order",
      entityId: pointId,
      after: { ruling },
    });

    return true;
  } catch (error) {
    console.error("[Plenary] Failed to rule on point:", error);
    return false;
  }
}

// ============================================================================
// Quorum Management
// ============================================================================

/**
 * Update quorum status.
 */
export async function updateQuorum(
  sessionId: number,
  membersPresent: number
): Promise<{ quorumMet: boolean; quorumRequired: number }> {
  const db = getDb();
  if (!db) return { quorumMet: false, quorumRequired: 0 };

  try {
    const [session] = await db
      .select()
      .from(plenarySessions)
      .where(eq(plenarySessions.id, sessionId))
      .limit(1);

    if (!session) return { quorumMet: false, quorumRequired: 0 };

    const rules = session.rules as ParliamentaryRules;
    const quorumRequired = Math.ceil(
      (session.totalEligibleVoters ?? 0) * (rules.quorumPercentage / 100)
    );

    const quorumMet = membersPresent >= quorumRequired;

    await db
      .update(plenarySessions)
      .set({
        membersPresent,
        quorumMet,
        updatedAt: new Date(),
      })
      .where(eq(plenarySessions.id, sessionId));

    return { quorumMet, quorumRequired };
  } catch (error) {
    console.error("[Plenary] Failed to update quorum:", error);
    return { quorumMet: false, quorumRequired: 0 };
  }
}
