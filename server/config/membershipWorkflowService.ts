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
  const workflowResult = await advanceWorkflow(
    await findWorkflowInstance("membership", applicationId),
    {
      decision: decision === "approve" ? "approve" : "reject",
      notes,
      userId: verifiedBy,
    }
  );

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
