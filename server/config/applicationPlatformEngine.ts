/**
 * Application Platform Engine (§49-53)
 *
 * Application definitions, submission inbox, review framework,
 * conflict of interest, and tracking.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { applicationDefinitions, applicationSubmissions } from "../../drizzle/schema.platform";

export const applicationPlatformEngine = {
  createDefinition: async (input: {
    name: string; description?: string; type: string;
    formSchema?: Record<string, any>; workflowId?: number;
    organizationId?: number; createdBy?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(applicationDefinitions).values({
        name: input.name, description: input.description, type: input.type,
        formSchema: input.formSchema, workflowId: input.workflowId,
        organizationId: input.organizationId, createdBy: input.createdBy,
      } as any);
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  submit: async (input: {
    definitionId: number; applicantId: number; formData: Record<string, any>;
    organizationId?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(applicationSubmissions).values({
        definitionId: input.definitionId, applicantId: input.applicantId,
        formData: input.formData, organizationId: input.organizationId,
      });
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  review: async (submissionId: number, decision: string, reviewedBy: number, notes?: string): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(applicationSubmissions).set({
        status: decision as any, reviewNotes: notes,
        reviewedBy, reviewedAt: new Date(), decisionAt: new Date(),
      }).where(eq(applicationSubmissions.id, submissionId));
      return true;
    } catch { return false; }
  },

  getInbox: async (options: { status?: string; organizationId?: number; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      if (options.status) conditions.push(eq(applicationSubmissions.status, options.status as any));
      if (options.organizationId) conditions.push(eq(applicationSubmissions.organizationId, options.organizationId));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(applicationSubmissions).where(where).orderBy(desc(applicationSubmissions.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  listDefinitions: async (options: { type?: string; organizationId?: number; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      if (options.type) conditions.push(eq(applicationDefinitions.type, options.type));
      if (options.organizationId) conditions.push(eq(applicationDefinitions.organizationId, options.organizationId));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(applicationDefinitions).where(where).orderBy(desc(applicationDefinitions.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb();
    if (!db) return {};
    try {
      const counts = await db.select({ status: applicationSubmissions.status, count: sql<number>`count(*)` }).from(applicationSubmissions).groupBy(applicationSubmissions.status);
      return Object.fromEntries(counts.map(c => [c.status ?? "unknown", c.count]));
    } catch { return {}; }
  },
};
