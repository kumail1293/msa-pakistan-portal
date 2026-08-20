/**
 * Activities Module Engine (§61-70)
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { activities, activityParticipants, activityApprovals, activityReports } from "../../drizzle/schema.modules";
import { logAuditEvent } from "./auditService";

export interface CreateActivityInput {
  title: string;
  description?: string;
  type: string;
  category?: string;
  organizationId?: number;
  startDate?: Date;
  endDate?: Date;
  registrationDeadline?: Date;
  venue?: string;
  city?: string;
  mode?: "in_person" | "online" | "hybrid";
  budget?: number;
  maxParticipants?: number;
  organizedBy?: number;
  createdBy?: number;
}

const STATUS_ORDER = [
  "draft", "submitted", "under_review", "approved", "preparation",
  "registration_open", "registration_closed", "in_progress",
  "reporting", "evaluation", "completed", "cancelled",
];

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["under_review", "cancelled"],
  under_review: ["approved", "rejected", "draft"],
  approved: ["preparation", "cancelled"],
  preparation: ["registration_open", "in_progress"],
  registration_open: ["registration_closed", "in_progress", "cancelled"],
  registration_closed: ["in_progress", "cancelled"],
  in_progress: ["reporting", "completed"],
  reporting: ["evaluation", "completed"],
  evaluation: ["completed"],
  completed: [],
  cancelled: [],
};

export function canTransitionActivity(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getActivityProgress(status: string): number {
  const idx = STATUS_ORDER.indexOf(status);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / STATUS_ORDER.length) * 100);
}

export const activitiesEngine = {
  create: async (input: CreateActivityInput): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(activities).values({
        title: input.title,
        description: input.description,
        type: input.type,
        category: input.category,
        organizationId: input.organizationId,
        startDate: input.startDate,
        endDate: input.endDate,
        registrationDeadline: input.registrationDeadline,
        venue: input.venue,
        city: input.city,
        mode: input.mode ?? "in_person",
        budget: input.budget,
        maxParticipants: input.maxParticipants,
        organizedBy: input.organizedBy,
        status: "draft",
        createdBy: input.createdBy ?? input.organizedBy,
      });
      const id = Number((result as any)[0].insertId);
      await logAuditEvent({ userId: input.createdBy ?? input.organizedBy, action: "activity.created", entityType: "activity", entityId: id, after: { title: input.title } });
      return { id };
    } catch (error) {
      console.error("[Activities] Failed to create:", error);
      return null;
    }
  },

  transition: async (activityId: number, newStatus: string, userId: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      const [current] = await db.select().from(activities).where(eq(activities.id, activityId)).limit(1);
      if (!current) return false;
      if (!canTransitionActivity(current.status as string, newStatus)) return false;
      await db.update(activities).set({ status: newStatus as any, updatedAt: new Date() }).where(eq(activities.id, activityId));
      await logAuditEvent({ userId, action: `activity.${newStatus}`, entityType: "activity", entityId: activityId, after: { status: newStatus } });
      return true;
    } catch { return false; }
  },

  register: async (activityId: number, userId: number, role?: string): Promise<{ success: boolean; waitlisted?: boolean }> => {
    const db = getDb();
    if (!db) return { success: false };
    try {
      const [activity] = await db.select().from(activities).where(eq(activities.id, activityId)).limit(1);
      if (!activity) return { success: false };
      const [existing] = await db.select().from(activityParticipants)
        .where(and(eq(activityParticipants.activityId, activityId), eq(activityParticipants.userId, userId))).limit(1);
      if (existing) return { success: false };
      const atCapacity = Boolean(activity.maxParticipants && (activity.currentParticipants ?? 0) >= activity.maxParticipants);
      await db.insert(activityParticipants).values({
        activityId, userId, role: role ?? "participant",
        status: "registered" as any,
      });
      if (!atCapacity) {
        const newCount = (activity.currentParticipants ?? 0) + 1;
        await db.update(activities).set({ currentParticipants: newCount }).where(eq(activities.id, activityId));
      }
      return { success: true, waitlisted: atCapacity };
    } catch { return { success: false }; }
  },

  checkIn: async (activityId: number, userId: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(activityParticipants)
        .set({ checkedIn: true, checkedInAt: new Date(), status: "attended" as any })
        .where(and(eq(activityParticipants.activityId, activityId), eq(activityParticipants.userId, userId)));
      return true;
    } catch { return false; }
  },

  list: async (options: { status?: string; type?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      if (options.status) conditions.push(eq(activities.status, options.status as any));
      if (options.type) conditions.push(eq(activities.type, options.type));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(activities).where(where).orderBy(desc(activities.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  getStats: async (): Promise<{ total: number; active: number; completed: number; cancelled: number }> => {
    const db = getDb();
    if (!db) return { total: 0, active: 0, completed: 0, cancelled: 0 };
    try {
      const [total] = await db.select({ count: sql<number>`count(*)` }).from(activities);
      const [active] = await db.select({ count: sql<number>`count(*)` }).from(activities).where(sql`status IN ('in_progress', 'registration_open')`);
      const [completed] = await db.select({ count: sql<number>`count(*)` }).from(activities).where(eq(activities.status, "completed"));
      const [cancelled] = await db.select({ count: sql<number>`count(*)` }).from(activities).where(eq(activities.status, "cancelled"));
      return { total: total?.count ?? 0, active: active?.count ?? 0, completed: completed?.count ?? 0, cancelled: cancelled?.count ?? 0 };
    } catch { return { total: 0, active: 0, completed: 0, cancelled: 0 }; }
  },
};

export default activitiesEngine;
