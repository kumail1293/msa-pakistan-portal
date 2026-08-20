/**
 * Member Lifecycle Engine (§9) + Onboarding (§12)
 *
 * Application submission, review, approval, activation, renewal,
 * onboarding task management, and lifecycle status tracking.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { membershipApplications, onboardingTasks, memberOnboardingProgress } from "../../drizzle/schema.membership";

export const memberLifecycleEngine = {
  /** Submit a membership application */
  submitApplication: async (input: {
    userId: number; institutionId?: number; localCouncilId?: number;
    degree?: string; graduationYear?: number; discipline?: string;
    studentId?: string; documents?: { type: string; url: string; name: string }[];
    membershipType?: string;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      const [result] = await db.insert(membershipApplications).values({
        userId: input.userId,
        institutionId: input.institutionId,
        localCouncilId: input.localCouncilId,
        applicantName: user?.name ?? null,
        applicantEmail: user?.email ?? null,
        degree: input.degree,
        graduationYear: input.graduationYear,
        discipline: input.discipline,
        studentId: input.studentId,
        documents: input.documents,
        membershipType: input.membershipType ?? "ordinary",
        status: "submitted" as any,
      });
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  /** Review an application */
  reviewApplication: async (applicationId: number, decision: string, reviewedBy: number, notes?: string, rejectionReason?: string): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(membershipApplications).set({
        status: decision as any,
        reviewedBy, reviewNotes: notes, reviewedAt: new Date(), decisionAt: new Date(),
        rejectionReason,
      }).where(eq(membershipApplications.id, applicationId));
      if (decision === "approved") {
        const [app] = await db.select().from(membershipApplications).where(eq(membershipApplications.id, applicationId)).limit(1);
        if (app) {
          await db.update(users).set({
            membershipStatus: "Active" as any,
            membershipStartDate: new Date(),
          }).where(eq(users.id, app.userId));
        }
      }
      return true;
    } catch { return false; }
  },

  /** List applications */
  list: async (options: { status?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      if (options.status) conditions.push(eq(membershipApplications.status, options.status as any));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(membershipApplications).where(where).orderBy(desc(membershipApplications.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  /** Get stats */
  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb();
    if (!db) return {};
    try {
      const counts = await db.select({ status: membershipApplications.status, count: sql<number>`count(*)` }).from(membershipApplications).groupBy(membershipApplications.status);
      return Object.fromEntries(counts.map(c => [c.status ?? "unknown", c.count]));
    } catch { return {}; }
  },
};

/** Onboarding Engine (§12) */
export const onboardingEngine = {
  /** Create onboarding task */
  createTask: async (input: {
    name: string; description?: string; category?: string;
    required?: boolean; order?: number; membershipType?: string;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(onboardingTasks).values({
        name: input.name, description: input.description, category: input.category,
        required: input.required ?? true, order: input.order ?? 0,
        membershipType: input.membershipType,
      });
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  /** Complete a task for a member */
  completeTask: async (userId: number, taskId: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      const [existing] = await db.select().from(memberOnboardingProgress)
        .where(and(eq(memberOnboardingProgress.userId, userId), eq(memberOnboardingProgress.taskId, taskId))).limit(1);
      if (existing) {
        await db.update(memberOnboardingProgress).set({ status: "completed" as any, completedAt: new Date() }).where(eq(memberOnboardingProgress.id, existing.id));
      } else {
        await db.insert(memberOnboardingProgress).values({ userId, taskId, status: "completed" as any, completedAt: new Date() });
      }
      return true;
    } catch { return false; }
  },

  /** Get member onboarding progress */
  getProgress: async (userId: number): Promise<{ total: number; completed: number; percentage: number; tasks: any[] }> => {
    const db = getDb();
    if (!db) return { total: 0, completed: 0, percentage: 0, tasks: [] };
    try {
      const tasks = await db.select().from(onboardingTasks).where(eq(onboardingTasks.status, "active" as any));
      const progress = await db.select().from(memberOnboardingProgress).where(eq(memberOnboardingProgress.userId, userId));
      const completedCount = progress.filter(p => p.status === "completed").length;
      return {
        total: tasks.length,
        completed: completedCount,
        percentage: tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0,
        tasks: tasks.map(t => ({
          ...t,
          progress: progress.find(p => p.taskId === t.id)?.status ?? "pending",
        })),
      };
    } catch { return { total: 0, completed: 0, percentage: 0, tasks: [] }; }
  },

  /** List tasks */
  listTasks: async (): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      return db.select().from(onboardingTasks).orderBy(onboardingTasks.order);
    } catch { return []; }
  },
};
