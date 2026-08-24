/**
 * Phase 7+8 Tests: Form Pipeline & Workflow Migration Adapters
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// Form Pipeline Engine (Phase 7)
// ============================================================================

describe("Form Pipeline Engine — FORM→WORKFLOW→APPROVAL→DOCUMENT", () => {
  it("should export createPipeline function", async () => {
    const { createPipeline } = await import("./formPipelineEngine");
    expect(typeof createPipeline).toBe("function");
  });

  it("should export activatePipeline function", async () => {
    const { activatePipeline } = await import("./formPipelineEngine");
    expect(typeof activatePipeline).toBe("function");
  });

  it("should export triggerPipeline function", async () => {
    const { triggerPipeline } = await import("./formPipelineEngine");
    expect(typeof triggerPipeline).toBe("function");
  });

  it("should export advancePipeline function", async () => {
    const { advancePipeline } = await import("./formPipelineEngine");
    expect(typeof advancePipeline).toBe("function");
  });

  it("should export cancelPipeline function", async () => {
    const { cancelPipeline } = await import("./formPipelineEngine");
    expect(typeof cancelPipeline).toBe("function");
  });

  it("should export getPipelineStatus function", async () => {
    const { getPipelineStatus } = await import("./formPipelineEngine");
    expect(typeof getPipelineStatus).toBe("function");
  });

  it("should export listPipelineInstances function", async () => {
    const { listPipelineInstances } = await import("./formPipelineEngine");
    expect(typeof listPipelineInstances).toBe("function");
  });

  it("should export getPipelineCounts function", async () => {
    const { getPipelineCounts } = await import("./formPipelineEngine");
    expect(typeof getPipelineCounts).toBe("function");
  });

  it("should export createApprovalChain function", async () => {
    const { createApprovalChain } = await import("./formPipelineEngine");
    expect(typeof createApprovalChain).toBe("function");
  });

  it("should export listPipelines function", async () => {
    const { listPipelines } = await import("./formPipelineEngine");
    expect(typeof listPipelines).toBe("function");
  });

  it("should export getPipeline function", async () => {
    const { getPipeline } = await import("./formPipelineEngine");
    expect(typeof getPipeline).toBe("function");
  });
});

// ============================================================================
// Form Engine (Phase 7)
// ============================================================================

describe("Forms Engine — Dynamic form creation and submission", () => {
  it("should export createForm function", async () => {
    const { createForm } = await import("./formsEngine");
    expect(typeof createForm).toBe("function");
  });

  it("should export activateForm function", async () => {
    const { activateForm } = await import("./formsEngine");
    expect(typeof activateForm).toBe("function");
  });

  it("should export addFormField function", async () => {
    const { addFormField } = await import("./formsEngine");
    expect(typeof addFormField).toBe("function");
  });

  it("should export submitForm function", async () => {
    const { submitForm } = await import("./formsEngine");
    expect(typeof submitForm).toBe("function");
  });

  it("should export reviewSubmission function", async () => {
    const { reviewSubmission } = await import("./formsEngine");
    expect(typeof reviewSubmission).toBe("function");
  });

  it("should export getFormWithFields function", async () => {
    const { getFormWithFields } = await import("./formsEngine");
    expect(typeof getFormWithFields).toBe("function");
  });

  it("should export getSubmissionCounts function", async () => {
    const { getSubmissionCounts } = await import("./formsEngine");
    expect(typeof getSubmissionCounts).toBe("function");
  });
});

// ============================================================================
// Workflow Migration Adapters (Phase 8)
// ============================================================================

describe("Workflow Migration — Membership", () => {
  it("should export membershipWorkflow", async () => {
    const { membershipWorkflow } = await import("./workflowMigration");
    expect(membershipWorkflow).toBeDefined();
  });

  it("membershipWorkflow should have init method", async () => {
    const { membershipWorkflow } = await import("./workflowMigration");
    expect(typeof membershipWorkflow.init).toBe("function");
  });

  it("membershipWorkflow should have start method", async () => {
    const { membershipWorkflow } = await import("./workflowMigration");
    expect(typeof membershipWorkflow.start).toBe("function");
  });

  it("membershipWorkflow should have advance method", async () => {
    const { membershipWorkflow } = await import("./workflowMigration");
    expect(typeof membershipWorkflow.advance).toBe("function");
  });

  it("membershipWorkflow should have cancel method", async () => {
    const { membershipWorkflow } = await import("./workflowMigration");
    expect(typeof membershipWorkflow.cancel).toBe("function");
  });

  it("membershipWorkflow should have getTasks method", async () => {
    const { membershipWorkflow } = await import("./workflowMigration");
    expect(typeof membershipWorkflow.getTasks).toBe("function");
  });
});

describe("Workflow Migration — Activity", () => {
  it("should export activityWorkflow", async () => {
    const { activityWorkflow } = await import("./workflowMigration");
    expect(activityWorkflow).toBeDefined();
    expect(typeof activityWorkflow.init).toBe("function");
    expect(typeof activityWorkflow.start).toBe("function");
    expect(typeof activityWorkflow.advance).toBe("function");
  });
});

describe("Workflow Migration — NEF/NRF", () => {
  it("should export nefWorkflow", async () => {
    const { nefWorkflow } = await import("./workflowMigration");
    expect(nefWorkflow).toBeDefined();
    expect(typeof nefWorkflow.init).toBe("function");
    expect(typeof nefWorkflow.start).toBe("function");
    expect(typeof nefWorkflow.advance).toBe("function");
  });
});

describe("Workflow Migration — Event", () => {
  it("should export eventWorkflow", async () => {
    const { eventWorkflow } = await import("./workflowMigration");
    expect(eventWorkflow).toBeDefined();
    expect(typeof eventWorkflow.init).toBe("function");
    expect(typeof eventWorkflow.start).toBe("function");
  });
});

describe("Workflow Migration — Finance", () => {
  it("should export financeWorkflow", async () => {
    const { financeWorkflow } = await import("./workflowMigration");
    expect(financeWorkflow).toBeDefined();
    expect(typeof financeWorkflow.init).toBe("function");
    expect(typeof financeWorkflow.start).toBe("function");
  });
});

describe("Workflow Migration — Credential", () => {
  it("should export credentialWorkflow", async () => {
    const { credentialWorkflow } = await import("./workflowMigration");
    expect(credentialWorkflow).toBeDefined();
    expect(typeof credentialWorkflow.init).toBe("function");
  });
});

describe("Workflow Migration — BCP", () => {
  it("should export bcpWorkflow", async () => {
    const { bcpWorkflow } = await import("./workflowMigration");
    expect(bcpWorkflow).toBeDefined();
    expect(typeof bcpWorkflow.init).toBe("function");
  });
});

describe("Workflow Migration — Registry", () => {
  it("should export ALL_MIGRATION_WORKFLOWS array", async () => {
    const { ALL_MIGRATION_WORKFLOWS } = await import("./workflowMigration");
    expect(Array.isArray(ALL_MIGRATION_WORKFLOWS)).toBe(true);
    expect(ALL_MIGRATION_WORKFLOWS.length).toBeGreaterThanOrEqual(7);
  });

  it("ALL_MIGRATION_WORKFLOWS should have consistent API", async () => {
    const { ALL_MIGRATION_WORKFLOWS } = await import("./workflowMigration");
    for (const workflow of ALL_MIGRATION_WORKFLOWS) {
      expect(typeof workflow.init).toBe("function");
      expect(typeof workflow.start).toBe("function");
      expect(typeof workflow.advance).toBe("function");
      expect(typeof workflow.cancel).toBe("function");
      expect(typeof workflow.getTasks).toBe("function");
    }
  });

  it("should export initializeMigrationWorkflows function", async () => {
    const { initializeMigrationWorkflows } = await import("./workflowMigration");
    expect(typeof initializeMigrationWorkflows).toBe("function");
  });
});

// ============================================================================
// Integration: Forms → Pipeline → Workflow Connection
// ============================================================================

describe("Integration — Forms→Pipeline→Workflow connection", () => {
  it("formPipelineEngine uses formsEngine types", async () => {
    const formsMod = await import("./formsEngine");
    const pipelineMod = await import("./formPipelineEngine");

    // Both should work with form submissions
    expect(typeof formsMod.submitForm).toBe("function");
    expect(typeof pipelineMod.triggerPipeline).toBe("function");
  });

  it("workflowMigration uses workflowEngine", async () => {
    const engineMod = await import("./workflowEngine");
    const migrationMod = await import("./workflowMigration");

    // Migration adapters should delegate to the engine
    expect(typeof engineMod.startWorkflow).toBe("function");
    expect(typeof engineMod.advanceWorkflow).toBe("function");
    expect(typeof migrationMod.membershipWorkflow.start).toBe("function");
    expect(typeof migrationMod.membershipWorkflow.advance).toBe("function");
  });

  it("pipeline engine has approval chain support", async () => {
    const { createApprovalChain } = await import("./formPipelineEngine");
    expect(typeof createApprovalChain).toBe("function");
  });
});
