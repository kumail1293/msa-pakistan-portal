/**
 * Import/Export Engine (§138)
 *
 * Bulk data import with mapping, validation, error reporting,
 * and data export with format selection.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { importJobs, exportJobs } from "../../drizzle/schema.platform";

export const importEngine = {
  createJob: async (input: {
    type: string; format: string; fileName?: string;
    totalRows?: number; mapping?: Record<string, any>;
    organizationId?: number; createdBy?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(importJobs).values({
        type: input.type, format: input.format as any,
        fileName: input.fileName, totalRows: input.totalRows,
        mapping: input.mapping,
        organizationId: input.organizationId, createdBy: input.createdBy,
      } as any);
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  updateProgress: async (jobId: number, processed: number, success: number, errors: number, errorList?: { row: number; message: string }[]): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(importJobs).set({
        processedRows: processed, successRows: success, errorRows: errors,
        errors: errorList,
        status: errors > 0 && success === 0 ? "failed" as any : "processing" as any,
      }).where(eq(importJobs.id, jobId));
      return true;
    } catch { return false; }
  },

  complete: async (jobId: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(importJobs).set({ status: "completed" as any, completedAt: new Date() }).where(eq(importJobs.id, jobId));
      return true;
    } catch { return false; }
  },

  list: async (options: { type?: string; status?: string; organizationId?: number; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      if (options.type) conditions.push(eq(importJobs.type, options.type));
      if (options.status) conditions.push(eq(importJobs.status, options.status as any));
      if (options.organizationId) conditions.push(eq(importJobs.organizationId, options.organizationId));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(importJobs).where(where).orderBy(desc(importJobs.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb();
    if (!db) return {};
    try {
      const counts = await db.select({ type: importJobs.type, count: sql<number>`count(*)` }).from(importJobs).groupBy(importJobs.type);
      return Object.fromEntries(counts.map(c => [c.type ?? "unknown", c.count]));
    } catch { return {}; }
  },
};

export const exportEngine = {
  createJob: async (input: {
    type: string; format: string; filters?: Record<string, any>;
    organizationId?: number; createdBy?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(exportJobs).values({
        type: input.type, format: input.format as any,
        filters: input.filters,
        organizationId: input.organizationId, createdBy: input.createdBy,
      } as any);
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  complete: async (jobId: number, fileUrl: string, fileSize?: number, recordCount?: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(exportJobs).set({
        status: "completed" as any, fileUrl, fileSize, recordCount,
        completedAt: new Date(),
      }).where(eq(exportJobs.id, jobId));
      return true;
    } catch { return false; }
  },

  list: async (options: { type?: string; status?: string; organizationId?: number; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      if (options.type) conditions.push(eq(exportJobs.type, options.type));
      if (options.status) conditions.push(eq(exportJobs.status, options.status as any));
      if (options.organizationId) conditions.push(eq(exportJobs.organizationId, options.organizationId));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(exportJobs).where(where).orderBy(desc(exportJobs.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb();
    if (!db) return {};
    try {
      const counts = await db.select({ type: exportJobs.type, count: sql<number>`count(*)` }).from(exportJobs).groupBy(exportJobs.type);
      return Object.fromEntries(counts.map(c => [c.type ?? "unknown", c.count]));
    } catch { return {}; }
  },
};
