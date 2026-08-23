/**
 * Project/Task Management Engine (§75-77)
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { projects, tasks } from "../../drizzle/schema.modules";
import { logAuditEvent } from "./auditService";

export const projectsEngine = {
  create: async (input: {
    title: string; description?: string; organizationId?: number;
    startDate?: Date; endDate?: Date; budget?: number; ownerId?: number; createdBy?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb(); if (!db) return null;
    try {
      const [result] = await db.insert(projects).values({
        title: input.title, description: input.description,
        organizationId: input.organizationId, startDate: input.startDate,
        endDate: input.endDate, budget: input.budget ? String(input.budget) : undefined,
        ownerId: input.ownerId, createdBy: input.createdBy,
      });
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  createTask: async (input: {
    projectId?: number; title: string; description?: string;
    assignedTo?: number; dueDate?: Date; priority?: string; createdBy?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb(); if (!db) return null;
    try {
      const [result] = await db.insert(tasks).values({
        projectId: input.projectId, title: input.title, description: input.description,
        assignedTo: input.assignedTo, dueDate: input.dueDate,
        priority: (input.priority as any) ?? "medium", createdBy: input.createdBy,
      });
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  updateTaskStatus: async (taskId: number, status: string, userId: number): Promise<boolean> => {
    const db = getDb(); if (!db) return false;
    try {
      const updates: any = { status, updatedAt: new Date() };
      if (status === "done") updates.completedAt = new Date();
      await db.update(tasks).set(updates).where(eq(tasks.id, taskId));
      return true;
    } catch { return false; }
  },

  getProject: async (projectId: number): Promise<any | null> => {
    const db = getDb(); if (!db) return null;
    try {
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
      return project ?? null;
    } catch { return null; }
  },

  listProjects: async (options: { status?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb(); if (!db) return [];
    try {
      const where = options.status ? eq(projects.status, options.status as any) : undefined;
      return db.select().from(projects).where(where).orderBy(desc(projects.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  listTasks: async (options: { projectId?: number; assignedTo?: number; status?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb(); if (!db) return [];
    try {
      const conditions = [];
      if (options.projectId) conditions.push(eq(tasks.projectId, options.projectId));
      if (options.assignedTo) conditions.push(eq(tasks.assignedTo, options.assignedTo));
      if (options.status) conditions.push(eq(tasks.status, options.status as any));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(tasks).where(where).orderBy(desc(tasks.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  getStats: async (): Promise<{ projects: number; tasks: number; completedTasks: number; overdueTasks: number }> => {
    const db = getDb(); if (!db) return { projects: 0, tasks: 0, completedTasks: 0, overdueTasks: 0 };
    try {
      const [p] = await db.select({ count: sql<number>`count(*)` }).from(projects);
      const [t] = await db.select({ count: sql<number>`count(*)` }).from(tasks);
      const [c] = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.status, "done"));
      const [o] = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(and(eq(tasks.status, "todo"), sql`${tasks.dueDate} < NOW()`));
      return { projects: p?.count ?? 0, tasks: t?.count ?? 0, completedTasks: c?.count ?? 0, overdueTasks: o?.count ?? 0 };
    } catch { return { projects: 0, tasks: 0, completedTasks: 0, overdueTasks: 0 }; }
  },
};

export default projectsEngine;
