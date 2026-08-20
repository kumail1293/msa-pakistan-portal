/**
 * Activities Engine (§61-70)
 *
 * Activity lifecycle, NEF/NRF workflows, event management,
 * capacity management, check-in/checkout, and approval workflows.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { activities, activityParticipants } from "../../drizzle/schema.modules";

export const activitiesEngine = {
  /** Create a new activity */
  create: async (input: {
    title: string;
    description?: string;
    type?: string;
    category?: string;
    startDate?: Date;
    endDate?: Date;
    venue?: string;
    city?: string;
    maxParticipants?: number;
    organizedBy?: number;
    organizationId?: number;
    createdBy?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(activities).values({
        title: input.title,
        description: input.description,
        type: input.type ?? "workshop",
        category: input.category,
        startDate: input.startDate,
        endDate: input.endDate,
        venue: input.venue,
        city: input.city,
        maxParticipants: input.maxParticipants,
        organizedBy: input.organizedBy,
        organizationId: input.organizationId,
        createdBy: input.createdBy,
      } as any);
      return { id: Number((result as any)[0].insertId) };
    } catch {
      return null;
    }
  },

  /** Register a participant */
  register: async (activityId: number, userId: number, role?: string): Promise<{ success: boolean; waitlisted: boolean }> => {
    const db = getDb();
    if (!db) return { success: false, waitlisted: false };
    try {
      const [activity] = await db.select().from(activities).where(eq(activities.id, activityId)).limit(1);
      if (!activity) return { success: false, waitlisted: false };

      const maxP = activity.maxParticipants;
      const currentP = activity.currentParticipants ?? 0;
      const atCapacity = maxP != null && currentP >= maxP;

      await db.insert(activityParticipants).values({
        activityId,
        userId,
        role: role ?? "participant",
        status: "registered" as any,
      });

      if (!atCapacity) {
        await db.update(activities).set({
          currentParticipants: (currentP + 1) as any,
        }).where(eq(activities.id, activityId));
      }

      return { success: true, waitlisted: atCapacity };
    } catch {
      return { success: false, waitlisted: false };
    }
  },

  /** Check in a participant */
  checkIn: async (activityId: number, userId: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(activityParticipants).set({
        checkedIn: true as any,
        checkedInAt: new Date() as any,
      }).where(and(
        eq(activityParticipants.activityId, activityId),
        eq(activityParticipants.userId, userId),
      ));
      return true;
    } catch {
      return false;
    }
  },

  /** List activities */
  list: async (options: { type?: string; status?: string; organizationId?: number; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      if (options.type) conditions.push(eq(activities.type, options.type));
      if (options.organizationId) conditions.push(eq(activities.organizationId, options.organizationId));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(activities).where(where).orderBy(desc(activities.createdAt)).limit(options.limit ?? 50);
    } catch {
      return [];
    }
  },

  /** Get activity stats */
  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb();
    if (!db) return {};
    try {
      const counts = await db.select({ type: activities.type, count: sql<number>`count(*)` }).from(activities).groupBy(activities.type);
      return Object.fromEntries(counts.map(c => [c.type ?? "unknown", c.count]));
    } catch {
      return {};
    }
  },
};
