/**
 * Event Management Engine (§78-82)
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { events, eventSessions, eventRegistrations } from "../../drizzle/schema.modules";
import { logAuditEvent } from "./auditService";

export const eventsEngine = {
  create: async (input: {
    title: string; description?: string; type?: string; organizationId?: number;
    startDate: Date; endDate: Date; venue?: string; city?: string;
    mode?: string; maxCapacity?: number; fee?: number; createdBy?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(events).values({
        title: input.title, description: input.description,
        type: (input.type as any) ?? "conference",
        organizationId: input.organizationId,
        startDate: input.startDate, endDate: input.endDate,
        venue: input.venue, city: input.city,
        mode: (input.mode as any) ?? "in_person",
        maxCapacity: input.maxCapacity, fee: input.fee,
        createdBy: input.createdBy,
      });
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  register: async (eventId: number, userId: number): Promise<{ success: boolean; waitlisted?: boolean }> => {
    const db = getDb();
    if (!db) return { success: false };
    try {
      const [existing] = await db.select().from(eventRegistrations)
        .where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, userId))).limit(1);
      if (existing) return { success: false };

      const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
      const atCapacity = Boolean(event?.maxCapacity && (event.currentRegistrations ?? 0) >= event.maxCapacity);

      await db.insert(eventRegistrations).values({
        eventId, userId, status: (atCapacity ? "waitlisted" : "pending") as any,
      });

      if (!atCapacity && event) {
        const newCount = (event.currentRegistrations ?? 0) + 1;
        await db.update(events).set({ currentRegistrations: newCount }).where(eq(events.id, eventId));
      }
      return { success: true, waitlisted: atCapacity };
    } catch { return { success: false }; }
  },

  checkIn: async (eventId: number, userId: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(eventRegistrations)
        .set({ checkedIn: true, checkedInAt: new Date(), status: "confirmed" as any })
        .where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, userId)));
      return true;
    } catch { return false; }
  },

  list: async (options: { status?: string; type?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      if (options.status) conditions.push(eq(events.status, options.status as any));
      if (options.type) conditions.push(eq(events.type, options.type as any));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(events).where(where).orderBy(desc(events.startDate)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  getStats: async (): Promise<{ total: number; upcoming: number; active: number; completed: number }> => {
    const db = getDb();
    if (!db) return { total: 0, upcoming: 0, active: 0, completed: 0 };
    try {
      const now = new Date();
      const [total] = await db.select({ count: sql<number>`count(*)` }).from(events);
      const [upcoming] = await db.select({ count: sql<number>`count(*)` }).from(events).where(sql`startDate > ${now}`);
      const [active] = await db.select({ count: sql<number>`count(*)` }).from(events).where(eq(events.status, "in_progress"));
      const [completed] = await db.select({ count: sql<number>`count(*)` }).from(events).where(eq(events.status, "completed"));
      return { total: total?.count ?? 0, upcoming: upcoming?.count ?? 0, active: active?.count ?? 0, completed: completed?.count ?? 0 };
    } catch { return { total: 0, upcoming: 0, active: 0, completed: 0 }; }
  },
};

export default eventsEngine;
