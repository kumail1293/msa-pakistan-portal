/**
 * Feature Flag Service
 *
 * Provides controlled rollout of new modules, features, and experiments.
 * Flags can be scoped by environment, organization, role, or percentage.
 *
 * Usage:
 *   import { isFeatureEnabled, getAllFeatureFlags } from "./featureFlags";
 *
 *   if (await isFeatureEnabled("workflow.engine", { userId: 5, role: "admin" })) {
 *     // Show workflow UI
 *   }
 */

import { eq, and, gte, lte } from "drizzle-orm";
import { featureFlags } from "../../drizzle/schema.enterprise";
import { getDb } from "../db";
import { childLogger } from "../_core/logger";

const log = childLogger("FeatureFlags");

// ============================================================================
// Cache
// ============================================================================

interface FlagCacheEntry {
  flags: Map<string, boolean>;
  expiresAt: number;
}

const FLAG_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const flagCache = new Map<string, FlagCacheEntry>();

function getCacheKey(userId?: number, role?: string): string {
  return `${userId ?? "anon"}:${role ?? "none"}`;
}

// ============================================================================
// Core Evaluation
// ============================================================================

export interface FeatureFlagContext {
  userId?: number;
  role?: string;
  organizationId?: number;
  environment?: string;
}

/**
 * Check if a feature flag is enabled for the given context.
 * Returns false if the flag doesn't exist or the database is unavailable.
 */
export async function isFeatureEnabled(
  key: string,
  context: FeatureFlagContext = {}
): Promise<boolean> {
  const cacheKey = getCacheKey(context.userId, context.role);
  const cached = flagCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.flags.get(key) ?? false;
  }

  // Build fresh cache
  const allFlags = await getAllFlagsForContext(context);

  // Cache results
  flagCache.set(cacheKey, {
    flags: allFlags,
    expiresAt: Date.now() + FLAG_CACHE_TTL_MS,
  });

  return allFlags.get(key) ?? false;
}

/**
 * Get all feature flags evaluated for a given context.
 * Returns a Map of key -> boolean.
 */
async function getAllFlagsForContext(
  context: FeatureFlagContext
): Promise<Map<string, boolean>> {
  const db = getDb();
  const result = new Map<string, boolean>();

  if (!db) {
    // No database - return defaults (all disabled)
    return result;
  }

  try {
    const rows = await db.select().from(featureFlags);

    for (const flag of rows) {
      result.set(flag.key, evaluateFlag(flag, context));
    }
  } catch (error) {
    log.warn({ err: error }, "Failed to load flags");
  }

  return result;
}

/**
 * Evaluate a single flag against a context.
 */
function evaluateFlag(
  flag: {
    enabled: boolean;
    environment: string | null;
    organizationId: number | null;
    allowedRoles: string[] | null;
    percentage: number | null;
  },
  context: FeatureFlagContext
): boolean {
  // 1. Master switch
  if (!flag.enabled) return false;

  // 2. Environment check
  if (flag.environment && context.environment) {
    if (flag.environment !== context.environment) return false;
  }

  // 3. Organization check
  if (flag.organizationId !== null && context.organizationId !== undefined) {
    if (flag.organizationId !== context.organizationId) return false;
  }

  // 4. Role check
  if (flag.allowedRoles && flag.allowedRoles.length > 0 && context.role) {
    if (!flag.allowedRoles.includes(context.role)) return false;
  }

  // 5. Percentage rollout (deterministic based on userId)
  if ((flag.percentage ?? 100) < 100 && context.userId !== undefined) {
    // Simple hash: userId % 100 < percentage
    if ((context.userId % 100) >= (flag.percentage ?? 100)) return false;
  }

  return true;
}

// ============================================================================
// Admin Operations
// ============================================================================

/**
 * Get all feature flags with their current state.
 */
export async function getAllFeatureFlags(): Promise<
  Array<{
    id: number;
    key: string;
    name: string;
    description: string | null;
    enabled: boolean;
    environment: string | null;
    organizationId: number | null;
    allowedRoles: string[] | null;
    percentage: number;
    createdAt: Date;
    updatedAt: Date;
  }>
> {
  const db = getDb();
  if (!db) return [];

  try {
    const rows = await db.select().from(featureFlags);
    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      enabled: r.enabled,
      environment: r.environment,
      organizationId: r.organizationId,
      allowedRoles: r.allowedRoles,
      percentage: r.percentage ?? 100,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  } catch (error) {
    log.warn({ err: error }, "Failed to list flags");
    return [];
  }
}

/**
 * Toggle a feature flag on/off.
 */
export async function toggleFeatureFlag(
  key: string,
  enabled: boolean
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const result = await db
      .update(featureFlags)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(featureFlags.key, key));

    invalidateCache();
    return true;
  } catch (error) {
    log.error({ err: error }, "Failed to toggle flag");
    return false;
  }
}

/**
 * Create a new feature flag.
 */
export async function createFeatureFlag(input: {
  key: string;
  name: string;
  description?: string;
  enabled?: boolean;
  environment?: string;
  organizationId?: number;
  allowedRoles?: string[];
  percentage?: number;
  createdBy?: number;
}): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await db.insert(featureFlags).values({
      key: input.key,
      name: input.name,
      description: input.description,
      enabled: input.enabled ?? false,
      environment: input.environment,
      organizationId: input.organizationId,
      allowedRoles: input.allowedRoles,
      percentage: input.percentage ?? 100,
      createdBy: input.createdBy,
    });

    invalidateCache();
    return true;
  } catch (error) {
    log.error({ err: error }, "Failed to create flag");
    return false;
  }
}

/**
 * Update a feature flag's configuration.
 */
export async function updateFeatureFlag(
  key: string,
  updates: {
    name?: string;
    description?: string;
    enabled?: boolean;
    environment?: string;
    organizationId?: number;
    allowedRoles?: string[];
    percentage?: number;
  }
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .update(featureFlags)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(featureFlags.key, key));

    invalidateCache();
    return true;
  } catch (error) {
    log.error({ err: error }, "Failed to update flag");
    return false;
  }
}

/**
 * Delete a feature flag.
 */
export async function deleteFeatureFlag(key: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await db.delete(featureFlags).where(eq(featureFlags.key, key));
    invalidateCache();
    return true;
  } catch (error) {
    log.error({ err: error }, "Failed to delete flag");
    return false;
  }
}

/**
 * Invalidate the in-memory cache (call after any mutation).
 */
export function invalidateCache(): void {
  flagCache.clear();
}

// ============================================================================
// Default Feature Flags
// ============================================================================

/**
 * Default feature flags to seed on startup.
 */
export const DEFAULT_FEATURE_FLAGS = [
  {
    key: "workflow.engine",
    name: "Workflow Engine",
    description: "Enable the generic workflow engine for business processes",
    enabled: true,
  },
  {
    key: "forms.builder",
    name: "Form Builder",
    description: "Enable dynamic form creation and management",
    enabled: true,
  },
  {
    key: "activities.module",
    name: "Activities Module",
    description: "Enable activity planning, execution, and reporting",
    enabled: true,
  },
  {
    key: "events.module",
    name: "Events Module",
    description: "Enable event management and registration",
    enabled: true,
  },
  {
    key: "governance.committees",
    name: "Committee Management",
    description: "Enable committee workspaces and meeting management",
    enabled: true,
  },
  {
    key: "elections.engine",
    name: "Election Engine",
    description: "Enable the dedicated election system",
    enabled: false,
  },
  {
    key: "plenary.engine",
    name: "Plenary Engine",
    description: "Enable the plenary/assembly voting system",
    enabled: false,
  },
  {
    key: "finance.module",
    name: "Finance Module",
    description: "Enable budgeting, expenses, and financial tracking",
    enabled: false,
  },
  {
    key: "projects.module",
    name: "Projects Module",
    description: "Enable project and task management",
    enabled: false,
  },
  {
    key: "training.lms",
    name: "Training/LMS",
    description: "Enable courses, enrollment, and learning records",
    enabled: false,
  },
  {
    key: "analytics.dashboards",
    name: "Analytics Dashboards",
    description: "Enable role-aware analytics and KPI dashboards",
    enabled: false,
  },
  {
    key: "integrations.webhooks",
    name: "Webhook Integrations",
    description: "Enable webhook configuration and event publishing",
    enabled: false,
  },
  {
    key: "api.access",
    name: "API Access",
    description: "Enable API key management for external integrations",
    enabled: false,
  },
  {
    key: "i18n.urdu",
    name: "Urdu Language Support",
    description: "Enable Urdu translation and RTL layout",
    enabled: false,
  },
  {
    key: "pwa.installable",
    name: "PWA Installable",
    description: "Enable Progressive Web App installation",
    enabled: false,
  },
];

/**
 * Seed default feature flags on startup (only inserts missing keys).
 */
export async function seedDefaultFeatureFlags(): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    let seeded = 0;
    for (const flag of DEFAULT_FEATURE_FLAGS) {
      const existing = await db
        .select({ key: featureFlags.key })
        .from(featureFlags)
        .where(eq(featureFlags.key, flag.key))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(featureFlags).values({
          key: flag.key,
          name: flag.name,
          description: flag.description,
          enabled: flag.enabled,
        });
        seeded++;
      }
    }
    if (seeded > 0) {
      log.info({ count: seeded }, "Seeded default feature flags");
    }
  } catch (error) {
    log.warn({ err: error }, "Failed to seed default flags");
  }
}
