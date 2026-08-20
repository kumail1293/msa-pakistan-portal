/**
 * Communication Center Engine (§83-88)
 *
 * Features:
 * - Communication center (§83)
 * - Notification engine (§84)
 * - Communication templates (§85)
 * - Email queue (§86)
 * - Announcement system (§87)
 * - Internal messaging (§88)
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { announcements, notificationTemplates, notificationLog } from "../../drizzle/schema.modules";
import { logAuditEvent } from "./auditService";

export const communicationsEngine = {
  /** Create an announcement. */
  createAnnouncement: async (input: {
    title: string; content: string; type?: string; priority?: string;
    targetAudience?: Record<string, unknown>; organizationId?: number; createdBy?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(announcements).values({
        title: input.title, content: input.content,
        type: (input.type as any) ?? "general",
        priority: (input.priority as any) ?? "medium",
        targetAudience: input.targetAudience, organizationId: input.organizationId,
        createdBy: input.createdBy, status: "draft",
      });
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  /** Publish an announcement. */
  publishAnnouncement: async (announcementId: number, userId: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(announcements).set({ status: "published", publishAt: new Date(), updatedAt: new Date() })
        .where(eq(announcements.id, announcementId));
      await logAuditEvent({ userId, action: "announcement.published", entityType: "announcement", entityId: announcementId });
      return true;
    } catch { return false; }
  },

  /** Create a notification template. */
  createTemplate: async (input: {
    name: string; channel: string; subject?: string; body: string; variables?: string[];
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(notificationTemplates).values({
        name: input.name, channel: input.channel as any,
        subject: input.subject, body: input.body, variables: input.variables,
      });
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  /** Send a notification (log it for queue processing). */
  sendNotification: async (input: {
    recipientId: number; channel: string; subject?: string; body: string; templateId?: number;
  }): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.insert(notificationLog).values({
        templateId: input.templateId, recipientId: input.recipientId,
        channel: input.channel as any, subject: input.subject,
        body: input.body, status: "queued",
      });
      return true;
    } catch { return false; }
  },

  /** List announcements. */
  listAnnouncements: async (options: { status?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const where = options.status ? eq(announcements.status, options.status as any) : undefined;
      return db.select().from(announcements).where(where).orderBy(desc(announcements.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  /** List notification templates. */
  listTemplates: async (): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try { return db.select().from(notificationTemplates).orderBy(notificationTemplates.name); } catch { return []; }
  },

  /** Get notification stats. */
  getStats: async (): Promise<{ sent: number; delivered: number; failed: number; queued: number }> => {
    const db = getDb();
    if (!db) return { sent: 0, delivered: 0, failed: 0, queued: 0 };
    try {
      const counts = await db.select({ status: notificationLog.status, count: sql<number>`count(*)` }).from(notificationLog).groupBy(notificationLog.status);
      const result: any = { sent: 0, delivered: 0, failed: 0, queued: 0 };
      for (const row of counts) { result[row.status ?? "unknown"] = row.count; }
      return result;
    } catch { return { sent: 0, delivered: 0, failed: 0, queued: 0 }; }
  },
};

export default communicationsEngine;
