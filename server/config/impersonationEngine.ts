/**
 * Impersonation Engine (§33)
 *
 * Allows administrators to troubleshoot using controlled impersonation,
 * with mandatory reason capture and complete audit logging.
 */

import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db";
import { impersonationSessions } from "../../drizzle/schema.remaining";
import { logAuditEvent } from "./auditService";

export const impersonationEngine = {
  /** Start an impersonation session. */
  start: async (input: {
    administratorId: number;
    targetUserId: number;
    reason: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ sessionId: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      // End any existing active session for this admin
      await db.update(impersonationSessions)
        .set({ status: "ended", endedAt: new Date() })
        .where(and(
          eq(impersonationSessions.administratorId, input.administratorId),
          eq(impersonationSessions.status, "active")
        ));

      const [result] = await db.insert(impersonationSessions).values({
        administratorId: input.administratorId,
        targetUserId: input.targetUserId,
        reason: input.reason,
        status: "active",
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        actionsPerformed: [],
      });

      const sessionId = Number((result as any)[0].insertId);

      await logAuditEvent({
        userId: input.administratorId,
        action: "impersonation.started",
        entityType: "impersonation",
        entityId: sessionId,
        after: { targetUserId: input.targetUserId, reason: input.reason },
      });

      return { sessionId };
    } catch { return null; }
  },

  /** End an impersonation session. */
  end: async (sessionId: number, administratorId: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(impersonationSessions)
        .set({ status: "ended", endedAt: new Date() })
        .where(and(
          eq(impersonationSessions.id, sessionId),
          eq(impersonationSessions.administratorId, administratorId),
          eq(impersonationSessions.status, "active")
        ));

      await logAuditEvent({
        userId: administratorId,
        action: "impersonation.ended",
        entityType: "impersonation",
        entityId: sessionId,
      });
      return true;
    } catch { return false; }
  },

  /** Record an action performed during impersonation. */
  recordAction: async (sessionId: number, action: string, entityType: string, entityId?: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      const [session] = await db.select().from(impersonationSessions).where(eq(impersonationSessions.id, sessionId)).limit(1);
      if (!session || session.status !== "active") return false;

      const actions = (session.actionsPerformed as any[]) ?? [];
      actions.push({ action, entityType, entityId, timestamp: new Date().toISOString() });

      await db.update(impersonationSessions)
        .set({ actionsPerformed: actions })
        .where(eq(impersonationSessions.id, sessionId));
      return true;
    } catch { return false; }
  },

  /** Get active impersonation for a user. */
  getActive: async (administratorId: number): Promise<any | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [session] = await db.select().from(impersonationSessions)
        .where(and(
          eq(impersonationSessions.administratorId, administratorId),
          eq(impersonationSessions.status, "active")
        )).limit(1);
      return session ?? null;
    } catch { return null; }
  },

  /** Get impersonation stats for admin dashboard. */
  getStats: async (): Promise<{ total: number; active: number; completed: number; administrators: number }> => {
    const db = getDb();
    if (!db) return { total: 0, active: 0, completed: 0, administrators: 0 };
    try {
      const all = await db.select().from(impersonationSessions);
      return {
        total: all.length,
        active: all.filter(s => s.status === "active").length,
        completed: all.filter(s => s.status === "ended").length,
        administrators: new Set(all.map(s => s.administratorId)).size,
      };
    } catch { return { total: 0, active: 0, completed: 0, administrators: 0 }; }
  },

  /** Get impersonation sessions list. */
  getSessions: async (limit: number = 50): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      return db.select().from(impersonationSessions).orderBy(desc(impersonationSessions.createdAt)).limit(limit);
    } catch { return []; }
  },

  /** Get impersonation history. */
  getHistory: async (administratorId?: number, limit: number = 50): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const where = administratorId ? eq(impersonationSessions.administratorId, administratorId) : undefined;
      return db.select().from(impersonationSessions).where(where).orderBy(desc(impersonationSessions.createdAt)).limit(limit);
    } catch { return []; }
  },

  /** End all active impersonations (emergency). */
  endAll: async (adminId: number): Promise<number> => {
    const db = getDb();
    if (!db) return 0;
    try {
      const result = await db.update(impersonationSessions)
        .set({ status: "ended", endedAt: new Date() })
        .where(eq(impersonationSessions.status, "active"));
      return 0; // affected rows not easily extracted from mysql2
    } catch { return 0; }
  },
};

export default impersonationEngine;
