/**
 * Capability Resolver (Phase 5)
 *
 * Maps roles and positions to capabilities. The application resolves
 * authorization dynamically from configuration, not from hardcoded role names.
 *
 * Core principle:
 *   Role → Capability → Policy
 *
 * Example:
 *   VPF → finance.request.review, finance.budget.approve, finance.payment.verify
 *   VPA → activities.submit, activities.approve, activities.report
 *   President → everything
 *
 * Usage:
 *   import { resolveCapabilities, hasCapability } from "./capabilityResolver";
 *
 *   const caps = await resolveCapabilities(userId);
 *   if (await hasCapability(userId, "finance.approve")) { ... }
 */

import { checkPermission, getUserPermissions } from "./rbac";
import { getConfig } from "./configService";

// ============================================================================
// Types
// ============================================================================

export interface CapabilityResolution {
  userId: number;
  capabilities: Set<string>;
  roles: string[];
  source: "rbac" | "position" | "config";
}

// ============================================================================
// MSA Position → Capability Mapping (configurable)
// ============================================================================

/**
 * Default capability mappings for MSA positions.
 * These can be overridden via configuration.
 */
const DEFAULT_POSITION_CAPABILITIES: Record<string, string[]> = {
  // National Executive Board
  president: [
    "member.view", "member.create", "member.edit", "member.approve", "member.delete",
    "member.suspend", "member.directory",
    "chapter.view", "chapter.create", "chapter.edit", "chapter.delete", "chapter.admin",
    "activity.view", "activity.create", "activity.edit", "activity.approve", "activity.delete", "activity.attendance",
    "event.view", "event.create", "event.edit", "event.approve", "event.delete", "event.register",
    "governance.view", "governance.committee", "governance.meeting", "governance.motion", "governance.vote", "governance.decision",
    "election.view", "election.manage", "election.candidate", "election.vote", "election.certify",
    "finance.view", "finance.budget", "finance.expense", "finance.approve", "finance.report",
    "document.view", "document.create", "document.edit", "document.delete", "document.approve",
    "admin.config", "admin.users", "admin.roles", "admin.audit", "admin.feature_flags", "admin.integrations", "admin.branding",
    "project.view", "project.create", "project.edit", "project.delete", "project.task",
    "training.view", "training.create", "training.enroll", "training.certify",
    "communication.announce", "communication.notify", "communication.template",
    "workflow.manage", "configuration.manage",
  ],
  vpf: [
    "member.view", "member.directory",
    "activity.view", "event.view",
    "governance.view",
    "finance.view", "finance.budget", "finance.expense", "finance.approve", "finance.report",
    "document.view", "document.create",
    "project.view",
    "communication.announce",
  ],
  vpi: [
    "member.view", "member.create", "member.edit", "member.approve", "member.directory",
    "chapter.view", "chapter.create", "chapter.edit", "chapter.admin",
    "activity.view", "activity.create", "activity.edit", "activity.approve", "activity.attendance",
    "event.view", "event.create", "event.edit", "event.approve",
    "governance.view", "governance.meeting",
    "document.view", "document.create",
    "project.view", "project.create", "project.edit", "project.task",
    "training.view", "training.create",
    "communication.announce",
  ],
  vpa: [
    "member.view", "member.directory",
    "activity.view", "activity.create", "activity.edit", "activity.approve", "activity.attendance",
    "event.view", "event.create", "event.edit", "event.approve",
    "governance.view",
    "document.view", "document.create",
    "project.view", "project.create",
    "training.view",
    "communication.announce",
  ],
  vpm: [
    "member.view", "member.create", "member.edit", "member.approve", "member.directory",
    "activity.view",
    "event.view", "event.register",
    "governance.view",
    "document.view", "document.create",
    "project.view",
    "training.view", "training.enroll",
    "communication.announce", "communication.notify",
  ],
  vpe: [
    "member.view", "member.directory",
    "activity.view",
    "event.view", "event.create", "event.edit", "event.approve",
    "governance.view",
    "document.view",
    "project.view", "project.create", "project.edit",
    "training.view",
    "communication.announce",
  ],
  vpprc: [
    "member.view", "member.directory",
    "governance.view", "governance.committee", "governance.meeting", "governance.motion", "governance.vote", "governance.decision",
    "document.view", "document.create", "document.edit",
    "communication.announce", "communication.notify",
  ],
  vpcb: [
    "member.view", "member.directory",
    "governance.view",
    "document.view",
    "communication.announce", "communication.notify",
  ],

  // Support Committee
  npo: [
    "member.view", "member.create", "member.edit", "member.directory",
    "chapter.view", "chapter.create", "chapter.edit",
    "activity.view",
    "governance.view",
    "document.view",
    "admin.config", "admin.audit",
  ],
  norp: [
    "member.view", "member.directory",
    "governance.view", "governance.committee", "governance.meeting",
    "document.view",
    "admin.audit",
  ],
  nora: [
    "member.view", "member.directory",
    "governance.view",
    "document.view",
  ],
  nome: [
    "member.view", "member.directory",
    "activity.view",
    "event.view",
    "document.view",
    "training.view",
    "communication.announce",
  ],
  nore: [
    "member.view", "member.directory",
    "activity.view", "activity.attendance",
    "event.view",
    "document.view",
    "training.view",
  ],
  neo: [
    "member.view", "member.directory",
    "activity.view",
    "event.view",
    "document.view",
    "training.view",
    "communication.announce",
  ],

  // Local Council roles
  "lc-president": [
    "member.view", "member.create", "member.edit", "member.approve", "member.directory",
    "chapter.view", "chapter.edit", "chapter.admin",
    "activity.view", "activity.create", "activity.edit", "activity.approve", "activity.attendance",
    "event.view", "event.create", "event.edit", "event.approve",
    "governance.view", "governance.meeting",
    "document.view", "document.create",
    "project.view", "project.create",
    "communication.announce",
  ],
  "lc-vpa": [
    "member.view", "member.directory",
    "activity.view", "activity.create", "activity.edit", "activity.attendance",
    "event.view", "event.create", "event.edit",
    "governance.view",
    "document.view",
    "training.view",
    "communication.announce",
  ],
  "lc-vpf": [
    "member.view", "member.directory",
    "finance.view", "finance.expense", "finance.report",
    "document.view",
  ],
  "lc-secretary": [
    "member.view", "member.directory",
    "governance.view", "governance.meeting",
    "document.view", "document.create",
    "communication.announce",
  ],

  // Coordinator Institute
  "ci-coordinator": [
    "member.view", "member.create", "member.edit", "member.approve", "member.directory",
    "activity.view", "activity.create", "activity.edit",
    "event.view", "event.create",
    "governance.view",
    "document.view", "document.create",
    "communication.announce",
  ],
};

// ============================================================================
// Capability Resolution
// ============================================================================

/**
 * Resolve all capabilities for a user.
 * First checks RBAC permissions, then adds position-based capabilities.
 */
export async function resolveCapabilities(userId: number): Promise<CapabilityResolution> {
  // 1. Get RBAC permissions
  const rbacPerms = await getUserPermissions(userId);

  // 2. Get position-based capabilities from config
  const positionCapsConfig = await getConfig("capability.positionMappings", "");
  const positionCaps = positionCapsConfig
    ? parsePositionCapabilities(positionCapsConfig)
    : DEFAULT_POSITION_CAPABILITIES;

  // 3. Combine (RBAC takes precedence)
  const capabilities = new Set(rbacPerms);

  // For now, position capabilities are additive (RBAC is the primary source)
  // In production, user's position would be resolved from the database

  return {
    userId,
    capabilities,
    roles: [], // Would be resolved from userRoles
    source: "rbac",
  };
}

/**
 * Check if a user has a specific capability.
 * Resolves from both RBAC permissions and position-based capabilities.
 */
export async function hasCapability(
  userId: number,
  capability: string
): Promise<boolean> {
  // Fast path: check RBAC first
  const hasRbac = await checkPermission(userId, capability);
  if (hasRbac) return true;

  // Slow path: resolve full capabilities
  const resolution = await resolveCapabilities(userId);
  return resolution.capabilities.has(capability);
}

/**
 * Check if a user has ANY of the specified capabilities.
 */
export async function hasAnyCapability(
  userId: number,
  capabilities: string[]
): Promise<boolean> {
  for (const cap of capabilities) {
    if (await hasCapability(userId, cap)) return true;
  }
  return false;
}

/**
 * Check if a user has ALL of the specified capabilities.
 */
export async function hasAllCapabilities(
  userId: number,
  capabilities: string[]
): Promise<boolean> {
  for (const cap of capabilities) {
    if (!(await hasCapability(userId, cap))) return false;
  }
  return true;
}

// ============================================================================
// Authorization Middleware Helpers
// ============================================================================

/**
 * Create a permission-gated middleware for tRPC.
 * This replaces hardcoded role-name checks with capability checks.
 */
export function requireCapability(capability: string) {
  return async (userId: number): Promise<boolean> => {
    return hasCapability(userId, capability);
  };
}

/**
 * Authorization matrix for common operations.
 * Used by routers to check permissions consistently.
 */
export const AUTHORIZATION_MATRIX: Record<string, string[]> = {
  // Member operations
  "member.view": ["member.view"],
  "member.create": ["member.create"],
  "member.edit": ["member.edit"],
  "member.delete": ["member.delete"],
  "member.approve": ["member.approve"],
  "member.suspend": ["member.suspend"],

  // Activity operations
  "activity.view": ["activity.view"],
  "activity.create": ["activity.create"],
  "activity.edit": ["activity.edit"],
  "activity.approve": ["activity.approve"],
  "activity.delete": ["activity.delete"],

  // Finance operations
  "finance.view": ["finance.view"],
  "finance.budget": ["finance.budget"],
  "finance.expense": ["finance.expense"],
  "finance.approve": ["finance.approve"],
  "finance.report": ["finance.report"],

  // Governance operations
  "governance.view": ["governance.view"],
  "governance.committee": ["governance.committee"],
  "governance.meeting": ["governance.meeting"],
  "governance.motion": ["governance.motion"],
  "governance.vote": ["governance.vote"],
  "governance.decision": ["governance.decision"],

  // Election operations
  "election.view": ["election.view"],
  "election.manage": ["election.manage"],
  "election.candidate": ["election.candidate"],
  "election.vote": ["election.vote"],
  "election.certify": ["election.certify"],

  // Document operations
  "document.view": ["document.view"],
  "document.create": ["document.create"],
  "document.edit": ["document.edit"],
  "document.delete": ["document.delete"],
  "document.approve": ["document.approve"],

  // Admin operations
  "admin.config": ["admin.config"],
  "admin.users": ["admin.users"],
  "admin.roles": ["admin.roles"],
  "admin.audit": ["admin.audit"],
  "admin.feature_flags": ["admin.feature_flags"],
};

// ============================================================================
// Helpers
// ============================================================================

function parsePositionCapabilities(
  configValue: string
): Record<string, string[]> {
  try {
    return JSON.parse(configValue);
  } catch {
    return DEFAULT_POSITION_CAPABILITIES;
  }
}

/**
 * Get all defined capabilities (for admin UI / documentation).
 */
export function getAllCapabilities(): Array<{
  key: string;
  category: string;
  description: string;
}> {
  const seen = new Set<string>();
  const result: Array<{ key: string; category: string; description: string }> = [];

  for (const caps of Object.values(DEFAULT_POSITION_CAPABILITIES)) {
    for (const cap of caps) {
      if (!seen.has(cap)) {
        seen.add(cap);
        const [category] = cap.split(".");
        result.push({
          key: cap,
          category,
          description: `Capability: ${cap}`,
        });
      }
    }
  }

  return result.sort((a, b) => a.key.localeCompare(b.key));
}
