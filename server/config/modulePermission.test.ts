/**
 * Tests for Module Permission Service
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  getModuleAccess,
  setModuleAccess,
  removeModuleAccess,
  hasAccess,
  canView,
  canComment,
  canEdit,
  getUserModulePermissions,
  getModulePermissions,
  getPermissionSummary,
  setDefaultAccess,
  getDefaultAccess,
  resetAllPermissions,
  setBulkModuleAccess,
  MODULE_LIST,
  ACCESS_LEVEL_LABELS,
  type ModuleAccessLevel,
} from "./modulePermissionService";

describe("ModulePermissionService", () => {
  beforeEach(() => {
    resetAllPermissions();
  });

  // ============================================================================
  // Default Access
  // ============================================================================

  describe("Default access", () => {
    it("defaults to 'view'", () => {
      expect(getDefaultAccess()).toBe("view");
    });

    it("can change default access", () => {
      setDefaultAccess("comment");
      expect(getDefaultAccess()).toBe("comment");
    });

    it("can change default to edit", () => {
      setDefaultAccess("edit");
      expect(getDefaultAccess()).toBe("edit");
    });
  });

  // ============================================================================
  // getModuleAccess
  // ============================================================================

  describe("getModuleAccess", () => {
    it("returns 'edit' for superadmin regardless of settings", () => {
      expect(getModuleAccess(1, "superadmin", "activities")).toBe("edit");
      expect(getModuleAccess(1, "superadmin", "finance")).toBe("edit");
      expect(getModuleAccess(1, "superadmin", "governance")).toBe("edit");
    });

    it("returns default for users with no explicit permissions", () => {
      expect(getModuleAccess(10, "user", "activities")).toBe("view");
    });

    it("returns explicit permission when set", () => {
      setModuleAccess(10, "activities", "comment", 1);
      expect(getModuleAccess(10, "user", "activities")).toBe("comment");
    });

    it("returns 'edit' for officials with module in moduleAccess list", () => {
      expect(getModuleAccess(10, "official", "activities", ["activities", "events"])).toBe("edit");
    });

    it("returns default for officials without module in list", () => {
      expect(getModuleAccess(10, "official", "finance", ["activities", "events"])).toBe("view");
    });

    it("explicit permission overrides moduleAccess list", () => {
      setModuleAccess(10, "activities", "view", 1);
      expect(getModuleAccess(10, "official", "activities", ["activities"])).toBe("view");
    });

    it("works for all modules in MODULE_LIST", () => {
      for (const mod of MODULE_LIST) {
        setModuleAccess(20, mod.id, "comment", 1);
        expect(getModuleAccess(20, "user", mod.id)).toBe("comment");
      }
    });
  });

  // ============================================================================
  // setModuleAccess
  // ============================================================================

  describe("setModuleAccess", () => {
    it("creates a new permission", () => {
      const perm = setModuleAccess(10, "activities", "comment", 1);
      expect(perm.userId).toBe(10);
      expect(perm.module).toBe("activities");
      expect(perm.accessLevel).toBe("comment");
      expect(perm.grantedBy).toBe(1);
    });

    it("updates an existing permission", () => {
      setModuleAccess(10, "activities", "view", 1);
      const updated = setModuleAccess(10, "activities", "edit", 1);
      expect(updated.accessLevel).toBe("edit");
      expect(getModuleAccess(10, "user", "activities")).toBe("edit");
    });

    it("includes notes when provided", () => {
      const perm = setModuleAccess(10, "finance", "edit", 1, "Promoted to VPF");
      expect(perm.notes).toBe("Promoted to VPF");
    });
  });

  // ============================================================================
  // removeModuleAccess
  // ============================================================================

  describe("removeModuleAccess", () => {
    it("removes an explicit permission", () => {
      setModuleAccess(10, "activities", "comment", 1);
      const removed = removeModuleAccess(10, "activities");
      expect(removed).toBe(true);
      expect(getModuleAccess(10, "user", "activities")).toBe("view"); // reverts to default
    });

    it("returns false when no permission exists", () => {
      const removed = removeModuleAccess(99, "activities");
      expect(removed).toBe(false);
    });

    it("other modules are unaffected", () => {
      setModuleAccess(10, "activities", "comment", 1);
      setModuleAccess(10, "finance", "edit", 1);
      removeModuleAccess(10, "activities");
      expect(getModuleAccess(10, "user", "finance")).toBe("edit");
    });
  });

  // ============================================================================
  // Bulk permissions
  // ============================================================================

  describe("setBulkModuleAccess", () => {
    it("sets multiple permissions at once", () => {
      const results = setBulkModuleAccess(10, [
        { module: "activities", accessLevel: "comment" },
        { module: "finance", accessLevel: "edit" },
        { module: "events", accessLevel: "view" },
      ], 1);
      expect(results).toHaveLength(3);
      expect(getModuleAccess(10, "user", "activities")).toBe("comment");
      expect(getModuleAccess(10, "user", "finance")).toBe("edit");
      expect(getModuleAccess(10, "user", "events")).toBe("view");
    });
  });

  // ============================================================================
  // Access checks
  // ============================================================================

  describe("hasAccess", () => {
    it("view level allows view", () => {
      expect(hasAccess(10, "user", "activities", "view")).toBe(true);
    });

    it("view level does not allow comment", () => {
      expect(hasAccess(10, "user", "activities", "comment")).toBe(false);
    });

    it("view level does not allow edit", () => {
      expect(hasAccess(10, "user", "activities", "edit")).toBe(false);
    });

    it("comment level allows view", () => {
      setModuleAccess(10, "activities", "comment", 1);
      expect(hasAccess(10, "user", "activities", "view")).toBe(true);
    });

    it("comment level allows comment", () => {
      setModuleAccess(10, "activities", "comment", 1);
      expect(hasAccess(10, "user", "activities", "comment")).toBe(true);
    });

    it("comment level does not allow edit", () => {
      setModuleAccess(10, "activities", "comment", 1);
      expect(hasAccess(10, "user", "activities", "edit")).toBe(false);
    });

    it("edit level allows everything", () => {
      setModuleAccess(10, "activities", "edit", 1);
      expect(hasAccess(10, "user", "activities", "view")).toBe(true);
      expect(hasAccess(10, "user", "activities", "comment")).toBe(true);
      expect(hasAccess(10, "user", "activities", "edit")).toBe(true);
    });

    it("superadmin always has edit access", () => {
      expect(hasAccess(1, "superadmin", "anything", "edit")).toBe(true);
    });
  });

  describe("canView / canComment / canEdit", () => {
    it("canView returns true for default (view)", () => {
      expect(canView(10, "user", "activities")).toBe(true);
    });

    it("canComment returns false for default (view)", () => {
      expect(canComment(10, "user", "activities")).toBe(false);
    });

    it("canEdit returns false for default (view)", () => {
      expect(canEdit(10, "user", "activities")).toBe(false);
    });

    it("canComment returns true when set to comment", () => {
      setModuleAccess(10, "activities", "comment", 1);
      expect(canComment(10, "user", "activities")).toBe(true);
    });

    it("canEdit returns true when set to edit", () => {
      setModuleAccess(10, "activities", "edit", 1);
      expect(canEdit(10, "user", "activities")).toBe(true);
    });

    it("superadmin passes all checks", () => {
      expect(canView(1, "superadmin", "any")).toBe(true);
      expect(canComment(1, "superadmin", "any")).toBe(true);
      expect(canEdit(1, "superadmin", "any")).toBe(true);
    });
  });

  // ============================================================================
  // User and module queries
  // ============================================================================

  describe("getUserModulePermissions", () => {
    it("returns empty for user with no permissions", () => {
      const perms = getUserModulePermissions(99);
      expect(perms).toEqual([]);
    });

    it("returns all permissions for a user", () => {
      setModuleAccess(10, "activities", "comment", 1);
      setModuleAccess(10, "finance", "edit", 1);
      const perms = getUserModulePermissions(10);
      expect(perms).toHaveLength(2);
    });
  });

  describe("getModulePermissions", () => {
    it("returns empty for module with no permissions", () => {
      const perms = getModulePermissions("activities");
      expect(perms).toEqual([]);
    });

    it("returns all permissions for a module", () => {
      setModuleAccess(10, "activities", "comment", 1);
      setModuleAccess(20, "activities", "edit", 1);
      const perms = getModulePermissions("activities");
      expect(perms).toHaveLength(2);
    });
  });

  // ============================================================================
  // Summary
  // ============================================================================

  describe("getPermissionSummary", () => {
    it("returns empty summary initially", () => {
      const summary = getPermissionSummary();
      expect(summary.totalPermissions).toBe(0);
      expect(summary.byLevel.view).toBe(0);
      expect(summary.byLevel.comment).toBe(0);
      expect(summary.byLevel.edit).toBe(0);
    });

    it("counts permissions correctly", () => {
      setModuleAccess(10, "activities", "comment", 1);
      setModuleAccess(10, "finance", "edit", 1);
      setModuleAccess(20, "activities", "view", 1);
      const summary = getPermissionSummary();
      expect(summary.totalPermissions).toBe(3);
      expect(summary.byLevel.comment).toBe(1);
      expect(summary.byLevel.edit).toBe(1);
      expect(summary.byLevel.view).toBe(1);
    });
  });

  // ============================================================================
  // Module List
  // ============================================================================

  describe("MODULE_LIST", () => {
    it("has at least 10 modules", () => {
      expect(MODULE_LIST.length).toBeGreaterThanOrEqual(10);
    });

    it("each module has id, label, description", () => {
      for (const mod of MODULE_LIST) {
        expect(mod.id).toBeTruthy();
        expect(mod.label).toBeTruthy();
        expect(mod.description).toBeTruthy();
      }
    });

    it("module ids are unique", () => {
      const ids = MODULE_LIST.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  // ============================================================================
  // Access Level Labels
  // ============================================================================

  describe("ACCESS_LEVEL_LABELS", () => {
    it("has labels for all three levels", () => {
      expect(ACCESS_LEVEL_LABELS.view).toBeTruthy();
      expect(ACCESS_LEVEL_LABELS.comment).toBeTruthy();
      expect(ACCESS_LEVEL_LABELS.edit).toBeTruthy();
    });

    it("each has label, description, icon", () => {
      for (const [key, val] of Object.entries(ACCESS_LEVEL_LABELS)) {
        expect(val.label).toBeTruthy();
        expect(val.description).toBeTruthy();
        expect(val.icon).toBeTruthy();
      }
    });
  });

  // ============================================================================
  // Reset
  // ============================================================================

  describe("resetAllPermissions", () => {
    it("clears all permissions and reverts default", () => {
      setModuleAccess(10, "activities", "edit", 1);
      setDefaultAccess("comment");
      resetAllPermissions();
      expect(getDefaultAccess()).toBe("view");
      expect(getModuleAccess(10, "user", "activities")).toBe("view");
      expect(getPermissionSummary().totalPermissions).toBe(0);
    });
  });

  // ============================================================================
  // Cross-module isolation
  // ============================================================================

  describe("Cross-module isolation", () => {
    it("permissions for one module do not affect others", () => {
      setModuleAccess(10, "activities", "edit", 1);
      expect(getModuleAccess(10, "user", "activities")).toBe("edit");
      expect(getModuleAccess(10, "user", "finance")).toBe("view");
      expect(getModuleAccess(10, "user", "governance")).toBe("view");
    });

    it("permissions for one user do not affect others", () => {
      setModuleAccess(10, "activities", "edit", 1);
      expect(getModuleAccess(20, "user", "activities")).toBe("view");
    });
  });
});
