/**
 * Meeting/Board/Committee Management Engine (§113-115)
 *
 * Board meetings, committee sessions, workspaces, agenda management,
 * attendance tracking, and decision recording.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { meetings, committeeMemberships } from "../../drizzle/schema.platform";

export const meetingsEngine = {
  create: async (input: {
    title: string; type?: string; scheduledDate: Date;
    endDate?: Date; venue?: string; onlineUrl?: string; mode?: string;
    quorum?: number; agenda?: any[];
    organizationId?: number; createdBy?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(meetings).values({
        title: input.title, type: (input.type as any) ?? "board",
        scheduledDate: input.scheduledDate, endDate: input.endDate,
        venue: input.venue, onlineUrl: input.onlineUrl,
        mode: (input.mode as any) ?? "in_person",
        quorum: input.quorum, agenda: input.agenda,
        organizationId: input.organizationId, createdBy: input.createdBy,
      } as any);
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  start: async (meetingId: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(meetings).set({ status: "in_progress" as any }).where(eq(meetings.id, meetingId));
      return true;
    } catch { return false; }
  },

  complete: async (meetingId: number, decisions?: any[], minutes?: string): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(meetings).set({
        status: "completed" as any, decisions, minutes,
        endDate: new Date(),
      }).where(eq(meetings.id, meetingId));
      return true;
    } catch { return false; }
  },

  get: async (meetingId: number): Promise<any | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1);
      return meeting ?? null;
    } catch { return null; }
  },

  list: async (options: { type?: string; status?: string; organizationId?: number; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      if (options.type) conditions.push(eq(meetings.type, options.type as any));
      if (options.status) conditions.push(eq(meetings.status, options.status as any));
      if (options.organizationId) conditions.push(eq(meetings.organizationId, options.organizationId));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(meetings).where(where).orderBy(desc(meetings.scheduledDate)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb();
    if (!db) return {};
    try {
      const counts = await db.select({ status: meetings.status, count: sql<number>`count(*)` }).from(meetings).groupBy(meetings.status);
      return Object.fromEntries(counts.map(c => [c.status ?? "unknown", c.count]));
    } catch { return {}; }
  },
};

/** Committee Management Engine (§114-115) */
export const committeeEngine = {
  addMember: async (committeeId: number, userId: number, role?: string): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.insert(committeeMemberships).values({
        committeeId, userId, role, startDate: new Date(),
      });
      return true;
    } catch { return false; }
  },

  removeMember: async (committeeId: number, userId: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(committeeMemberships).set({
        status: "removed" as any, endDate: new Date(),
      }).where(and(
        eq(committeeMemberships.committeeId, committeeId),
        eq(committeeMemberships.userId, userId),
      ));
      return true;
    } catch { return false; }
  },

  listMembers: async (committeeId: number): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      return db.select().from(committeeMemberships)
        .where(eq(committeeMemberships.committeeId, committeeId))
        .orderBy(desc(committeeMemberships.createdAt));
    } catch { return []; }
  },

  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb();
    if (!db) return {};
    try {
      const counts = await db.select({ role: committeeMemberships.role, count: sql<number>`count(*)` }).from(committeeMemberships).groupBy(committeeMemberships.role);
      return Object.fromEntries(counts.map(c => [c.role ?? "member", c.count]));
    } catch { return {}; }
  },
};
