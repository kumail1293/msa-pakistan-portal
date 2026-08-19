/**
 * RBAC (Role-Based Access Control) Service
 *
 * Provides granular permission checking, role assignment, and authorization.
 * Roles are scoped to specific entities (global, org, chapter, committee).
 *
 * Usage:
 *   import { checkPermission, assignRole, getUserPermissions } from "./rbac";
 *
 *   if (await checkPermission(userId, "member.create")) {
 *     // Allow action
 *   }
 *
 *   await assignRole(userId, "chapter_admin", { scopeType: "chapter", scopeId: 5 });
 */

import { eq, and, or, isNull, gt } from "drizzle-orm";
import {
  permissions,
  roles,
  rolePermissions,
  userRoles,
} from "../../drizzle/schema.enterprise";
import { getDb } from "../db";

// ============================================================================
// Cache
// ============================================================================

interface PermCacheEntry {
  permissions: Set<string>;
  expiresAt: number;
}

const PERM_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const permCache = new Map<number, PermCacheEntry>();

// ============================================================================
// Permission Checking
// ============================================================================

/**
 * Check if a user has a specific permission.
 *
 * @param userId - The user's ID
 * @param permissionKey - The permission to check (e.g., "member.create")
 * @param scopeType - Optional scope type (e.g., "chapter")
 * @param scopeId - Optional scope ID
 * @returns true if the user has the permission
 */
export async function checkPermission(
  userId: number,
  permissionKey: string,
  scopeType?: string,
  scopeId?: number
): Promise<boolean> {
  const userPerms = await getUserPermissions(userId, scopeType, scopeId);
  return userPerms.has(permissionKey);
}

/**
 * Check if a user has ANY of the specified permissions.
 */
export async function checkAnyPermission(
  userId: number,
  permissionKeys: string[],
  scopeType?: string,
  scopeId?: number
): Promise<boolean> {
  const userPerms = await getUserPermissions(userId, scopeType, scopeId);
  return permissionKeys.some((key) => userPerms.has(key));
}

/**
 * Check if a user has ALL of the specified permissions.
 */
export async function checkAllPermissions(
  userId: number,
  permissionKeys: string[],
  scopeType?: string,
  scopeId?: number
): Promise<boolean> {
  const userPerms = await getUserPermissions(userId, scopeType, scopeId);
  return permissionKeys.every((key) => userPerms.has(key));
}

/**
 * Get all permissions for a user (across all roles).
 * Results are cached for 5 minutes.
 */
export async function getUserPermissions(
  userId: number,
  scopeType?: string,
  scopeId?: number
): Promise<Set<string>> {
  // Check cache
  const cached = permCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.permissions;
  }

  const db = getDb();
  if (!db) return new Set();

  try {
    // Get all active user roles
    const now = new Date();
    const userRoleRows = await db
      .select()
      .from(userRoles)
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.active, true),
          or(
            isNull(userRoles.expiresAt),
            gt(userRoles.expiresAt, now)
          )
        )
      );

    // Collect permission IDs from all roles
    const permIds = new Set<number>();
    for (const ur of userRoleRows) {
      const rolePermRows = await db
        .select()
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, ur.roleId));

      for (const rp of rolePermRows) {
        permIds.add(rp.permissionId);
      }
    }

    // Resolve permission keys
    const permKeys = new Set<string>();
    for (const permId of Array.from(permIds)) {
      const [perm] = await db
        .select({ key: permissions.key })
        .from(permissions)
        .where(eq(permissions.id, permId))
        .limit(1);

      if (perm) permKeys.add(perm.key);
    }

    // Cache results
    permCache.set(userId, {
      permissions: permKeys,
      expiresAt: Date.now() + PERM_CACHE_TTL_MS,
    });

    return permKeys;
  } catch (error) {
    console.error("[RBAC] Failed to get user permissions:", error);
    return new Set();
  }
}

/**
 * Get all roles for a user.
 */
export async function getUserRoles(
  userId: number
): Promise<Array<{ roleId: number; roleName: string; scopeType: string | null; scopeId: number | null }>> {
  const db = getDb();
  if (!db) return [];

  try {
    const rows = await db
      .select({
        roleId: userRoles.roleId,
        roleName: roles.name,
        scopeType: userRoles.scopeType,
        scopeId: userRoles.scopeId,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.active, true)
        )
      );

    return rows;
  } catch (error) {
    console.error("[RBAC] Failed to get user roles:", error);
    return [];
  }
}

// ============================================================================
// Role Assignment
// ============================================================================

/**
 * Assign a role to a user.
 */
export async function assignRole(
  userId: number,
  roleName: string,
  options: {
    scopeType?: string;
    scopeId?: number;
    assignedBy?: number;
    expiresAt?: Date;
  } = {}
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    // Look up the role
    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);

    if (!role) {
      console.warn(`[RBAC] Role "${roleName}" not found.`);
      return false;
    }

    // Check for existing active assignment
    const existing = await db
      .select()
      .from(userRoles)
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.roleId, role.id),
          eq(userRoles.active, true)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      console.log(`[RBAC] User ${userId} already has role "${roleName}".`);
      return true; // Already assigned
    }

    // Insert the assignment
    await db.insert(userRoles).values({
      userId,
      roleId: role.id,
      scopeType: options.scopeType,
      scopeId: options.scopeId,
      assignedBy: options.assignedBy,
      expiresAt: options.expiresAt,
    });

    invalidatePermCache(userId);
    console.log(`[RBAC] Assigned role "${roleName}" to user ${userId}.`);
    return true;
  } catch (error) {
    console.error("[RBAC] Failed to assign role:", error);
    return false;
  }
}

/**
 * Remove a role from a user.
 */
export async function removeRole(
  userId: number,
  roleName: string,
  scopeType?: string,
  scopeId?: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);

    if (!role) return false;

    // Deactivate the assignment (soft delete)
    const conditions = [
      eq(userRoles.userId, userId),
      eq(userRoles.roleId, role.id),
      eq(userRoles.active, true),
    ];

    if (scopeType) conditions.push(eq(userRoles.scopeType, scopeType));
    if (scopeId) conditions.push(eq(userRoles.scopeId, scopeId));

    await db
      .update(userRoles)
      .set({ active: false, updatedAt: new Date() })
      .where(and(...conditions));

    invalidatePermCache(userId);
    return true;
  } catch (error) {
    console.error("[RBAC] Failed to remove role:", error);
    return false;
  }
}

// ============================================================================
// Permission Management
// ============================================================================

/**
 * Create a new permission.
 */
export async function createPermission(
  key: string,
  name: string,
  description?: string,
  category?: string
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await db.insert(permissions).values({
      key,
      name,
      description,
      category,
    });
    return true;
  } catch (error) {
    console.error("[RBAC] Failed to create permission:", error);
    return false;
  }
}

/**
 * Create a new role.
 */
export async function createRole(
  name: string,
  displayName: string,
  options: {
    description?: string;
    scope?: string;
    isSystem?: boolean;
    hierarchyLevel?: number;
  } = {}
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await db.insert(roles).values({
      name,
      displayName,
      description: options.description,
      scope: options.scope as any,
      isSystem: options.isSystem ?? false,
      hierarchyLevel: options.hierarchyLevel ?? 0,
    });
    return true;
  } catch (error) {
    console.error("[RBAC] Failed to create role:", error);
    return false;
  }
}

/**
 * Assign a permission to a role.
 */
export async function assignPermissionToRole(
  roleName: string,
  permissionKey: string
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);

    const [perm] = await db
      .select()
      .from(permissions)
      .where(eq(permissions.key, permissionKey))
      .limit(1);

    if (!role || !perm) {
      console.warn(`[RBAC] Role "${roleName}" or permission "${permissionKey}" not found.`);
      return false;
    }

    // Check for existing assignment
    const existing = await db
      .select()
      .from(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, role.id),
          eq(rolePermissions.permissionId, perm.id)
        )
      )
      .limit(1);

    if (existing.length > 0) return true; // Already assigned

    await db.insert(rolePermissions).values({
      roleId: role.id,
      permissionId: perm.id,
    });

    return true;
  } catch (error) {
    console.error("[RBAC] Failed to assign permission to role:", error);
    return false;
  }
}

// ============================================================================
// Cache Invalidation
// ============================================================================

export function invalidatePermCache(userId: number): void {
  permCache.delete(userId);
}

export function invalidateAllPermCache(): void {
  permCache.clear();
}

// ============================================================================
// Default Roles & Permissions
// ============================================================================

/**
 * Default permission definitions.
 */
export const DEFAULT_PERMISSIONS = [
  // Member management
  { key: "member.view", name: "View Members", category: "membership" },
  { key: "member.create", name: "Create Members", category: "membership" },
  { key: "member.edit", name: "Edit Members", category: "membership" },
  { key: "member.delete", name: "Delete Members", category: "membership" },
  { key: "member.approve", name: "Approve Members", category: "membership" },
  { key: "member.suspend", name: "Suspend Members", category: "membership" },
  { key: "member.directory", name: "Access Member Directory", category: "membership" },

  // Chapter management
  { key: "chapter.view", name: "View Chapters", category: "chapter" },
  { key: "chapter.create", name: "Create Chapters", category: "chapter" },
  { key: "chapter.edit", name: "Edit Chapters", category: "chapter" },
  { key: "chapter.delete", name: "Delete Chapters", category: "chapter" },
  { key: "chapter.admin", name: "Administer Chapter", category: "chapter" },

  // Activity management
  { key: "activity.view", name: "View Activities", category: "activity" },
  { key: "activity.create", name: "Create Activities", category: "activity" },
  { key: "activity.edit", name: "Edit Activities", category: "activity" },
  { key: "activity.approve", name: "Approve Activities", category: "activity" },
  { key: "activity.delete", name: "Delete Activities", category: "activity" },
  { key: "activity.attendance", name: "Manage Attendance", category: "activity" },

  // Event management
  { key: "event.view", name: "View Events", category: "event" },
  { key: "event.create", name: "Create Events", category: "event" },
  { key: "event.edit", name: "Edit Events", category: "event" },
  { key: "event.approve", name: "Approve Events", category: "event" },
  { key: "event.delete", name: "Delete Events", category: "event" },
  { key: "event.register", name: "Register for Events", category: "event" },

  // Governance
  { key: "governance.view", name: "View Governance", category: "governance" },
  { key: "governance.committee", name: "Manage Committees", category: "governance" },
  { key: "governance.meeting", name: "Manage Meetings", category: "governance" },
  { key: "governance.motion", name: "Submit Motions", category: "governance" },
  { key: "governance.vote", name: "Vote on Motions", category: "governance" },
  { key: "governance.decision", name: "Record Decisions", category: "governance" },

  // Elections
  { key: "election.view", name: "View Elections", category: "election" },
  { key: "election.manage", name: "Manage Elections", category: "election" },
  { key: "election.candidate", name: "Nominate Candidates", category: "election" },
  { key: "election.vote", name: "Vote in Elections", category: "election" },
  { key: "election.certify", name: "Certify Results", category: "election" },

  // Finance
  { key: "finance.view", name: "View Finances", category: "finance" },
  { key: "finance.budget", name: "Manage Budgets", category: "finance" },
  { key: "finance.expense", name: "Submit Expenses", category: "finance" },
  { key: "finance.approve", name: "Approve Expenses", category: "finance" },
  { key: "finance.report", name: "Generate Reports", category: "finance" },

  // Documents
  { key: "document.view", name: "View Documents", category: "document" },
  { key: "document.create", name: "Create Documents", category: "document" },
  { key: "document.edit", name: "Edit Documents", category: "document" },
  { key: "document.delete", name: "Delete Documents", category: "document" },
  { key: "document.approve", name: "Approve Documents", category: "document" },

  // Administration
  { key: "admin.config", name: "Manage Configuration", category: "admin" },
  { key: "admin.users", name: "Manage Users", category: "admin" },
  { key: "admin.roles", name: "Manage Roles", category: "admin" },
  { key: "admin.audit", name: "View Audit Logs", category: "admin" },
  { key: "admin.feature_flags", name: "Manage Feature Flags", category: "admin" },
  { key: "admin.integrations", name: "Manage Integrations", category: "admin" },
  { key: "admin.branding", name: "Manage Branding", category: "admin" },

  // Projects
  { key: "project.view", name: "View Projects", category: "project" },
  { key: "project.create", name: "Create Projects", category: "project" },
  { key: "project.edit", name: "Edit Projects", category: "project" },
  { key: "project.delete", name: "Delete Projects", category: "project" },
  { key: "project.task", name: "Manage Tasks", category: "project" },

  // Training
  { key: "training.view", name: "View Courses", category: "training" },
  { key: "training.create", name: "Create Courses", category: "training" },
  { key: "training.enroll", name: "Enroll in Courses", category: "training" },
  { key: "training.certify", name: "Issue Certificates", category: "training" },

  // Communications
  { key: "communication.announce", name: "Create Announcements", category: "communication" },
  { key: "communication.notify", name: "Send Notifications", category: "communication" },
  { key: "communication.template", name: "Manage Templates", category: "communication" },
];

/**
 * Default role definitions with their permissions.
 */
export const DEFAULT_ROLES: Array<{
  name: string;
  displayName: string;
  description: string;
  scope: string;
  isSystem: boolean;
  isDefault?: boolean;
  hierarchyLevel: number;
  permissions: string[];
}> = [
  {
    name: "superadmin",
    displayName: "Super Administrator",
    description: "Full system access across all organizations",
    scope: "global",
    isSystem: true,
    hierarchyLevel: 100,
    permissions: DEFAULT_PERMISSIONS.map((p) => p.key), // All permissions
  },
  {
    name: "admin",
    displayName: "Administrator",
    description: "Organization-wide administrative access",
    scope: "org",
    isSystem: true,
    hierarchyLevel: 80,
    permissions: [
      "member.view", "member.create", "member.edit", "member.approve",
      "chapter.view", "chapter.create", "chapter.edit", "chapter.admin",
      "activity.view", "activity.create", "activity.edit", "activity.approve",
      "event.view", "event.create", "event.edit", "event.approve",
      "governance.view", "governance.committee", "governance.meeting",
      "document.view", "document.create", "document.edit", "document.approve",
      "admin.config", "admin.users", "admin.audit", "admin.branding",
      "finance.view", "finance.budget", "finance.expense", "finance.approve",
      "project.view", "project.create", "project.edit", "project.task",
      "training.view", "training.create", "training.enroll",
      "communication.announce", "communication.notify",
    ],
  },
  {
    name: "official",
    displayName: "Official",
    description: "Portal official with module-specific access",
    scope: "org",
    isSystem: true,
    hierarchyLevel: 60,
    permissions: [
      "member.view", "member.directory",
      "activity.view", "activity.attendance",
      "event.view", "event.register",
      "governance.view",
      "document.view",
    ],
  },
  {
    name: "chapter_admin",
    displayName: "Chapter Administrator",
    description: "Administers a specific chapter",
    scope: "chapter",
    isSystem: false,
    hierarchyLevel: 40,
    permissions: [
      "member.view", "member.create", "member.edit", "member.approve",
      "chapter.view", "chapter.edit", "chapter.admin",
      "activity.view", "activity.create", "activity.edit", "activity.attendance",
      "event.view", "event.create", "event.edit",
      "governance.view", "governance.meeting",
      "document.view", "document.create",
      "project.view", "project.create", "project.task",
      "communication.announce",
    ],
  },
  {
    name: "user",
    displayName: "Member",
    description: "Standard member with basic access",
    scope: "org",
    isSystem: true,
    isDefault: true,
    hierarchyLevel: 10,
    permissions: [
      "member.view",
      "activity.view", "activity.attendance",
      "event.view", "event.register",
      "document.view",
      "project.view",
      "training.view", "training.enroll",
    ],
  },
];

/**
 * Seed default roles and permissions on startup.
 */
export async function seedRbacDefaults(): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    // Seed permissions
    let permCount = 0;
    for (const perm of DEFAULT_PERMISSIONS) {
      const existing = await db
        .select({ key: permissions.key })
        .from(permissions)
        .where(eq(permissions.key, perm.key))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(permissions).values({
          key: perm.key,
          name: perm.name,
          category: perm.category,
        });
        permCount++;
      }
    }
    if (permCount > 0) {
      console.log(`[RBAC] Seeded ${permCount} permission(s).`);
    }

    // Seed roles
    let roleCount = 0;
    for (const roleDef of DEFAULT_ROLES) {
      const existing = await db
        .select({ name: roles.name })
        .from(roles)
        .where(eq(roles.name, roleDef.name))
        .limit(1);

      let roleId: number;
      if (existing.length === 0) {
        const result = await db.insert(roles).values({
          name: roleDef.name,
          displayName: roleDef.displayName,
          description: roleDef.description,
          scope: roleDef.scope as any,
          isSystem: roleDef.isSystem,
          isDefault: roleDef.isDefault ?? false,
          hierarchyLevel: roleDef.hierarchyLevel,
        });
        roleId = Number(result[0].insertId);
        roleCount++;
      } else {
        const [role] = await db
          .select({ id: roles.id })
          .from(roles)
          .where(eq(roles.name, roleDef.name))
          .limit(1);
        roleId = role!.id;
      }

      // Seed role-permission mappings
      for (const permKey of roleDef.permissions) {
        const [perm] = await db
          .select({ id: permissions.id })
          .from(permissions)
          .where(eq(permissions.key, permKey))
          .limit(1);

        if (perm) {
          const existingRp = await db
            .select()
            .from(rolePermissions)
            .where(
              and(
                eq(rolePermissions.roleId, roleId),
                eq(rolePermissions.permissionId, perm.id)
              )
            )
            .limit(1);

          if (existingRp.length === 0) {
            await db.insert(rolePermissions).values({
              roleId,
              permissionId: perm.id,
            });
          }
        }
      }
    }
    if (roleCount > 0) {
      console.log(`[RBAC] Seeded ${roleCount} role(s) with permissions.`);
    }
  } catch (error) {
    console.warn("[RBAC] Failed to seed RBAC defaults:", error);
  }
}
