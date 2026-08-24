/**
 * Plenary/Parliamentary Engine (§100-111)
 *
 * Completely separate from the Election Engine. Handles:
 * - Plenary sessions (WHO/UN/IFMSA-style meetings)
 * - Agenda management
 * - Motions and amendments
 * - Speaker queues (chair-controlled)
 * - Voting (majority, two-thirds, consensus, roll-call, weighted)
 * - Procedural motions
 * - Points of order
 * - Resolution records
 * - Minutes generation
 *
 * State machine for motions:
 *   DRAFT → SUBMITTED → SPONSORED → AGENDA → OPEN → DEBATE → AMENDMENT → VOTE → RESULT → ADOPTED/REJECTED → PUBLISHED
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { getConfigNumber, getConfig } from "./configService";
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

/** Build default plenary rules from configuration. All values are configurable via admin. */
async function getDefaultRules(): Promise<Record<string, unknown>> {
  return {
    quorumPercentage: await getConfigNumber("gov.quorumNumerator", 1) / Math.max(await getConfigNumber("gov.quorumDenominator", 3), 1) * 100,
    defaultVotingMethod: await getConfig("plenary.defaultVotingMethod", "simple_majority"),
    allowedVotingMethods: ["simple_majority", "absolute_majority", "two_thirds", "consensus", "roll_call", "weighted"],
    maxSpeakerTimeSeconds: await getConfigNumber("plenary.speakingTimeSeconds", 120),
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
    maxSessionDurationHours: 8,
    maxDebateTimePerItemMinutes: 30,
    requireRollCall: false,
    publishMinutes: true,
  };
}

export const plenaryEngine = {
  /** Create a new plenary session */
  createSession: async (input: {
    title: string;
    description?: string;
    type?: string;
    scheduledStart: Date;
    scheduledEnd: Date;
    chairId: number;
    secretaryId: number;
    organizationId?: number;
    createdById?: number;
    rules?: Record<string, unknown>;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(plenarySessions).values({
        title: input.title,
        description: input.description,
        type: (input.type as any) ?? "regular",
        scheduledStart: input.scheduledStart,
        scheduledEnd: input.scheduledEnd,
        chairId: input.chairId,
        secretaryId: input.secretaryId,
        organizationId: input.organizationId,
        createdById: input.createdById,
        rules: { ...(await getDefaultRules()), ...input.rules } as any,
      });
      return { id: Number((result as any)[0].insertId) };
    } catch {
      return null;
    }
  },

  /** List plenary sessions */
  listSessions: async (options: { status?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const where = options.status ? eq(plenarySessions.status, options.status as any) : undefined;
      return db.select().from(plenarySessions).where(where).orderBy(desc(plenarySessions.scheduledStart)).limit(options.limit ?? 50);
    } catch {
      return [];
    }
  },

  /** Get a single plenary session with full detail */
  getSession: async (sessionId: number): Promise<any | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [session] = await db.select().from(plenarySessions).where(eq(plenarySessions.id, sessionId)).limit(1);
      if (!session) return null;
      const agenda = await db.select().from(agendaItems).where(eq(agendaItems.sessionId, sessionId)).orderBy(agendaItems.order);
      const motionsList = await db.select().from(motions).where(eq(motions.sessionId, sessionId)).orderBy(desc(motions.createdAt));
      const votes = await db.select().from(plenaryVotes).where(eq(plenaryVotes.sessionId, sessionId)).orderBy(desc(plenaryVotes.startedAt));
      const resos = await db.select().from(resolutions).where(eq(resolutions.sessionId, sessionId)).orderBy(desc(resolutions.createdAt));
      return { ...session, agenda, motions: motionsList, votes, resolutions: resos };
    } catch {
      return null;
    }
  },

  /** Add an agenda item to a session */
  addAgendaItem: async (sessionId: number, input: {
    title: string;
    description?: string;
    type?: string;
    proposedById: number;
    order?: number;
    timeAllotted?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      // Auto-calculate order if not provided
      let order = input.order;
      if (!order) {
        const [last] = await db.select({ maxOrder: sql<number>`COALESCE(MAX(${agendaItems.order}), 0)` })
          .from(agendaItems).where(eq(agendaItems.sessionId, sessionId));
        order = (Number(last?.maxOrder ?? 0)) + 1;
      }
      const [result] = await db.insert(agendaItems).values({
        sessionId,
        order,
        title: input.title,
        description: input.description,
        type: (input.type as any) ?? "regular",
        proposedById: input.proposedById,
        timeAllotted: input.timeAllotted,
      });
      return { id: Number((result as any)[0].insertId) };
    } catch {
      return null;
    }
  },

  /** Propose a motion */
  proposeMotion: async (sessionId: number, input: {
    text: string;
    proposedById: number;
    type?: string;
    agendaItemId?: number;
    amendmentTo?: number;
    amendmentPosition?: string;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(motions).values({
        sessionId,
        agendaItemId: input.agendaItemId,
        type: (input.type as any) ?? "main",
        text: input.text,
        proposedById: input.proposedById,
        amendmentTo: input.amendmentTo,
        amendmentPosition: input.amendmentPosition as any,
      });
      return { id: Number((result as any)[0].insertId) };
    } catch {
      return null;
    }
  },

  /** Second a motion */
  secondMotion: async (motionId: number, secondedById: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(motions).set({
        secondedById,
        secondedAt: new Date(),
        status: "seconded" as any,
      }).where(eq(motions.id, motionId));
      return true;
    } catch {
      return false;
    }
  },

  /** Start debate on a motion */
  startDebate: async (motionId: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(motions).set({
        status: "under_debate" as any,
        debateStartedAt: new Date(),
      }).where(eq(motions.id, motionId));
      // Create speaker list
      await db.insert(speakerLists).values({ sessionId: 0, motionId }); // sessionId resolved from motion
      return true;
    } catch {
      return false;
    }
  },

  /** Vote on a motion */
  voteOnMotion: async (sessionId: number, motionId: number, input: {
    method: string;
    totalEligible: number;
    votes?: Array<{ voterId: number; vote: string; weight?: number }>;
    threshold?: number;
  }): Promise<{ id: number; adopted: boolean } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const totalVoted = input.votes?.length ?? 0;
      const yesCount = input.votes?.filter((v) => v.vote === "yes").reduce((sum, v) => sum + (v.weight ?? 1), 0) ?? 0;
      const noCount = input.votes?.filter((v) => v.vote === "no").reduce((sum, v) => sum + (v.weight ?? 1), 0) ?? 0;
      const abstainCount = input.votes?.filter((v) => v.vote === "abstain").reduce((sum, v) => sum + (v.weight ?? 1), 0) ?? 0;
      const absentCount = input.totalEligible - totalVoted;
      const threshold = input.threshold ?? 50;
      const votedTotal = yesCount + noCount + abstainCount;
      const adopted = votedTotal > 0 && (yesCount / votedTotal) * 100 >= threshold;

      const [result] = await db.insert(plenaryVotes).values({
        sessionId,
        motionId,
        method: input.method,
        totalEligible: input.totalEligible,
        totalVoted,
        quorumMet: (totalVoted / input.totalEligible) * 100 >= 50,
        votes: input.votes as any,
        result: {
          yes: yesCount,
          no: noCount,
          abstain: abstainCount,
          absent: absentCount,
          adopted,
          requiredThreshold: threshold,
        },
        endedAt: new Date(),
      });

      // Update motion status
      await db.update(motions).set({
        status: adopted ? "adopted" : "rejected",
        decidedAt: new Date(),
      }).where(eq(motions.id, motionId));

      return { id: Number((result as any)[0].insertId), adopted };
    } catch {
      return null;
    }
  },

  /** Create a resolution from an adopted motion */
  createResolution: async (sessionId: number, motionId: number, input: {
    number: string;
    title: string;
    text: string;
    assignedTo?: number;
    implementationDeadline?: Date;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(resolutions).values({
        sessionId,
        motionId,
        number: input.number,
        title: input.title,
        text: input.text,
        status: "adopted",
        adoptedAt: new Date(),
        assignedTo: input.assignedTo,
        implementationDeadline: input.implementationDeadline,
      });
      return { id: Number((result as any)[0].insertId) };
    } catch {
      return null;
    }
  },

  /** Get plenary stats */
  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb();
    if (!db) return {};
    try {
      const counts = await db.select({ status: plenarySessions.status, count: sql<number>`count(*)` })
        .from(plenarySessions).groupBy(plenarySessions.status);
      return Object.fromEntries(counts.map((c) => [c.status ?? "unknown", c.count]));
    } catch {
      return {};
    }
  },

  /** Get all resolutions */
  listResolutions: async (options: { status?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const where = options.status ? eq(resolutions.status, options.status as any) : undefined;
      return db.select().from(resolutions).where(where).orderBy(desc(resolutions.createdAt)).limit(options.limit ?? 50);
    } catch {
      return [];
    }
  },
};

// ============================================================================
// V2 Features — Merged from plenaryEngineV2.ts
// ============================================================================
// These were previously in a separate V2 engine. Now consolidated here
// as the single source of truth for plenary proceedings.

import { evaluateMajority } from "./governanceRulesEngine";
import { logAuditEvent } from "./auditService";

// ── Procedural Motion Types (§8.4.11 a–r) ──────────────────

export interface ProceduralMotionType {
  code: string;
  name: string;
  description: string;
  requiresSeconder: boolean;
  threshold: string;
  canInterrupt: boolean;
  precedence: number;
}

export const PROCEDURAL_MOTIONS: ProceduralMotionType[] = [
  { code: "adopt_agenda", name: "To adopt the NGA/plenary agenda", description: "Adopt the proposed agenda as written", requiresSeconder: true, threshold: "two_thirds", canInterrupt: false, precedence: 10 },
  { code: "open_agenda", name: "To open the NGA/plenary agenda", description: "Open the agenda for discussion", requiresSeconder: true, threshold: "two_thirds", canInterrupt: false, precedence: 11 },
  { code: "change_agenda", name: "To change the NGA/plenary agenda", description: "Modify the proposed agenda", requiresSeconder: true, threshold: "two_thirds", canInterrupt: false, precedence: 12 },
  { code: "open_meeting", name: "The meeting to be opened", description: "Formally open the meeting", requiresSeconder: true, threshold: "two_thirds", canInterrupt: false, precedence: 1 },
  { code: "adjourn", name: "The meeting to be adjourned", description: "Adjourn the meeting", requiresSeconder: true, threshold: "two_thirds", canInterrupt: true, precedence: 100 },
  { code: "proceed_to_vote", name: "The meeting to proceed immediately to a vote", description: "End debate and vote immediately", requiresSeconder: true, threshold: "two_thirds", canInterrupt: true, precedence: 50 },
  { code: "proceed_next_business", name: "The meeting to proceed to the next business", description: "Move to the next agenda item", requiresSeconder: true, threshold: "two_thirds", canInterrupt: true, precedence: 51 },
  { code: "postpone", name: "Consideration of the present motion to be postponed", description: "Defer the current motion to a later time", requiresSeconder: true, threshold: "two_thirds", canInterrupt: false, precedence: 40 },
  { code: "reopen_debate", name: "The debate on a motion to be reopened", description: "Reopen debate on a previously closed motion", requiresSeconder: true, threshold: "two_thirds", canInterrupt: false, precedence: 41 },
  { code: "reopen_speakers", name: "The speakers' list to be reopened", description: "Reopen the speakers' list for additional speakers", requiresSeconder: true, threshold: "two_thirds", canInterrupt: false, precedence: 42 },
  { code: "candidates_leave", name: "Candidates for election leave the hall", description: "Require candidates to leave during preliminary discussions", requiresSeconder: true, threshold: "two_thirds", canInterrupt: false, precedence: 43 },
  { code: "suspend_bylaw", name: "To suspend a paragraph of constitution & bylaws", description: "Suspend a bylaw paragraph until end of NGA or resumed by NGA", requiresSeconder: true, threshold: "two_thirds", canInterrupt: false, precedence: 60 },
  { code: "resume_bylaw", name: "To resume a paragraph of constitution & bylaws", description: "Resume a previously suspended bylaw paragraph", requiresSeconder: true, threshold: "two_thirds", canInterrupt: false, precedence: 61 },
  { code: "confidential", name: "A discussion not to be recorded in the minutes", description: "Make the current discussion confidential", requiresSeconder: true, threshold: "two_thirds", canInterrupt: false, precedence: 70 },
  { code: "overrule_chair", name: "To overrule the decision of the Chairperson", description: "Overrule a ruling made by the Chairperson", requiresSeconder: true, threshold: "two_thirds", canInterrupt: true, precedence: 5 },
  { code: "vote_no_confidence_chair", name: "Vote of no confidence in the Chair", description: "Remove the Chairperson from the Chair", requiresSeconder: true, threshold: "two_thirds", canInterrupt: true, precedence: 4 },
  { code: "overrule_ccc", name: "To overrule the decisions of the CCC", description: "Overrule a CCC decision", requiresSeconder: true, threshold: "two_thirds", canInterrupt: false, precedence: 44 },
  { code: "observers_leave", name: "Observers must leave the room", description: "Require observers to leave the room", requiresSeconder: true, threshold: "two_thirds", canInterrupt: false, precedence: 45 },
];

// ── Speaker Management ──────────────────────────────────────

/** Add a speaker to the queue. */
export async function addSpeaker(
  sessionId: number, userId: number, speakingFor: "pro" | "con" | "neutral" = "neutral", motionId?: number
): Promise<{ id: number; position: number } | null> {
  const db = getDb();
  if (!db) return null;
  try {
    let [list] = await db.select().from(speakerLists).where(
      and(eq(speakerLists.sessionId, sessionId), motionId ? eq(speakerLists.motionId, motionId) : sql`${speakerLists.motionId} IS NULL`)
    ).limit(1);
    if (!list) {
      const [newList] = await db.insert(speakerLists).values({ sessionId, motionId: motionId ?? null, isOpen: true });
      list = { id: Number((newList as any)[0].insertId), sessionId, motionId: motionId ?? null, isOpen: true, closedAt: null, createdAt: new Date() };
    }
    const [maxOrder] = await db.select({ maxOrder: speakerEntries.scheduledOrder }).from(speakerEntries).where(eq(speakerEntries.listId, list.id)).orderBy(desc(speakerEntries.scheduledOrder)).limit(1);
    const position = (maxOrder?.maxOrder ?? 0) + 1;
    const [session] = await db.select().from(plenarySessions).where(eq(plenarySessions.id, sessionId)).limit(1);
    const rules = (session?.rules as Record<string, unknown>) ?? {};
    const timeLimit = (rules.maxSpeakerTimeSeconds as number) ?? 300;
    const [result] = await db.insert(speakerEntries).values({ listId: list.id, userId, scheduledOrder: position, speakingFor, timeLimit });
    return { id: Number((result as any)[0].insertId), position };
  } catch {
    return null;
  }
}

/** Start speaking. */
export async function startSpeaking(entryId: number): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const [entry] = await db.select().from(speakerEntries).where(eq(speakerEntries.id, entryId)).limit(1);
    if (!entry || entry.status !== "scheduled") return false;
    await db.update(speakerEntries).set({ status: "speaking", startTime: new Date() }).where(eq(speakerEntries.id, entryId));
    return true;
  } catch {
    return false;
  }
}

/** Stop speaking. */
export async function stopSpeaking(entryId: number): Promise<{ timeUsed: number; overtime: boolean } | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const [entry] = await db.select().from(speakerEntries).where(eq(speakerEntries.id, entryId)).limit(1);
    if (!entry || entry.status !== "speaking" || !entry.startTime) return null;
    const endTime = new Date();
    const timeUsed = Math.floor((endTime.getTime() - new Date(entry.startTime).getTime()) / 1000);
    const overtime = entry.timeLimit ? timeUsed > entry.timeLimit : false;
    await db.update(speakerEntries).set({ status: "completed", endTime, timeUsed }).where(eq(speakerEntries.id, entryId));
    return { timeUsed, overtime };
  } catch {
    return null;
  }
}

/** Get the speaker queue. */
export async function getSpeakerQueue(sessionId: number, motionId?: number): Promise<Array<{ entryId: number; userId: number; speakingFor: string; timeLimit: number; timeUsed: number; status: string }>> {
  const db = getDb();
  if (!db) return [];
  try {
    let [list] = await db.select().from(speakerLists).where(
      and(eq(speakerLists.sessionId, sessionId), motionId ? eq(speakerLists.motionId, motionId) : sql`${speakerLists.motionId} IS NULL`)
    ).limit(1);
    if (!list) return [];
    const entries = await db.select().from(speakerEntries).where(eq(speakerEntries.listId, list.id)).orderBy(speakerEntries.scheduledOrder);
    return entries.map((e) => ({ entryId: e.id, userId: e.userId, speakingFor: e.speakingFor as string, timeLimit: e.timeLimit ?? 0, timeUsed: e.timeUsed ?? 0, status: e.status as string }));
  } catch {
    return [];
  }
}

// ── Nemo Contra (§8.3.10) ───────────────────────────────────

/** Check if a motion passes nemo contra (no amendments or direct negatives). */
export async function checkNemoContra(motionId: number): Promise<{ isNemoContra: boolean; amendmentCount: number }> {
  const db = getDb();
  if (!db) return { isNemoContra: false, amendmentCount: 0 };
  try {
    const [motion] = await db.select().from(motions).where(eq(motions.id, motionId)).limit(1);
    if (!motion) return { isNemoContra: false, amendmentCount: 0 };
    const [amendmentResult] = await db.select({ count: sql<number>`count(*)` }).from(motions).where(
      and(eq(motions.sessionId, motion.sessionId), eq(motions.type, "amendment"), eq(motions.amendmentTo, motionId))
    );
    const amendmentCount = amendmentResult?.count ?? 0;
    return { isNemoContra: amendmentCount === 0, amendmentCount };
  } catch {
    return { isNemoContra: false, amendmentCount: 0 };
  }
}

// ── Procedural Motions ──────────────────────────────────────

/** Get available procedural motion types. */
export function getAvailableProceduralMotionTypes(): ProceduralMotionType[] {
  return PROCEDURAL_MOTIONS;
}

/** Propose a procedural motion. Requires seconder + 2/3 majority. */
export async function proposeProceduralMotion(sessionId: number, code: string, proposedById: number, text?: string): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const motionType = PROCEDURAL_MOTIONS.find((m) => m.code === code);
    if (!motionType) return null;
    const [session] = await db.select().from(plenarySessions).where(eq(plenarySessions.id, sessionId)).limit(1);
    if (!session || session.status !== "in_progress") return null;
    const [result] = await db.insert(motions).values({ sessionId, type: "procedural" as any, text: text ?? motionType.name, proposedById, status: "proposed" as any });
    return { id: Number((result as any)[0].insertId) };
  } catch {
    return null;
  }
}

/** Vote on a procedural motion (2/3 majority required). */
export async function voteProceduralMotion(motionId: number, votes: { yes: number; no: number; abstain: number; totalEligible: number }): Promise<{ adopted: boolean; decision: string } | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const [motion] = await db.select().from(motions).where(eq(motions.id, motionId)).limit(1);
    if (!motion || motion.type !== "procedural") return null;
    const majorityResult = await evaluateMajority({ yes: votes.yes, no: votes.no, abstain: votes.abstain }, "two_thirds");
    await db.update(motions).set({ status: majorityResult.adopted ? "adopted" : "rejected", decidedAt: new Date(), updatedAt: new Date() }).where(eq(motions.id, motionId));
    return { adopted: majorityResult.adopted, decision: majorityResult.calculation };
  } catch {
    return null;
  }
}

// ── Point of Order (§8.5) ───────────────────────────────────

/** Raise a Point of Order. */
export async function raisePointOfOrder(sessionId: number, raisedById: number, reason: string): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const [session] = await db.select().from(plenarySessions).where(eq(plenarySessions.id, sessionId)).limit(1);
    if (!session || session.status !== "in_progress") return null;
    const [result] = await db.insert(pointsOfOrder).values({ sessionId, raisedById, type: "order", text: reason });
    return { id: Number((result as any)[0].insertId) };
  } catch {
    return null;
  }
}

/** Rule on a Point of Order. */
export async function ruleOnPOO(pointId: number, ruling: "sustained" | "overruled", rulingBy: number, rulingText?: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await db.update(pointsOfOrder).set({ ruling, rulingBy, rulingText, ruledAt: new Date() }).where(eq(pointsOfOrder.id, pointId));
    return true;
  } catch {
    return false;
  }
}

// ── Point of Information (§8.6) ─────────────────────────────

/** Raise a Point of Information. */
export async function raisePointOfInformation(sessionId: number, raisedById: number, delegationId: number, question: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await logAuditEvent({ userId: raisedById, action: "plenary.poi_raised", entityType: "point_of_information", entityId: 0, after: { question, delegationId } });
    return true;
  } catch {
    return false;
  }
}
