/**
 * Chapter Management Engine (§21-27)
 *
 * Features:
 * - Chapter profiles and management (§21)
 * - Chapter lifecycle (§22)
 * - Chapter dashboard data (§23)
 * - Chapter leadership (§24)
 * - Leadership directory (§25)
 * - Terms of office (§26)
 * - Position registry (§27)
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { chapters, chapterLeadership } from "../../drizzle/schema.modules";
import { logAuditEvent } from "./auditService";

export const chaptersEngine = {
  /** Create a chapter. */
  create: async (input: {
    name: string; shortName?: string; institutionId?: number;
    city?: string; province?: string; type?: string;
    organizationId?: number; createdBy?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(chapters).values({
        name: input.name, shortName: input.shortName,
        institutionId: input.institutionId,
        city: input.city, province: input.province,
        type: (input.type as any) ?? "candidate",
        organizationId: input.organizationId, createdBy: input.createdBy,
      });
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  /** Transition chapter status. */
  transition: async (chapterId: number, newStatus: string, userId: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(chapters).set({ status: newStatus as any, updatedAt: new Date() }).where(eq(chapters.id, chapterId));
      await logAuditEvent({ userId, action: `chapter.${newStatus}`, entityType: "chapter", entityId: chapterId });
      return true;
    } catch { return false; }
  },

  /** Assign chapter leader. */
  assignLeader: async (chapterId: number, userId: number, position: string, termStart?: Date, termEnd?: Date): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      // Deactivate previous holder of same position
      await db.update(chapterLeadership).set({ status: "former" })
        .where(and(eq(chapterLeadership.chapterId, chapterId), eq(chapterLeadership.position, position), eq(chapterLeadership.status, "active")));

      await db.insert(chapterLeadership).values({
        chapterId, userId, position, termStart, termEnd, status: "active",
      });
      return true;
    } catch { return false; }
  },

  /** Get a single chapter by ID. */
  get: async (chapterId: number): Promise<any | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [chapter] = await db.select().from(chapters).where(eq(chapters.id, chapterId)).limit(1);
      return chapter ?? null;
    } catch { return null; }
  },

  /** List chapters. */
  list: async (options: { type?: string; status?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      if (options.type) conditions.push(eq(chapters.type, options.type as any));
      if (options.status) conditions.push(eq(chapters.status, options.status as any));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(chapters).where(where).orderBy(chapters.name).limit(options.limit ?? 100);
    } catch { return []; }
  },

  /** Get chapter stats. */
  getStats: async (): Promise<{ total: number; permanent: number; temporary: number; candidate: number; suspended: number }> => {
    const db = getDb();
    if (!db) return { total: 0, permanent: 0, temporary: 0, candidate: 0, suspended: 0 };
    try {
      const [total] = await db.select({ count: sql<number>`count(*)` }).from(chapters);
      const [perm] = await db.select({ count: sql<number>`count(*)` }).from(chapters).where(eq(chapters.type, "permanent"));
      const [temp] = await db.select({ count: sql<number>`count(*)` }).from(chapters).where(eq(chapters.type, "temporary"));
      const [cand] = await db.select({ count: sql<number>`count(*)` }).from(chapters).where(eq(chapters.type, "candidate"));
      const [susp] = await db.select({ count: sql<number>`count(*)` }).from(chapters).where(eq(chapters.status, "suspended"));
      return { total: total?.count ?? 0, permanent: perm?.count ?? 0, temporary: temp?.count ?? 0, candidate: cand?.count ?? 0, suspended: susp?.count ?? 0 };
    } catch { return { total: 0, permanent: 0, temporary: 0, candidate: 0, suspended: 0 }; }
  },

  /** Get chapter leadership. */
  getLeadership: async (chapterId: number): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      return db.select().from(chapterLeadership)
        .where(and(eq(chapterLeadership.chapterId, chapterId), eq(chapterLeadership.status, "active")))
        .orderBy(chapterLeadership.position);
    } catch { return []; }
  },
};

export default chaptersEngine;
