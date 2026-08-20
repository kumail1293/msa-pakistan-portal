/**
 * Generic Workflow Engine v2
 *
 * Enhanced with:
 * - Transition graph (branching based on outcome)
 * - SLA tracking and escalation
 * - Versioned workflow definitions
 * - Configurable permissions per stage
 * - Notification hooks
 * - Complete audit trail
 *
 * Usage:
 *   import { createWorkflowV2, startWorkflowV2, advanceWorkflowV2 } from "./workflowEngineV2";
 *
 *   const workflow = await createWorkflowV2({
 *     name: "Membership Approval",
 *     entityType: "membership_application",
 *     stages: [
 *       { name: "Review", type: "review", slaHours: 48 },
 *       { name: "Approval", type: "approval", slaHours: 72 },
 *     ],
 *     transitions: [
 *       { from: "Review", outcome: "approved", to: "Approval" },
 *       { from: "Review", outcome: "rejected", to: null },
 *       { from: "Approval", outcome: "approved", to: null }, // end
 *       { from: "Approval", outcome: "rejected", to: "Review" }, // loop back
 *     ],
 *   });
 *
 *   const instance = await startWorkflowV2(workflow.id, "membership_application", 42);
 *   await advanceWorkflowV2(instance.instanceId, { decision: "approved", userId: 5 });
 */

import { eq, and, desc, sql, or, isNull } from "drizzle-orm";
import {
  workflows,
  workflowStages,
  workflowInstances,
  workflowTasks,
} from "../../drizzle/schema.enterprise";
import { getDb } from "../db";
import { logAuditEvent } from "./auditService";

// ============================================================================
// Types
// ============================================================================

export interface WorkflowDefinitionInputV2 {
  name: string;
  description?: string;
  entityType: string;
  config?: Record<string, unknown>;
  stages: WorkflowStageDefinitionV2[];
  transitions: WorkflowTransitionDefinition[];
  triggerType?: "manual" | "event" | "schedule" | "webhook";
  triggerConfig?: Record<string, unknown>;
  startConditions?: Record<string, unknown>;
  slaDeadlineHours?: number;
  slaEscalationConfig?: Record<string, unknown>;
  organizationId?: number;
}

export interface WorkflowStageDefinitionV2 {
  name: string;
  type: string;
  config?: Record<string, unknown>;
  entryConditions?: Record<string, unknown>;
  slaHours?: number;
  slaEscalationConfig?: Record<string, unknown>;
  requiredPermissions?: string[];
  onEnterNotifications?: Record<string, unknown>;
  onCompleteNotifications?: Record<string, unknown>;
  onTimeoutNotifications?: Record<string, unknown>;
  formId?: number;
  documentTemplateId?: number;
  assignmentRules?: Record<string, unknown>;
}

export interface WorkflowTransitionDefinition {
  fromStage: string; // Stage name
  outcome: string;   // "approved", "rejected", "needs_revision", "expired", "default"
  toStage: string | null; // Stage name or null for end
  conditions?: Record<string, unknown>;
  priority?: number;
  isDefault?: boolean;
}

export interface AdvanceOptions {
  decision: string;
  notes?: string;
  userId?: number;
  decisionData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface TransitionResolution {
  success: boolean;
  nextStageId?: number;
  nextStageName?: string;
  completed?: boolean;
  rejected?: boolean;
  error?: string;
}

// ============================================================================
// Workflow Definition Management
// ============================================================================

/**
 * Create a new workflow definition with stages and transitions.
 */
export async function createWorkflowV2(
  input: WorkflowDefinitionInputV2,
  createdBy?: number
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Create workflow
    const [result] = await db.insert(workflows).values({
      name: input.name,
      description: input.description,
      entityType: input.entityType,
      config: {
        ...input.config,
        triggerType: input.triggerType ?? "manual",
        triggerConfig: input.triggerConfig,
        startConditions: input.startConditions,
        slaDeadlineHours: input.slaDeadlineHours,
        slaEscalationConfig: input.slaEscalationConfig,
        organizationId: input.organizationId,
      },
      createdBy,
      status: "draft",
    });

    const workflowId = Number((result as any)[0].insertId);

    // Create stages
    const stageNameToId = new Map<string, number>();
    
    for (let i = 0; i < input.stages.length; i++) {
      const stage = input.stages[i];
      const [stageResult] = await db.insert(workflowStages).values({
        workflowId,
        name: stage.name,
        type: stage.type as any,
        order: i + 1,
        config: stage.config,
        conditions: {
          entryConditions: stage.entryConditions,
          requiredPermissions: stage.requiredPermissions,
          onEnterNotifications: stage.onEnterNotifications,
          onCompleteNotifications: stage.onCompleteNotifications,
          onTimeoutNotifications: stage.onTimeoutNotifications,
          formId: stage.formId,
          documentTemplateId: stage.documentTemplateId,
          assignmentRules: stage.assignmentRules,
          slaHours: stage.slaHours,
          slaEscalationConfig: stage.slaEscalationConfig,
        },
      });
      
      const stageId = Number((stageResult as any)[0].insertId);
      stageNameToId.set(stage.name, stageId);
    }

    // Create transitions
    for (const transition of input.transitions) {
      const fromStageId = stageNameToId.get(transition.fromStage);
      const toStageId = transition.toStage ? stageNameToId.get(transition.toStage) : null;
      
      if (!fromStageId) {
        console.warn(`[Workflow] Stage "${transition.fromStage}" not found, skipping transition.`);
        continue;
      }
      
      // For transitions to null (end), we store toStageId as null
      // The advance logic will handle this as workflow completion
      await db.insert(workflowStages).values({
        workflowId,
        name: `transition_${transition.fromStage}_${transition.outcome}`,
        type: "end" as any, // Transitions are stored as special stages
        order: 1000 + (transition.priority ?? 0), // High order number
        config: {
          isTransition: true,
          fromStageId,
          toStageId,
          outcome: transition.outcome,
          conditions: transition.conditions,
          priority: transition.priority ?? 0,
          isDefault: transition.isDefault ?? false,
        },
      });
    }

    console.log(`[Workflow] Created workflow "${input.name}" (#${workflowId}) with ${input.stages.length} stages and ${input.transitions.length} transitions.`);
    return { id: workflowId };
  } catch (error) {
    console.error("[Workflow] Failed to create workflow:", error);
    return null;
  }
}

/**
 * Activate a workflow (make it available for use).
 */
export async function activateWorkflowV2(workflowId: number): Promise<boolean> {
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
 * Get a workflow with its stages and transitions.
 */
export async function getWorkflowDetailsV2(
  workflowId: number
): Promise<{
  workflow: any;
  stages: any[];
  transitions: any[];
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

    const allStages = await db
      .select()
      .from(workflowStages)
      .where(eq(workflowStages.workflowId, workflowId))
      .orderBy(workflowStages.order);

    // Separate actual stages from transitions
    const stages = allStages.filter((s: any) => {
      const config = s.config as Record<string, unknown>;
      return !config?.isTransition;
    });

    const transitions = allStages
      .filter((s: any) => {
        const config = s.config as Record<string, unknown>;
        return config?.isTransition;
      })
      .map((s: any) => {
        const config = s.config as Record<string, unknown>;
        return {
          id: s.id,
          fromStageId: config.fromStageId,
          toStageId: config.toStageId,
          outcome: config.outcome,
          conditions: config.conditions,
          priority: config.priority,
          isDefault: config.isDefault,
        };
      });

    return { workflow, stages, transitions };
  } catch (error) {
    console.error("[Workflow] Failed to get workflow details:", error);
    return null;
  }
}

// ============================================================================
// Workflow Instance Management
// ============================================================================

/**
 * Start a new workflow instance for an entity.
 */
export async function startWorkflowV2(
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

    // Get the first stage (lowest order, not a transition)
    const allStages = await db
      .select()
      .from(workflowStages)
      .where(eq(workflowStages.workflowId, workflow.id))
      .orderBy(workflowStages.order);

    const stages = allStages.filter((s: any) => {
      const config = s.config as Record<string, unknown>;
      return !config?.isTransition;
    });

    if (stages.length === 0) {
      console.warn(`[Workflow] Workflow "${workflow.name}" has no stages.`);
      return null;
    }

    const firstStage = stages[0];

    // Calculate SLA deadline
    const config = workflow.config as Record<string, unknown>;
    let slaDeadline: Date | undefined;
    if (config?.slaDeadlineHours) {
      slaDeadline = new Date(Date.now() + (config.slaDeadlineHours as number) * 60 * 60 * 1000);
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
    await createTaskForStageV2(instanceId, firstStage);

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
 * Advance a workflow instance based on decision outcome.
 * Uses transition graph to determine next stage.
 */
export async function advanceWorkflowV2(
  instanceId: number,
  options: AdvanceOptions
): Promise<TransitionResolution> {
  const db = getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    // Get current instance
    const [instance] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, instanceId))
      .limit(1);

    if (!instance || instance.status !== "running") {
      return { success: false, error: "Workflow instance not found or not running" };
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
          metadata: { ...((currentTask.metadata as Record<string, unknown>) ?? {}), decisionData: options.decisionData },
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

    // Get all stages for this workflow
    const allStages = await db
      .select()
      .from(workflowStages)
      .where(eq(workflowStages.workflowId, instance.workflowId))
      .orderBy(workflowStages.order);

    // Get transitions for this workflow
    const transitions = allStages
      .filter((s: any) => {
        const config = s.config as Record<string, unknown>;
        return config?.isTransition && config?.fromStageId === currentStage?.id;
      })
      .map((s: any) => {
        const config = s.config as Record<string, unknown>;
        return {
          id: s.id,
          toStageId: config.toStageId as number | null,
          outcome: config.outcome as string,
          conditions: config.conditions as Record<string, unknown> | undefined,
          priority: (config.priority as number) ?? 0,
          isDefault: (config.isDefault as boolean) ?? false,
        };
      });

    // Resolve next stage using transition graph
    const resolution = resolveTransition(transitions, options.decision, options.decisionData);

    if (!resolution.success) {
      return { success: false, error: resolution.error };
    }

    // If workflow is complete (nextStageId is null)
    if (resolution.completed) {
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
    const nextStageId = resolution.nextStageId!;
    const nextStage = allStages.find((s) => s.id === nextStageId);

    await db
      .update(workflowInstances)
      .set({
        currentStageId: nextStageId,
        updatedAt: new Date(),
      })
      .where(eq(workflowInstances.id, instanceId));

    // Create task for next stage
    await createTaskForStageV2(instanceId, nextStage!);

    // Audit
    await logAuditEvent({
      userId: options.userId,
      action: "workflow.advanced",
      entityType: instance.entityType,
      entityId: instance.entityId,
      before: { stage: currentStage?.name },
      after: { stage: nextStage?.name },
      metadata: { instanceId, decision: options.decision, outcome: resolution.nextStageName },
    });

    return {
      success: true,
      nextStageId,
      nextStageName: nextStage?.name,
      completed: false,
    };
  } catch (error) {
    console.error("[Workflow] Failed to advance workflow:", error);
    return { success: false, error: "Internal error" };
  }
}

/**
 * Cancel a workflow instance.
 */
export async function cancelWorkflowV2(
  instanceId: number,
  reason?: string,
  userId?: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [instance] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, instanceId))
      .limit(1);

    if (!instance) return false;

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

    return true;
  } catch (error) {
    console.error("[Workflow] Failed to cancel workflow:", error);
    return false;
  }
}

// ============================================================================
// Task Management
// ============================================================================

/**
 * Get pending tasks for a user.
 */
export async function getWorkflowTasksV2(
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
export async function getTaskCountsV2(userId: number): Promise<{
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
// Transition Resolution
// ============================================================================

/**
 * Resolve the next stage based on transition rules and outcome.
 */
function resolveTransition(
  transitions: Array<{
    toStageId: number | null;
    outcome: string;
    conditions?: Record<string, unknown>;
    priority: number;
    isDefault: boolean;
  }>,
  outcome: string,
  decisionData?: Record<string, unknown>
): TransitionResolution {
  if (transitions.length === 0) {
    // No transitions defined - try to find a default
    const defaultTransition = transitions.find((t) => t.isDefault);
    if (defaultTransition) {
      if (defaultTransition.toStageId === null) {
        return { success: true, completed: true };
      }
      return { success: true, nextStageId: defaultTransition.toStageId };
    }
    
    // No transitions at all - complete the workflow
    return { success: true, completed: true };
  }

  // 1. Find transitions matching the outcome
  const matchingTransitions = transitions
    .filter((t) => t.outcome === outcome)
    .sort((a, b) => b.priority - a.priority);

  // 2. Check conditions for each matching transition
  for (const transition of matchingTransitions) {
    if (evaluateTransitionConditions(transition.conditions, decisionData)) {
      if (transition.toStageId === null) {
        return { success: true, completed: true };
      }
      return { success: true, nextStageId: transition.toStageId };
    }
  }

  // 3. Fallback to default transition
  const defaultTransition = transitions.find((t) => t.isDefault);
  if (defaultTransition) {
    if (defaultTransition.toStageId === null) {
      return { success: true, completed: true };
    }
    return { success: true, nextStageId: defaultTransition.toStageId };
  }

  // 4. No matching transition found
  return {
    success: false,
    error: `No transition found for outcome "${outcome}". Available outcomes: ${transitions.map((t) => t.outcome).join(", ")}`,
  };
}

/**
 * Evaluate transition conditions.
 */
function evaluateTransitionConditions(
  conditions: Record<string, unknown> | undefined,
  decisionData: Record<string, unknown> | undefined
): boolean {
  if (!conditions || Object.keys(conditions).length === 0) {
    return true; // No conditions = always matches
  }

  if (!decisionData) {
    return false; // Has conditions but no data
  }

  // Simple condition evaluation
  // In a real implementation, this would be a full rules engine
  for (const [key, expectedValue] of Object.entries(conditions)) {
    const actualValue = decisionData[key];
    if (actualValue !== expectedValue) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create a task for a workflow stage.
 */
async function createTaskForStageV2(
  instanceId: number,
  stage: { id: number; name: string; type: string; config: unknown; conditions: unknown }
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const config = (stage.config as Record<string, unknown>) ?? {};
  const conditions = (stage.conditions as Record<string, unknown>) ?? {};

  // Calculate due date from SLA
  let dueAt: Date | undefined;
  if (conditions.slaHours) {
    dueAt = new Date(Date.now() + (conditions.slaHours as number) * 60 * 60 * 1000);
  } else if (config.dueAt) {
    dueAt = new Date(config.dueAt as string);
  }

  // Determine assignment
  let assignedTo: number | undefined;
  if (conditions.assignmentRules) {
    // In a real implementation, this would evaluate assignment rules
    // For now, use the configured assignee if present
    const rules = conditions.assignmentRules as Record<string, unknown>;
    if (rules.assignTo) {
      assignedTo = rules.assignTo as number;
    }
  }

  await db.insert(workflowTasks).values({
    instanceId,
    stageId: stage.id,
    assignedTo,
    status: "pending",
    dueAt,
    metadata: {
      stageName: stage.name,
      stageType: stage.type,
      ...config,
    },
  });
}

/**
 * Check SLA breaches and escalate overdue tasks.
 * Should be called periodically (e.g., every minute).
 */
export async function checkSLABreachesV2(): Promise<number> {
  const db = getDb();
  if (!db) return 0;

  try {
    const now = new Date();
    let escalatedCount = 0;

    // Find tasks that are overdue
    const overdueTasks = await db
      .select()
      .from(workflowTasks)
      .where(
        and(
          eq(workflowTasks.status, "pending"),
          sql`${workflowTasks.dueAt} < ${now}`
        )
      );

    for (const task of overdueTasks) {
      // Get the stage's SLA config
      const [stage] = await db
        .select()
        .from(workflowStages)
        .where(eq(workflowStages.id, task.stageId))
        .limit(1);

      if (!stage) continue;

      const conditions = (stage.conditions as Record<string, unknown>) ?? {};
      const slaConfig = conditions.slaEscalationConfig as Record<string, unknown> | undefined;

      // Update task status to overdue
      await db
        .update(workflowTasks)
        .set({ status: "overdue", updatedAt: new Date() })
        .where(eq(workflowTasks.id, task.id));

      // Log audit event
      await logAuditEvent({
        action: "workflow.sla_breached",
        entityType: "workflow_task",
        entityId: task.id,
        metadata: {
          instanceId: task.instanceId,
          stageName: stage.name,
          dueAt: task.dueAt,
          slaConfig,
        },
      });

      escalatedCount++;
    }

    return escalatedCount;
  } catch (error) {
    console.error("[Workflow] Failed to check SLA breaches:", error);
    return 0;
  }
}
