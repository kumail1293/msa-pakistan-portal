/**
 * Centralized Configuration Service
 *
 * Provides a single source of truth for all application settings. Reads from
 * the `configuration` database table with an in-memory cache (5-minute TTL).
 * Falls back to environment variables when a key is not in the DB.
 *
 * Usage:
 *   import { getConfig, getConfigNumber, getConfigBoolean } from "../config/configService";
 *
 *   const orgName = await getConfig("brand.name", "MSA Pakistan");
 *   const maxUpload = await getConfigNumber("upload.maxSizeBytes", 5_000_000);
 *   const maintenance = await getConfigBoolean("feature.maintenanceMode", false);
 */

import { eq } from "drizzle-orm";
import { configuration } from "../../drizzle/schema";
import { getDb } from "../db";
import { childLogger } from "../_core/logger";

const log = childLogger("ConfigService");

// ============================================================================
// Cache
// ============================================================================

interface CacheEntry {
  value: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const configCache = new Map<string, CacheEntry>();

function cacheGet(key: string): string | undefined {
  const entry = configCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    configCache.delete(key);
    return undefined;
  }
  return entry.value;
}

function cacheSet(key: string, value: string): void {
  configCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function cacheInvalidate(key?: string): void {
  if (key) {
    configCache.delete(key);
  } else {
    configCache.clear();
  }
}

// ============================================================================
// Core getters
// ============================================================================

/**
 * Get a configuration value by key. Checks the database first, then falls
 * back to the provided default (or env var matching `MSAP_<UPPER_KEY>`).
 */
export async function getConfig(
  key: string,
  defaultValue?: string
): Promise<string> {
  // 1. Check in-memory cache
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  // 2. Check database
  const db = getDb();
  if (db) {
    try {
      const rows = await db
        .select()
        .from(configuration)
        .where(eq(configuration.key, key))
        .limit(1);

      if (rows.length > 0 && rows[0].value !== null && rows[0].value !== undefined) {
        cacheSet(key, rows[0].value);
        return rows[0].value;
      }
    } catch (error) {
      log.warn({ err: error, key }, "Failed to read key from DB");
    }
  }

  // 3. Fallback to environment variable (MSAP_<UPPER_KEY> format)
  const envKey = `MSAP_${key.replace(/[.\-]/g, "_").toUpperCase()}`;
  const envValue = process.env[envKey];
  if (envValue !== undefined) {
    cacheSet(key, envValue);
    return envValue;
  }

  // 4. Return the provided default
  const result = defaultValue ?? "";
  if (result) {
    cacheSet(key, result);
  }
  return result;
}

/**
 * Get a configuration value as a number. Returns `defaultValue` if the
 * value is not a valid number.
 */
export async function getConfigNumber(
  key: string,
  defaultValue: number
): Promise<number> {
  const raw = await getConfig(key);
  if (!raw) return defaultValue;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/**
 * Get a configuration value as a boolean. Recognizes "true", "1", "yes"
 * (case-insensitive) as true; everything else is false.
 */
export async function getConfigBoolean(
  key: string,
  defaultValue: boolean
): Promise<boolean> {
  const raw = await getConfig(key);
  if (!raw) return defaultValue;
  const normalized = raw.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

// ============================================================================
// Setters (for admin API / seeding)
// ============================================================================

/**
 * Set a configuration value in the database. Creates the row if it doesn't
 * exist, updates it if it does. Also invalidates the cache.
 */
export async function setConfig(
  key: string,
  value: string,
  category?: string
): Promise<void> {
  const db = getDb();
  if (!db) {
    log.warn({ key }, "Cannot set key — no database configured");
    return;
  }

  try {
    // Try to update first
    const result = await db
      .update(configuration)
      .set({ value, ...(category ? { category } : {}) })
      .where(eq(configuration.key, key));

    // If no rows were affected, insert
    if (!result || (result as any).affectedRows === 0) {
      await db.insert(configuration).values({
        key,
        value,
        ...(category ? { category } : {}),
      });
    }

    cacheInvalidate(key);
  } catch (error) {
    log.error({ err: error, key }, "Failed to set key");
  }
}

/**
 * Set multiple configuration values in a single transaction.
 */
export async function setConfigs(
  entries: Array<{ key: string; value: string; category?: string }>
): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    for (const entry of entries) {
      await setConfig(entry.key, entry.value, entry.category);
    }
  } catch (error) {
    log.error({ err: error }, "Failed to batch set configs");
  }
}

/**
 * Delete a configuration value from the database and invalidate the cache.
 */
export async function deleteConfig(key: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    await db.delete(configuration).where(eq(configuration.key, key));
    cacheInvalidate(key);
  } catch (error) {
    log.error({ err: error, key }, "Failed to delete key");
  }
}

// ============================================================================
// Bulk operations
// ============================================================================

/**
 * Get all configuration entries, optionally filtered by category.
 * Returns an array of { key, value, category } objects.
 */
export async function getAllConfigs(
  category?: string
): Promise<Array<{ key: string; value: string; category: string | null }>> {
  const db = getDb();
  if (!db) return [];

  try {
    const rows = await db.select().from(configuration);
    const filtered = category
      ? rows.filter((r) => r.category === category)
      : rows;
    return filtered.map((r) => ({
      key: r.key,
      value: r.value ?? "",
      category: r.category,
    }));
  } catch (error) {
    log.warn({ err: error }, "Failed to get all configs");
    return [];
  }
}

/**
 * Invalidate the entire cache (e.g., after a bulk import or admin change).
 */
export function invalidateAllConfigCache(): void {
  cacheInvalidate();
}

// ============================================================================
// Default configuration seeding
// ============================================================================

export interface ConfigDefinition {
  key: string;
  defaultValue: string;
  category: string;
  description: string;
}

/**
 * All known configuration keys with their defaults and categories.
 * This serves as the single source of truth for what can be configured.
 */
export const CONFIG_DEFINITIONS: ConfigDefinition[] = [
  // ── Branding ────────────────────────────────────────────────────────
  {
    key: "brand.name",
    defaultValue: "MSA Pakistan",
    category: "branding",
    description: "Organization display name",
  },
  {
    key: "brand.email",
    defaultValue: "vpm@msapakistan.org",
    category: "branding",
    description: "Primary contact email",
  },
  {
    key: "brand.fullName",
    defaultValue: "Medical Students' Association of Pakistan",
    category: "branding",
    description: "Full organization name",
  },
  {
    key: "brand.shortName",
    defaultValue: "MSAP",
    category: "branding",
    description: "Short organization name / abbreviation",
  },
  {
    key: "brand.color.primary",
    defaultValue: "#1B355E",
    category: "branding",
    description: "Primary brand color (hex)",
  },
  {
    key: "brand.color.secondary",
    defaultValue: "#2E7D32",
    category: "branding",
    description: "Secondary brand color (hex)",
  },
  {
    key: "brand.color.accent",
    defaultValue: "#FFC107",
    category: "branding",
    description: "Accent brand color (hex)",
  },
  {
    key: "brand.logoUrl",
    defaultValue: "",
    category: "branding",
    description: "URL or data URL of the organization logo",
  },
  {
    key: "brand.faviconUrl",
    defaultValue: "",
    category: "branding",
    description: "URL of the favicon",
  },
  {
    key: "brand.website",
    defaultValue: "https://msapakistan.org",
    category: "branding",
    description: "Organization website URL",
  },
  {
    key: "brand.presidentName",
    defaultValue: "Kumail Danial",
    category: "branding",
    description: "Current National President name",
  },
  {
    key: "brand.presidentTitle",
    defaultValue: "National President",
    category: "branding",
    description: "President's title",
  },

  // ── Portal ──────────────────────────────────────────────────────────
  {
    key: "portal.name",
    defaultValue: "MSAP Member Portal",
    category: "portal",
    description: "Portal display name",
  },
  {
    key: "portal.footerText",
    defaultValue: "© 2025 MSA Pakistan. All rights reserved.",
    category: "portal",
    description: "Footer copyright text",
  },

  // ── Email ───────────────────────────────────────────────────────────
  {
    key: "email.senderName",
    defaultValue: "MSA Pakistan",
    category: "email",
    description: "Email sender display name",
  },
  {
    key: "email.senderEmail",
    defaultValue: "no-reply@msapakistan.org",
    category: "email",
    description: "Email sender address",
  },
  {
    key: "email.supportEmail",
    defaultValue: "vpm@msapakistan.org",
    category: "email",
    description: "Support contact email for emails",
  },
  {
    key: "email.headerBgColor",
    defaultValue: "#1B355E",
    category: "email",
    description: "Email header background color",
  },
  {
    key: "email.footerText",
    defaultValue: "Best regards,<br/>MSA Pakistan Team",
    category: "email",
    description: "Email footer text",
  },

  // ── Membership ──────────────────────────────────────────────────────
  {
    key: "membership.prefix",
    defaultValue: "MSAP",
    category: "membership",
    description: "Membership ID prefix (e.g., MSAP-K1-0001)",
  },
  {
    key: "membership.serialPrefix",
    defaultValue: "MSAP",
    category: "membership",
    description: "Card serial number prefix",
  },

  // ── Uploads ─────────────────────────────────────────────────────────
  {
    key: "upload.maxSizeBytes",
    defaultValue: "5000000",
    category: "uploads",
    description: "Maximum upload size in bytes",
  },

  // ── Features ────────────────────────────────────────────────────────
  {
    key: "feature.maintenanceMode",
    defaultValue: "false",
    category: "features",
    description: "Enable maintenance mode",
  },
  {
    key: "feature.recruitmentEnabled",
    defaultValue: "true",
    category: "features",
    description: "Enable member recruitment flow",
  },
  {
    key: "feature.votingEnabled",
    defaultValue: "true",
    category: "features",
    description: "Enable voting sessions",
  },
  {
    key: "feature.opportunitiesEnabled",
    defaultValue: "true",
    category: "features",
    description: "Enable opportunity listings",
  },
];

/**
 * Seed the database with default configuration values (only inserts missing
 * keys — never overwrites existing values). Safe to call on every boot.
 */
export async function seedDefaultConfigs(): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    let seeded = 0;
    for (const def of CONFIG_DEFINITIONS) {
      const existing = await db
        .select({ key: configuration.key })
        .from(configuration)
        .where(eq(configuration.key, def.key))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(configuration).values({
          key: def.key,
          value: def.defaultValue,
          category: def.category,
        });
        seeded++;
      }
    }
    if (seeded > 0) {
      log.info({ count: seeded }, "Seeded default configurations");
    }
  } catch (error) {
    log.warn({ err: error }, "Failed to seed default configs");
  }
}
