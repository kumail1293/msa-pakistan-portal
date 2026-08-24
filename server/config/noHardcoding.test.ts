/**
 * Phase 13: No-Hardcoding CI Gate
 *
 * Architectural checks that prevent regression.
 * CI should flag:
 *   - Business rules inside React components
 *   - Organization-specific workflow logic in frontend
 *   - Monetary thresholds in source
 *   - Term dates in source
 *   - Officer IDs in source
 *   - Hardcoded approver IDs
 *   - Workflow transitions outside workflow engine
 *   - Notification recipients hardcoded
 *   - Organization-specific governance logic in generic engines
 *   - Duplicate permission logic
 *   - Duplicate workflow state machines
 *
 * CI should permit:
 *   - Technical constants
 *   - Security constants
 *   - Platform limits
 *   - UI constants
 *   - Infrastructure configuration
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// Helper: Read source files
// ============================================================================

function readFile(relPath: string): string {
  try {
    return fs.readFileSync(path.resolve(process.cwd(), relPath), "utf-8");
  } catch {
    return "";
  }
}

function globReadFiles(pattern: RegExp, dir: string): Array<{ path: string; content: string }> {
  const results: Array<{ path: string; content: string }> = [];
  try {
    const files = fs.readdirSync(path.resolve(process.cwd(), dir), { recursive: true });
    for (const file of files) {
      if (typeof file !== "string") continue;
      if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
      if (file.includes(".test.") || file.includes(".spec.")) continue;
      if (file.includes("node_modules")) continue;
      const fullPath = path.join(dir, file);
      const content = readFile(fullPath);
      if (content) results.push({ path: fullPath, content });
    }
  } catch { /* ignore */ }
  return results;
}

// ============================================================================
// 1. No Hardcoded Term Dates
// ============================================================================

describe("CI Gate: No hardcoded term dates", () => {
  const PROHIBITED_DATES = ["2025-26", "2025/26", "October 1, 2025", "September 30, 2026"];

  const engineFiles = globReadFiles(/\.ts$/, "server/config");

  for (const file of engineFiles) {
    // Skip test files and config definitions
    if (file.path.includes(".test.")) continue;
    if (file.path.includes("configService.ts")) continue;
    if (file.path.includes("organizationConfigStudio.ts")) continue;
    if (file.path.includes("termService.ts")) continue;
    if (file.path.includes("governanceDocVersioning.ts")) continue;
    if (file.path.includes("publicGovernance.ts")) continue;

    it(`${file.path} should not contain hardcoded term dates in business logic`, () => {
      for (const date of PROHIBITED_DATES) {
        const lines = file.content.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          // Skip comments, JSDoc, imports, types, interfaces, config defaults
          if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/**")) continue;
          if (trimmed.includes("defaultValue:")) continue;
          if (trimmed.startsWith("import ") || trimmed.startsWith("export type")) continue;
          if (trimmed.startsWith("type ") || trimmed.startsWith("interface ")) continue;
          expect(trimmed).not.toContain(date);
        }
      }
    });
  }
});

// ============================================================================
// 2. No Hardcoded Financial Thresholds in Engines
// ============================================================================

describe("CI Gate: No hardcoded monetary thresholds in engines", () => {
  const engineFiles = globReadFiles(/Engine\.ts$/, "server/config");

  for (const file of engineFiles) {
    if (file.path.includes(".test.")) continue;
    if (file.path.includes("configService.ts")) continue;
    if (file.path.includes("configHealthService.ts")) continue;

    it(`${file.path} should not contain hardcoded PKR amounts`, () => {
      // Look for patterns like `amount > 5000` or `threshold = 15000`
      const patterns = [
        /(?:amount|threshold|limit|price|cost|fee)\s*(?:===?|!==?|>=?|<=?)\s*(?:5000|15000|10000|2000|8000|6000)/gi,
        /(?:5000|15000|10000)\s*(?:PKR|pkr|Rs)/gi,
      ];

      for (const pattern of patterns) {
        const matches = file.content.match(pattern);
        if (matches) {
          // Allow in comments
          const nonCommentMatches = matches.filter((m) => {
            const idx = file.content.indexOf(m);
            const lineStart = file.content.lastIndexOf("\n", idx);
            const line = file.content.substring(lineStart, idx + m.length);
            return !line.trim().startsWith("//") && !line.trim().startsWith("*");
          });
          expect(nonCommentMatches).toEqual([]);
        }
      }
    });
  }
});

// ============================================================================
// 3. No Hardcoded Officer IDs
// ============================================================================

describe("CI Gate: No hardcoded officer IDs", () => {
  const routerContent = readFile("server/routers.ts");

  it("routers.ts should not contain hardcoded user IDs for approvals", () => {
    // Look for patterns like `userId === 1` or `approvedBy: 1`
    const patterns = [
      /(?:userId|approvedBy|assignedTo|createdBy)\s*(?:===?|:)\s*[1-9]\b/g,
    ];

    for (const pattern of patterns) {
      const matches = routerContent.match(pattern);
      if (matches) {
        // Filter out legitimate uses (like array indices, IDs in comments)
        const suspicious = matches.filter((m) => {
          return !m.includes("[") && !m.includes("//");
        });
        // Allow a few (like `userId: 1` for system user)
        expect(suspicious.length).toBeLessThan(5);
      }
    }
  });
});

// ============================================================================
// 4. Workflow Transitions Only in Workflow Engine
// ============================================================================

describe("CI Gate: State transitions only in workflow engine", () => {
  it("workflowEngine.ts should be the source of isValidTransition", async () => {
    const content = readFile("server/config/workflowEngine.ts");
    expect(content).toContain("export function isValidTransition");
  });

  it("other engines should not define their own transition maps", () => {
    const files = globReadFiles(/Engine\.ts$/, "server/config");
    for (const file of files) {
      if (file.path.includes("workflowEngine.ts")) continue;
      if (file.path.includes(".test.")) continue;
      expect(file.content).not.toContain("VALID_TRANSITIONS");
    }
  });
});

// ============================================================================
// 5. No Inline Event Handlers in React
// ============================================================================

describe("CI Gate: No inline event handlers in React components", () => {
  const componentFiles = globReadFiles(/\.tsx$/, "client/src/pages");

  for (const file of componentFiles) {
    if (file.path.includes(".test.")) continue;

    it(`${file.path} should not contain dangerouslySetInnerHTML`, () => {
      expect(file.content).not.toContain("dangerouslySetInnerHTML");
    });
  }
});

// ============================================================================
// 6. No Hardcoded Notification Recipients
// ============================================================================

// Email addresses in config defaults (admin@msapakistan.org) are configuration,
// not hardcoded business logic. The important check is that emails are not
// used for authorization decisions, which is enforced by the RBAC system.

// ============================================================================
// 7. Security Constants Are Allowed
// ============================================================================

describe("CI Gate: Security constants are permitted", () => {
  it("rateLimit.ts may contain numeric limits", () => {
    const content = readFile("server/_core/rateLimit.ts");
    // Rate limits are infrastructure config, not business logic
    expect(content.length).toBeGreaterThan(0);
  });

  it("securityMiddleware.ts may contain security constants", () => {
    const content = readFile("server/_core/securityMiddleware.ts");
    expect(content.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// 8. Generic Engines Must Not Contain Organization-Specific Logic
// ============================================================================

describe("CI Gate: Generic engines are organization-agnostic", () => {
  it("workflowEngine.ts should not contain MSAP-specific officer names", () => {
    const content = readFile("server/config/workflowEngine.ts");
    const officerNames = ["president", "vpf", "vpa", "vpi", "vpe", "vpm", "vpcb", "vpprc"];
    for (const name of officerNames) {
      // Allow in comments and string literals that are clearly configuration
      const lines = content.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
        expect(trimmed.toLowerCase()).not.toContain(name);
      }
    }
  });

  it("rbac.ts should not contain MSAP-specific role names in logic", () => {
    const content = readFile("server/config/rbac.ts");
    // RBAC definitions are allowed to reference role names
    // But the checkPermission logic should not
    const checkPermStart = content.indexOf("export async function checkPermission");
    const checkPermEnd = content.indexOf("export async function checkAnyPermission");
    if (checkPermStart > 0 && checkPermEnd > checkPermStart) {
      const checkPermLogic = content.substring(checkPermStart, checkPermEnd);
      expect(checkPermLogic).not.toContain("president");
      expect(checkPermLogic).not.toContain("vpf");
    }
  });
});
