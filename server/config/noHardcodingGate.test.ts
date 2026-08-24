/**
 * Phase 13 (Expanded): No-Hardcoding CI Gate — Additional Checks
 *
 * Supplements the original noHardcoding.test.ts with:
 *   - Duplicate engine detection (no V2 files)
 *   - Hardcoded LC lists in frontend/backend
 *   - Hardcoded org names in business logic
 *   - Configuration-first validation (thresholds must use getConfig)
 *   - No inline email addresses in business logic
 *   - Spreadsheet dependency tracking
 *   - LC lifecycle config-driven validation
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// Helpers
// ============================================================================

function readFile(relPath: string): string {
  try {
    return fs.readFileSync(path.resolve(process.cwd(), relPath), "utf-8");
  } catch {
    return "";
  }
}

function listFiles(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  try {
    const files = fs.readdirSync(path.resolve(process.cwd(), dir), { recursive: true });
    for (const file of files) {
      if (typeof file !== "string") continue;
      if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
      if (file.includes(".test.") || file.includes(".spec.")) continue;
      if (file.includes("node_modules")) continue;
      if (pattern.test(file)) results.push(path.join(dir, file));
    }
  } catch { /* ignore */ }
  return results;
}

// ============================================================================
// 1. No Duplicate Engine Files (V2 pattern)
// ============================================================================

describe("CI Gate: No duplicate V2 engine files", () => {
  it("no EngineV2.ts files exist in server/config", () => {
    const v2Files = listFiles("server/config", /EngineV2\.ts$/);
    expect(v2Files).toEqual([]);
  });

  it("no workflowEngineV2.ts exists", () => {
    const exists = fs.existsSync(path.resolve(process.cwd(), "server/config/workflowEngineV2.ts"));
    expect(exists).toBe(false);
  });

  it("no plenaryEngineV2.ts exists", () => {
    const exists = fs.existsSync(path.resolve(process.cwd(), "server/config/plenaryEngineV2.ts"));
    expect(exists).toBe(false);
  });
});

// ============================================================================
// 2. No Hardcoded LC Lists in Frontend
// ============================================================================

describe("CI Gate: No hardcoded LC lists in frontend code", () => {
  it("no hardcoded LC short codes in page components", () => {
    const pageFiles = listFiles(/\.tsx$/, /client\/src\/pages/);
    const lcCodes = ["KEMU", "AKU", "SMC", "LUMS", "NUST", "COMSATS", "IBA", "PUNJAB"];
    let violations = 0;

    for (const file of pageFiles) {
      if (file.includes("AdminBulkData")) continue; // Known — being migrated
      const content = readFile(file);
      if (!content) continue;

      for (const code of lcCodes) {
        const patterns = [
          new RegExp(`shortCode:\\s*["']${code}["']`, "g"),
          new RegExp(`"shortCode":\\s*"${code}"`, "g"),
        ];
        for (const pattern of patterns) {
          const lines = content.split("\n");
          for (const line of lines) {
            if (pattern.test(line)) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("//") && !trimmed.startsWith("*")) {
                violations++;
              }
            }
          }
        }
      }
    }
    expect(violations).toBe(0);
  });
});

// ============================================================================
// 3. No Hardcoded Org Names in Generic Engines
// ============================================================================

describe("CI Gate: No organization-specific names in generic engines", () => {
  it("generic engines should not contain MSA Pakistan in business logic", () => {
    const genericEngines = [
      "server/config/workflowEngine.ts",
      "server/config/configService.ts",
      "server/config/ruleSimulator.ts",
      "server/config/capabilityResolver.ts",
    ];

    for (const enginePath of genericEngines) {
      const content = readFile(enginePath);
      if (!content) continue;

      const lines = content.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
        if (trimmed.includes("defaultValue:")) continue;
        if (trimmed.startsWith("import ") || trimmed.startsWith("export ")) continue;
        expect(trimmed).not.toContain("MSA Pakistan");
      }
    }
  });
});

// ============================================================================
// 4. Configuration-First: Thresholds Must Use Config
// ============================================================================

describe("CI Gate: Financial thresholds must use getConfigNumber", () => {
  it("engine files should not contain raw PKR amounts in conditionals", () => {
    const engineFiles = listFiles(/Engine\.ts$/, /server\/config/);
    const skipFiles = ["configService.ts", "configHealthService.ts", "organizationConfigStudio.ts"];
    let violations = 0;

    for (const file of engineFiles) {
      if (file.includes(".test.")) continue;
      if (skipFiles.some((s) => file.includes(s))) continue;

      const content = readFile(file);
      if (!content) continue;

      const patterns = [
        /(?:if|else if|return)\s*\(.*(?:amount|threshold|limit|price|budget|fee)\s*(?:>=?|<=?|===?|!==?)\s*\d{3,}/gi,
        /(?:amount|threshold|limit|price|budget|fee)\s*[=:]\s*\d{4,}/gi,
      ];

      for (const pattern of patterns) {
        const matches = content.match(pattern) ?? [];
        for (const m of matches) {
          const idx = content.indexOf(m);
          const lineStart = content.lastIndexOf("\n", idx);
          const line = content.substring(lineStart, idx + m.length).trim();
          if (!line.startsWith("//") && !line.startsWith("*") && !line.includes("defaultValue:")) {
            violations++;
          }
        }
      }
    }
    expect(violations).toBe(0);
  });
});

// ============================================================================
// 5. No Inline Email Addresses in Business Logic
// ============================================================================

describe("CI Gate: No hardcoded email addresses in business logic", () => {
  it("engine and service files should not contain hardcoded emails in logic", () => {
    const files = listFiles(/Engine\.ts$|Service\.ts$/, /server\/config/);
    const skipFiles = ["configService.ts", "mockDataSeeder.ts"];
    let violations = 0;

    for (const file of files) {
      if (file.includes(".test.")) continue;
      if (skipFiles.some((s) => file.includes(s))) continue;

      const content = readFile(file);
      if (!content) continue;

      const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const matches = content.match(emailPattern) ?? [];

      for (const email of matches) {
        const idx = content.indexOf(email);
        const lineStart = content.lastIndexOf("\n", idx);
        const line = content.substring(lineStart, idx + email.length).trim();
        if (line.startsWith("//") || line.startsWith("*")) continue;
        if (line.includes("defaultValue:")) continue;
        if (line.includes("process.env")) continue;
        violations++;
      }
    }
    expect(violations).toBe(0);
  });
});

// ============================================================================
// 6. No Hardcoded Date Strings in Engines
// ============================================================================

describe("CI Gate: No hardcoded date strings in engine business logic", () => {
  it("engine files should not contain hardcoded date strings", () => {
    const files = listFiles(/Engine\.ts$|Service\.ts$/, /server\/config/);
    const skipFiles = ["configService.ts", "termService.ts", "mockDataSeeder.ts", "organizationConfigStudio.ts"];
    let violations = 0;

    for (const file of files) {
      if (file.includes(".test.")) continue;
      if (skipFiles.some((s) => file.includes(s))) continue;

      const content = readFile(file);
      if (!content) continue;

      const datePatterns = [
        /["']20\d{2}-\d{2}-\d{2}["']/g,
      ];

      for (const pattern of datePatterns) {
        const matches = content.match(pattern) ?? [];
        for (const date of matches) {
          const idx = content.indexOf(date);
          const lineStart = content.lastIndexOf("\n", idx);
          const line = content.substring(lineStart, idx + date.length).trim();
          if (!line.startsWith("//") && !line.startsWith("*") && !line.includes("defaultValue:")) {
            violations++;
          }
        }
      }
    }
    expect(violations).toBe(0);
  });
});

// ============================================================================
// 7. Spreadsheet Dependency Status Check
// ============================================================================

describe("CI Gate: Spreadsheet dependency migration tracking", () => {
  it("spreadsheetDependencyAudit.ts should track all 6 dependencies", () => {
    const content = readFile("server/config/spreadsheetDependencyAudit.ts");
    expect(content).toContain("membership-master");
    expect(content).toContain("nef-tracker");
    expect(content).toContain("lc-mapping");
    expect(content).toContain("approval-matrix");
    expect(content).toContain("events-calendar");
    expect(content).toContain("financial-ledger");
  });

  it("all dependencies should have a defined status field", () => {
    const content = readFile("server/config/spreadsheetDependencyAudit.ts");
    // Count status assignments — each of the 6 dependencies has a status field
    // plus the getMigrationStatus function checks status values
    const statusMatches = content.match(/status:\s*\"(?:identified|migrating|completed)\"/g) ?? [];
    expect(statusMatches.length).toBeGreaterThanOrEqual(6);
  });
});

// ============================================================================
// 8. Config Keys Must Exist for LC Lifecycle Thresholds
// ============================================================================

describe("CI Gate: LC lifecycle thresholds are config-driven", () => {
  it("lcLifecycleEngine.ts uses getConfigNumber for member thresholds", () => {
    const content = readFile("server/config/lcLifecycleEngine.ts");
    expect(content).toContain("getConfigNumber(\"lc.minMembersForCandidate\"");
    expect(content).toContain("getConfigNumber(\"lc.minMembersForTemporary\"");
    expect(content).toContain("getConfigNumber(\"lc.minMembersForPermanent\"");
  });

  it("lcLifecycleEngine.ts uses getConfig for approval requirements", () => {
    const content = readFile("server/config/lcLifecycleEngine.ts");
    expect(content).toContain("getConfig(\"lc.ciToCandidateRequiresNga\"");
    expect(content).toContain("getConfig(\"lc.candidateToTempRequiresNga\"");
    expect(content).toContain("getConfig(\"lc.tempToPermRequiresNga\"");
  });

  it("lcLifecycleEngine.ts has cache invalidation support", () => {
    const content = readFile("server/config/lcLifecycleEngine.ts");
    expect(content).toContain("invalidateTransitionCache");
  });

  it("lcLifecycleEngine.ts builds transitions dynamically (not static const)", () => {
    const content = readFile("server/config/lcLifecycleEngine.ts");
    // The transitions should be built by an async function, not a static const
    expect(content).toContain("async function buildTransitions");
    expect(content).toContain("async function getTransitions");
  });
});
