/**
 * API Platform Engine (§135) + External Integrations (§137)
 *
 * API key management, usage tracking, rate limiting,
 * integration registry, and webhook management.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { apiKeys, apiUsageLogs, integrations } from "../../drizzle/schema.membership";

/** Generate a random API key */
function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "msap_";
  for (let i = 0; i < 40; i++) key += chars[Math.floor(Math.random() * chars.length)];
  return key;
}

/** Hash a string (simple SHA-256 simulation for display) */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, "0");
}

export const apiPlatformEngine = {
  /** Create an API key */
  createKey: async (input: {
    name: string; userId: number; permissions?: string[];
    rateLimit?: number; expiresAt?: Date;
  }): Promise<{ id: number; key: string; prefix: string } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const rawKey = generateApiKey();
      const prefix = rawKey.substring(0, 12) + "...";
      const [result] = await db.insert(apiKeys).values({
        name: input.name,
        keyHash: simpleHash(rawKey),
        keyPrefix: prefix,
        userId: input.userId,
        permissions: input.permissions,
        rateLimit: input.rateLimit ?? 1000,
        expiresAt: input.expiresAt,
      });
      return { id: Number((result as any)[0].insertId), key: rawKey, prefix };
    } catch { return null; }
  },

  /** Validate an API key */
  validateKey: async (rawKey: string): Promise<{ valid: boolean; keyData?: any }> => {
    const db = getDb();
    if (!db) return { valid: false };
    try {
      const keyHash = simpleHash(rawKey);
      const [key] = await db.select().from(apiKeys)
        .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.status, "active" as any))).limit(1);
      if (!key) return { valid: false };
      if (key.expiresAt && new Date() > key.expiresAt) return { valid: false };
      // Update last used
      await db.update(apiKeys).set({ lastUsedAt: new Date(), usageCount: (key.usageCount ?? 0) + 1 }).where(eq(apiKeys.id, key.id));
      return { valid: true, keyData: key };
    } catch { return { valid: false }; }
  },

  /** Revoke an API key */
  revokeKey: async (keyId: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(apiKeys).set({ status: "revoked" as any }).where(eq(apiKeys.id, keyId));
      return true;
    } catch { return false; }
  },

  /** List API keys */
  listKeys: async (options: { userId?: number; status?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      if (options.userId) conditions.push(eq(apiKeys.userId, options.userId));
      if (options.status) conditions.push(eq(apiKeys.status, options.status as any));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(apiKeys).where(where).orderBy(desc(apiKeys.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  /** Log API usage */
  logUsage: async (apiKeyId: number, method: string, path: string, statusCode: number, responseTime: number, ipAddress?: string): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.insert(apiUsageLogs).values({ apiKeyId, method, path, statusCode, responseTime, ipAddress });
      return true;
    } catch { return false; }
  },

  /** Get usage stats */
  getUsageStats: async (apiKeyId?: number): Promise<Record<string, number>> => {
    const db = getDb();
    if (!db) return {};
    try {
      const conditions = apiKeyId ? [eq(apiUsageLogs.apiKeyId, apiKeyId)] : [];
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const counts = await db.select({ method: apiUsageLogs.method, count: sql<number>`count(*)` }).from(apiUsageLogs).where(where).groupBy(apiUsageLogs.method);
      return Object.fromEntries(counts.map(c => [c.method ?? "unknown", c.count]));
    } catch { return {}; }
  },
};

/** External Integrations Engine (§137) */
export const integrationsEngine = {
  /** Register an integration */
  register: async (input: {
    name: string; type: string; provider?: string;
    config?: Record<string, any>; webhookUrl?: string;
    createdBy?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(integrations).values({
        name: input.name, type: input.type, provider: input.provider,
        config: input.config, webhookUrl: input.webhookUrl,
        createdBy: input.createdBy,
      } as any);
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  /** Update integration status */
  updateStatus: async (id: number, status: string, errorLog?: string): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(integrations).set({
        status: status as any, errorLog,
        lastSyncAt: new Date(), updatedAt: new Date(),
      }).where(eq(integrations.id, id));
      return true;
    } catch { return false; }
  },

  /** List integrations */
  list: async (options: { type?: string; status?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      if (options.type) conditions.push(eq(integrations.type, options.type));
      if (options.status) conditions.push(eq(integrations.status, options.status as any));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(integrations).where(where).orderBy(integrations.name).limit(options.limit ?? 50);
    } catch { return []; }
  },

  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb();
    if (!db) return {};
    try {
      const counts = await db.select({ status: integrations.status, count: sql<number>`count(*)` }).from(integrations).groupBy(integrations.status);
      return Object.fromEntries(counts.map(c => [c.status ?? "unknown", c.count]));
    } catch { return {}; }
  },
};
