/**
 * Events Engine (§78-82)
 *
 * Event lifecycle, registration, session management,
 * capacity tracking, check-in, and post-event analytics.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { events, eventRegistrations } from "../../drizzle/schema.modules";

export const eventsEngine = {
  /** Create a new event */
  create: async (input: {
    title: string;
    description?: string;
    type?: string;
    startDate: Date;
    endDate: Date;
    venue?: string;
    city?: string;
    maxCapacity?: number;
    registrationDeadline?: Date;
    isPublic?: boolean;
    organizationId?: number;
    createdBy?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(events).values({
        title: input.title,
        description: input.description,
        type: (input.type as any) ?? "conference",
        startDate: input.startDate,
        endDate: input.endDate,
        venue: input.venue,
        city: input.city,
        maxCapacity: input.maxCapacity,
        registrationDeadline: input.registrationDeadline,
        organizationId: input.organizationId,
        createdBy: input.createdBy,
      });
      return { id: Number((result as any)[0].insertId) };
    } catch {
      return null;
    }
  },

  /** Register for an event */
  register: async (eventId: number, userId: number): Promise<{ success: boolean; waitlisted: boolean }> => {
    const db = getDb();
    if (!db) return { success: false, waitlisted: false };
    try {
      const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
      if (!event) return { success: false, waitlisted: false };

      const maxCap = event.maxCapacity;
      const currentReg = event.currentRegistrations ?? 0;
      const atCapacity = maxCap != null && currentReg >= maxCap;

      await db.insert(eventRegistrations).values({
        eventId,
        userId,
        status: atCapacity ? "waitlisted" as any : "pending" as any,
      });

      if (!atCapacity) {
        await db.update(events).set({
          currentRegistrations: (currentReg + 1) as any,
        }).where(eq(events.id, eventId));
      }

      return { success: true, waitlisted: atCapacity };
    } catch {
      return { success: false, waitlisted: false };
    }
  },

  /** Check in attendee */
  checkIn: async (eventId: number, userId: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(eventRegistrations).set({
        checkedIn: true as any,
        checkedInAt: new Date() as any,
      }).where(and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.userId, userId),
      ));
      return true;
    } catch {
      return false;
    }
  },

  /** List events */
  list: async (options: { type?: string; status?: string; organizationId?: number; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      if (options.type) conditions.push(eq(events.type, options.type as any));
      if (options.organizationId) conditions.push(eq(events.organizationId, options.organizationId));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(events).where(where).orderBy(desc(events.createdAt)).limit(options.limit ?? 50);
    } catch {
      return [];
    }
  },

  /** Get event stats */
  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb();
    if (!db) return {};
    try {
      const counts = await db.select({ type: events.type, count: sql<number>`count(*)` }).from(events).groupBy(events.type);
      return Object.fromEntries(counts.map(c => [c.type ?? "unknown", c.count]));
    } catch {
      return {};
    }
  },
};
