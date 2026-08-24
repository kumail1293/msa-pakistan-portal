/**
 * Phase 5+6 Tests: Capability-Based Authorization & Configurable Workflow Runtime
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// Capability Resolver (Phase 5)
// ============================================================================

describe("Capability Resolver — Configuration-driven authorization", () => {
  it("should export resolveCapabilities function", async () => {
    const { resolveCapabilities } = await import("./capabilityResolver");
    expect(typeof resolveCapabilities).toBe("function");
  });

  it("should export hasCapability function", async () => {
    const { hasCapability } = await import("./capabilityResolver");
    expect(typeof hasCapability).toBe("function");
  });

  it("should export hasAnyCapability function", async () => {
    const { hasAnyCapability } = await import("./capabilityResolver");
    expect(typeof hasAnyCapability).toBe("function");
  });

  it("should export hasAllCapabilities function", async () => {
    const { hasAllCapabilities } = await import("./capabilityResolver");
    expect(typeof hasAllCapabilities).toBe("function");
  });

  it("should export requireCapability function", async () => {
    const { requireCapability } = await import("./capabilityResolver");
    expect(typeof requireCapability).toBe("function");
  });

  it("should export AUTHORIZATION_MATRIX", async () => {
    const { AUTHORIZATION_MATRIX } = await import("./capabilityResolver");
    expect(AUTHORIZATION_MATRIX).toBeDefined();
    expect(typeof AUTHORIZATION_MATRIX).toBe("object");

    // Must cover key operation categories
    const keys = Object.keys(AUTHORIZATION_MATRIX);
    expect(keys.length).toBeGreaterThanOrEqual(20);
    expect(keys).toContain("member.view");
    expect(keys).toContain("member.create");
    expect(keys).toContain("finance.approve");
    expect(keys).toContain("governance.vote");
    expect(keys).toContain("election.manage");
    expect(keys).toContain("document.delete");
    expect(keys).toContain("admin.config");
  });

  it("should export getAllCapabilities function", async () => {
    const { getAllCapabilities } = await import("./capabilityResolver");
    expect(typeof getAllCapabilities).toBe("function");

    const caps = getAllCapabilities();
    expect(Array.isArray(caps)).toBe(true);
    expect(caps.length).toBeGreaterThanOrEqual(30);

    // Every capability should have key, category, description
    for (const cap of caps) {
      expect(cap.key).toBeTruthy();
      expect(cap.category).toBeTruthy();
      expect(cap.description).toBeTruthy();
    }
  });

  it("capabilities should be sorted alphabetically", async () => {
    const { getAllCapabilities } = await import("./capabilityResolver");
    const caps = getAllCapabilities();
    for (let i = 1; i < caps.length; i++) {
      expect(caps[i].key >= caps[i - 1].key).toBe(true);
    }
  });
});

// ============================================================================
// tRPC Middleware — Capability Procedures
// ============================================================================

describe("tRPC Middleware — Capability-gated procedures", () => {
  it("should export capabilityProcedure", async () => {
    const trpc = await import("../_core/trpc");
    expect(typeof trpc.capabilityProcedure).toBe("function");
  });

  it("should export anyCapabilityProcedure", async () => {
    const trpc = await import("../_core/trpc");
    expect(typeof trpc.anyCapabilityProcedure).toBe("function");
  });

  it("capabilityProcedure should return a procedure builder", async () => {
    const trpc = await import("../_core/trpc");
    const proc = trpc.capabilityProcedure("member.view");
    // Should be a tRPC procedure (has query/mutation methods)
    expect(proc).toBeDefined();
  });
});

// ============================================================================
// Workflow Engine — Configuration-Driven (Phase 6)
// ============================================================================

describe("Workflow Engine — Configuration-driven workflow runtime", () => {
  it("should export resolveApprovers function", async () => {
    const { resolveApprovers } = await import("./workflowEngine");
    expect(typeof resolveApprovers).toBe("function");
  });

  it("should export evaluateGuard function", async () => {
    const { evaluateGuard } = await import("./workflowEngine");
    expect(typeof evaluateGuard).toBe("function");
  });

  it("should export getStageDeadline function", async () => {
    const { getStageDeadline } = await import("./workflowEngine");
    expect(typeof getStageDeadline).toBe("function");
  });

  it("should export getWorkflowConfigSummary function", async () => {
    const { getWorkflowConfigSummary } = await import("./workflowEngine");
    expect(typeof getWorkflowConfigSummary).toBe("function");
  });

  it("should export isValidTransition function", async () => {
    const { isValidTransition } = await import("./workflowEngine");
    expect(typeof isValidTransition).toBe("function");
  });

  it("isValidTransition should allow draft→running", async () => {
    const { isValidTransition } = await import("./workflowEngine");
    expect(isValidTransition("draft", "running")).toBe(true);
  });

  it("isValidTransition should allow running→completed", async () => {
    const { isValidTransition } = await import("./workflowEngine");
    expect(isValidTransition("running", "completed")).toBe(true);
  });

  it("isValidTransition should allow running→cancelled", async () => {
    const { isValidTransition } = await import("./workflowEngine");
    expect(isValidTransition("running", "cancelled")).toBe(true);
  });

  it("isValidTransition should reject cancelled→running", async () => {
    const { isValidTransition } = await import("./workflowEngine");
    expect(isValidTransition("cancelled", "running")).toBe(false);
  });

  it("isValidTransition should reject completed→running", async () => {
    const { isValidTransition } = await import("./workflowEngine");
    expect(isValidTransition("completed", "running")).toBe(false);
  });

  it("isValidTransition should reject rejected→running", async () => {
    const { isValidTransition } = await import("./workflowEngine");
    expect(isValidTransition("rejected", "running")).toBe(false);
  });

  it("isValidTransition should allow paused→running", async () => {
    const { isValidTransition } = await import("./workflowEngine");
    expect(isValidTransition("paused", "running")).toBe(true);
  });

  it("isValidTransition should allow paused→cancelled", async () => {
    const { isValidTransition } = await import("./workflowEngine");
    expect(isValidTransition("paused", "cancelled")).toBe(true);
  });

  it("isValidTransition should reject running→draft", async () => {
    const { isValidTransition } = await import("./workflowEngine");
    expect(isValidTransition("running", "draft")).toBe(false);
  });

  it("evaluateGuard should handle financial_threshold guard", async () => {
    const { evaluateGuard } = await import("./workflowEngine");
    const result = await evaluateGuard("financial_threshold", {
      entityType: "expense",
      entityId: 1,
      metadata: { amount: 10000 },
    });
    expect(result.allowed).toBe(true);
  });

  it("evaluateGuard should block amount exceeding threshold", async () => {
    const { evaluateGuard } = await import("./workflowEngine");
    const result = await evaluateGuard("financial_threshold", {
      entityType: "expense",
      entityId: 1,
      metadata: { amount: 100000 },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("exceeds");
  });

  it("evaluateGuard should handle term_valid guard", async () => {
    const { evaluateGuard } = await import("./workflowEngine");
    const result = await evaluateGuard("term_valid", {
      entityType: "election",
      entityId: 1,
    });
    expect(typeof result.allowed).toBe("boolean");
  });

  it("evaluateGuard should allow unknown guard types", async () => {
    const { evaluateGuard } = await import("./workflowEngine");
    const result = await evaluateGuard("unknown_guard_type", {
      entityType: "test",
      entityId: 1,
    });
    expect(result.allowed).toBe(true);
  });

  it("getStageDeadline should return null when no deadline configured", async () => {
    const { getStageDeadline } = await import("./workflowEngine");
    const deadline = await getStageDeadline("nonexistent_entity", "nonexistent_stage");
    expect(deadline).toBeNull();
  });

  it("resolveApprovers should return an array", async () => {
    const { resolveApprovers } = await import("./workflowEngine");
    const approvers = await resolveApprovers("approval", "membership");
    expect(Array.isArray(approvers)).toBe(true);
  });

  it("getWorkflowConfigSummary should return summary object", async () => {
    const { getWorkflowConfigSummary } = await import("./workflowEngine");
    const summary = await getWorkflowConfigSummary("membership");
    expect(summary).toBeDefined();
    expect(typeof summary.hasDefinition).toBe("boolean");
    expect(typeof summary.stageCount).toBe("number");
    expect(typeof summary.approverConfigured).toBe("boolean");
    expect(typeof summary.guardsConfigured).toBe("boolean");
    expect(typeof summary.deadlinesConfigured).toBe("boolean");
  });
});

// ============================================================================
// State Machine Invariants
// ============================================================================

describe("State Machine Invariants — Terminal states have no outgoing transitions", () => {
  const terminalStates = ["completed", "cancelled", "rejected"];

  for (const terminal of terminalStates) {
    it(`${terminal} should not allow any outgoing transitions`, async () => {
      const { isValidTransition } = await import("./workflowEngine");
      const allStates = ["draft", "running", "paused", "completed", "cancelled", "rejected"];
      for (const target of allStates) {
        if (target === terminal) continue;
        expect(isValidTransition(terminal, target)).toBe(false);
      }
    });
  }
});

// ============================================================================
// Workflow Runtime Completeness
// ============================================================================

describe("Workflow Runtime — All required functions exported", () => {
  it("should export createWorkflow", async () => {
    const { createWorkflow } = await import("./workflowEngine");
    expect(typeof createWorkflow).toBe("function");
  });

  it("should export activateWorkflow", async () => {
    const { activateWorkflow } = await import("./workflowEngine");
    expect(typeof activateWorkflow).toBe("function");
  });

  it("should export listWorkflows", async () => {
    const { listWorkflows } = await import("./workflowEngine");
    expect(typeof listWorkflows).toBe("function");
  });

  it("should export getWorkflowWithStages", async () => {
    const { getWorkflowWithStages } = await import("./workflowEngine");
    expect(typeof getWorkflowWithStages).toBe("function");
  });

  it("should export startWorkflow", async () => {
    const { startWorkflow } = await import("./workflowEngine");
    expect(typeof startWorkflow).toBe("function");
  });

  it("should export advanceWorkflow", async () => {
    const { advanceWorkflow } = await import("./workflowEngine");
    expect(typeof advanceWorkflow).toBe("function");
  });

  it("should export cancelWorkflow", async () => {
    const { cancelWorkflow } = await import("./workflowEngine");
    expect(typeof cancelWorkflow).toBe("function");
  });

  it("should export getWorkflowTasks", async () => {
    const { getWorkflowTasks } = await import("./workflowEngine");
    expect(typeof getWorkflowTasks).toBe("function");
  });

  it("should export getTaskCounts", async () => {
    const { getTaskCounts } = await import("./workflowEngine");
    expect(typeof getTaskCounts).toBe("function");
  });
});
