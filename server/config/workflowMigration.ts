/**
 * Workflow Migration Adapters (Phase 8)
 *
 * Bridges existing business workflows to the generic workflow runtime.
 * Each adapter wraps legacy module-specific logic and delegates to the
 * generic engine for state management, guards, approvals, audit, and notifications.
 *
 * Priority migration order (per PLAN_NEW §14):
 *   1. Membership
 *   2. Appointments
 *   3. NEF / NRF
 *   4. Activities
 *   5. Events
 *   6. Finance
 *   7. Credentials
 *   8. NGA
 *   9. SGA
 *  10. Elections
 *  11. Plenary
 *  12. BCP / BSP
 *
 * Usage:
 *   import { membershipWorkflow, activityWorkflow, nefWorkflow } from "./workflowMigration";
 *
 *   const instance = await membershipWorkflow.start(applicationId, userId);
 *   await membershipWorkflow.advance(instanceId, { decision: "approve", userId: approverId });
 */

import {
  createWorkflow,
  activateWorkflow,
  startWorkflow,
  advanceWorkflow,
  cancelWorkflow,
  getWorkflowTasks,
  getWorkflowConfigSummary,
  resolveApprovers,
  evaluateGuard,
  getStageDeadline,
} from "./workflowEngine";
import { logAuditEvent } from "./auditService";
import { getConfigNumber, getConfig } from "./configService";
import { getCurrentGovernanceVersion } from "./termService";

// ============================================================================
// Types
// ============================================================================

export interface WorkflowMigrationResult {
  success: boolean;
  instanceId?: number;
  error?: string;
}

export interface WorkflowAdvanceInput {
  decision: "approve" | "reject" | "needs_revision";
  userId: number;
  notes?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Generic Migration Adapter
// ============================================================================

/**
 * Creates a migration adapter for a specific business workflow.
 * This is the standard pattern — each workflow type creates one of these.
 */
function createMigrationAdapter(config: {
  workflowName: string;
  entityType: string;
  stages: Array<{ name: string; type: string; config?: Record<string, unknown> }>;
  advanceGuard?: (input: WorkflowAdvanceInput) => Promise<{ allowed: boolean; reason?: string }>;
  onAdvance?: (instanceId: number, input: WorkflowAdvanceInput) => Promise<void>;
  onComplete?: (instanceId: number) => Promise<void>;
  onCancel?: (instanceId: number, reason?: string) => Promise<void>;
}) {
  let workflowId: number | null = null;

  return {
    /**
     * Initialize the workflow definition (call once on startup).
     */
    async init(): Promise<void> {
      const existing = await getWorkflowConfigSummary(config.entityType);
      if (existing.hasDefinition) {
        console.log(`[Migration] Workflow "${config.workflowName}" already exists.`);
        return;
      }

      const result = await createWorkflow(
        {
          name: config.workflowName,
          entityType: config.entityType,
          stages: config.stages,
        },
        1 // system user
      );

      if (result) {
        workflowId = result.id;
        await activateWorkflow(result.id);
        console.log(`[Migration] Created and activated workflow "${config.workflowName}" (#${result.id}).`);
      }
    },

    /**
     * Start a workflow instance for an entity.
     */
    async start(entityId: number, startedBy?: number, metadata?: Record<string, unknown>): Promise<WorkflowMigrationResult> {
      const result = await startWorkflow(
        config.workflowName,
        config.entityType,
        entityId,
        startedBy,
        metadata
      );

      if (!result) {
        return { success: false, error: "Failed to start workflow" };
      }

      return { success: true, instanceId: result.instanceId };
    },

    /**
     * Advance the workflow with an approval decision.
     */
    async advance(instanceId: number, input: WorkflowAdvanceInput): Promise<WorkflowMigrationResult> {
      // Evaluate guard if configured
      if (config.advanceGuard) {
        const guardResult = await config.advanceGuard(input);
        if (!guardResult.allowed) {
          await logAuditEvent({
            userId: input.userId,
            action: `${config.entityType}.workflow.guard_rejected`,
            entityType: config.entityType,
            entityId: instanceId,
            reason: guardResult.reason,
          });
          return { success: false, error: guardResult.reason };
        }
      }

      // Execute pre-advance hook
      if (config.onAdvance) {
        await config.onAdvance(instanceId, input);
      }

      // Advance the generic workflow
      const result = await advanceWorkflow(instanceId, {
        decision: input.decision === "approve" ? "approve" : "reject",
        notes: input.notes,
        userId: input.userId,
        metadata: input.metadata,
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Execute post-complete hook
      if (result.completed && config.onComplete) {
        await config.onComplete(instanceId);
      }

      return {
        success: true,
        instanceId,
        error: result.error,
      };
    },

    /**
     * Cancel the workflow.
     */
    async cancel(instanceId: number, userId: number, reason?: string): Promise<WorkflowMigrationResult> {
      if (config.onCancel) {
        await config.onCancel(instanceId, reason);
      }

      const result = await cancelWorkflow(instanceId, reason, userId);
      return { success: result.success, error: result.error };
    },

    /**
     * Get pending tasks for a user in this workflow.
     */
    async getTasks(userId: number, limit?: number) {
      return getWorkflowTasks(userId, { limit });
    },
  };
}

// ============================================================================
// 1. Membership Workflow Migration
// ============================================================================

export const membershipWorkflow = createMigrationAdapter({
  workflowName: "membership_approval",
  entityType: "membership",
  stages: [
    { name: "Application Submitted", type: "start" },
    { name: "Form Review", type: "form", config: { formUsageType: "membership_application" } },
    { name: "LC Verification", type: "review", config: { approverRole: "lc-president" } },
    { name: "VPI Approval", type: "approval", config: { approverRole: "vpi" } },
    { name: "Membership Certificate", type: "notification", config: { template: "membership_approved" } },
    { name: "Complete", type: "end" },
  ],
  advanceGuard: async (input) => {
    // Financial threshold check for membership
    if (input.metadata?.feeAmount) {
      const feeThreshold = await getConfigNumber("membership.fee_pkr", 1000);
      if ((input.metadata.feeAmount as number) > feeThreshold * 2) {
        return { allowed: false, reason: `Fee amount exceeds 2x standard fee (PKR ${feeThreshold})` };
      }
    }
    return { allowed: true };
  },
  onComplete: async (instanceId) => {
    await logAuditEvent({
      action: "membership.workflow_completed",
      entityType: "membership",
      entityId: instanceId,
      after: { status: "approved", governanceVersion: await getCurrentGovernanceVersion() },
    });
  },
});

// ============================================================================
// 2. Activity Workflow Migration
// ============================================================================

export const activityWorkflow = createMigrationAdapter({
  workflowName: "activity_approval",
  entityType: "activity",
  stages: [
    { name: "Proposal Submitted", type: "start" },
    { name: "VPA Review", type: "review", config: { approverRole: "vpa" } },
    { name: "Budget Validation", type: "conditional", config: { condition: "hasBudget" } },
    { name: "VPF Approval", type: "approval", config: { approverRole: "vpf" } },
    { name: "Execution Tracking", type: "form", config: { formUsageType: "activity_report" } },
    { name: "Complete", type: "end" },
  ],
  advanceGuard: async (input) => {
    if (input.decision === "approve" && input.metadata?.budget) {
      const threshold = await getConfigNumber("finance.vpfThreshold", 5000);
      if ((input.metadata.budget as number) > threshold) {
        return { allowed: false, reason: `Budget exceeds VPF threshold (PKR ${threshold}) — requires EB approval` };
      }
    }
    return { allowed: true };
  },
  onComplete: async (instanceId) => {
    await logAuditEvent({
      action: "activity.workflow_completed",
      entityType: "activity",
      entityId: instanceId,
      after: { governanceVersion: await getCurrentGovernanceVersion() },
    });
  },
});

// ============================================================================
// 3. NEF/NRF Workflow Migration
// ============================================================================

export const nefWorkflow = createMigrationAdapter({
  workflowName: "nef_nrf_approval",
  entityType: "nef_nrf",
  stages: [
    { name: "Submission", type: "start" },
    { name: "VPA Review", type: "review", config: { approverRole: "vpa" } },
    { name: "Financial Review", type: "review", config: { approverRole: "vpf" } },
    { name: "President Approval", type: "approval", config: { approverRole: "president" } },
    { name: "Execution", type: "form", config: { formUsageType: "nef_report" } },
    { name: "Closure Report", type: "notification", config: { template: "nef_closed" } },
    { name: "Complete", type: "end" },
  ],
  advanceGuard: async (input) => {
    if (input.metadata?.amount) {
      const ebThreshold = await getConfigNumber("finance.ebSupermajorityThreshold", 15000);
      if ((input.metadata.amount as number) > ebThreshold) {
        return { allowed: false, reason: `Amount exceeds EB supermajority threshold (PKR ${ebThreshold})` };
      }
    }
    return { allowed: true };
  },
  onComplete: async (instanceId) => {
    await logAuditEvent({
      action: "nef.workflow_completed",
      entityType: "nef_nrf",
      entityId: instanceId,
      after: { governanceVersion: await getCurrentGovernanceVersion() },
    });
  },
});

// ============================================================================
// 4. Event Workflow Migration
// ============================================================================

export const eventWorkflow = createMigrationAdapter({
  workflowName: "event_approval",
  entityType: "event",
  stages: [
    { name: "Proposal Submitted", type: "start" },
    { name: "VPA Review", type: "review", config: { approverRole: "vpa" } },
    { name: "Budget Check", type: "conditional", config: { condition: "hasBudget" } },
    { name: "VPF Approval", type: "approval", config: { approverRole: "vpf" } },
    { name: "Complete", type: "end" },
  ],
  onComplete: async (instanceId) => {
    await logAuditEvent({
      action: "event.workflow_completed",
      entityType: "event",
      entityId: instanceId,
      after: { governanceVersion: await getCurrentGovernanceVersion() },
    });
  },
});

// ============================================================================
// 5. Finance Workflow Migration
// ============================================================================

export const financeWorkflow = createMigrationAdapter({
  workflowName: "finance_request_approval",
  entityType: "finance_request",
  stages: [
    { name: "Request Submitted", type: "start" },
    { name: "Budget Validation", type: "review", config: { approverRole: "vpf" } },
    { name: "Authority Resolution", type: "conditional", config: { condition: "amountThreshold" } },
    { name: "Payment Processing", type: "approval", config: { approverRole: "president" } },
    { name: "Receipt Recording", type: "form", config: { formUsageType: "expense_receipt" } },
    { name: "Complete", type: "end" },
  ],
  advanceGuard: async (input) => {
    if (input.metadata?.amount) {
      const amount = input.metadata.amount as number;
      const vpfLimit = await getConfigNumber("finance.vpfThreshold", 5000);
      const presidentLimit = await getConfigNumber("finance.presidentThreshold", 15000);

      if (amount > presidentLimit) {
        return { allowed: false, reason: `Amount exceeds president limit (PKR ${presidentLimit}) — requires EB 2/3` };
      }
    }
    return { allowed: true };
  },
});

// ============================================================================
// 6. Credential Workflow Migration
// ============================================================================

export const credentialWorkflow = createMigrationAdapter({
  workflowName: "credential_verification",
  entityType: "credential",
  stages: [
    { name: "Submission", type: "start" },
    { name: "Validation", type: "review", config: { approverRole: "norp" } },
    { name: "Approval", type: "approval", config: { approverRole: "president" } },
    { name: "Issuance", type: "notification", config: { template: "credential_issued" } },
    { name: "Complete", type: "end" },
  ],
});

// ============================================================================
// 7. BCP/BSP Workflow Migration (Amendments/Suspensions)
// ============================================================================

export const bcpWorkflow = createMigrationAdapter({
  workflowName: "bylaw_change_proposal",
  entityType: "bcp",
  stages: [
    { name: "Proposal Submitted", type: "start" },
    { name: "Plenary Team Review", type: "review", config: { approverRole: "vpprc" } },
    { name: "NGA Agenda Placement", type: "conditional", config: { condition: "deadlineCheck" } },
    { name: "Plenary Vote", type: "approval", config: { approverRole: "delegates" } },
    { name: "Activation", type: "notification", config: { template: "bcp_activated" } },
    { name: "Complete", type: "end" },
  ],
  advanceGuard: async (input) => {
    // B-17.2.2: Must be submitted at least 3 weeks before NGA
    const deadlineWeeks = await getConfigNumber("gov.bcpDeadlineWeeks", 3);
    return {
      allowed: true,
      reason: `BCP deadline: ${deadlineWeeks} weeks before NGA`,
    };
  },
});

// ============================================================================
// All Workflows Registry
// ============================================================================

export const ALL_MIGRATION_WORKFLOWS = [
  membershipWorkflow,
  activityWorkflow,
  nefWorkflow,
  eventWorkflow,
  financeWorkflow,
  credentialWorkflow,
  bcpWorkflow,
];

/**
 * Initialize all migration workflows on startup.
 * Creates workflow definitions for any that don't exist yet.
 */
export async function initializeMigrationWorkflows(): Promise<void> {
  console.log("[Migration] Initializing workflow definitions...");
  for (const workflow of ALL_MIGRATION_WORKFLOWS) {
    try {
      await workflow.init();
    } catch (error) {
      console.error("[Migration] Failed to initialize workflow:", error);
    }
  }
  console.log("[Migration] Workflow initialization complete.");
}
