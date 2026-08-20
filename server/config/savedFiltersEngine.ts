/**
 * Saved Filters Engine (§60)
 *
 * Advanced search with saved filters, custom views, and column preferences.
 */

import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db";
import { savedFilters } from "../../drizzle/schema.membership";

export const savedFiltersEngine = {
  /** Save a filter */
  save: async (input: {
    userId: number; name: string; entityType: string;
    filters: Record<string, any>; columns?: string[];
    sortBy?: string; sortOrder?: string; isDefault?: boolean; isShared?: boolean;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      // If setting as default, unset other defaults for this entity type
      if (input.isDefault) {
        await db.update(savedFilters).set({ isDefault: false })
          .where(and(eq(savedFilters.userId, input.userId), eq(savedFilters.entityType, input.entityType)));
      }
      const [result] = await db.insert(savedFilters).values({
        userId: input.userId, name: input.name, entityType: input.entityType,
        filters: input.filters, columns: input.columns,
        sortBy: input.sortBy, sortOrder: (input.sortOrder as any) ?? "asc",
        isDefault: input.isDefault ?? false, isShared: input.isShared ?? false,
      });
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  /** List saved filters */
  list: async (userId: number, entityType?: string): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [eq(savedFilters.userId, userId)];
      if (entityType) conditions.push(eq(savedFilters.entityType, entityType));
      return db.select().from(savedFilters).where(and(...conditions)).orderBy(desc(savedFilters.updatedAt));
    } catch { return []; }
  },

  /** Delete a saved filter */
  delete: async (filterId: number, userId: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      const { eq: eqFn } = await import("drizzle-orm");
      await db.delete(savedFilters).where(and(eq(savedFilters.id, filterId), eq(savedFilters.userId, userId)));
      return true;
    } catch { return false; }
  },

  /** Update a saved filter */
  update: async (filterId: number, userId: number, updates: Record<string, any>): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(savedFilters).set({ ...updates, updatedAt: new Date() })
        .where(and(eq(savedFilters.id, filterId), eq(savedFilters.userId, userId)));
      return true;
    } catch { return false; }
  },

  /** Get shared filters for an entity type */
  getShared: async (entityType: string): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      return db.select().from(savedFilters).where(and(eq(savedFilters.entityType, entityType), eq(savedFilters.isShared, true))).orderBy(savedFilters.name);
    } catch { return []; }
  },
};
