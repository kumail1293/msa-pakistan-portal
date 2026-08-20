/**
 * Academic/Institution Directory Engine (§7)
 *
 * University/college registry with search, filtering, and LC associations.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { institutions } from "../../drizzle/schema.membership";

export const institutionEngine = {
  create: async (input: {
    name: string; shortCode?: string; type?: string;
    city?: string; province?: string; country?: string;
    website?: string; contactEmail?: string; contactPhone?: string;
    address?: string;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(institutions).values({
        name: input.name, shortCode: input.shortCode,
        type: (input.type as any) ?? "medical_college",
        city: input.city, province: input.province,
        country: input.country ?? "Pakistan",
        website: input.website, contactEmail: input.contactEmail,
        contactPhone: input.contactPhone, address: input.address,
      } as any);
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  update: async (id: number, updates: Record<string, any>): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(institutions).set({ ...updates, updatedAt: new Date() }).where(eq(institutions.id, id));
      return true;
    } catch { return false; }
  },

  getById: async (id: number): Promise<any | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [inst] = await db.select().from(institutions).where(eq(institutions.id, id)).limit(1);
      return inst ?? null;
    } catch { return null; }
  },

  search: async (query: string): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      // Simple LIKE search
      return db.select().from(institutions)
        .where(sql`${institutions.name} LIKE ${"%" + query + "%"} OR ${institutions.city} LIKE ${"%" + query + "%"} OR ${institutions.shortCode} LIKE ${"%" + query + "%"}`)
        .limit(50);
    } catch { return []; }
  },

  list: async (options: { type?: string; city?: string; province?: string; status?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      if (options.type) conditions.push(eq(institutions.type, options.type as any));
      if (options.city) conditions.push(eq(institutions.city, options.city));
      if (options.province) conditions.push(eq(institutions.province, options.province));
      if (options.status) conditions.push(eq(institutions.status, options.status as any));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(institutions).where(where).orderBy(institutions.name).limit(options.limit ?? 100);
    } catch { return []; }
  },

  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb();
    if (!db) return {};
    try {
      const counts = await db.select({ type: institutions.type, count: sql<number>`count(*)` }).from(institutions).groupBy(institutions.type);
      return Object.fromEntries(counts.map(c => [c.type ?? "unknown", c.count]));
    } catch { return {}; }
  },
};
