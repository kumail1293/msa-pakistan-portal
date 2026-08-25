/**
 * Tests for module permission middleware
 *
 * Verifies that:
 *   - Superadmins always pass
 *   - View-only users get FORBIDDEN on edit mutations
 *   - Comment-level users get FORBIDDEN on edit but pass on comment
 *   - Edit-level users pass on all access levels
 *   - Default (no explicit permission) resolves to "view"
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  getModuleAccess,
  setModuleAccess,
  resetAllPermissions,
  hasAccess,
  MODULE_LIST,
  setDefaultAccess,
} from "./modulePermissionService";

// ---------------------------------------------------------------------------
// Helpers — simulate what the middleware does internally
// ---------------------------------------------------------------------------

/** Simulates the moduleGuardedProcedure middleware logic. */
function evaluateModuleGuard(
  userId: number,
  userRole: string,
  moduleId: string,
  requiredLevel: "view" | "comment" | "edit",
  moduleAccessList: string[] | null = null,
): { allowed: boolean; reason?: string } {
  // Superadmin always passes
  if (userRole === "superadmin") return { allowed: true };

  const allowed = hasAccess(userId, userRole, moduleId, requiredLevel, moduleAccessList);
  if (!allowed) {
    const levelLabel =
      requiredLevel === "edit"
        ? "edit"
        : requiredLevel === "comment"
          ? "comment"
          : "view";
    return { allowed: false, reason: `You need ${levelLabel} access for the ${moduleId} module.` };
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const SUPERADMIN = { id: 1, role: "superadmin" };
const VIEW_USER = { id: 10, role: "user" };
const COMMENT_USER = { id: 11, role: "user" };
const EDIT_USER = { id: 12, role: "user" };
const OFFICIAL_USER = { id: 20, role: "official" };

describe("moduleGuardedProcedure — access resolution", () => {
  beforeEach(() => {
    resetAllPermissions();
  });

  it("superadmin always passes regardless of module permissions", () => {
    const result = evaluateModuleGuard(SUPERADMIN.id, SUPERADMIN.role, "activities", "edit");
    expect(result.allowed).toBe(true);
  });

  it("superadmin passes even for unconfigured modules", () => {
    const result = evaluateModuleGuard(SUPERADMIN.id, SUPERADMIN.role, "nonexistent", "edit");
    expect(result.allowed).toBe(true);
  });

  it("unauthenticated-like role gets default view access", () => {
    // user with no explicit permission gets default "view"
    const result = evaluateModuleGuard(VIEW_USER.id, VIEW_USER.role, "activities", "view");
    expect(result.allowed).toBe(true);
  });

  it("default access (view) blocks edit operations", () => {
    const result = evaluateModuleGuard(VIEW_USER.id, VIEW_USER.role, "activities", "edit");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("edit access");
    expect(result.reason).toContain("activities");
  });

  it("default access (view) blocks comment operations", () => {
    const result = evaluateModuleGuard(VIEW_USER.id, VIEW_USER.role, "activities", "comment");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("comment access");
  });

  it("explicit view permission blocks edit", () => {
    setModuleAccess(VIEW_USER.id, "activities", "edit", SUPERADMIN.id); // grant edit first
    setModuleAccess(VIEW_USER.id, "activities", "view", SUPERADMIN.id); // then downgrade
    const result = evaluateModuleGuard(VIEW_USER.id, VIEW_USER.role, "activities", "edit");
    expect(result.allowed).toBe(false);
  });

  it("explicit view permission allows view", () => {
    setModuleAccess(VIEW_USER.id, "activities", "view", SUPERADMIN.id);
    const result = evaluateModuleGuard(VIEW_USER.id, VIEW_USER.role, "activities", "view");
    expect(result.allowed).toBe(true);
  });

  it("comment-level user can comment but not edit", () => {
    setModuleAccess(COMMENT_USER.id, "events", "comment", SUPERADMIN.id);

    const canComment = evaluateModuleGuard(COMMENT_USER.id, COMMENT_USER.role, "events", "comment");
    expect(canComment.allowed).toBe(true);

    const canEdit = evaluateModuleGuard(COMMENT_USER.id, COMMENT_USER.role, "events", "edit");
    expect(canEdit.allowed).toBe(false);
  });

  it("comment-level user can view", () => {
    setModuleAccess(COMMENT_USER.id, "events", "comment", SUPERADMIN.id);
    const result = evaluateModuleGuard(COMMENT_USER.id, COMMENT_USER.role, "events", "view");
    expect(result.allowed).toBe(true);
  });

  it("edit-level user can view, comment, and edit", () => {
    setModuleAccess(EDIT_USER.id, "finance", "edit", SUPERADMIN.id);

    expect(evaluateModuleGuard(EDIT_USER.id, EDIT_USER.role, "finance", "view").allowed).toBe(true);
    expect(evaluateModuleGuard(EDIT_USER.id, EDIT_USER.role, "finance", "comment").allowed).toBe(true);
    expect(evaluateModuleGuard(EDIT_USER.id, EDIT_USER.role, "finance", "edit").allowed).toBe(true);
  });

  it("official with module access in access list gets edit", () => {
    // Officials with a module in their officialModuleAccess get "edit"
    const result = evaluateModuleGuard(
      OFFICIAL_USER.id,
      OFFICIAL_USER.role,
      "activities",
      "edit",
      ["activities", "events"], // moduleAccessList
    );
    expect(result.allowed).toBe(true);
  });

  it("official without module in access list gets default view", () => {
    const result = evaluateModuleGuard(
      OFFICIAL_USER.id,
      OFFICIAL_USER.role,
      "finance",
      "edit",
      ["activities", "events"], // finance NOT in list
    );
    expect(result.allowed).toBe(false);
  });
});

describe("moduleGuardedProcedure — per-module isolation", () => {
  beforeEach(() => {
    resetAllPermissions();
  });

  it("permissions are per-module (one module does not grant another)", () => {
    setModuleAccess(VIEW_USER.id, "activities", "edit", SUPERADMIN.id);

    // Activities: edit allowed
    expect(evaluateModuleGuard(VIEW_USER.id, VIEW_USER.role, "activities", "edit").allowed).toBe(true);

    // Finance: still default (view only)
    expect(evaluateModuleGuard(VIEW_USER.id, VIEW_USER.role, "finance", "edit").allowed).toBe(false);

    // Events: still default
    expect(evaluateModuleGuard(VIEW_USER.id, VIEW_USER.role, "events", "edit").allowed).toBe(false);
  });

  it("multiple users have independent permissions", () => {
    setModuleAccess(VIEW_USER.id, "finance", "view", SUPERADMIN.id);
    setModuleAccess(EDIT_USER.id, "finance", "edit", SUPERADMIN.id);

    expect(evaluateModuleGuard(VIEW_USER.id, VIEW_USER.role, "finance", "edit").allowed).toBe(false);
    expect(evaluateModuleGuard(EDIT_USER.id, EDIT_USER.role, "finance", "edit").allowed).toBe(true);
  });
});

describe("moduleGuardedProcedure — all 17 modules", () => {
  beforeEach(() => {
    resetAllPermissions();
  });

  it("every module in MODULE_LIST is guardable", () => {
    for (const mod of MODULE_LIST) {
      // No explicit permission → default "view"
      expect(evaluateModuleGuard(VIEW_USER.id, VIEW_USER.role, mod.id, "view").allowed).toBe(true);
      expect(evaluateModuleGuard(VIEW_USER.id, VIEW_USER.role, mod.id, "edit").allowed).toBe(false);

      // After granting edit
      setModuleAccess(VIEW_USER.id, mod.id, "edit", SUPERADMIN.id);
      expect(evaluateModuleGuard(VIEW_USER.id, VIEW_USER.role, mod.id, "edit").allowed).toBe(true);
    }
  });
});

describe("moduleGuardedProcedure — edge cases", () => {
  beforeEach(() => {
    resetAllPermissions();
  });

  it("granting then revoking reverts to default", () => {
    setModuleAccess(VIEW_USER.id, "documents", "edit", SUPERADMIN.id);
    expect(evaluateModuleGuard(VIEW_USER.id, VIEW_USER.role, "documents", "edit").allowed).toBe(true);

    // Reset to default view
    setDefaultAccess("view");
    // The explicit permission is still there, so we need to remove it
    // setModuleAccess with "view" effectively downgrades
    setModuleAccess(VIEW_USER.id, "documents", "view", SUPERADMIN.id);
    expect(evaluateModuleGuard(VIEW_USER.id, VIEW_USER.role, "documents", "edit").allowed).toBe(false);
  });

  it("changing default access affects users without explicit permissions", () => {
    setDefaultAccess("edit");
    expect(evaluateModuleGuard(VIEW_USER.id, VIEW_USER.role, "governance", "edit").allowed).toBe(true);

    setDefaultAccess("view");
    expect(evaluateModuleGuard(VIEW_USER.id, VIEW_USER.role, "governance", "edit").allowed).toBe(false);
  });

  it("comment user on governance module cannot edit elections", () => {
    setModuleAccess(COMMENT_USER.id, "governance", "comment", SUPERADMIN.id);
    expect(evaluateModuleGuard(COMMENT_USER.id, COMMENT_USER.role, "governance", "comment").allowed).toBe(true);
    expect(evaluateModuleGuard(COMMENT_USER.id, COMMENT_USER.role, "governance", "edit").allowed).toBe(false);
    expect(evaluateModuleGuard(COMMENT_USER.id, COMMENT_USER.role, "elections", "comment").allowed).toBe(false);
  });

  it("error message includes module name and required level", () => {
    const result = evaluateModuleGuard(VIEW_USER.id, VIEW_USER.role, "nef", "edit");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("nef");
    expect(result.reason).toContain("edit");
  });

  it("error message for comment access includes correct level", () => {
    const result = evaluateModuleGuard(VIEW_USER.id, VIEW_USER.role, "credentials", "comment");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("comment");
    expect(result.reason).toContain("credentials");
  });
});

describe("moduleGuardedProcedure — role-based resolution via getModuleAccess", () => {
  beforeEach(() => {
    resetAllPermissions();
  });

  it("superadmin always returns 'edit' from getModuleAccess", () => {
    expect(getModuleAccess(SUPERADMIN.id, SUPERADMIN.role, "activities")).toBe("edit");
    expect(getModuleAccess(SUPERADMIN.id, SUPERADMIN.role, "nonexistent")).toBe("edit");
  });

  it("user with no explicit permission gets default", () => {
    expect(getModuleAccess(VIEW_USER.id, VIEW_USER.role, "activities")).toBe("view");
  });

  it("user with explicit comment permission gets 'comment'", () => {
    setModuleAccess(VIEW_USER.id, "activities", "comment", SUPERADMIN.id);
    expect(getModuleAccess(VIEW_USER.id, VIEW_USER.role, "activities")).toBe("comment");
  });

  it("user with explicit edit permission gets 'edit'", () => {
    setModuleAccess(VIEW_USER.id, "activities", "edit", SUPERADMIN.id);
    expect(getModuleAccess(VIEW_USER.id, VIEW_USER.role, "activities")).toBe("edit");
  });

  it("official with moduleAccessList gets 'edit' for listed modules", () => {
    const access = getModuleAccess(
      OFFICIAL_USER.id,
      OFFICIAL_USER.role,
      "activities",
      ["activities", "events"],
    );
    expect(access).toBe("edit");
  });

  it("official without module in accessList gets default", () => {
    const access = getModuleAccess(
      OFFICIAL_USER.id,
      OFFICIAL_USER.role,
      "finance",
      ["activities", "events"],
    );
    expect(access).toBe("view");
  });
});
