/**
 * Module Permission Service
 *
 * Provides per-module, per-user access control with three levels:
 *   - view:    Can view/read content only (no editing, no comments)
 *   - comment: Can view + add comments (no editing)
 *   - edit:    Full edit access (create, update, delete)
 *
 * Only the Superadmin can grant/edit these permissions.
 *
 * Usage:
 *   import { getModuleAccess, setModuleAccess, MODULE_LIST } from "./modulePermissionService";
 *
 *   const access = getModuleAccess(userId, "activities"); // "view" | "comment" | "edit"
 *   setModuleAccess(userId, "activities", "comment");
 */

// ============================================================================
// Types
// ============================================================================

export type ModuleAccessLevel = "view" | "comment" | "edit";

export interface ModulePermission {
  userId: number;
  module: string;
  accessLevel: ModuleAccessLevel;
  grantedBy: number | null;
  grantedAt: Date;
  updatedAt: Date;
  notes: string | null;
}

// ============================================================================
// Module List — all portal modules
// ============================================================================

export const MODULE_LIST = [
  { id: "activities",   label: "Activities",   description: "Health camps, workshops, blood drives, etc." },
  { id: "events",       label: "Events",       description: "Conferences, competitions, summits, etc." },
  { id: "chapters",     label: "Chapters/LCs", description: "Local councils and regional chapters" },
  { id: "members",      label: "Members",      description: "Member directory, profiles, membership" },
  { id: "finance",      label: "Finance",      description: "Budgets, expenses, transactions" },
  { id: "governance",   label: "Governance",   description: "Bylaws, motions, plenary, decisions" },
  { id: "elections",    label: "Elections",    description: "Elections, nominations, voting" },
  { id: "documents",    label: "Documents",    description: "File uploads, templates, archives" },
  { id: "training",     label: "Training",     description: "Courses, certifications, enrollment" },
  { id: "projects",     label: "Projects",     description: "Project tracking, tasks, milestones" },
  { id: "meetings",     label: "Meetings",     description: "Meeting schedules, minutes, agendas" },
  { id: "communications", label: "Communications", description: "Announcements, notifications, messaging" },
  { id: "nef",          label: "NEF/NRF",      description: "National Execution Fund / National Response Fund" },
  { id: "credentials",  label: "Credentials",  description: "Credential verification, certificates" },
  { id: "volunteer",    label: "Volunteer",    description: "Volunteer opportunities, sign-ups" },
  { id: "recognition",  label: "Recognition",  description: "Awards, achievements, recognition" },
  { id: "settings",     label: "Settings",     description: "User preferences, profile settings" },
] as const;

export type ModuleId = (typeof MODULE_LIST)[number]["id"];

// Access level hierarchy for comparison
const ACCESS_RANK: Record<ModuleAccessLevel, number> = {
  view: 0,
  comment: 1,
  edit: 2,
};

// ============================================================================
// In-Memory Store (persisted to JSON)
// ============================================================================

import * as fs from "fs";
import * as path from "path";

const STORE_PATH = path.join(process.cwd(), ".data", "module-permissions.json");

interface StoredPermissions {
  permissions: Record<string, Record<string, ModuleAccessLevel>>;
  // "userId:module" -> accessLevel
  defaultAccess: ModuleAccessLevel;
  superadminOverrides: Record<string, ModuleAccessLevel>;
}

let store: StoredPermissions = {
  permissions: {},
  defaultAccess: "view",
  superadminOverrides: {},
};

function loadStore(): void {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, "utf8");
      const parsed = JSON.parse(raw);
      store = { ...store, ...parsed };
    }
  } catch {
    // Start fresh
  }
}

function saveStore(): void {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
  } catch (err) {
    console.error("[ModulePermissions] Failed to save store:", err);
  }
}

// Initialize on import
loadStore();

// ============================================================================
// Public API
// ============================================================================

/**
 * Get a user's access level for a specific module.
 *
 * Resolution order:
 *   1. Superadmin → always "edit"
 *   2. Explicit per-module permission
 *   3. Default ("view")
 */
export function getModuleAccess(
  userId: number,
  userRole: string,
  moduleId: string,
  moduleAccessList: string[] | null = null
): ModuleAccessLevel {
  // Superadmin always has full access
  if (userRole === "superadmin") return "edit";

  // Check explicit permission
  const key = `${userId}:${moduleId}`;
  const explicit = store.permissions[key];
  if (explicit) return explicit;

  // Check if user's officialModuleAccess grants this module (officials with module access get "edit")
  if (moduleAccessList && moduleAccessList.includes(moduleId)) {
    return "edit";
  }

  // Default
  return store.defaultAccess;
}

/**
 * Get access level for all modules for a user.
 */
export function getAllModuleAccess(
  userId: number,
  userRole: string,
  moduleAccessList: string[] | null = null
): Record<string, ModuleAccessLevel> {
  const result: Record<string, ModuleAccessLevel> = {};
  for (const mod of MODULE_LIST) {
    result[mod.id] = getModuleAccess(userId, userRole, mod.id, moduleAccessList);
  }
  return result;
}

/**
 * Set a user's access level for a specific module.
 * Only callable by superadmin.
 */
export function setModuleAccess(
  userId: number,
  moduleId: string,
  accessLevel: ModuleAccessLevel,
  grantedBy: number,
  notes?: string
): ModulePermission {
  const key = `${userId}:${moduleId}`;

  const existing = store.permissions[key];
  const now = new Date();

  store.permissions[key] = accessLevel;
  saveStore();

  return {
    userId,
    module: moduleId,
    accessLevel,
    grantedBy,
    grantedAt: existing ? now : now,
    updatedAt: now,
    notes: notes ?? null,
  };
}

/**
 * Bulk set permissions for a user across multiple modules.
 */
export function setBulkModuleAccess(
  userId: number,
  permissions: { module: string; accessLevel: ModuleAccessLevel }[],
  grantedBy: number
): ModulePermission[] {
  return permissions.map((p) =>
    setModuleAccess(userId, p.module, p.accessLevel, grantedBy)
  );
}

/**
 * Remove explicit permissions for a user/module (reverts to default).
 */
export function removeModuleAccess(userId: number, moduleId: string): boolean {
  const key = `${userId}:${moduleId}`;
  const existed = key in store.permissions;
  delete store.permissions[key];
  if (existed) saveStore();
  return existed;
}

/**
 * Get all permissions for a specific user.
 */
export function getUserModulePermissions(userId: number): ModulePermission[] {
  const result: ModulePermission[] = [];
  const prefix = `${userId}:`;

  for (const [key, accessLevel] of Object.entries(store.permissions)) {
    if (key.startsWith(prefix)) {
      const moduleId = key.slice(prefix.length);
      result.push({
        userId,
        module: moduleId,
        accessLevel,
        grantedBy: null,
        grantedAt: new Date(),
        updatedAt: new Date(),
        notes: null,
      });
    }
  }

  return result;
}

/**
 * Get all permissions for a specific module (which users have what access).
 */
export function getModulePermissions(moduleId: string): ModulePermission[] {
  const result: ModulePermission[] = [];
  const suffix = `:${moduleId}`;

  for (const [key, accessLevel] of Object.entries(store.permissions)) {
    if (key.endsWith(suffix)) {
      const userId = parseInt(key.slice(0, key.length - suffix.length), 10);
      if (!isNaN(userId)) {
        result.push({
          userId,
          module: moduleId,
          accessLevel,
          grantedBy: null,
          grantedAt: new Date(),
          updatedAt: new Date(),
          notes: null,
        });
      }
    }
  }

  return result;
}

/**
 * Check if a user has at least a certain access level for a module.
 */
export function hasAccess(
  userId: number,
  userRole: string,
  moduleId: string,
  requiredLevel: ModuleAccessLevel,
  moduleAccessList: string[] | null = null
): boolean {
  const actual = getModuleAccess(userId, userRole, moduleId, moduleAccessList);
  return ACCESS_RANK[actual] >= ACCESS_RANK[requiredLevel];
}

/**
 * Check if user can view a module.
 */
export function canView(
  userId: number,
  userRole: string,
  moduleId: string,
  moduleAccessList?: string[] | null
): boolean {
  return hasAccess(userId, userRole, moduleId, "view", moduleAccessList);
}

/**
 * Check if user can comment on a module.
 */
export function canComment(
  userId: number,
  userRole: string,
  moduleId: string,
  moduleAccessList?: string[] | null
): boolean {
  return hasAccess(userId, userRole, moduleId, "comment", moduleAccessList);
}

/**
 * Check if user can edit a module.
 */
export function canEdit(
  userId: number,
  userRole: string,
  moduleId: string,
  moduleAccessList?: string[] | null
): boolean {
  return hasAccess(userId, userRole, moduleId, "edit", moduleAccessList);
}

/**
 * Get the default access level.
 */
export function getDefaultAccess(): ModuleAccessLevel {
  return store.defaultAccess;
}

/**
 * Set the default access level (only superadmin).
 */
export function setDefaultAccess(level: ModuleAccessLevel): void {
  store.defaultAccess = level;
  saveStore();
}

/**
 * Get a summary of all permissions across all users and modules.
 */
export function getPermissionSummary(): {
  totalPermissions: number;
  byLevel: Record<ModuleAccessLevel, number>;
  byModule: Record<string, Record<ModuleAccessLevel, number>>;
} {
  const byLevel: Record<ModuleAccessLevel, number> = { view: 0, comment: 0, edit: 0 };
  const byModule: Record<string, Record<ModuleAccessLevel, number>> = {};

  for (const [_key, level] of Object.entries(store.permissions)) {
    byLevel[level]++;
  }

  for (const mod of MODULE_LIST) {
    const perms = getModulePermissions(mod.id);
    byModule[mod.id] = { view: 0, comment: 0, edit: 0 };
    for (const p of perms) {
      byModule[mod.id][p.accessLevel]++;
    }
  }

  return {
    totalPermissions: Object.keys(store.permissions).length,
    byLevel,
    byModule,
  };
}

/**
 * Reset all permissions (superadmin only, for testing).
 */
export function resetAllPermissions(): void {
  store = {
    permissions: {},
    defaultAccess: "view",
    superadminOverrides: {},
  };
  saveStore();
}

// ============================================================================
// Access Level Labels
// ============================================================================

export const ACCESS_LEVEL_LABELS: Record<ModuleAccessLevel, { label: string; description: string; icon: string }> = {
  view: {
    label: "View Only",
    description: "Can view content but cannot edit or comment",
    icon: "👁️",
  },
  comment: {
    label: "View + Comments",
    description: "Can view content and add comments, but cannot edit",
    icon: "💬",
  },
  edit: {
    label: "Full Edit",
    description: "Can view, comment, and edit/create/delete content",
    icon: "✏️",
  },
};

/**
 * Get a user-friendly description of their access level for a module.
 */
export function getAccessDescription(level: ModuleAccessLevel): string {
  return ACCESS_LEVEL_LABELS[level].description;
}

/**
 * Get all access levels with their labels and icons.
 */
export function getAllAccessLevels() {
  return ACCESS_LEVEL_LABELS;
}
