/**
 * Search Engine (§59-60)
 *
 * Global search across members, chapters, activities, documents, events,
 * and other authorized records with advanced filters.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { searchIndex } from "../../drizzle/schema.modules";

export interface SearchResult {
  entityType: string;
  entityId: number;
  title: string;
  subtitle?: string;
  relevance: number;
  metadata?: Record<string, unknown>;
}

export const searchEngine = {
  /** Index an entity for search. */
  index: async (input: {
    entityType: string; entityId: number; title: string;
    subtitle?: string; content?: string; tags?: string[];
    organizationId?: number; visibility?: string; metadata?: Record<string, unknown>;
  }): Promise<boolean> => {
    const db = getDb(); if (!db) return false;
    try {
      // Upsert: delete old index entry then insert new
      await db.delete(searchIndex).where(and(
        eq(searchIndex.entityType, input.entityType),
        eq(searchIndex.entityId, input.entityId)
      ));
      await db.insert(searchIndex).values({
        entityType: input.entityType, entityId: input.entityId,
        title: input.title, subtitle: input.subtitle, content: input.content,
        tags: input.tags, organizationId: input.organizationId,
        visibility: input.visibility ?? "members_only", metadata: input.metadata,
      });
      return true;
    } catch { return false; }
  },

  /** Global search. */
  search: async (query: string, options: {
    entityTypes?: string[]; limit?: number;
  } = {}): Promise<SearchResult[]> => {
    const db = getDb(); if (!db) return [];
    try {
      const q = `%${query}%`;
      let whereClause = sql`(${searchIndex.title} LIKE ${q} OR ${searchIndex.content} LIKE ${q})`;
      if (options.entityTypes && options.entityTypes.length > 0) {
        whereClause = sql`${whereClause} AND ${searchIndex.entityType} IN (${sql.join(options.entityTypes.map(t => sql`${t}`), sql`, `)})`;
      }
      const results = await db.select().from(searchIndex).where(whereClause)
        .orderBy(desc(searchIndex.updatedAt)).limit(options.limit ?? 20);

      return results.map(r => ({
        entityType: r.entityType, entityId: r.entityId,
        title: r.title, subtitle: r.subtitle ?? undefined,
        relevance: 1.0, metadata: r.metadata as any,
      }));
    } catch { return []; }
  },

  /** Remove entity from search index. */
  remove: async (entityType: string, entityId: number): Promise<boolean> => {
    const db = getDb(); if (!db) return false;
    try {
      await db.delete(searchIndex).where(and(eq(searchIndex.entityType, entityType), eq(searchIndex.entityId, entityId)));
      return true;
    } catch { return false; }
  },

  /** Get search stats. */
  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb(); if (!db) return {};
    try {
      const counts = await db.select({ entityType: searchIndex.entityType, count: sql<number>`count(*)` }).from(searchIndex).groupBy(searchIndex.entityType);
      return Object.fromEntries(counts.map(c => [c.entityType, c.count]));
    } catch { return {}; }
  },
};

export default searchEngine;
