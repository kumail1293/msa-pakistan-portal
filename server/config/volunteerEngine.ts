/**
 * Volunteer Management Engine (§127)
 *
 * Opportunity listing, signup, hour tracking, supervisor assignment,
 * feedback, and volunteer statistics.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { volunteerOpportunities, volunteerSignups } from "../../drizzle/schema.platform";

export const volunteerEngine = {
  createOpportunity: async (input: {
    title: string; description?: string; type: string;
    skills?: string[]; commitmentHours?: number;
    startDate?: Date; endDate?: Date; maxVolunteers?: number;
    organizationId?: number; createdBy?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(volunteerOpportunities).values({
        title: input.title, description: input.description, type: input.type,
        skills: input.skills, commitmentHours: input.commitmentHours,
        startDate: input.startDate, endDate: input.endDate,
        maxVolunteers: input.maxVolunteers,
        organizationId: input.organizationId, createdBy: input.createdBy,
      } as any);
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  signup: async (opportunityId: number, userId: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      const [opp] = await db.select().from(volunteerOpportunities).where(eq(volunteerOpportunities.id, opportunityId)).limit(1);
      if (!opp) return false;
      await db.insert(volunteerSignups).values({ opportunityId, userId });
      return true;
    } catch { return false; }
  },

  approve: async (signupId: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(volunteerSignups).set({ status: "approved" as any }).where(eq(volunteerSignups.id, signupId));
      return true;
    } catch { return false; }
  },

  logHours: async (signupId: number, hours: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(volunteerSignups).set({ hoursLogged: String(hours) }).where(eq(volunteerSignups.id, signupId));
      return true;
    } catch { return false; }
  },

  list: async (options: { organizationId?: number; type?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      if (options.organizationId) conditions.push(eq(volunteerOpportunities.organizationId, options.organizationId));
      if (options.type) conditions.push(eq(volunteerOpportunities.type, options.type));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(volunteerOpportunities).where(where).orderBy(desc(volunteerOpportunities.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb();
    if (!db) return {};
    try {
      const counts = await db.select({ type: volunteerOpportunities.type, count: sql<number>`count(*)` }).from(volunteerOpportunities).groupBy(volunteerOpportunities.type);
      return Object.fromEntries(counts.map(c => [c.type ?? "unknown", c.count]));
    } catch { return {}; }
  },
};
