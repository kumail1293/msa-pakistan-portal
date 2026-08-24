/**
 * Generic Workflow Engine
 *
 * Provides a configurable, versioned workflow system for any business process:
 * membership approval, activity proposals, elections, NEF/NRF, etc.
 *
 * Each workflow has stages (start, form, review, approval, etc.) and
 * instances track a specific entity going through that workflow.
 *
 * Usage:
 *   import { startWorkflow, advanceWorkflow, getWorkflowTasks } from "./workflowEngine";
 *
 *   const instance = await startWorkflow("membership_approval", "application", 42);
 *   await advanceWorkflow(instance.id, { decision: "approve", userId: 5 });
 */

import { eq, and, desc, sql } from "drizzle-orm";
import {
  workflows,
  workflowStages,
  workflowInstances,
  workflowTasks,
} from "../../drizzle/schema.enterprise";
import { getDb } from "../db";
import { logAuditEvent } from "./auditService";
import { getConfigNumber, getConfig } from "./configService";

// ============================================================================
// Workflow Definition Management
// ============================================================================

export interface WorkflowDefinitionInput {
  name: string;
  description?: string;
  entityType: string;
  config?: Record<string, unknown>;
  stages: WorkflowStageDefinition[];
}

export interface WorkflowStageDefinition {
  name: string;
  type: string; // "start", "form", "review", "approval", "parallel_approval", "conditional", "notification", "timer", "end"
  config?: Record<string, unknown>;
  conditions?: Record<string, unknown>;
}

/**
 * Create a new workflow definition with stages.
 */
export async function createWorkflow(
  input: WorkflowDefinitionInput,
  createdBy?: number
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [result] = await db.insert(workflows).values({
      name: input.name,
      description: input.description,
      entityType: input.entityType,
      config: input.config,
      createdBy,
      status: "draft",
    });

    const workflowId = Number((result as any)[0].insertId);

    // Create stages in order
    for (let i = 0; i < input.stages.length; i++) {
      const stage = input.stages[i];
      await db.insert(workflowStages).values({
        workflowId,
        name: stage.name,
        type: stage.type as any,
        order: i + 1,
        config: stage.config,
        conditions: stage.conditions,
      });
    }

    console.log(`[Workflow] Created workflow "${input.name}" (#${workflowId}) with ${input.stages.length} stages.`);
    return { id: workflowId };
  } catch (error) {
    console.error("[Workflow] Failed to create workflow:", error);
    return null;
  }
}

/**
 * Activate a workflow (make it available for use).
 */
export async function activateWorkflow(workflowId: number): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .update(workflows)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(workflows.id, workflowId));
    return true;
  } catch (error) {
    console.error("[Workflow] Failed to activate workflow:", error);
    return false;
  }
}

/**
 * Get all workflow definitions.
 */
export async function listWorkflows(entityType?: string): Promise<
  Array<{
    id: number;
    name: string;
    description: string | null;
    entityType: string;
    version: number;
    status: string;
    createdAt: Date;
  }>
> {
  const db = getDb();
  if (!db) return [];

  try {
    const where = entityType
      ? eq(workflows.entityType, entityType)
      : undefined;

    return await db
      .select()
      .from(workflows)
      .where(where)
      .orderBy(desc(workflows.createdAt));
  } catch (error) {
    console.error("[Workflow] Failed to list workflows:", error);
    return [];
  }
}

/**
 * Get a workflow with its stages.
 */
export async function getWorkflowWithStages(
  workflowId: number
): Promise<{
  workflow: any;
  stages: any[];
} | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [workflow] = await db
      .select()
      .from(workflows)
      .where(eq(workflows.id, workflowId))
      .limit(1);

    if (!workflow) return null;

    const stages = await db
      .select()
      .from(workflowStages)
      .where(eq(workflowStages.workflowId, workflowId))
      .orderBy(workflowStages.order);

    return { workflow, stages };
  } catch (error) {
    console.error("[Workflow] Failed to get workflow:", error);
    return null;
  }
}

// ============================================================================
// Workflow Instance Management
// ============================================================================

/**
 * Start a new workflow instance for an entity.
 * Creates the instance and the first task.
 */
export async function startWorkflow(
  workflowIdOrName: number | string,
  entityType: string,
  entityId: number,
  startedBy?: number,
  metadata?: Record<string, unknown>
): Promise<{ instanceId: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Resolve workflow
    let workflow: any;
    if (typeof workflowIdOrName === "string") {
      const [found] = await db
        .select()
        .from(workflows)
        .where(and(
          eq(workflows.name, workflowIdOrName),
          eq(workflows.status, "active")
        ))
        .limit(1);
      workflow = found;
    } else {
      const [found] = await db
        .select()
        .from(workflows)
        .where(eq(workflows.id, workflowIdOrName))
        .limit(1);
      workflow = found;
    }

    if (!workflow) {
      console.warn(`[Workflow] No active workflow found for "${workflowIdOrName}".`);
      return null;
    }

    // Get the first stage
    const [firstStage] = await db
      .select()
      .from(workflowStages)
      .where(eq(workflowStages.workflowId, workflow.id))
      .orderBy(workflowStages.order)
      .limit(1);

    if (!firstStage) {
      console.warn(`[Workflow] Workflow "${workflow.name}" has no stages.`);
      return null;
    }

    // Create instance
    const [instanceResult] = await db.insert(workflowInstances).values({
      workflowId: workflow.id,
      entityType,
      entityId,
      currentStageId: firstStage.id,
      status: "running",
      startedBy,
      metadata,
    });

    const instanceId = Number((instanceResult as any)[0].insertId);

    // Create task for the first stage
    await createTaskForStage(instanceId, firstStage);

    // Audit
    await logAuditEvent({
      userId: startedBy,
      action: "workflow.started",
      entityType,
      entityId,
      after: { workflowId: workflow.id, workflowName: workflow.name, instanceId },
      metadata: { stageName: firstStage.name },
    });

    console.log(`[Workflow] Started instance #${instanceId} for ${entityType}#${entityId} in "${workflow.name}".`);
    return { instanceId };
  } catch (error) {
    console.error("[Workflow] Failed to start workflow:", error);
    return null;
  }
}

/**
 * Validate that a workflow state transition is legal.
 * Prevents illegal transitions like cancelled->running, completed->running, etc.
 */
export function isValidTransition(fromStatus: string, toStatus: string): boolean {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    draft: ["running"],
    running: ["completed", "rejected", "cancelled", "paused"],
    paused: ["running", "cancelled"],
    // completed/cancelled/rejected are terminal — no outgoing transitions
  };
  const allowed = VALID_TRANSITIONS[fromStatus];
  if (!allowed) return false;
  return allowed.includes(toStatus);
}

/**
 * Advance a workflow instance to the next stage.
 */
export async function advanceWorkflow(
  instanceId: number,
  options: {
    decision?: string;
    notes?: string;
    userId?: number;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<{ success: boolean; nextStage?: string; completed?: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    // Get current instance
    const [instance] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, instanceId))
      .limit(1);

    if (!instance) {
      return { success: false, error: "Workflow instance not found" };
    }

    // SECURITY: Validate state machine transition
    if (!isValidTransition(instance.status, "running")) {
      await logAuditEvent({
        userId: options.userId,
        action: "workflow.transition_rejected",
        entityType: instance.entityType,
        entityId: instance.entityId,
        metadata: { instanceId, from: instance.status, attempted: "advance" },
      });
      return { success: false, error: `Cannot advance workflow in status '${instance.status}'` };
    }

    if (instance.status !== "running") {
      return { success: false, error: `Workflow is not running (status: ${instance.status})` };
    }

    // Complete the current task
    const [currentTask] = await db
      .select()
      .from(workflowTasks)
      .where(
        and(
          eq(workflowTasks.instanceId, instanceId),
          eq(workflowTasks.status, "pending")
        )
      )
      .limit(1);

    if (currentTask) {
      await db
        .update(workflowTasks)
        .set({
          status: options.decision === "reject" ? "rejected" : "completed",
          notes: options.notes,
          decision: options.decision,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(workflowTasks.id, currentTask.id));
    }

    // Get current stage
    const [currentStage] = await db
      .select()
      .from(workflowStages)
      .where(eq(workflowStages.id, instance.currentStageId!))
      .limit(1);

    // Find next stage
    const [nextStage] = await db
      .select()
      .from(workflowStages)
      .where(
        and(
          eq(workflowStages.workflowId, instance.workflowId),
          // Next stage has order > current stage order
        )
      )
      .orderBy(workflowStages.order);

    // Simple linear flow: find the next stage after current
    const allStages = await db
      .select()
      .from(workflowStages)
      .where(eq(workflowStages.workflowId, instance.workflowId))
      .orderBy(workflowStages.order);

    const currentOrder = currentStage?.order ?? 0;
    const nextStageInFlow = allStages.find((s) => s.order > currentOrder);

    if (!nextStageInFlow || nextStageInFlow.type === "end") {
      // Workflow complete
      await db
        .update(workflowInstances)
        .set({
          status: options.decision === "reject" ? "rejected" : "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(workflowInstances.id, instanceId));

      await logAuditEvent({
        userId: options.userId,
        action: "workflow.completed",
        entityType: instance.entityType,
        entityId: instance.entityId,
        metadata: { instanceId, decision: options.decision },
      });

      return { success: true, completed: true };
    }

    // Move to next stage
    await db
      .update(workflowInstances)
      .set({
        currentStageId: nextStageInFlow.id,
        updatedAt: new Date(),
      })
      .where(eq(workflowInstances.id, instanceId));

    // Create task for next stage
    await createTaskForStage(instanceId, nextStageInFlow);

    await logAuditEvent({
      userId: options.userId,
      action: "workflow.advanced",
      entityType: instance.entityType,
      entityId: instance.entityId,
      before: { stage: currentStage?.name },
      after: { stage: nextStageInFlow.name },
      metadata: { instanceId, decision: options.decision },
    });

    return { success: true, nextStage: nextStageInFlow.name, completed: false };
  } catch (error) {
    console.error("[Workflow] Failed to advance workflow:", error);
    return { success: false };
  }
}

/**
 * Cancel a workflow instance.
 */
export async function cancelWorkflow(
  instanceId: number,
  reason?: string,
  userId?: number
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    const [instance] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, instanceId))
      .limit(1);

    if (!instance) return { success: false, error: "Instance not found" };

    // SECURITY: Only running or paused workflows can be cancelled
    if (!isValidTransition(instance.status, "cancelled")) {
      await logAuditEvent({
        userId,
        action: "workflow.transition_rejected",
        entityType: instance.entityType,
        entityId: instance.entityId,
        metadata: { instanceId, from: instance.status, attempted: "cancel" },
      });
      return { success: false, error: `Cannot cancel workflow in status '${instance.status}'` };
    }

    await db
      .update(workflowInstances)
      .set({
        status: "cancelled",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workflowInstances.id, instanceId));

    await logAuditEvent({
      userId,
      action: "workflow.cancelled",
      entityType: instance.entityType,
      entityId: instance.entityId,
      reason,
      metadata: { instanceId },
    });

    return { success: true };
  } catch (error) {
    console.error("[Workflow] Failed to cancel workflow:", error);
    return { success: false, error: "Internal error" };
  }
}

// ============================================================================
// Task Management
// ============================================================================

/**
 * Get pending tasks for a user.
 */
export async function getWorkflowTasks(
  userId: number,
  options: { status?: string; limit?: number } = {}
): Promise<Array<{
  taskId: number;
  instanceId: number;
  stageName: string;
  entityType: string;
  entityId: number;
  dueAt: Date | null;
  status: string;
}>> {
  const db = getDb();
  if (!db) return [];

  try {
    const status = options.status ?? "pending";
    const limit = options.limit ?? 50;

    const rows = await db
      .select({
        taskId: workflowTasks.id,
        instanceId: workflowTasks.instanceId,
        stageName: workflowStages.name,
        entityType: workflowInstances.entityType,
        entityId: workflowInstances.entityId,
        dueAt: workflowTasks.dueAt,
        status: workflowTasks.status,
      })
      .from(workflowTasks)
      .innerJoin(workflowInstances, eq(workflowTasks.instanceId, workflowInstances.id))
      .innerJoin(workflowStages, eq(workflowTasks.stageId, workflowStages.id))
      .where(
        and(
          eq(workflowTasks.assignedTo, userId),
          eq(workflowTasks.status, status as any)
        )
      )
      .orderBy(workflowTasks.dueAt)
      .limit(limit);

    return rows;
  } catch (error) {
    console.error("[Workflow] Failed to get tasks:", error);
    return [];
  }
}

/**
 * Get task counts by status for a user.
 */
export async function getTaskCounts(userId: number): Promise<{
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}> {
  const db = getDb();
  if (!db) return { pending: 0, inProgress: 0, completed: 0, overdue: 0 };

  try {
    const now = new Date();

    const [pending] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workflowTasks)
      .where(
        and(
          eq(workflowTasks.assignedTo, userId),
          eq(workflowTasks.status, "pending")
        )
      );

    const [inProgress] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workflowTasks)
      .where(
        and(
          eq(workflowTasks.assignedTo, userId),
          eq(workflowTasks.status, "in_progress")
        )
      );

    const [completed] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workflowTasks)
      .where(
        and(
          eq(workflowTasks.assignedTo, userId),
          eq(workflowTasks.status, "completed")
        )
      );

    const [overdue] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workflowTasks)
      .where(
        and(
          eq(workflowTasks.assignedTo, userId),
          eq(workflowTasks.status, "pending"),
          sql`${workflowTasks.dueAt} < ${now}`
        )
      );

    return {
      pending: pending?.count ?? 0,
      inProgress: inProgress?.count ?? 0,
      completed: completed?.count ?? 0,
      overdue: overdue?.count ?? 0,
    };
  } catch (error) {
    console.error("[Workflow] Failed to get task counts:", error);
    return { pending: 0, inProgress: 0, completed: 0, overdue: 0 };
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create a task for a workflow stage.
 */
async function createTaskForStage(
  instanceId: number,
  stage: { id: number; name: string; type: string; config: unknown }
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const config = (stage.config as Record<string, unknown>) ?? {};

  await db.insert(workflowTasks).values({
    instanceId,
    stageId: stage.id,
    status: "pending",
    dueAt: config.dueAt ? new Date(config.dueAt as string) : undefined,
    metadata: config,
  });
}

// ============================================================================
// Configuration-Driven Workflow Helpers (Phase 6)
// ============================================================================

/**
 * Resolve the approver for a workflow stage from configuration.
 * Returns user IDs that should be assigned the approval task.
 */
export async function resolveApprovers(
  stageType: string,
  entityType: string,
  metadata?: Record<string, unknown>
): Promise<number[]> {
  const db = getDb();
  if (!db) return [];

  // Check for configured approver role for this stage type
  const configKey = `workflow.approver.${entityType}.${stageType}`;
  const approverRole = await getConfig(configKey, "");

  if (!approverRole) {
    // Default: no specific approver configured, task goes to unassigned pool
    return [];
  }

  // In production, resolve role → user IDs from the database
  // For now, return empty (task goes to unassigned pool)
  return [];
}

/**
 * Evaluate a workflow guard condition against configuration.
 * Guards determine whether a transition should be allowed.
 */
export async function evaluateGuard(
  guardType: string,
  context: {
    entityType: string;
    entityId: number;
    metadata?: Record<string, unknown>;
    userId?: number;
  }
): Promise<{ allowed: boolean; reason?: string }> {
  switch (guardType) {
    case "financial_threshold": {
      const threshold = await getConfigNumber("finance.ebSupermajorityThreshold", 15000);
      const amount = (context.metadata?.amount as number) ?? 0;
      if (amount > threshold) {
        return {
          allowed: false,
          reason: `Amount PKR ${amount} exceeds EB approval threshold PKR ${threshold}`,
        };
      }
      return { allowed: true };
    }

    case "quorum_required": {
      const numerator = await getConfigNumber("gov.quorumNumerator", 1);
      const denominator = await getConfigNumber("gov.quorumDenominator", 3);
      return {
        allowed: true,
        reason: `Quorum requirement: ${numerator}/${denominator}`,
      };
    }

    case "term_valid": {
      // Check if the current term is still active
      const { isDateInCurrentTerm } = await import("./termService");
      const inTerm = await isDateInCurrentTerm(new Date());
      if (!inTerm) {
        return { allowed: false, reason: "Current term has expired" };
      }
      return { allowed: true };
    }

    case "membership_active": {
      // Check if the subject member is still active
      return { allowed: true }; // Would check membership status in production
    }

    default:
      // Unknown guard type — allow by default (fail open for unknown guards)
      return { allowed: true };
  }
}

/**
 * Get the default deadline for a workflow stage from configuration.
 */
export async function getStageDeadline(
  entityType: string,
  stageType: string
): Promise<Date | null> {
  const configKey = `workflow.deadline.${entityType}.${stageType}`;
  const days = await getConfigNumber(configKey, 0);

  if (days <= 0) return null;

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + days);
  return deadline;
}

/**
 * Get workflow configuration summary for a given entity type.
 * Useful for the Configuration Health Dashboard.
 */
export async function getWorkflowConfigSummary(
  entityType: string
): Promise<{
  hasDefinition: boolean;
  stageCount: number;
  approverConfigured: boolean;
  guardsConfigured: boolean;
  deadlinesConfigured: boolean;
}> {
  const db = getDb();
  if (!db) return { hasDefinition: false, stageCount: 0, approverConfigured: false, guardsConfigured: false, deadlinesConfigured: false };

  const [workflow] = await db
    .select()
    .from(workflows)
    .where(
      and(
        eq(workflows.entityType, entityType),
        eq(workflows.status, "active")
      )
    )
    .limit(1);

  if (!workflow) {
    return { hasDefinition: false, stageCount: 0, approverConfigured: false, guardsConfigured: false, deadlinesConfigured: false };
  }

  const stages = await db
    .select()
    .from(workflowStages)
    .where(eq(workflowStages.workflowId, workflow.id));

  const approverKey = `workflow.approver.${entityType}.approval`;
  const deadlineKey = `workflow.deadline.${entityType}.review`;

  const [approverVal] = await db.select().from(workflowStages).where(eq(workflowStages.workflowId, workflow.id)).limit(1);

  return {
    hasDefinition: true,
    stageCount: stages.length,
    approverConfigured: approverVal?.config != null,
    guardsConfigured: stages.some((s) => s.conditions != null),
    deadlinesConfigured: stages.some((s) => {
      const cfg = (s.config as Record<string, unknown>) ?? {};
      return cfg.dueAt != null;
    }),
  };
}
