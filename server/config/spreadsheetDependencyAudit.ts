/**
 * Spreadsheet Dependency Audit
 *
 * Phase 22: Identifies all Google Sheets workflow dependencies
 * that must be replaced by the database-driven workflow engine.
 *
 * Each dependency is categorized:
 * - REPLACE: Sheet is used as workflow controller → use DB workflow engine
 * - SYNC: Sheet is used for display/export → keep as read-only view
 * - REMOVE: Sheet is redundant with database → delete dependency
 * - KEEP: Sheet is external reporting → no change needed
 */

export interface SpreadsheetDependency {
  sheetId: string;
  sheetName: string;
  entityType: string;
  usage: "workflow_controller" | "data_store" | "display_view" | "external_report";
  action: "REPLACE" | "SYNC" | "REMOVE" | "KEEP";
  replacementEngine: string;
  description: string;
  status: "identified" | "migrating" | "completed";
  columns: Array<{
    name: string;
    target: "database_field" | "workflow_state" | "document" | "config" | "derived" | "legacy" | "remove";
    field?: string;
  }>;
}

// ============================================================================
// Known Spreadsheet Dependencies
// ============================================================================

export const SPREADSHEET_DEPENDENCIES: SpreadsheetDependency[] = [
  // ── Membership Excel ────────────────────────────────────────
  {
    sheetId: "membership-master",
    sheetName: "Membership Master",
    entityType: "member",
    usage: "workflow_controller",
    action: "REPLACE",
    replacementEngine: "membershipWorkflowService",
    description:
      "Tracks membership applications through VPF/VPM/Pres approval stages. " +
      "Each row = one member. Status columns control workflow progression.",
    status: "identified",
    columns: [
      { name: "Full Name", target: "database_field", field: "members.name" },
      { name: "Email", target: "database_field", field: "users.email" },
      { name: "CNIC", target: "database_field", field: "members.cnic" },
      { name: "Institute", target: "database_field", field: "members.institution" },
      { name: "VPF_Status", target: "workflow_state", field: "membership.workflow.stage.vpf_approval" },
      { name: "VPM_Status", target: "workflow_state", field: "membership.workflow.stage.vpm_approval" },
      { name: "Pres_Status", target: "workflow_state", field: "membership.workflow.stage.president_approval" },
      { name: "Mem_ID", target: "database_field", field: "members.membershipId" },
      { name: "Cert_URL", target: "document", field: "documents.membership_certificate" },
      { name: "Card_URL", target: "document", field: "documents.membership_card" },
      { name: "LC_Notified", target: "derived", field: "notifications.membership.activated" },
      { name: "Dup_CNIC_Flag", target: "derived", field: "members.duplicateCheck" },
      { name: "Completeness_%", target: "derived", field: "members.completenessScore" },
      { name: "Fee Receipt", target: "document", field: "documents.fee_receipt" },
      { name: "CNIC Photo", target: "document", field: "documents.cnic_photo" },
    ],
  },

  // ── NEF Excel ───────────────────────────────────────────────
  {
    sheetId: "nef-tracker",
    sheetName: "NEF Activity Tracker",
    entityType: "activity",
    usage: "workflow_controller",
    action: "REPLACE",
    replacementEngine: "nefWorkflowService",
    description:
      "Tracks NEF activity lifecycle from submission to completion. " +
      "Status columns control VPA/VPF/Pres approval flow.",
    status: "identified",
    columns: [
      { name: "Activity_ID", target: "database_field", field: "activities.id" },
      { name: "Activity_Name", target: "database_field", field: "activities.name" },
      { name: "Institute", target: "database_field", field: "activities.localCouncilId" },
      { name: "Coordinator", target: "database_field", field: "activities.coordinatorId" },
      { name: "Budget", target: "database_field", field: "activities.budget" },
      { name: "VPF_Status", target: "workflow_state", field: "nef.workflow.stage.vpf_approval" },
      { name: "VPA_Status", target: "workflow_state", field: "nef.workflow.stage.vpa_approval" },
      { name: "Pres_Status", target: "workflow_state", field: "nef.workflow.stage.president_approval" },
      { name: "Stage", target: "workflow_state", field: "activities.workflowStage" },
      { name: "Stage_Since", target: "workflow_state", field: "activities.stageSince" },
      { name: "NRF_Status", target: "workflow_state", field: "nrf.workflow.status" },
      { name: "NRF_Deadline", target: "config", field: "finance.nrfDeadlineDays" },
      { name: "Drive_Folder_URL", target: "database_field", field: "activities.driveFolderUrl" },
      { name: "Certificates_Issued", target: "derived", field: "documents.activity_certificates" },
      { name: "Activity_Completed", target: "workflow_state", field: "activities.workflowStage === completed" },
      { name: "Cancelled", target: "workflow_state", field: "activities.workflowStage === cancelled" },
    ],
  },

  // ── LC Mapping Sheet ────────────────────────────────────────
  {
    sheetId: "lc-mapping",
    sheetName: "LC Mapping & Status",
    entityType: "local_council",
    usage: "data_store",
    action: "REPLACE",
    replacementEngine: "lcLifecycleEngine",
    description:
      "Maps institutions to Local Councils, tracks LC status (CI/Candidate/Temp/Permanent). " +
      "Should be replaced by local_councils table + lcLifecycleEngine.",
    status: "identified",
    columns: [
      { name: "LC_Name", target: "database_field", field: "local_councils.name" },
      { name: "Short_Code", target: "database_field", field: "local_councils.shortCode" },
      { name: "City", target: "database_field", field: "local_councils.city" },
      { name: "University", target: "database_field", field: "local_councils.university" },
      { name: "Status", target: "database_field", field: "local_councils.status" },
      { name: "President", target: "database_field", field: "local_councils.presidentId" },
      { name: "Member_Count", target: "derived", field: "COUNT(members WHERE localCouncilId = lc.id)" },
      { name: "Health_Score", target: "derived", field: "lcLifecycleEngine.getLCHealth()" },
    ],
  },

  // ── Approval Status Matrix ──────────────────────────────────
  {
    sheetId: "approval-matrix",
    sheetName: "Approval Status Matrix",
    entityType: "workflow",
    usage: "workflow_controller",
    action: "REPLACE",
    replacementEngine: "workflowEngine",
    description:
      "Master tracking sheet for all pending approvals across modules. " +
      "Should be replaced by workflow_instances + workflow_tasks tables.",
    status: "identified",
    columns: [
      { name: "Request_Type", target: "workflow_state", field: "workflow_instances.entityType" },
      { name: "Request_ID", target: "database_field", field: "workflow_instances.entityId" },
      { name: "Current_Stage", target: "workflow_state", field: "workflow_tasks.status" },
      { name: "Assigned_To", target: "database_field", field: "workflow_tasks.assignedTo" },
      { name: "Due_Date", target: "database_field", field: "workflow_tasks.dueAt" },
      { name: "Status", target: "workflow_state", field: "workflow_instances.status" },
    ],
  },

  // ── Events Calendar ─────────────────────────────────────────
  {
    sheetId: "events-calendar",
    sheetName: "Events Calendar",
    entityType: "event",
    usage: "display_view",
    action: "SYNC",
    replacementEngine: "events table (read-only sync)",
    description:
      "Shared calendar view of upcoming events. " +
      "Keep as a read-only Google Sheets view synced from the database.",
    status: "identified",
    columns: [
      { name: "Event_Name", target: "database_field", field: "events.name" },
      { name: "Date", target: "database_field", field: "events.startDate" },
      { name: "Location", target: "database_field", field: "events.location" },
      { name: "LC", target: "database_field", field: "events.localCouncilId" },
      { name: "Status", target: "database_field", field: "events.status" },
    ],
  },

  // ── Financial Ledger ────────────────────────────────────────
  {
    sheetId: "financial-ledger",
    sheetName: "Financial Ledger",
    entityType: "finance",
    usage: "workflow_controller",
    action: "REPLACE",
    replacementEngine: "financeEngine + workflowEngine",
    description:
      "Tracks all financial transactions, budget allocations, and expenditure approvals. " +
      "Should be fully replaced by the database finance tables.",
    status: "identified",
    columns: [
      { name: "Transaction_ID", target: "database_field", field: "finance_transactions.id" },
      { name: "Type", target: "database_field", field: "finance_transactions.type" },
      { name: "Amount", target: "database_field", field: "finance_transactions.amount" },
      { name: "Approved_By", target: "database_field", field: "finance_transactions.approvedBy" },
      { name: "VPF_Status", target: "workflow_state", field: "finance.workflow.stage.vpf" },
      { name: "Pres_Status", target: "workflow_state", field: "finance.workflow.stage.president" },
    ],
  },
];

// ============================================================================
// Audit Functions
// ============================================================================

/**
 * Get all spreadsheet dependencies that need replacement.
 */
export function getReplaceableDependencies(): SpreadsheetDependency[] {
  return SPREADSHEET_DEPENDENCIES.filter((d) => d.action === "REPLACE");
}

/**
 * Get dependencies by entity type.
 */
export function getDependenciesByEntity(
  entityType: string
): SpreadsheetDependency[] {
  return SPREADSHEET_DEPENDENCIES.filter((d) => d.entityType === entityType);
}

/**
 * Get migration status summary.
 */
export function getMigrationStatus(): {
  total: number;
  identified: number;
  migrating: number;
  completed: number;
  byAction: Record<string, number>;
} {
  const byAction: Record<string, number> = {};
  let identified = 0;
  let migrating = 0;
  let completed = 0;

  for (const dep of SPREADSHEET_DEPENDENCIES) {
    byAction[dep.action] = (byAction[dep.action] ?? 0) + 1;
    if (dep.status === "identified") identified++;
    if (dep.status === "migrating") migrating++;
    if (dep.status === "completed") completed++;
  }

  return {
    total: SPREADSHEET_DEPENDENCIES.length,
    identified,
    migrating,
    completed,
    byAction,
  };
}

/**
 * Get columns that map to workflow states (the most critical to migrate).
 */
export function getWorkflowColumns(): Array<{
  sheet: string;
  column: string;
  target: string;
}> {
  const result: Array<{ sheet: string; column: string; target: string }> = [];

  for (const dep of SPREADSHEET_DEPENDENCIES) {
    for (const col of dep.columns) {
      if (col.target === "workflow_state") {
        result.push({
          sheet: dep.sheetName,
          column: col.name,
          target: col.field ?? "",
        });
      }
    }
  }

  return result;
}
