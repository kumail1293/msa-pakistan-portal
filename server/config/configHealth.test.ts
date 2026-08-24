/**
 * Phase 9+10 Tests: Configuration Studio & Health Dashboard
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// Configuration Health Service (Phase 10)
// ============================================================================

describe("Configuration Health Service — System health checks", () => {
  it("should export getConfigurationHealth function", async () => {
    const { getConfigurationHealth } = await import("./configHealthService");
    expect(typeof getConfigurationHealth).toBe("function");
  });

  it("getConfigurationHealth should return a health report", async () => {
    const { getConfigurationHealth } = await import("./configHealthService");
    const health = await getConfigurationHealth();

    expect(health).toBeDefined();
    expect(typeof health.overall).toBe("string");
    expect(typeof health.score).toBe("number");
    expect(health.score).toBeGreaterThanOrEqual(0);
    expect(health.score).toBeLessThanOrEqual(100);
    expect(health.timestamp).toBeInstanceOf(Date);
  });

  it("health report should have term info", async () => {
    const { getConfigurationHealth } = await import("./configHealthService");
    const health = await getConfigurationHealth();

    expect(health.term).toBeDefined();
    expect(typeof health.term.name).toBe("string");
    expect(typeof health.term.governanceVersion).toBe("string");
    expect(typeof health.term.inTerm).toBe("boolean");
  });

  it("health report should have summary", async () => {
    const { getConfigurationHealth } = await import("./configHealthService");
    const health = await getConfigurationHealth();

    expect(health.summary).toBeDefined();
    expect(typeof health.summary.totalChecks).toBe("number");
    expect(typeof health.summary.ok).toBe("number");
    expect(typeof health.summary.warnings).toBe("number");
    expect(typeof health.summary.critical).toBe("number");
    expect(typeof health.summary.configKeys).toBe("number");
    expect(typeof health.summary.governanceParams).toBe("number");
    expect(typeof health.summary.workflows).toBe("number");
    expect(typeof health.summary.pipelines).toBe("number");
    expect(typeof health.summary.migrationAdapters).toBe("number");
  });

  it("health report should have checks array", async () => {
    const { getConfigurationHealth } = await import("./configHealthService");
    const health = await getConfigurationHealth();

    expect(Array.isArray(health.checks)).toBe(true);
    expect(health.checks.length).toBeGreaterThan(0);

    for (const check of health.checks) {
      expect(typeof check.id).toBe("string");
      expect(typeof check.name).toBe("string");
      expect(["ok", "warning", "critical"]).toContain(check.severity);
      expect(typeof check.message).toBe("string");
      expect(typeof check.category).toBe("string");
      expect(typeof check.fixable).toBe("boolean");
    }
  });

  it("health report should have domains breakdown", async () => {
    const { getConfigurationHealth } = await import("./configHealthService");
    const health = await getConfigurationHealth();

    expect(health.domains).toBeDefined();
    expect(typeof health.domains).toBe("object");

    for (const [domain, stats] of Object.entries(health.domains)) {
      expect(typeof stats.total).toBe("number");
      expect(typeof stats.ok).toBe("number");
      expect(typeof stats.warnings).toBe("number");
      expect(typeof stats.critical).toBe("number");
    }
  });

  it("overall severity should match check results", async () => {
    const { getConfigurationHealth } = await import("./configHealthService");
    const health = await getConfigurationHealth();

    const hasCritical = health.checks.some((c) => c.severity === "critical");
    const hasWarnings = health.checks.some((c) => c.severity === "warning");

    if (hasCritical) {
      expect(health.overall).toBe("critical");
    } else if (hasWarnings) {
      expect(health.overall).toBe("warning");
    } else {
      expect(health.overall).toBe("ok");
    }
  });

  it("summary counts should add up", async () => {
    const { getConfigurationHealth } = await import("./configHealthService");
    const health = await getConfigurationHealth();

    expect(health.summary.totalChecks).toBe(
      health.summary.ok + health.summary.warnings + health.summary.critical
    );
  });

  it("configKeys count should match CONFIG_DEFINITIONS length", async () => {
    const { getConfigurationHealth } = await import("./configHealthService");
    const { CONFIG_DEFINITIONS } = await import("./configService");
    const health = await getConfigurationHealth();

    expect(health.summary.configKeys).toBe(CONFIG_DEFINITIONS.length);
  });

  it("migrationAdapters count should be 7", async () => {
    const { getConfigurationHealth } = await import("./configHealthService");
    const health = await getConfigurationHealth();

    expect(health.summary.migrationAdapters).toBe(7);
  });
});

// ============================================================================
// Configuration Studio (Phase 9)
// ============================================================================

describe("Configuration Studio — Domain management", () => {
  it("should export getGovernanceConfig function", async () => {
    const { getGovernanceConfig } = await import("./organizationConfigStudio");
    expect(typeof getGovernanceConfig).toBe("function");
  });

  it("should export getGovernanceConfigGrouped function", async () => {
    const { getGovernanceConfigGrouped } = await import("./organizationConfigStudio");
    expect(typeof getGovernanceConfigGrouped).toBe("function");
  });

  it("should export getConfigDomains function", async () => {
    const { getConfigDomains } = await import("./organizationConfigStudio");
    expect(typeof getConfigDomains).toBe("function");
  });

  it("should export updateGovernanceConfig function", async () => {
    const { updateGovernanceConfig } = await import("./organizationConfigStudio");
    expect(typeof updateGovernanceConfig).toBe("function");
  });

  it("should export bulkUpdateGovernanceConfig function", async () => {
    const { bulkUpdateGovernanceConfig } = await import("./organizationConfigStudio");
    expect(typeof bulkUpdateGovernanceConfig).toBe("function");
  });

  it("should export resetGovernanceConfig function", async () => {
    const { resetGovernanceConfig } = await import("./organizationConfigStudio");
    expect(typeof resetGovernanceConfig).toBe("function");
  });

  it("should export resetDomainConfig function", async () => {
    const { resetDomainConfig } = await import("./organizationConfigStudio");
    expect(typeof resetDomainConfig).toBe("function");
  });

  it("should export simulateGovernanceQuery function", async () => {
    const { simulateGovernanceQuery } = await import("./organizationConfigStudio");
    expect(typeof simulateGovernanceQuery).toBe("function");
  });

  it("getConfigDomains should return domains with icons", async () => {
    const { getConfigDomains } = await import("./organizationConfigStudio");
    const domains = getConfigDomains();

    expect(Array.isArray(domains)).toBe(true);
    expect(domains.length).toBeGreaterThanOrEqual(8);

    for (const domain of domains) {
      expect(typeof domain.key).toBe("string");
      expect(typeof domain.label).toBe("string");
      expect(typeof domain.icon).toBe("string");
      expect(typeof domain.count).toBe("number");
      expect(domain.count).toBeGreaterThan(0);
    }
  });

  it("GOVERNANCE_CONFIG_DEFINITIONS should have 50+ entries", async () => {
    const { GOVERNANCE_CONFIG_DEFINITIONS } = await import("./organizationConfigStudio");
    expect(GOVERNANCE_CONFIG_DEFINITIONS.length).toBeGreaterThanOrEqual(50);
  });

  it("every config definition should have required fields", async () => {
    const { GOVERNANCE_CONFIG_DEFINITIONS } = await import("./organizationConfigStudio");
    for (const def of GOVERNANCE_CONFIG_DEFINITIONS) {
      expect(typeof def.key).toBe("string");
      expect(def.key.length).toBeGreaterThan(0);
      expect(typeof def.value).toBe("string");
      expect(typeof def.domain).toBe("string");
      expect(typeof def.label).toBe("string");
      expect(typeof def.description).toBe("string");
      expect(["string", "number", "boolean", "json", "select"]).toContain(def.type);
      expect(typeof def.defaultValue).toBe("string");
    }
  });

  it("select-type definitions should have options array", async () => {
    const { GOVERNANCE_CONFIG_DEFINITIONS } = await import("./organizationConfigStudio");
    const selectDefs = GOVERNANCE_CONFIG_DEFINITIONS.filter((d) => d.type === "select");
    for (const def of selectDefs) {
      expect(Array.isArray(def.options)).toBe(true);
      expect(def.options!.length).toBeGreaterThan(0);
      expect(def.options!).toContain(def.defaultValue);
    }
  });
});

// ============================================================================
// Simulation Engine
// ============================================================================

describe("Simulation Engine — Governance rule simulation", () => {
  it("simulateGovernanceQuery should handle quorum questions", async () => {
    const { simulateGovernanceQuery } = await import("./organizationConfigStudio");
    const result = await simulateGovernanceQuery({ question: "What is the quorum?" });
    expect(result.answer).toBeTruthy();
    expect(result.applicableRules.length).toBeGreaterThan(0);
    expect(result.confidence).toBe("high");
  });

  it("simulateGovernanceQuery should handle voting questions", async () => {
    const { simulateGovernanceQuery } = await import("./organizationConfigStudio");
    const result = await simulateGovernanceQuery({ question: "How does voting work?" });
    expect(result.answer).toBeTruthy();
    expect(result.applicableRules.length).toBeGreaterThan(0);
  });

  it("simulateGovernanceQuery should handle eligibility questions", async () => {
    const { simulateGovernanceQuery } = await import("./organizationConfigStudio");
    const result = await simulateGovernanceQuery({ question: "Who is eligible for membership?" });
    expect(result.answer).toBeTruthy();
  });

  it("simulateGovernanceQuery should handle term questions", async () => {
    const { simulateGovernanceQuery } = await import("./organizationConfigStudio");
    const result = await simulateGovernanceQuery({ question: "What is the term of office?" });
    expect(result.answer).toBeTruthy();
  });

  it("simulateGovernanceQuery should support overrides", async () => {
    const { simulateGovernanceQuery } = await import("./organizationConfigStudio");
    const result = await simulateGovernanceQuery(
      { question: "What is the quorum?" },
      { "gov.quorum_numerator": "2" }
    );
    expect(result.answer).toContain("2/");
  });
});
