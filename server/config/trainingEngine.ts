/**
 * Training/LMS Engine (§129) + Skills Engine (§128)
 *
 * Course management, enrollment, progress tracking, certificates,
 * skills registry, and talent directory.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { trainingCourses, trainingEnrollments, memberSkills } from "../../drizzle/schema.platform";

export const trainingEngine = {
  createCourse: async (input: {
    title: string; description?: string; category?: string;
    type?: string; duration?: number; maxEnrollments?: number;
    passingScore?: number; organizationId?: number; createdBy?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(trainingCourses).values({
        title: input.title, description: input.description, category: input.category,
        type: (input.type as any) ?? "self_paced", duration: input.duration,
        maxEnrollments: input.maxEnrollments, passingScore: input.passingScore,
        organizationId: input.organizationId, createdBy: input.createdBy,
      } as any);
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  enroll: async (courseId: number, userId: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.insert(trainingEnrollments).values({ courseId, userId });
      return true;
    } catch { return false; }
  },

  updateProgress: async (enrollmentId: number, progress: number, score?: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      const updates: any = { progress };
      if (score !== undefined) {
        updates.score = score;
        const [enrollment] = await db.select().from(trainingEnrollments).where(eq(trainingEnrollments.id, enrollmentId)).limit(1);
        if (enrollment) {
          const [course] = await db.select().from(trainingCourses).where(eq(trainingCourses.id, enrollment.courseId)).limit(1);
          updates.passed = score >= (course?.passingScore ?? 70);
          if (progress >= 100) updates.status = "completed" as any;
        }
      }
      await db.update(trainingEnrollments).set(updates).where(eq(trainingEnrollments.id, enrollmentId));
      return true;
    } catch { return false; }
  },

  listCourses: async (options: { organizationId?: number; category?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      if (options.organizationId) conditions.push(eq(trainingCourses.organizationId, options.organizationId));
      if (options.category) conditions.push(eq(trainingCourses.category, options.category));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(trainingCourses).where(where).orderBy(desc(trainingCourses.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb();
    if (!db) return {};
    try {
      const counts = await db.select({ category: trainingCourses.category, count: sql<number>`count(*)` }).from(trainingCourses).groupBy(trainingCourses.category);
      return Object.fromEntries(counts.map(c => [c.category ?? "unknown", c.count]));
    } catch { return {}; }
  },
};

/** Skills engine (§128) */
export const skillsEngine = {
  addSkill: async (input: {
    userId: number; skillName: string; category?: string;
    proficiency?: string;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(memberSkills).values({
        userId: input.userId, skillName: input.skillName,
        category: input.category, proficiency: (input.proficiency as any) ?? "intermediate",
      } as any);
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  getUserSkills: async (userId: number): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      return db.select().from(memberSkills).where(eq(memberSkills.userId, userId));
    } catch { return []; }
  },

  searchBySkill: async (skillName: string): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      return db.select().from(memberSkills).where(eq(memberSkills.skillName, skillName)).limit(50);
    } catch { return []; }
  },
};
