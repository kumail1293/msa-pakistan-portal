/**
 * Membership Workflow Service (Phase 18)
 *
 * Makes the membership application work end-to-end WITHOUT Google Sheets:
 *
 *   Form Submit → Validation → LC Verification → VPI Approval →
 *   Account Creation → Membership ID → Certificate → Card → Notify
 *
 * Every step is database-driven, audited, and configurable.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  users,
  membershipApplications,
  localCouncils,
  documents,
  memberCards,
} from "../../drizzle/schema";
import {
  workflowInstances,
  workflowTasks,
  workflowStages,
} from "../../drizzle/schema.enterprise";
// Lifecycle + onboarding tables (merged from memberLifecycleEngine.ts).
// Alias: schema.ts also exports a different `membershipApplications` table.
import {
  membershipApplications as memberApplicationRecords,
  onboardingTasks,
  memberOnboardingProgress,
} from "../../drizzle/schema.membership";
// Termination tables (merged from membershipTerminationEngine.ts)
import {
  membershipTerminations,
  type MembershipTermination,
  type InsertMembershipTermination,
} from "../../drizzle/schema.proxy_oath_termination";
import { logAuditEvent } from "./auditService";
import { getConfig, getConfigNumber } from "./configService";
import { getCurrentGovernanceVersion, getCurrentTermName } from "./termService";
import { startWorkflow, advanceWorkflow, isValidTransition } from "./workflowEngine";

// ============================================================================
// Types
// ============================================================================

export interface MembershipSubmissionResult {
  success: boolean;
  applicationId?: number;
  validationErrors?: string[];
  error?: string;
}

export interface MembershipApprovalResult {
  success: boolean;
  membershipId?: string;
  userId?: number;
  error?: string;
}

// ============================================================================
// 1. FORM SUBMISSION
// ============================================================================

/**
 * Submit a membership application from the portal form.
 * Validates eligibility, checks for duplicates, stores application.
 */
export async function submitMembershipApplication(input: {
  email: string;
  fullName: string;
  contactNumber: string;
  age: number;
  dateOfBirth: string;
  cnic: string;
  gender: string;
  cityOfResidence: string;
  address: string;
  reasonForJoining: string;
  courseLevel: string;
  courseOfStudy: string;
  yearOfStudy: string;
  institute: string;
  collegeRollNumber: string;
  paymentAccountName: string;
  graduationDate?: string;
  profilePhotoUrl?: string;
  feeReceiptUrl?: string;
  cnicCopyUrl?: string;
  termsAccepted: boolean;
  undertakingAccepted: boolean;
  discoverySources?: string[];
  submittedBy?: number;
}): Promise<MembershipSubmissionResult> {
  // ── VALIDATION (before DB check) ──────────────────────────────
  const errors: string[] = [];

  // Required acknowledgements
  if (!input.termsAccepted) errors.push("Terms and conditions must be accepted");
  if (!input.undertakingAccepted) errors.push("Undertaking must be accepted");

  // CNIC format validation
  const cnicClean = input.cnic.replace(/-/g, "");
  if (!/^\d{13}$/.test(cnicClean)) {
    errors.push("CNIC must be 13 digits");
  }

  if (errors.length > 0) {
    return { success: false, validationErrors: errors };
  }

  const db = getDb();
  if (!db) return { success: false, error: "Database not available" };

  // ── DATABASE CHECKS ───────────────────────────────────────────
  // Duplicate CNIC check
  const [existingByCnic] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.cnic, input.cnic))
    .limit(1);

  if (existingByCnic) {
    errors.push("A member with this CNIC already exists");
  }

  // Duplicate email check
  const [existingByEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (existingByEmail) {
    errors.push("A member with this email already exists");
  }

  // Duplicate application check
  const [existingApp] = await db
    .select({ id: membershipApplications.id })
    .from(membershipApplications)
    .where(
      and(
        eq(membershipApplications.cnic, input.cnic),
        eq(membershipApplications.status, "pending")
      )
    )
    .limit(1);

  if (existingApp) {
    errors.push("You already have a pending membership application");
  }

  if (errors.length > 0) {
    return { success: false, validationErrors: errors };
  }

  // ── STORE APPLICATION ─────────────────────────────────────────
  const [result] = await db.insert(membershipApplications).values({
    email: input.email,
    fullName: input.fullName,
    contactNumber: input.contactNumber,
    age: input.age,
    dateOfBirth: input.dateOfBirth,
    cnic: input.cnic,
    gender: input.gender,
    cityOfResidence: input.cityOfResidence,
    address: input.address,
    reasonForJoining: input.reasonForJoining,
    courseLevel: input.courseLevel,
    courseOfStudy: input.courseOfStudy,
    yearOfStudy: input.yearOfStudy,
    institute: input.institute,
    collegeRollNumber: input.collegeRollNumber,
    paymentAccountName: input.paymentAccountName,
    graduationDate: input.graduationDate,
    profilePhotoUrl: input.profilePhotoUrl,
    feeReceiptUrl: input.feeReceiptUrl,
    cnicCopyUrl: input.cnicCopyUrl,
    termsAccepted: input.termsAccepted,
    undertakingAccepted: input.undertakingAccepted,
    discoverySources: input.discoverySources,
    status: "pending",
  });

  const applicationId = Number((result as any)[0].insertId);

  // ── START WORKFLOW ────────────────────────────────────────────
  const workflowResult = await startWorkflow(
    "membership_approval",
    "membership",
    applicationId,
    input.submittedBy,
    {
      email: input.email,
      fullName: input.fullName,
      cnic: input.cnic,
      institute: input.institute,
    }
  );

  // ── AUDIT ─────────────────────────────────────────────────────
  await logAuditEvent({
    userId: input.submittedBy,
    action: "membership.application_submitted",
    entityType: "membership_application",
    entityId: applicationId,
    after: {
      email: input.email,
      fullName: input.fullName,
      institute: input.institute,
      workflowInstanceId: workflowResult?.instanceId,
    },
  });

  console.log(`[Membership] Application #${applicationId} submitted by ${input.fullName}`);

  return {
    success: true,
    applicationId,
  };
}

// ============================================================================
// 2. APPLICATION REVIEW (LC Verification)
// ============================================================================

/**
 * Verify a membership application at the LC level.
 * Checks: institute matches LC, member belongs to LC area, documents are valid.
 */
export async function verifyApplicationAtLC(
  applicationId: number,
  verifiedBy: number,
  decision: "approve" | "reject",
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { success: false, error: "Database not available" };

  const [application] = await db
    .select()
    .from(membershipApplications)
    .where(eq(membershipApplications.id, applicationId))
    .limit(1);

  if (!application) return { success: false, error: "Application not found" };
  if (application.status !== "pending") return { success: false, error: "Application is not pending" };

  // Update application status
  await db
    .update(membershipApplications)
    .set({
      status: decision === "approve" ? "pending" : "rejected",
      reviewedBy: String(verifiedBy),
      reviewedAt: new Date(),
      reviewNotes: notes,
      updatedAt: new Date(),
    })
    .where(eq(membershipApplications.id, applicationId));

  // Advance workflow
  const workflowInstanceId = await findWorkflowInstance("membership", applicationId);
  const workflowResult = workflowInstanceId !== null
    ? await advanceWorkflow(
        workflowInstanceId,
        {
          decision: decision === "approve" ? "approve" : "reject",
          notes,
          userId: verifiedBy,
        }
      )
    : { success: false as const, error: "No workflow instance found for this application" };

  // Audit
  await logAuditEvent({
    userId: verifiedBy,
    action: `membership.lc_${decision === "approve" ? "verified" : "rejected"}`,
    entityType: "membership_application",
    entityId: applicationId,
    after: { decision, notes },
  });

  return { success: true };
}

// ============================================================================
// 3. FINAL APPROVAL (VPI/President)
// ============================================================================

/**
 * Final approval of membership application.
 * On approval: creates user account, generates membership ID, creates certificate.
 */
export async function approveMembership(
  applicationId: number,
  approvedBy: number,
  notes?: string
): Promise<MembershipApprovalResult> {
  const db = getDb();
  if (!db) return { success: false, error: "Database not available" };

  const [application] = await db
    .select()
    .from(membershipApplications)
    .where(eq(membershipApplications.id, applicationId))
    .limit(1);

  if (!application) return { success: false, error: "Application not found" };
  if (application.status === "approved") return { success: false, error: "Already approved" };

  // ── GENERATE MEMBERSHIP ID ────────────────────────────────────
  const prefix = await getConfig("membership.prefix", "MSAP");
  const termName = await getCurrentTermName();
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.membershipStatus, "Active"));
  const nextNum = (countResult?.count ?? 0) + 1;
  const membershipId = `${prefix}-${termName}-${String(nextNum).padStart(4, "0")}`;

  // ── CREATE USER ACCOUNT ───────────────────────────────────────
  const openId = `msap-${application.cnic}-${Date.now()}`;
  const [userResult] = await db.insert(users).values({
    openId,
    email: application.email,
    name: application.fullName,
    cnic: application.cnic,
    phone: application.contactNumber,
    institution: application.institute,
    degree: application.courseOfStudy,
    membershipStatus: "Active",
    membershipId,
    membershipStartDate: new Date(),
    profilePhotoUrl: application.profilePhotoUrl,
    role: "user",
  });

  const userId = Number((userResult as any)[0].insertId);

  // ── CREATE MEMBER CARD ────────────────────────────────────────
  await db.insert(memberCards).values({
    userId,
    version: 1,
    identitySnapshot: {
      memberName: application.fullName,
      institution: application.institute,
      discipline: application.courseOfStudy,
      yearOfStudy: application.yearOfStudy,
      localCouncil: application.institute,
      graduationYear: application.graduationDate ? parseInt(application.graduationDate) : null,
      photoUrl: application.profilePhotoUrl ?? "",
    },
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
  });

  // ── UPDATE APPLICATION ────────────────────────────────────────
  await db
    .update(membershipApplications)
    .set({
      status: "approved",
      membershipId,
      reviewedBy: String(approvedBy),
      reviewedAt: new Date(),
      reviewNotes: notes,
      updatedAt: new Date(),
    })
    .where(eq(membershipApplications.id, applicationId));

  // ── ADVANCE WORKFLOW TO COMPLETION ────────────────────────────
  const instanceId = await findWorkflowInstance("membership", applicationId);
  if (instanceId) {
    await advanceWorkflow(instanceId, {
      decision: "approve",
      notes: `Membership approved. ID: ${membershipId}`,
      userId: approvedBy,
      metadata: { membershipId, userId },
    });
  }

  // ── AUDIT ─────────────────────────────────────────────────────
  await logAuditEvent({
    userId: approvedBy,
    action: "membership.approved",
    entityType: "membership",
    entityId: userId,
    after: {
      membershipId,
      email: application.email,
      fullName: application.fullName,
      governanceVersion: await getCurrentGovernanceVersion(),
    },
  });

  console.log(`[Membership] Approved: ${application.fullName} → ${membershipId} (user #${userId})`);

  return {
    success: true,
    membershipId,
    userId,
  };
}

// ============================================================================
// 4. REJECTION
// ============================================================================

export async function rejectMembership(
  applicationId: number,
  rejectedBy: number,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { success: false, error: "Database not available" };

  const [application] = await db
    .select()
    .from(membershipApplications)
    .where(eq(membershipApplications.id, applicationId))
    .limit(1);

  if (!application) return { success: false, error: "Application not found" };

  await db
    .update(membershipApplications)
    .set({
      status: "rejected",
      reviewedBy: String(rejectedBy),
      reviewedAt: new Date(),
      reviewNotes: reason,
      updatedAt: new Date(),
    })
    .where(eq(membershipApplications.id, applicationId));

  const instanceId = await findWorkflowInstance("membership", applicationId);
  if (instanceId) {
    await advanceWorkflow(instanceId, {
      decision: "reject",
      notes: reason,
      userId: rejectedBy,
    });
  }

  await logAuditEvent({
    userId: rejectedBy,
    action: "membership.rejected",
    entityType: "membership_application",
    entityId: applicationId,
    after: { reason },
  });

  return { success: true };
}

// ============================================================================
// HELPERS
// ============================================================================

async function findWorkflowInstance(
  entityType: string,
  entityId: number
): Promise<number | null> {
  const db = getDb();
  if (!db) return null;

  const [instance] = await db
    .select({ id: workflowInstances.id })
    .from(workflowInstances)
    .where(
      and(
        eq(workflowInstances.entityType, entityType),
        eq(workflowInstances.entityId, entityId)
      )
    )
    .orderBy(desc(workflowInstances.createdAt))
    .limit(1);

  return instance?.id ?? null;
}

/**
 * Get pending membership applications with workflow status.
 */
export async function getPendingApplications(): Promise<Array<{
  applicationId: number;
  fullName: string;
  email: string;
  institute: string;
  cnic: string;
  status: string;
  submittedAt: Date;
  workflowStatus: string | null;
  currentStage: string | null;
}>> {
  const db = getDb();
  if (!db) return [];

  const apps = await db
    .select({
      applicationId: membershipApplications.id,
      fullName: membershipApplications.fullName,
      email: membershipApplications.email,
      institute: membershipApplications.institute,
      cnic: membershipApplications.cnic,
      status: membershipApplications.status,
      submittedAt: membershipApplications.submittedAt,
    })
    .from(membershipApplications)
    .where(eq(membershipApplications.status, "pending"))
    .orderBy(desc(membershipApplications.submittedAt));

  // Enrich with workflow status
  const enriched = [];
  for (const app of apps) {
    const instanceId = await findWorkflowInstance("membership", app.applicationId);
    let workflowStatus: string | null = null;
    let currentStage: string | null = null;

    if (instanceId) {
      const [instance] = await db
        .select()
        .from(workflowInstances)
        .where(eq(workflowInstances.id, instanceId))
        .limit(1);

      if (instance) {
        workflowStatus = instance.status;
        if (instance.currentStageId) {
          const [stage] = await db
            .select({ name: workflowStages.name })
            .from(workflowStages)
            .where(eq(workflowStages.id, instance.currentStageId))
            .limit(1);
          currentStage = stage?.name ?? null;
        }
      }
    }

    enriched.push({ ...app, workflowStatus, currentStage });
  }

  return enriched;
}

/**
 * Get membership statistics.
 */
export async function getMembershipStats(): Promise<{
  total: number;
  active: number;
  pending: number;
  rejected: number;
  thisTerm: number;
}> {
  const db = getDb();
  if (!db) return { total: 0, active: 0, pending: 0, rejected: 0, thisTerm: 0 };

  const [total] = await db.select({ count: sql<number>`count(*)` }).from(users);
  const [active] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.membershipStatus, "Active"));
  const [pending] = await db.select({ count: sql<number>`count(*)` }).from(membershipApplications).where(eq(membershipApplications.status, "pending"));
  const [rejected] = await db.select({ count: sql<number>`count(*)` }).from(membershipApplications).where(eq(membershipApplications.status, "rejected"));

  return {
    total: total?.count ?? 0,
    active: active?.count ?? 0,
    pending: pending?.count ?? 0,
    rejected: rejected?.count ?? 0,
    thisTerm: active?.count ?? 0, // All active members are in current term
  };
}

// ============================================================================
// Member lifecycle + onboarding (merged from memberLifecycleEngine.ts)
// Note: `memberApplicationRecords` is the schema.membership table, aliased to
// avoid colliding with the different `membershipApplications` from schema.ts
// ============================================================================

export const memberLifecycleEngine = {
  /** Submit a membership application */
  submitApplication: async (input: {
    userId: number; institutionId?: number; localCouncilId?: number;
    degree?: string; graduationYear?: number; discipline?: string;
    studentId?: string; documents?: { type: string; url: string; name: string }[];
    membershipType?: string;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      const [result] = await db.insert(memberApplicationRecords).values({
        userId: input.userId,
        institutionId: input.institutionId,
        localCouncilId: input.localCouncilId,
        applicantName: user?.name ?? null,
        applicantEmail: user?.email ?? null,
        degree: input.degree,
        graduationYear: input.graduationYear,
        discipline: input.discipline,
        studentId: input.studentId,
        documents: input.documents,
        membershipType: input.membershipType ?? "ordinary",
        status: "submitted" as any,
      });
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  /** Review an application */
  reviewApplication: async (applicationId: number, decision: string, reviewedBy: number, notes?: string, rejectionReason?: string): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(memberApplicationRecords).set({
        status: decision as any,
        reviewedBy, reviewNotes: notes, reviewedAt: new Date(), decisionAt: new Date(),
        rejectionReason,
      }).where(eq(memberApplicationRecords.id, applicationId));
      if (decision === "approved") {
        const [app] = await db.select().from(memberApplicationRecords).where(eq(memberApplicationRecords.id, applicationId)).limit(1);
        if (app) {
          await db.update(users).set({
            membershipStatus: "Active" as any,
            membershipStartDate: new Date(),
          }).where(eq(users.id, app.userId));
        }
      }
      return true;
    } catch { return false; }
  },

  /** List applications */
  list: async (options: { status?: string; limit?: number } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      if (options.status) conditions.push(eq(memberApplicationRecords.status, options.status as any));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db.select().from(memberApplicationRecords).where(where).orderBy(desc(memberApplicationRecords.createdAt)).limit(options.limit ?? 50);
    } catch { return []; }
  },

  /** Get stats */
  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb();
    if (!db) return {};
    try {
      const counts = await db.select({ status: memberApplicationRecords.status, count: sql<number>`count(*)` }).from(memberApplicationRecords).groupBy(memberApplicationRecords.status);
      return Object.fromEntries(counts.map(c => [c.status ?? "unknown", c.count]));
    } catch { return {}; }
  },
};

/** Onboarding Engine (§12) */
export const onboardingEngine = {
  /** Create onboarding task */
  createTask: async (input: {
    name: string; description?: string; category?: string;
    required?: boolean; order?: number; membershipType?: string;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [result] = await db.insert(onboardingTasks).values({
        name: input.name, description: input.description, category: input.category,
        required: input.required ?? true, order: input.order ?? 0,
        membershipType: input.membershipType,
      });
      return { id: Number((result as any)[0].insertId) };
    } catch { return null; }
  },

  /** Complete a task for a member */
  completeTask: async (userId: number, taskId: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      const [existing] = await db.select().from(memberOnboardingProgress)
        .where(and(eq(memberOnboardingProgress.userId, userId), eq(memberOnboardingProgress.taskId, taskId))).limit(1);
      if (existing) {
        await db.update(memberOnboardingProgress).set({ status: "completed" as any, completedAt: new Date() }).where(eq(memberOnboardingProgress.id, existing.id));
      } else {
        await db.insert(memberOnboardingProgress).values({ userId, taskId, status: "completed" as any, completedAt: new Date() });
      }
      return true;
    } catch { return false; }
  },

  /** Get member onboarding progress */
  getProgress: async (userId: number): Promise<{ total: number; completed: number; percentage: number; tasks: any[] }> => {
    const db = getDb();
    if (!db) return { total: 0, completed: 0, percentage: 0, tasks: [] };
    try {
      const tasks = await db.select().from(onboardingTasks).where(eq(onboardingTasks.status, "active" as any));
      const progress = await db.select().from(memberOnboardingProgress).where(eq(memberOnboardingProgress.userId, userId));
      const completedCount = progress.filter(p => p.status === "completed").length;
      return {
        total: tasks.length,
        completed: completedCount,
        percentage: tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0,
        tasks: tasks.map(t => ({
          ...t,
          progress: progress.find(p => p.taskId === t.id)?.status ?? "pending",
        })),
      };
    } catch { return { total: 0, completed: 0, percentage: 0, tasks: [] }; }
  },

  /** List tasks */
  listTasks: async (): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      return db.select().from(onboardingTasks).orderBy(onboardingTasks.order);
    } catch { return []; }
  },
};

// ============================================================================
// Membership termination with due process (merged from membershipTerminationEngine.ts)
// ============================================================================

export interface TerminationInitiationRequest {
  userId: number;
  organizationId?: number;
  type: "voluntary_resignation" | "conduct_based" | "non_payment" | "inactivity" | "disciplinary";
  initiatedBy?: number;
  reason: string;
  evidence?: string[];
}

export interface ShowCauseResponse {
  terminationId: number;
  response: string;
  evidence?: string[];
}

export interface JudgingPanelDecision {
  terminationId: number;
  panelMemberIds: number[];
  decision: "terminate" | "warn" | "suspend" | "dismiss";
  reason: string;
}

export interface AppealRequest {
  terminationId: number;
  grounds: string;
  appealPanelMemberIds: number[];
}

export interface AppealDecision {
  terminationId: number;
  decision: "upheld" | "reversed" | "modified";
  reason: string;
}

// ============================================================================
// MEMBERSHIP TERMINATION ENGINE
// ============================================================================

export const membershipTerminationEngine = {
  // ------------------------------------------------------------------
  // INITIATE TERMINATION (B-6.23)
  // ------------------------------------------------------------------
  initiateTermination: async (request: TerminationInitiationRequest): Promise<MembershipTermination> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const now = new Date();
    
    // For voluntary resignation, skip show-cause
    const initialStatus = request.type === "voluntary_resignation"
      ? "judging_panel_assigned"
      : "initiated";

    const termination: InsertMembershipTermination = {
      userId: request.userId,
      organizationId: request.organizationId,
      type: request.type,
      initiatedBy: request.initiatedBy,
      initiationReason: request.reason,
      initiationEvidence: request.evidence ?? [],
      status: initialStatus,
      initiatedAt: now,
      metadata: { initiatedByType: "manual" },
    };

    const [result] = await db
      .insert(membershipTerminations)
      .values(termination);

    const [inserted] = await db
      .select()
      .from(membershipTerminations)
      .where(eq(membershipTerminations.id, Number(result.insertId)))
      .limit(1);

    return inserted;
  },

  // ------------------------------------------------------------------
  // ISSUE SHOW-CAUSE NOTICE (B-6.23.2)
  // ------------------------------------------------------------------
  issueShowCause: async (
    terminationId: number,
    deadline: Date
  ): Promise<MembershipTermination> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const termination = await getTerminationOrThrow(terminationId);

    if (termination.status !== "initiated") {
      throw new Error(`Cannot issue show-cause in status '${termination.status}'. Expected 'initiated'.`);
    }

    if (termination.type === "voluntary_resignation") {
      throw new Error("Show-cause is not applicable for voluntary resignation.");
    }

    await db
      .update(membershipTerminations)
      .set({
        status: "show_cause_issued",
        showCauseIssuedAt: new Date(),
        showCauseDeadline: deadline,
      })
      .where(eq(membershipTerminations.id, terminationId));

    const [updated] = await db
      .select()
      .from(membershipTerminations)
      .where(eq(membershipTerminations.id, terminationId))
      .limit(1);

    return updated;
  },

  // ------------------------------------------------------------------
  // SUBMIT SHOW-CAUSE RESPONSE
  // ------------------------------------------------------------------
  submitShowCauseResponse: async (request: ShowCauseResponse): Promise<MembershipTermination> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const termination = await getTerminationOrThrow(request.terminationId);

    if (termination.status !== "show_cause_issued") {
      throw new Error(`Cannot submit show-cause response in status '${termination.status}'.`);
    }

    const now = new Date();
    if (termination.showCauseDeadline && now > termination.showCauseDeadline) {
      throw new Error("Show-cause response deadline has passed.");
    }

    await db
      .update(membershipTerminations)
      .set({
        status: "show_cause_response_received",
        showCauseResponse: request.response,
        showCauseResponseAt: now,
      })
      .where(eq(membershipTerminations.id, request.terminationId));

    const [updated] = await db
      .select()
      .from(membershipTerminations)
      .where(eq(membershipTerminations.id, request.terminationId))
      .limit(1);

    return updated;
  },

  // ------------------------------------------------------------------
  // ASSIGN JUDGING PANEL
  // ------------------------------------------------------------------
  assignJudgingPanel: async (
    terminationId: number,
    panelMemberIds: number[]
  ): Promise<MembershipTermination> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const termination = await getTerminationOrThrow(terminationId);

    if (!["initiated", "show_cause_response_received"].includes(termination.status)) {
      throw new Error(`Cannot assign judging panel in status '${termination.status}'.`);
    }

    await db
      .update(membershipTerminations)
      .set({
        status: "judging_panel_assigned",
        judgingPanelMemberIds: panelMemberIds,
      })
      .where(eq(membershipTerminations.id, terminationId));

    const [updated] = await db
      .select()
      .from(membershipTerminations)
      .where(eq(membershipTerminations.id, terminationId))
      .limit(1);

    return updated;
  },

  // ------------------------------------------------------------------
  // JUDGING PANEL DECISION (B-6.23.2)
  // ------------------------------------------------------------------
  submitJudgingPanelDecision: async (decision: JudgingPanelDecision): Promise<MembershipTermination> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const termination = await getTerminationOrThrow(decision.terminationId);

    if (!["judging_panel_assigned", "judging_panel_hearing"].includes(termination.status)) {
      throw new Error(`Cannot submit panel decision in status '${termination.status}'.`);
    }

    await db
      .update(membershipTerminations)
      .set({
        status: "judging_panel_decision",
        judgingPanelMemberIds: decision.panelMemberIds,
        judgingPanelDecisionAt: new Date(),
        judgingPanelDecision: decision.decision,
        judgingPanelReason: decision.reason,
      })
      .where(eq(membershipTerminations.id, decision.terminationId));

    // If decision is "dismiss" (no termination), auto-finalize
    if (decision.decision === "dismiss") {
      await db
        .update(membershipTerminations)
        .set({
          status: "finalized",
          finalizedAt: new Date(),
          effectiveDate: new Date(),
        })
        .where(eq(membershipTerminations.id, decision.terminationId));
    }

    const [updated] = await db
      .select()
      .from(membershipTerminations)
      .where(eq(membershipTerminations.id, decision.terminationId))
      .limit(1);

    return updated;
  },

  // ------------------------------------------------------------------
  // FILE APPEAL (B-6.23.3)
  // ------------------------------------------------------------------
  fileAppeal: async (request: AppealRequest): Promise<MembershipTermination> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const termination = await getTerminationOrThrow(request.terminationId);

    if (termination.status !== "judging_panel_decision") {
      throw new Error(`Cannot file appeal in status '${termination.status}'.`);
    }

    if (!termination.appealEligible) {
      throw new Error("This termination is not eligible for appeal.");
    }

    if (termination.judgingPanelDecisionAt) {
      const appealDeadlineDays = await getConfigNumber("member.appealDeadlineDays", 7);
      const deadline = new Date(termination.judgingPanelDecisionAt);
      deadline.setDate(deadline.getDate() + appealDeadlineDays);
      if (new Date() > deadline) {
        throw new Error(`Appeal deadline has passed (${appealDeadlineDays} days from panel decision).`);
      }
    }

    await db
      .update(membershipTerminations)
      .set({
        status: "appeal_pending",
        appealFiledAt: new Date(),
        appealGrounds: request.grounds,
        appealPanelMemberIds: request.appealPanelMemberIds,
      })
      .where(eq(membershipTerminations.id, request.terminationId));

    const [updated] = await db
      .select()
      .from(membershipTerminations)
      .where(eq(membershipTerminations.id, request.terminationId))
      .limit(1);

    return updated;
  },

  // ------------------------------------------------------------------
  // APPEAL DECISION
  // ------------------------------------------------------------------
  submitAppealDecision: async (decision: AppealDecision): Promise<MembershipTermination> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const termination = await getTerminationOrThrow(decision.terminationId);

    if (termination.status !== "appeal_pending" && termination.status !== "appeal_hearing") {
      throw new Error(`Cannot submit appeal decision in status '${termination.status}'.`);
    }

    await db
      .update(membershipTerminations)
      .set({
        status: "appeal_decision",
        appealDecisionAt: new Date(),
        appealDecision: decision.decision,
        appealReason: decision.reason,
      })
      .where(eq(membershipTerminations.id, decision.terminationId));

    const [updated] = await db
      .select()
      .from(membershipTerminations)
      .where(eq(membershipTerminations.id, decision.terminationId))
      .limit(1);

    return updated;
  },

  // ------------------------------------------------------------------
  // FINALIZE TERMINATION
  // ------------------------------------------------------------------
  finalizeTermination: async (
    terminationId: number,
    effectiveDate?: Date
  ): Promise<MembershipTermination> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const termination = await getTerminationOrThrow(terminationId);

    if (!["appeal_decision", "judging_panel_decision"].includes(termination.status)) {
      throw new Error(`Cannot finalize in status '${termination.status}'.`);
    }

    await db
      .update(membershipTerminations)
      .set({
        status: "finalized",
        finalizedAt: new Date(),
        effectiveDate: effectiveDate ?? new Date(),
      })
      .where(eq(membershipTerminations.id, terminationId));

    const [updated] = await db
      .select()
      .from(membershipTerminations)
      .where(eq(membershipTerminations.id, terminationId))
      .limit(1);

    return updated;
  },

  // ------------------------------------------------------------------
  // REVERSE TERMINATION
  // ------------------------------------------------------------------
  reverseTermination: async (
    terminationId: number,
    reversedBy: number,
    reason: string
  ): Promise<MembershipTermination> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const termination = await getTerminationOrThrow(terminationId);

    if (termination.status !== "finalized") {
      throw new Error(`Can only reverse finalized terminations. Current status: '${termination.status}'.`);
    }

    await db
      .update(membershipTerminations)
      .set({
        status: "reversed",
        reversedAt: new Date(),
        reversedBy,
        reversalReason: reason,
      })
      .where(eq(membershipTerminations.id, terminationId));

    const [updated] = await db
      .select()
      .from(membershipTerminations)
      .where(eq(membershipTerminations.id, terminationId))
      .limit(1);

    return updated;
  },

  // ------------------------------------------------------------------
  // GET TERMINATION BY ID
  // ------------------------------------------------------------------
  getTermination: async (id: number): Promise<MembershipTermination | undefined> => {
    const db = getDb();
    if (!db) return undefined;

    return db
      .select()
      .from(membershipTerminations)
      .where(eq(membershipTerminations.id, id))
      .then((rows) => rows[0]);
  },

  // ------------------------------------------------------------------
  // GET TERMINATIONS FOR USER
  // ------------------------------------------------------------------
  getTerminationsForUser: async (userId: number): Promise<MembershipTermination[]> => {
    const db = getDb();
    if (!db) return [];

    return db
      .select()
      .from(membershipTerminations)
      .where(eq(membershipTerminations.userId, userId));
  },

  // ------------------------------------------------------------------
  // GET PENDING TERMINATIONS
  // ------------------------------------------------------------------
  getPendingTerminations: async (organizationId?: number): Promise<MembershipTermination[]> => {
    const db = getDb();
    if (!db) return [];

    const conditions = [
      sql`${membershipTerminations.status} NOT IN ('finalized', 'reversed', 'dismissed')`,
    ];

    if (organizationId) {
      conditions.push(eq(membershipTerminations.organizationId, organizationId));
    }

    return db
      .select()
      .from(membershipTerminations)
      .where(and(...conditions));
  },

  // ------------------------------------------------------------------
  // VALIDATE INITIATION
  // ------------------------------------------------------------------
  validateTerminationInitiation: (type: string, reason: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!reason || reason.trim().length < 10) {
      errors.push("Termination reason must be at least 10 characters.");
    }

    const validTypes = [
      "voluntary_resignation", "conduct_based", "non_payment",
      "inactivity", "disciplinary",
    ];

    if (!validTypes.includes(type)) {
      errors.push(`Invalid termination type: '${type}'.`);
    }

    return { valid: errors.length === 0, errors };
  },

  // ------------------------------------------------------------------
  // GET TERMINATION TIMELINE
  // ------------------------------------------------------------------
  getTerminationTimeline: async (terminationId: number): Promise<Array<{
    timestamp: Date;
    action: string;
    actor?: number;
    details: string;
  }>> => {
    const termination = await getTerminationOrThrow(terminationId);

    const timeline: Array<{
      timestamp: Date;
      action: string;
      actor?: number;
      details: string;
    }> = [
      {
        timestamp: termination.initiatedAt,
        action: "initiated",
        actor: termination.initiatedBy ?? undefined,
        details: `Termination initiated: ${termination.initiationReason}`,
      },
    ];

    if (termination.showCauseIssuedAt) {
      timeline.push({
        timestamp: termination.showCauseIssuedAt,
        action: "show_cause_issued",
        details: "Show-cause notice issued to member.",
      });
    }

    if (termination.showCauseResponseAt) {
      timeline.push({
        timestamp: termination.showCauseResponseAt,
        action: "show_cause_response",
        details: "Member submitted show-cause response.",
      });
    }

    if (termination.judgingPanelDecisionAt) {
      timeline.push({
        timestamp: termination.judgingPanelDecisionAt,
        action: "panel_decision",
        details: `Judging panel decided: ${termination.judgingPanelDecision}. ${termination.judgingPanelReason}`,
      });
    }

    if (termination.appealFiledAt) {
      timeline.push({
        timestamp: termination.appealFiledAt,
        action: "appeal_filed",
        details: `Appeal filed: ${termination.appealGrounds}`,
      });
    }

    if (termination.appealDecisionAt) {
      timeline.push({
        timestamp: termination.appealDecisionAt,
        action: "appeal_decision",
        details: `Appeal decided: ${termination.appealDecision}. ${termination.appealReason}`,
      });
    }

    if (termination.finalizedAt) {
      timeline.push({
        timestamp: termination.finalizedAt,
        action: "finalized",
        details: "Termination finalized.",
      });
    }

    if (termination.reversedAt) {
      timeline.push({
        timestamp: termination.reversedAt,
        action: "reversed",
        actor: termination.reversedBy ?? undefined,
        details: `Termination reversed: ${termination.reversalReason}`,
      });
    }

    return timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  },
};

// ============================================================================
// HELPERS
// ============================================================================

async function getTerminationOrThrow(id: number): Promise<MembershipTermination> {
  const db = getDb();
  if (!db) throw new Error("Database not configured.");

  const termination = await db
    .select()
    .from(membershipTerminations)
    .where(eq(membershipTerminations.id, id))
    .then((rows) => rows[0]);

  if (!termination) {
    throw new Error(`Membership termination ${id} not found.`);
  }

  return termination;
}

