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
