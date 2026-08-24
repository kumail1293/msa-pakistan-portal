/**
 * NEF/NRF Workflow Service (Phase 19)
 *
 * Makes NEF/NRF work end-to-end WITHOUT Google Sheets:
 *
 *   Activity Submit → VPA Review → VPF Review → President Approval →
 *   Budget Allocation → Execution Tracking → Report → Closure
 *
 * NRF follows the same pattern with additional financial review.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { logAuditEvent } from "./auditService";
import { getConfig, getConfigNumber } from "./configService";
import { getCurrentGovernanceVersion } from "./termService";
import {
  startWorkflow,
  advanceWorkflow,
  getWorkflowTasks,
} from "./workflowEngine";

// ============================================================================
// Types
// ============================================================================

export interface NEFSubmissionInput {
  title: string;
  description: string;
  type: "nef" | "nrf";
  category?: string;
  startDate?: Date;
  endDate?: Date;
  venue?: string;
  city?: string;
  mode?: "in_person" | "online" | "hybrid";
  budget?: number;
  maxParticipants?: number;
  organizedBy?: number;
  createdBy?: number;
}

export interface NEFApprovalResult {
  success: boolean;
  activityId?: number;
  workflowInstanceId?: number;
  error?: string;
}

// ============================================================================
// 1. ACTIVITY SUBMISSION
// ============================================================================

/**
 * Submit a new NEF/NRF activity.
 * Creates the activity record and starts the workflow.
 */
export async function submitNEFActivity(
  input: NEFSubmissionInput
): Promise<NEFApprovalResult> {
  // ── VALIDATE (before DB check) ────────────────────────────────
  const errors: string[] = [];
  if (!input.title || input.title.length < 3) errors.push("Title must be at least 3 characters");
  if (!input.description || input.description.length < 10) errors.push("Description must be at least 10 characters");
  if (input.budget && input.budget < 0) errors.push("Budget cannot be negative");

  if (errors.length > 0) {
    return { success: false, error: errors.join("; ") };
  }

  // ── CHECK FINANCIAL THRESHOLDS ────────────────────────────────
  if (input.budget) {
    const vpfLimit = await getConfigNumber("finance.vpfThreshold", 5000);
    const presidentLimit = await getConfigNumber("finance.presidentThreshold", 15000);

    if (input.budget > presidentLimit) {
      return {
        success: false,
        error: `Budget PKR ${input.budget} exceeds president limit (PKR ${presidentLimit}). Requires EB 2/3 majority.`,
      };
    }
  }

  const db = getDb();
  if (!db) return { success: false, error: "Database not available" };

  // ── STORE ACTIVITY (using activitiesEngine pattern) ───────────
  // For now, store in a JSON metadata field on the workflow instance
  const metadata = {
    title: input.title,
    description: input.description,
    type: input.type,
    category: input.category,
    budget: input.budget,
    venue: input.venue,
    city: input.city,
    mode: input.mode,
    maxParticipants: input.maxParticipants,
    startDate: input.startDate?.toISOString(),
    endDate: input.endDate?.toISOString(),
    organizedBy: input.organizedBy,
  };

  // ── START WORKFLOW ────────────────────────────────────────────
  const workflowName = input.type === "nef" ? "nef_nrf_approval" : "nef_nrf_approval";
  const workflowResult = await startWorkflow(
    workflowName,
    input.type,
    0, // entityId — will be set after we have a real table
    input.createdBy,
    metadata
  );

  const activityId = workflowResult?.instanceId ?? 0;

  // ── AUDIT ─────────────────────────────────────────────────────
  await logAuditEvent({
    userId: input.createdBy,
    action: `${input.type}.activity_submitted`,
    entityType: input.type,
    entityId: activityId,
    after: {
      title: input.title,
      budget: input.budget,
      venue: input.venue,
      governanceVersion: await getCurrentGovernanceVersion(),
    },
  });

  console.log(`[NEF] Activity "${input.title}" submitted (#${activityId})`);

  return {
    success: true,
    activityId,
    workflowInstanceId: workflowResult?.instanceId,
  };
}

// ============================================================================
// 2. VPA REVIEW
// ============================================================================

export async function reviewNEFatVPA(
  activityId: number,
  reviewedBy: number,
  decision: "approve" | "reject" | "needs_revision",
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  return advanceNEFWorkflow(activityId, reviewedBy, decision, notes, "vpa_review");
}

// ============================================================================
// 3. VPF REVIEW (Financial)
// ============================================================================

export async function reviewNEFatVPF(
  activityId: number,
  reviewedBy: number,
  decision: "approve" | "reject" | "needs_revision",
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  return advanceNEFWorkflow(activityId, reviewedBy, decision, notes, "vpf_review");
}

// ============================================================================
// 4. PRESIDENT APPROVAL
// ============================================================================

export async function approveNEFByPresident(
  activityId: number,
  approvedBy: number,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  return advanceNEFWorkflow(activityId, approvedBy, "approve", notes, "president_approval");
}

// ============================================================================
// 5. COMPLETE / CANCEL
// ============================================================================

export async function completeNEFActivity(
  activityId: number,
  completedBy: number,
  reportUrl?: string
): Promise<{ success: boolean; error?: string }> {
  return advanceNEFWorkflow(activityId, completedBy, "approve", reportUrl ? `Report: ${reportUrl}` : "Activity completed", "execution");
}

export async function cancelNEFActivity(
  activityId: number,
  cancelledBy: number,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  return advanceNEFWorkflow(activityId, cancelledBy, "reject", reason, "cancellation");
}

// ============================================================================
// HELPERS
// ============================================================================

async function advanceNEFWorkflow(
  activityId: number,
  userId: number,
  decision: "approve" | "reject" | "needs_revision",
  notes: string | undefined,
  expectedStage: string
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { success: false, error: "Database not available" };

  // Find the workflow instance
  const [instance] = await db
    .select()
    .from((await import("../../drizzle/schema.enterprise")).workflowInstances)
    .where(
      and(
        eq((await import("../../drizzle/schema.enterprise")).workflowInstances.entityType, "nef_nrf"),
        eq((await import("../../drizzle/schema.enterprise")).workflowInstances.entityId, activityId)
      )
    )
    .orderBy(desc((await import("../../drizzle/schema.enterprise")).workflowInstances.createdAt))
    .limit(1);

  if (!instance) return { success: false, error: "No workflow instance found" };

  // Advance the workflow
  const result = await advanceWorkflow(instance.id, {
    decision: decision === "approve" ? "approve" : "reject",
    notes,
    userId,
    metadata: { stage: expectedStage },
  });

  if (!result.success) return { success: false, error: result.error };

  // Audit
  await logAuditEvent({
    userId,
    action: `nef.workflow.${decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "revision_requested"}`,
    entityType: "nef_nrf",
    entityId: activityId,
    after: { stage: expectedStage, decision, notes },
  });

  return { success: true };
}

/**
 * Get pending NEF/NRF tasks for a user.
 */
export async function getNEFTasks(userId: number) {
  return getWorkflowTasks(userId);
}

/**
 * Get NEF/NRF statistics.
 */
export async function getNEFStats(): Promise<{
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  totalBudget: number;
}> {
  const db = getDb();
  if (!db) return { total: 0, pending: 0, approved: 0, rejected: 0, totalBudget: 0 };

  const workflowInstancesTable = (await import("../../drizzle/schema.enterprise")).workflowInstances;

  const [total] = await db
    .select({ count: sql<number>`count(*)` })
    .from(workflowInstancesTable)
    .where(eq(workflowInstancesTable.entityType, "nef_nrf"));

  const [pending] = await db
    .select({ count: sql<number>`count(*)` })
    .from(workflowInstancesTable)
    .where(
      and(
        eq(workflowInstancesTable.entityType, "nef_nrf"),
        eq(workflowInstancesTable.status, "running")
      )
    );

  const [completed] = await db
    .select({ count: sql<number>`count(*)` })
    .from(workflowInstancesTable)
    .where(
      and(
        eq(workflowInstancesTable.entityType, "nef_nrf"),
        eq(workflowInstancesTable.status, "completed")
      )
    );

  const [rejected] = await db
    .select({ count: sql<number>`count(*)` })
    .from(workflowInstancesTable)
    .where(
      and(
        eq(workflowInstancesTable.entityType, "nef_nrf"),
        eq(workflowInstancesTable.status, "rejected")
      )
    );

  return {
    total: total?.count ?? 0,
    pending: pending?.count ?? 0,
    approved: completed?.count ?? 0,
    rejected: rejected?.count ?? 0,
    totalBudget: 0, // Would be calculated from financial records
  };
}
