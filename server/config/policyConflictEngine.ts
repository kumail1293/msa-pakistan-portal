/**
 * Policy Conflict Engine
 * 
 * Implements Section 47: Policy Conflict Detection
 * 
 * Hierarchy:
 *   CONSTITUTION > BYLAWS > ANNEXES > IOGs > POLICIES > PROCEDURES > LOCAL RULES
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  governanceRules,
} from "../../drizzle/schema.governance_rules";
import { logAuditEvent } from "./auditService";

// ============================================================================
// TYPES
// ============================================================================

export type PolicyLevel = 
  | "constitution"
  | "bylaws"
  | "annexes"
  | "iogs"
  | "policies"
  | "procedures"
  | "local_rules";

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflicts: PolicyConflict[];
  canOverride: boolean;
  requiresApproval: boolean;
}

export interface PolicyConflict {
  id: string;
  level: PolicyLevel;
  ruleId: number;
  clauseId: string;
  clauseText: string;
  conflictType: "direct_contradiction" | "scope_overlap" | "threshold_mismatch" | "eligibility_conflict" | "procedural_conflict";
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  resolution: string;
}

export interface PolicyOverride {
  id: string;
  ruleId: number;
  conflictId: string;
  actor: number;
  authority: string;
  reason: string;
  duration: "permanent" | "temporary";
  expiresAt?: Date;
  affectedScope: string;
  approvalRequired: boolean;
  approvedBy?: number;
  approvedAt?: Date;
  sourceClause: string;
  auditHash: string;
}

// ============================================================================
// POLICY LEVEL HIERARCHY
// ============================================================================

const LEVEL_PRIORITY: Record<PolicyLevel, number> = {
  constitution: 7,
  bylaws: 6,
  annexes: 5,
  iogs: 4,
  policies: 3,
  procedures: 2,
  local_rules: 1,
};

function isHigherPriority(a: PolicyLevel, b: PolicyLevel): boolean {
  return LEVEL_PRIORITY[a] > LEVEL_PRIORITY[b];
}

function getLevelFromRuleType(ruleType: string): PolicyLevel {
  const typeMap: Record<string, PolicyLevel> = {
    constitution: "constitution",
    bylaws: "bylaws",
    annex: "annexes",
    iog: "iogs",
    policy: "policies",
    procedure: "procedures",
    local_rule: "local_rules",
  };
  return typeMap[ruleType.toLowerCase()] ?? "policies";
}

// ============================================================================
// POLICY CONFLICT ENGINE
// ============================================================================

export const policyConflictEngine = {
  /**
   * Check a new rule against all higher-priority existing rules.
   */
  checkConflict: async (
    newRule: {
      ruleKey: string;
      parameters: Record<string, unknown>;
      ruleType: string;
    }
  ): Promise<ConflictCheckResult> => {
    const db = getDb();
    if (!db) return { hasConflict: false, conflicts: [], canOverride: false, requiresApproval: false };

    const newLevel = getLevelFromRuleType(newRule.ruleType);
    const conflicts: PolicyConflict[] = [];

    // Get all active rules for the same rule key
    const existingRules = await db
      .select()
      .from(governanceRules)
      .where(
        and(
          eq(governanceRules.ruleKey, newRule.ruleKey),
          eq(governanceRules.status, "active")
        )
      )
      .orderBy(desc(governanceRules.effectiveFrom));

    for (const existing of existingRules) {
      const existingLevel = getLevelFromRuleType(existing.ruleType);

      // Only check against higher-priority rules
      if (!isHigherPriority(existingLevel, newLevel)) continue;

      const existingParams = existing.parameters as Record<string, unknown>;
      const newParams = newRule.parameters;

      // Check for direct contradictions
      if (existingParams && newParams) {
        for (const key of Object.keys(newParams)) {
          if (existingParams[key] !== undefined && existingParams[key] !== newParams[key]) {
            conflicts.push({
              id: `CONTRADICTION-${existing.id}-${newRule.ruleKey}`,
              level: existingLevel,
              ruleId: existing.id,
              clauseId: existing.clauseId.toString(),
              clauseText: `Existing rule sets ${key} = ${existingParams[key]}`,
              conflictType: "direct_contradiction",
              description: `New rule sets ${key} = ${newParams[key]}, contradicting existing value ${existingParams[key]}`,
              severity: "critical",
              resolution: "Requires amendment to existing rule or explicit override with authorization",
            });
          }
        }
      }
    }

    const hasConflict = conflicts.length > 0;
    const canOverride = conflicts.every(c => c.severity !== "critical");
    const requiresApproval = hasConflict;

    if (hasConflict) {
      await logAuditEvent({
        action: "policy.conflict_detected",
        entityType: "governance_rule",
        entityId: 0,
        after: {
          ruleKey: newRule.ruleKey,
          conflictCount: conflicts.length,
        },
      });
    }

    return {
      hasConflict,
      conflicts,
      canOverride,
      requiresApproval,
    };
  },

  /**
   * Create a policy override record.
   */
  createOverride: async (override: Omit<PolicyOverride, "id" | "auditHash">): Promise<PolicyOverride> => {
    const auditHash = await computeAuditHash(override);

    const record: PolicyOverride = {
      ...override,
      id: `OVERRIDE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      auditHash,
    };

    await logAuditEvent({
      userId: override.actor,
      action: "policy.override_created",
      entityType: "policy_override",
      entityId: 0,
      after: {
        conflictId: override.conflictId,
        authority: override.authority,
        reason: override.reason,
      },
    });

    return record;
  },

  /**
   * Get all conflicts for a rule key.
   */
  getConflictsForRule: async (ruleKey: string): Promise<PolicyConflict[]> => {
    const db = getDb();
    if (!db) return [];

    const rules = await db
      .select()
      .from(governanceRules)
      .where(
        and(
          eq(governanceRules.ruleKey, ruleKey),
          eq(governanceRules.status, "active")
        )
      );

    const conflicts: PolicyConflict[] = [];

    // Check for internal inconsistencies between different rule types
    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const a = rules[i];
        const b = rules[j];

        if (a.ruleType !== b.ruleType) {
          const levelA = getLevelFromRuleType(a.ruleType);
          const levelB = getLevelFromRuleType(b.ruleType);

          const paramsA = a.parameters as Record<string, unknown>;
          const paramsB = b.parameters as Record<string, unknown>;

          if (paramsA && paramsB) {
            for (const key of Object.keys(paramsA)) {
              if (paramsB[key] !== undefined && paramsA[key] !== paramsB[key]) {
                conflicts.push({
                  id: `INTERNAL-${a.id}-${b.id}`,
                  level: isHigherPriority(levelA, levelB) ? levelA : levelB,
                  ruleId: isHigherPriority(levelA, levelB) ? a.id : b.id,
                  clauseId: a.clauseId.toString(),
                  clauseText: `${levelA} sets ${key} = ${paramsA[key]}, ${levelB} sets ${key} = ${paramsB[key]}`,
                  conflictType: "direct_contradiction",
                  description: `Conflict between ${levelA} and ${levelB} for rule ${ruleKey}`,
                  severity: "high",
                  resolution: "Requires alignment through amendment process",
                });
              }
            }
          }
        }
      }
    }

    return conflicts;
  },

  /**
   * Explain why a rule is valid or conflicted.
   */
  explainRuleStatus: async (ruleKey: string): Promise<{
    ruleKey: string;
    exists: boolean;
    activeVersions: Array<{ level: PolicyLevel; version: string; parameters: Record<string, unknown> }>;
    conflicts: PolicyConflict[];
    status: "clear" | "conflict" | "no_rule";
    explanation: string;
  }> => {
    const db = getDb();
    if (!db) return { ruleKey, exists: false, activeVersions: [], conflicts: [], status: "no_rule", explanation: "Database not configured" };

    const rules = await db
      .select()
      .from(governanceRules)
      .where(
        and(
          eq(governanceRules.ruleKey, ruleKey),
          eq(governanceRules.status, "active")
        )
      );

    if (rules.length === 0) {
      return {
        ruleKey,
        exists: false,
        activeVersions: [],
        conflicts: [],
        status: "no_rule",
        explanation: `No active rule found for "${ruleKey}"`,
      };
    }

    const activeVersions = rules.map(r => ({
      level: getLevelFromRuleType(r.ruleType),
      version: r.version.toString(),
      parameters: (r.parameters as Record<string, unknown>) ?? {},
    }));

    const conflicts = await policyConflictEngine.getConflictsForRule(ruleKey);

    return {
      ruleKey,
      exists: true,
      activeVersions,
      conflicts,
      status: conflicts.length > 0 ? "conflict" : "clear",
      explanation: conflicts.length > 0
        ? `${conflicts.length} conflict(s) detected for "${ruleKey}"`
        : `Rule "${ruleKey}" is clear across all ${activeVersions.length} active version(s)`,
    };
  },

  /**
   * Get hierarchy summary for governance rules.
   */
  getHierarchySummary: async (): Promise<{
    levels: Array<{ level: PolicyLevel; priority: number; ruleCount: number }>;
    totalRules: number;
  }> => {
    const db = getDb();
    if (!db) return { levels: [], totalRules: 0 };

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(governanceRules)
      .where(eq(governanceRules.status, "active"));

    const totalRules = totalResult?.count ?? 0;

    const levels: Array<{ level: PolicyLevel; priority: number; ruleCount: number }> = [];

    for (const [level, priority] of Object.entries(LEVEL_PRIORITY)) {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(governanceRules)
        .where(
          and(
            eq(governanceRules.status, "active"),
            eq(governanceRules.ruleType, level)
          )
        );

      levels.push({
        level: level as PolicyLevel,
        priority,
        ruleCount: countResult?.count ?? 0,
      });
    }

    return {
      levels: levels.sort((a, b) => b.priority - a.priority),
      totalRules,
    };
  },
};

// ============================================================================
// HELPERS
// ============================================================================

async function computeAuditHash(override: Omit<PolicyOverride, "id" | "auditHash">): Promise<string> {
  const data = `${override.conflictId}:${override.actor}:${override.authority}:${override.reason}:${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `audit_${Math.abs(hash).toString(16).padStart(8, "0")}`;
}

export default policyConflictEngine;
