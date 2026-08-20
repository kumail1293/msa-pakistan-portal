/**
 * Document Management Engine (§54-58)
 *
 * Features:
 * - Centralized document storage (§54)
 * - Document versioning (§55)
 * - Document approval workflow (§56)
 * - Policy library (§57)
 * - Records retention (§58)
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { documents, documentVersions } from "../../drizzle/schema.modules";
import { logAuditEvent } from "./auditService";

export const documentsEngine = {
  /** Create a document. */
  create: async (input: {
    title: string; description?: string; type: string; category?: string;
    content?: string; visibility?: string; organizationId?: number;
    tags?: string[]; createdBy?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(documents).values({
        title: input.title, description: input.description, type: input.type,
        category: input.category, content: input.content,
        visibility: (input.visibility as any) ?? "members_only",
        organizationId: input.organizationId, tags: input.tags, createdBy: input.createdBy,
      });
      const id = Number((result as any)[0].insertId);
      await logAuditEvent({ userId: input.createdBy, action: "document.created", entityType: "document", entityId: id });
      return { id };
    } catch { return null; }
  },

  /** Transition document status. */
  transition: async (docId: number, newStatus: string, userId: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      const [current] = await db.select().from(documents).where(eq(documents.id, docId)).limit(1);
      if (!current) return false;
      await db.update(documents).set({ status: newStatus as any, updatedAt: new Date() }).where(eq(documents.id, docId));
      await logAuditEvent({ userId, action: `document.${newStatus}`, entityType: "document", entityId: docId });
      return true;
    } catch { return false; }
  },

  /** Create a new version. */
  createVersion: async (docId: number, content: string, changeDescription: string, userId: number): Promise<number | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [maxVer] = await db.select({ maxVer: sql<number>`COALESCE(MAX(${documentVersions.versionNumber}), 0)` }).from(documentVersions).where(eq(documentVersions.documentId, docId));
      const version = (maxVer?.maxVer ?? 0) + 1;
      const [result] = await db.insert(documentVersions).values({ documentId: docId, versionNumber: version, content, changeDescription, createdBy: userId });
      await db.update(documents).set({ version, updatedAt: new Date() }).where(eq(documents.id, docId));
      return version;
    } catch { return null; }
  },

  /** List documents with filters. */
  list: async (options: { type?: string; status?: string; visibility?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      if (options.type) conditions.push(eq(documents.type, options.type));
      if (options.status) conditions.push(eq(documents.status, options.status as any));
      if (options.visibility) conditions.push(eq(documents.visibility, options.visibility as any));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(documents).where(where).orderBy(desc(documents.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  /** Get document stats. */
  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb();
    if (!db) return {};
    try {
      const counts = await db.select({ status: documents.status, count: sql<number>`count(*)` }).from(documents).groupBy(documents.status);
      return Object.fromEntries(counts.map(c => [c.status ?? "unknown", c.count]));
    } catch { return {}; }
  },

  /** Search documents. */
  search: async (query: string): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      return db.select().from(documents).where(
        sql`${documents.title} LIKE ${`%${query}%`} OR ${documents.content} LIKE ${`%${query}%`}`
      ).limit(20);
    } catch { return []; }
  },
};

export default documentsEngine;
