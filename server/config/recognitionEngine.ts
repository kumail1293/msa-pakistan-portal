/**
 * Recognition System Engine (§130)
 *
 * Award management, nomination workflow, judging, and certificate generation.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { awards, awardNominations } from "../../drizzle/schema.platform";

export const recognitionEngine = {
  createAward: async (input: {
    title: string; description?: string; category?: string;
    criteria?: string; frequency?: string;
    organizationId?: number; createdBy?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(awards).values({
        title: input.title, description: input.description,
        category: (input.category as any) ?? "excellence",
        criteria: input.criteria, frequency: input.frequency,
        organizationId: input.organizationId, createdBy: input.createdBy,
      } as any);
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  nominate: async (input: {
    awardId: number; nomineeId: number; nominatorId: number;
    justification: string;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(awardNominations).values({
        awardId: input.awardId, nomineeId: input.nomineeId,
        nominatorId: input.nominatorId, justification: input.justification,
      });
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  decide: async (nominationId: number, decision: string, decidedBy: number, notes?: string): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(awardNominations).set({
        status: decision as any, decisionNotes: notes,
        decidedBy, decidedAt: new Date(),
      }).where(eq(awardNominations.id, nominationId));
      return true;
    } catch { return false; }
  },

  listAwards: async (options: { organizationId?: number; status?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      if (options.organizationId) conditions.push(eq(awards.organizationId, options.organizationId));
      if (options.status) conditions.push(eq(awards.status, options.status as any));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(awards).where(where).orderBy(desc(awards.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  listNominations: async (options: { awardId?: number; status?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      if (options.awardId) conditions.push(eq(awardNominations.awardId, options.awardId));
      if (options.status) conditions.push(eq(awardNominations.status, options.status as any));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(awardNominations).where(where).orderBy(desc(awardNominations.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb();
    if (!db) return {};
    try {
      const counts = await db.select({ category: awards.category, count: sql<number>`count(*)` }).from(awards).groupBy(awards.category);
      return Object.fromEntries(counts.map(c => [c.category ?? "unknown", c.count]));
    } catch { return {}; }
  },
};
