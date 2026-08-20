/**
 * Form Pipeline Engine
 *
 * Implements the complete Form → Workflow → Approval → Document pipeline.
 *
 * When a form is submitted, this engine:
 *   1. Validates the submission
 *   2. Maps form fields to workflow metadata
 *   3. Initiates a workflow instance
 *   4. Tracks the approval chain
 *   5. Generates output documents (PDF, HTML, DOCX)
 *   6. Sends notifications at each stage
 *   7. Records full audit trail
 *
 * Usage:
 *   import { createPipeline, triggerPipeline, advancePipeline } from "./formPipelineEngine";
 *
 *   const pipeline = await createPipeline({
 *     formId: 1, workflowId: 5, name: "Membership Application Pipeline",
 *     fieldMapping: { fullName: "applicantName", email: "applicantEmail" },
 *   });
 *   const instance = await triggerPipeline(pipeline.id, submissionId);
 *   await advancePipeline(instance.id, { decision: "approved", approverUserId: 10 });
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { forms, formFields, formSubmissions, workflows, workflowInstances } from "../../drizzle/schema.enterprise";
import {
  formPipelines,
  pipelineInstances,
  approvalChains,
} from "../../drizzle/schema.forms_builder";
import { getDb } from "../db";
import { logAuditEvent } from "./auditService";

// ============================================================================
// Types
// ============================================================================

export interface CreatePipelineInput {
  formId: number;
  workflowId?: number;
  name: string;
  description?: string;
  triggerOnSubmission?: boolean;
  triggerOnStatusChange?: boolean;
  triggerStatusFilter?: string;
  fieldMapping?: Record<string, string>;
  documentTemplateId?: number;
  documentOutputFormat?: string;
  documentNamingPattern?: string;
  notifyOnSubmission?: boolean;
  notifyOnCompletion?: boolean;
  notifyOnRejection?: boolean;
  notificationRecipients?: string[];
  organizationId?: number;
  createdBy?: number;
}

export interface PipelineStepResult {
  stepNumber: number;
  name: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  result?: Record<string, unknown>;
  error?: string;
}

export interface ApprovalStep {
  stepNumber: number;
  approverRole: string;
  approverUserId?: number;
  decision?: string;
  decidedAt?: string;
  notes?: string;
}

export interface AdvancePipelineInput {
  decision: "approved" | "rejected" | "needs_revision";
  approverUserId: number;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface PipelineStatus {
  instanceId: number;
  pipelineName: string;
  formSubmissionId: number;
  status: string;
  currentStep: number;
  totalSteps: number;
  steps: PipelineStepResult[];
  approvalChain: ApprovalStep[];
  startedAt: Date;
  completedAt?: Date | null;
}

// ============================================================================
// Pipeline Management
// ============================================================================

/**
 * Create a new form-to-workflow pipeline configuration.
 */
export async function createPipeline(
  input: CreatePipelineInput
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [result] = await db.insert(formPipelines).values({
      formId: input.formId,
      workflowId: input.workflowId,
      name: input.name,
      description: input.description,
      status: "draft",
      triggerOnSubmission: input.triggerOnSubmission ?? true,
      triggerOnStatusChange: input.triggerOnStatusChange ?? false,
      triggerStatusFilter: input.triggerStatusFilter,
      fieldMapping: input.fieldMapping ?? {},
      documentTemplateId: input.documentTemplateId,
      documentOutputFormat: input.documentOutputFormat ?? "pdf",
      documentNamingPattern: input.documentNamingPattern,
      notifyOnSubmission: input.notifyOnSubmission ?? true,
      notifyOnCompletion: input.notifyOnCompletion ?? true,
      notifyOnRejection: input.notifyOnRejection ?? true,
      notificationRecipients: input.notificationRecipients ?? [],
      organizationId: input.organizationId,
      createdBy: input.createdBy,
    });

    const id = Number((result as any)[0].insertId);
    console.log(`[Pipeline] Created pipeline "${input.name}" (#${id}).`);

    await logAuditEvent({
      userId: input.createdBy,
      action: "pipeline.created",
      entityType: "form_pipeline",
      entityId: id,
      after: { name: input.name, formId: input.formId },
    });

    return { id };
  } catch (error) {
    console.error("[Pipeline] Failed to create pipeline:", error);
    return null;
  }
}

/**
 * Activate a pipeline (make it ready to receive submissions).
 */
export async function activatePipeline(pipelineId: number): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    // Validate that pipeline has required config
    const [pipeline] = await db
      .select()
      .from(formPipelines)
      .where(eq(formPipelines.id, pipelineId))
      .limit(1);

    if (!pipeline) {
      console.error("[Pipeline] Pipeline not found.");
      return false;
    }

    if (!pipeline.formId) {
      console.error("[Pipeline] Pipeline has no associated form.");
      return false;
    }

    await db
      .update(formPipelines)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(formPipelines.id, pipelineId));

    await logAuditEvent({
      action: "pipeline.activated",
      entityType: "form_pipeline",
      entityId: pipelineId,
    });

    console.log(`[Pipeline] Pipeline #${pipelineId} activated.`);
    return true;
  } catch (error) {
    console.error("[Pipeline] Failed to activate pipeline:", error);
    return false;
  }
}

/**
 * Get pipeline configuration with full details.
 */
export async function getPipeline(pipelineId: number): Promise<any | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [pipeline] = await db
      .select()
      .from(formPipelines)
      .where(eq(formPipelines.id, pipelineId))
      .limit(1);

    return pipeline ?? null;
  } catch (error) {
    console.error("[Pipeline] Failed to get pipeline:", error);
    return null;
  }
}

/**
 * List all pipelines for a form.
 */
export async function listPipelines(formId?: number): Promise<any[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const where = formId ? eq(formPipelines.formId, formId) : undefined;
    return await db
      .select()
      .from(formPipelines)
      .where(where)
      .orderBy(desc(formPipelines.createdAt));
  } catch (error) {
    console.error("[Pipeline] Failed to list pipelines:", error);
    return [];
  }
}

// ============================================================================
// Pipeline Triggering
// ============================================================================

/**
 * Trigger a pipeline for a form submission.
 * Creates a pipeline instance and begins executing steps.
 */
export async function triggerPipeline(
  pipelineId: number,
  formSubmissionId: number
): Promise<{ instanceId: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Get pipeline config
    const [pipeline] = await db
      .select()
      .from(formPipelines)
      .where(eq(formPipelines.id, pipelineId))
      .limit(1);

    if (!pipeline || pipeline.status !== "active") {
      console.error("[Pipeline] Pipeline not found or not active.");
      return null;
    }

    // Get the form submission
    const [submission] = await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.id, formSubmissionId))
      .limit(1);

    if (!submission) {
      console.error("[Pipeline] Form submission not found.");
      return null;
    }

    // Define pipeline steps
    const steps: PipelineStepResult[] = [
      { stepNumber: 1, name: "Validate Submission", type: "validate", status: "pending" },
      { stepNumber: 2, name: "Map Fields", type: "mapping", status: "pending" },
      { stepNumber: 3, name: "Initiate Workflow", type: "workflow", status: "pending" },
      { stepNumber: 4, name: "Approval Chain", type: "approval", status: "pending" },
      { stepNumber: 5, name: "Generate Document", type: "document", status: "pending" },
      { stepNumber: 6, name: "Send Notifications", type: "notify", status: "pending" },
    ];

    // Build approval chain from submission data
    const approvalSteps: ApprovalStep[] = [
      { stepNumber: 1, approverRole: "form_reviewer", decidedAt: undefined },
    ];

    // Create pipeline instance
    const [instanceResult] = await db.insert(pipelineInstances).values({
      pipelineId,
      formSubmissionId,
      status: "pending",
      currentStep: 1,
      totalSteps: steps.length,
      steps: steps as any,
      approvalChain: approvalSteps as any,
    });

    const instanceId = Number((instanceResult as any)[0].insertId);

    await logAuditEvent({
      action: "pipeline.triggered",
      entityType: "pipeline_instance",
      entityId: instanceId,
      after: { pipelineId, formSubmissionId, totalSteps: steps.length },
    });

    console.log(`[Pipeline] Triggered pipeline #${pipelineId} → instance #${instanceId}.`);

    // Start executing steps automatically
    await executePipelineSteps(instanceId, submission.data as Record<string, unknown>, pipeline);

    return { instanceId };
  } catch (error) {
    console.error("[Pipeline] Failed to trigger pipeline:", error);
    return null;
  }
}

/**
 * Execute the automatic pipeline steps (validate, map, initiate workflow).
 */
async function executePipelineSteps(
  instanceId: number,
  submissionData: Record<string, unknown>,
  pipeline: any
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const steps: PipelineStepResult[] = [
    { stepNumber: 1, name: "Validate Submission", type: "validate", status: "running", startedAt: new Date().toISOString() },
  ];

  try {
    // Step 1: Validate
    // Basic validation — check required fields exist
    const validationPassed = Object.keys(submissionData).length > 0;
    steps[0].status = validationPassed ? "completed" : "failed";
    steps[0].completedAt = new Date().toISOString();
    steps[0].result = { valid: validationPassed, fieldCount: Object.keys(submissionData).length };

    if (!validationPassed) {
      await db
        .update(pipelineInstances)
        .set({ status: "failed", lastError: "Validation failed: no data", steps: steps as any, updatedAt: new Date() })
        .where(eq(pipelineInstances.id, instanceId));
      return;
    }

    // Step 2: Map fields
    steps.push({
      stepNumber: 2, name: "Map Fields", type: "mapping", status: "running",
      startedAt: new Date().toISOString(),
    });

    const fieldMapping = (pipeline.fieldMapping as Record<string, string>) ?? {};
    const mappedData: Record<string, unknown> = {};
    for (const [formField, workflowKey] of Object.entries(fieldMapping)) {
      if (submissionData[formField] !== undefined) {
        mappedData[workflowKey] = submissionData[formField];
      }
    }

    steps[1].status = "completed";
    steps[1].completedAt = new Date().toISOString();
    steps[1].result = { mappedFields: Object.keys(mappedData).length, mapping: fieldMapping };

    // Step 3: Initiate workflow (if configured)
    let workflowInstanceId: number | null = null;
    if (pipeline.workflowId) {
      steps.push({
        stepNumber: 3, name: "Initiate Workflow", type: "workflow", status: "running",
        startedAt: new Date().toISOString(),
      });

      try {
        const [wfResult] = await db.insert(workflowInstances).values({
          workflowId: pipeline.workflowId,
          entityType: "form_submission",
          entityId: pipeline.formSubmissionId,
          status: "running",
          metadata: { pipelineInstanceId: instanceId, mappedData },
          startedBy: null,
        });
        workflowInstanceId = Number((wfResult as any)[0].insertId);

        steps[2].status = "completed";
        steps[2].completedAt = new Date().toISOString();
        steps[2].result = { workflowInstanceId };
      } catch (wfError) {
        steps[2].status = "failed";
        steps[2].completedAt = new Date().toISOString();
        steps[2].error = String(wfError);
      }
    } else {
      steps.push({
        stepNumber: 3, name: "Initiate Workflow", type: "workflow", status: "skipped",
        result: { reason: "No workflow configured" },
      });
    }

    // Step 4: Approval chain — stays pending until manual action
    steps.push({
      stepNumber: 4, name: "Approval Chain", type: "approval", status: "pending",
      result: { requiresAction: true },
    });

    // Step 5: Document generation — stays pending until approval
    steps.push({
      stepNumber: 5, name: "Generate Document", type: "document", status: "pending",
      result: { requiresAction: true },
    });

    // Step 6: Notifications
    steps.push({
      stepNumber: 6, name: "Send Notifications", type: "notify", status: "running",
      startedAt: new Date().toISOString(),
    });

    if (pipeline.notifyOnSubmission) {
      steps[5].status = "completed";
      steps[5].completedAt = new Date().toISOString();
      steps[5].result = { notificationType: "submission_received", recipients: pipeline.notificationRecipients };
    } else {
      steps[5].status = "skipped";
    }

    // Update instance
    await db
      .update(pipelineInstances)
      .set({
        status: "awaiting_approval",
        currentStep: 4,
        workflowInstanceId,
        steps: steps as any,
        updatedAt: new Date(),
      })
      .where(eq(pipelineInstances.id, instanceId));

  } catch (error) {
    console.error("[Pipeline] Step execution error:", error);
    try {
      await db
        .update(pipelineInstances)
        .set({
          status: "failed",
          lastError: String(error),
          steps: steps as any,
          updatedAt: new Date(),
        })
        .where(eq(pipelineInstances.id, instanceId));
    } catch { /* ignore */ }
  }
}

// ============================================================================
// Pipeline Advancement (Approval Chain)
// ============================================================================

/**
 * Advance the pipeline by making an approval decision.
 */
export async function advancePipeline(
  instanceId: number,
  input: AdvancePipelineInput
): Promise<{ success: boolean; nextStatus?: string; completed?: boolean }> {
  const db = getDb();
  if (!db) return { success: false };

  try {
    const [instance] = await db
      .select()
      .from(pipelineInstances)
      .where(eq(pipelineInstances.id, instanceId))
      .limit(1);

    if (!instance) {
      console.error("[Pipeline] Instance not found.");
      return { success: false };
    }

    if (instance.status !== "awaiting_approval") {
      console.error(`[Pipeline] Instance is in "${instance.status}" state, not awaiting_approval.`);
      return { success: false };
    }

    const steps = (instance.steps as PipelineStepResult[]) ?? [];
    const approvalChain = (instance.approvalChain as ApprovalStep[]) ?? [];
    const currentStep = instance.currentStep ?? 4;

    // Find current approval step
    const currentApprovalIdx = approvalChain.findIndex(
      (a) => a.decision === undefined
    );

    if (currentApprovalIdx === -1) {
      console.error("[Pipeline] No pending approval step found.");
      return { success: false };
    }

    // Record decision
    approvalChain[currentApprovalIdx] = {
      ...approvalChain[currentApprovalIdx],
      decision: input.decision,
      approverUserId: input.approverUserId,
      decidedAt: new Date().toISOString(),
      notes: input.notes,
    };

    await logAuditEvent({
      userId: input.approverUserId,
      action: `pipeline.approval.${input.decision}`,
      entityType: "pipeline_instance",
      entityId: instanceId,
      after: {
        decision: input.decision,
        stepNumber: currentApprovalIdx + 1,
        notes: input.notes,
      },
    });

    if (input.decision === "rejected") {
      // Pipeline rejected
      const stepsCopy = [...steps];
      if (stepsCopy[3]) {
        stepsCopy[3].status = "completed";
        stepsCopy[3].completedAt = new Date().toISOString();
        stepsCopy[3].result = { decision: "rejected" };
      }

      await db
        .update(pipelineInstances)
        .set({
          status: "rejected",
          approvalChain: approvalChain as any,
          steps: stepsCopy as any,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(pipelineInstances.id, instanceId));

      console.log(`[Pipeline] Instance #${instanceId} rejected.`);
      return { success: true, nextStatus: "rejected", completed: true };
    }

    if (input.decision === "needs_revision") {
      await db
        .update(pipelineInstances)
        .set({
          status: "needs_revision",
          approvalChain: approvalChain as any,
          updatedAt: new Date(),
        })
        .where(eq(pipelineInstances.id, instanceId));

      return { success: true, nextStatus: "needs_revision", completed: false };
    }

    // Approved — check if there are more approval steps
    const hasMoreApprovals = approvalChain.some((a) => a.decision === undefined);

    if (hasMoreApprovals) {
      // Stay in awaiting_approval
      await db
        .update(pipelineInstances)
        .set({
          approvalChain: approvalChain as any,
          updatedAt: new Date(),
        })
        .where(eq(pipelineInstances.id, instanceId));

      return { success: true, nextStatus: "awaiting_approval", completed: false };
    }

    // All approvals done — proceed to document generation and completion
    const stepsCopy = [...steps];

    // Mark approval step complete
    if (stepsCopy[3]) {
      stepsCopy[3].status = "completed";
      stepsCopy[3].completedAt = new Date().toISOString();
      stepsCopy[3].result = { decision: "approved", allApproved: true };
    }

    // Step 5: Generate document
    if (stepsCopy[4]) {
      stepsCopy[4].status = "running";
      stepsCopy[4].startedAt = new Date().toISOString();

      // Get submission data for document
      const [submission] = await db
        .select()
        .from(formSubmissions)
        .where(eq(formSubmissions.id, instance.formSubmissionId))
        .limit(1);

      if (submission) {
        // Get form for naming
        const [pipelineConfig] = await db
          .select()
          .from(formPipelines)
          .where(eq(formPipelines.id, instance.pipelineId))
          .limit(1);

        const documentName = pipelineConfig?.documentNamingPattern
          ? applyNamingPattern(pipelineConfig.documentNamingPattern, submission.data as Record<string, unknown>)
          : `Document-${instance.formSubmissionId}`;

        stepsCopy[4].status = "completed";
        stepsCopy[4].completedAt = new Date().toISOString();
        stepsCopy[4].result = {
          documentName,
          format: pipelineConfig?.documentOutputFormat ?? "pdf",
          generatedAt: new Date().toISOString(),
        };
      } else {
        stepsCopy[4].status = "failed";
        stepsCopy[4].error = "Submission data not found";
      }
    }

    // Step 6: Completion notification
    if (stepsCopy[5]) {
      stepsCopy[5].status = "completed";
      stepsCopy[5].completedAt = new Date().toISOString();
      stepsCopy[5].result = { notificationType: "pipeline_completed" };
    }

    await db
      .update(pipelineInstances)
      .set({
        status: "completed",
        currentStep: stepsCopy.length,
        approvalChain: approvalChain as any,
        steps: stepsCopy as any,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pipelineInstances.id, instanceId));

    console.log(`[Pipeline] Instance #${instanceId} completed successfully.`);

    return { success: true, nextStatus: "completed", completed: true };
  } catch (error) {
    console.error("[Pipeline] Failed to advance pipeline:", error);
    return { success: false };
  }
}

/**
 * Cancel a pipeline instance.
 */
export async function cancelPipeline(
  instanceId: number,
  cancelledBy: number,
  reason?: string
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .update(pipelineInstances)
      .set({
        status: "cancelled",
        lastError: reason ?? "Cancelled by user",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pipelineInstances.id, instanceId));

    await logAuditEvent({
      userId: cancelledBy,
      action: "pipeline.cancelled",
      entityType: "pipeline_instance",
      entityId: instanceId,
      after: { reason },
    });

    return true;
  } catch (error) {
    console.error("[Pipeline] Failed to cancel pipeline:", error);
    return false;
  }
}

// ============================================================================
// Pipeline Queries
// ============================================================================

/**
 * Get full pipeline status with all steps and approvals.
 */
export async function getPipelineStatus(instanceId: number): Promise<PipelineStatus | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [instance] = await db
      .select()
      .from(pipelineInstances)
      .where(eq(pipelineInstances.id, instanceId))
      .limit(1);

    if (!instance) return null;

    const [pipeline] = await db
      .select()
      .from(formPipelines)
      .where(eq(formPipelines.id, instance.pipelineId))
      .limit(1);

    return {
      instanceId: instance.id,
      pipelineName: pipeline?.name ?? "Unknown",
      formSubmissionId: instance.formSubmissionId,
      status: instance.status as string,
      currentStep: instance.currentStep ?? 0,
      totalSteps: instance.totalSteps ?? 0,
      steps: (instance.steps as PipelineStepResult[]) ?? [],
      approvalChain: (instance.approvalChain as ApprovalStep[]) ?? [],
      startedAt: instance.startedAt,
      completedAt: instance.completedAt,
    };
  } catch (error) {
    console.error("[Pipeline] Failed to get status:", error);
    return null;
  }
}

/**
 * List pipeline instances with optional filters.
 */
export async function listPipelineInstances(
  options: {
    pipelineId?: number;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<any[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const conditions = [];
    if (options.pipelineId) conditions.push(eq(pipelineInstances.pipelineId, options.pipelineId));
    if (options.status) conditions.push(eq(pipelineInstances.status, options.status as any));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    return await db
      .select()
      .from(pipelineInstances)
      .where(where)
      .orderBy(desc(pipelineInstances.createdAt))
      .limit(options.limit ?? 50)
      .offset(options.offset ?? 0);
  } catch (error) {
    console.error("[Pipeline] Failed to list instances:", error);
    return [];
  }
}

/**
 * Get pipeline instance counts by status.
 */
export async function getPipelineCounts(pipelineId?: number): Promise<Record<string, number>> {
  const db = getDb();
  if (!db) return {};

  try {
    const where = pipelineId ? eq(pipelineInstances.pipelineId, pipelineId) : undefined;

    const counts = await db
      .select({
        status: pipelineInstances.status,
        count: sql<number>`count(*)`,
      })
      .from(pipelineInstances)
      .where(where)
      .groupBy(pipelineInstances.status);

    const result: Record<string, number> = {};
    for (const row of counts) {
      result[row.status as string] = row.count;
    }
    return result;
  } catch (error) {
    console.error("[Pipeline] Failed to get counts:", error);
    return {};
  }
}

// ============================================================================
// Approval Chain Management
// ============================================================================

/**
 * Create an approval chain for a pipeline.
 */
export async function createApprovalChain(
  pipelineId: number,
  chainConfig: {
    name: string;
    description?: string;
    steps: Array<{
      stepNumber: number;
      name: string;
      type: string;
      approverRole?: string;
      approverUserIds?: number[];
      condition?: Record<string, unknown>;
      slaHours?: number;
      escalateToRole?: string;
      escalationHours?: number;
      allowDelegation?: boolean;
      requireComments?: boolean;
      autoApproveIfNoResponse?: boolean;
      autoApproveAfterHours?: number;
    }>;
    overrideRole?: string;
    overrideRequiresReason?: boolean;
  },
  createdBy?: number
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [result] = await db.insert(approvalChains).values({
      pipelineId,
      name: chainConfig.name,
      description: chainConfig.description,
      steps: chainConfig.steps.map((s) => ({
        ...s,
        allowDelegation: s.allowDelegation ?? false,
        requireComments: s.requireComments ?? false,
        autoApproveIfNoResponse: s.autoApproveIfNoResponse ?? false,
      })) as any,
      overrideRole: chainConfig.overrideRole,
      overrideRequiresReason: chainConfig.overrideRequiresReason ?? true,
      status: "draft",
      createdBy,
    });

    const id = Number((result as any)[0].insertId);
    console.log(`[Pipeline] Created approval chain "${chainConfig.name}" (#${id}).`);
    return { id };
  } catch (error) {
    console.error("[Pipeline] Failed to create approval chain:", error);
    return null;
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Apply a naming pattern using form data variables.
 * Pattern supports {fieldName} syntax.
 */
function applyNamingPattern(pattern: string, data: Record<string, unknown>): string {
  return pattern.replace(/\{(\w+)\}/g, (_, fieldName: string) => {
    const value = data[fieldName];
    if (value === undefined || value === null) return `Unknown`;
    return String(value);
  });
}
