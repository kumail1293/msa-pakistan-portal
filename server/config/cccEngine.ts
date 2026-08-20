/**
 * CCC (Constitution Credential Committee) Credential Engine
 * 
 * Implements the complete credentialing workflow for NGA/SGA:
 * - Credential form submission (B-8.1.15)
 * - Document validation and verification
 * - CCC committee management
 * - Multi-step validation checklist
 * - Preliminary and final report generation
 * - Report adoption by plenary
 * - Appeal process
 * - Override via procedural motion (B-8.4.11q)
 * - Voting card issuance
 * - Financial debt verification (B-8.7.6)
 *
 * Key rules:
 * - B-8.1.15: Credential submission before 2nd plenary
 * - B-8.4.11q: Procedural motion to overrule CCC
 * - B-8.7.6: Financial debt threshold for voting eligibility
 * - CCC has preliminary and final reports
 * - CCC decisions can be appealed
 * - Plenary can override CCC via 2/3 procedural motion
 */

import { eq, and, desc, sql, count } from "drizzle-orm";
import { getDb } from "../db";
import {
  ngaMeetings,
  ngaDelegations,
  cccMembers,
  cccReviews,
} from "../../drizzle/schema.nga";
import {
  credentialSubmissions,
  cccValidationChecklist,
  cccReports,
  votingCards,
  cccAppeals,
  type CredentialSubmission,
  type InsertCredentialSubmission,
  type CccValidationChecklist,
  type InsertCccValidationChecklist,
  type CccReport,
  type InsertCccReport,
  type VotingCard,
  type InsertVotingCard,
  type CccAppeal,
  type InsertCccAppeal,
} from "../../drizzle/schema.credentials";
import { logAuditEvent } from "./auditService";
import { resolveEffectiveRule } from "./governanceRulesEngine";

// ============================================================================
// TYPES
// ============================================================================

export interface CredentialSubmissionInput {
  meetingId: number;
  delegationId: number;
  submittedById: number;
  organizationName: string;
  organizationType: string;
  headOfDelegationName?: string;
  delegateCount?: number;
  delegateList?: Array<{
    userId: number;
    name: string;
    role: "head" | "delegate" | "observer" | "staff" | "faculty";
    membershipId?: string;
    isVoter: boolean;
  }>;
  financialDeclaration?: {
    totalDuesPaid: number;
    outstandingAmount: number;
    lastPaymentDate?: string;
    paymentReceipts?: string[];
  };
  documents?: Array<{
    type: string;
    filename: string;
    path: string;
    uploadedAt?: string;
    verified?: boolean;
  }>;
  submissionNotes?: string;
}

export interface CredentialValidationResult {
  submissionId: number;
  delegationId: number;
  valid: boolean;
  checks: {
    membershipListValid: boolean;
    memberCountMatch: boolean;
    financialClear: boolean;
    documentsComplete: boolean;
    organizationEligible: boolean;
    delegateEligible: boolean;
  };
  errors: string[];
  warnings: string[];
}

export interface CCCReportData {
  meetingId: number;
  reportType: "preliminary" | "final";
  delegations: Array<{
    delegationId: number;
    organizationName: string;
    organizationType: string;
    status: string;
    plenaryVotes: number;
    electionVotes: number;
    checks: Record<string, boolean>;
  }>;
  totals: {
    totalDelegations: number;
    approved: number;
    rejected: number;
    pending: number;
    overridden: number;
    totalPlenaryVotes: number;
    totalElectionVotes: number;
  };
}

// ============================================================================
// CCC CREDENTIAL ENGINE
// ============================================================================

export const cccEngine = {
  // ------------------------------------------------------------------
  // CCC COMMITTEE MANAGEMENT
  // ------------------------------------------------------------------
  
  /**
   * Appoint CCC members for a meeting.
   */
  appointCCCMembers: async (
    meetingId: number,
    members: Array<{ userId: number; role: "chair" | "member" | "observer" }>,
    appointedBy?: string
  ): Promise<void> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    for (const member of members) {
      // Check if already appointed
      const [existing] = await db
        .select()
        .from(cccMembers)
        .where(
          and(
            eq(cccMembers.meetingId, meetingId),
            eq(cccMembers.userId, member.userId)
          )
        )
        .limit(1);

      if (!existing) {
        await db.insert(cccMembers).values({
          meetingId,
          userId: member.userId,
          role: member.role,
          appointedBy,
        });
      }
    }

    await logAuditEvent({
      action: "ccc.members_appointed",
      entityType: "ccc_meeting",
      entityId: meetingId,
      after: { members: members.map(m => m.userId), appointedBy },
    });
  },

  /**
   * Get CCC members for a meeting.
   */
  getCCCMembers: async (meetingId: number): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];

    return db
      .select()
      .from(cccMembers)
      .where(eq(cccMembers.meetingId, meetingId))
      .orderBy(cccMembers.role);
  },

  // ------------------------------------------------------------------
  // CREDENTIAL FORM SUBMISSION
  // ------------------------------------------------------------------

  /**
   * Submit credential form for a delegation.
   * B-8.1.15: Must be done before 2nd plenary.
   */
  submitCredentialForm: async (
    input: CredentialSubmissionInput
  ): Promise<CredentialSubmission> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    // Check for existing submission
    const [existing] = await db
      .select()
      .from(credentialSubmissions)
      .where(
        and(
          eq(credentialSubmissions.meetingId, input.meetingId),
          eq(credentialSubmissions.delegationId, input.delegationId),
          sql`${credentialSubmissions.status} NOT IN ('rejected', 'overridden')`
        )
      )
      .limit(1);

    if (existing && (existing.status === "submitted" || existing.status === "approved")) {
      throw new Error("A credential form has already been submitted and is under review or approved.");
    }

    // Check deadline
    const [meeting] = await db
      .select()
      .from(ngaMeetings)
      .where(eq(ngaMeetings.id, input.meetingId))
      .limit(1);

    const now = new Date();
    const deadlineAt = meeting?.scheduledStart
      ? new Date(new Date(meeting.scheduledStart).getTime() - 7 * 24 * 60 * 60 * 1000) // 1 week before NGA
      : undefined;

    const submission: InsertCredentialSubmission = {
      meetingId: input.meetingId,
      delegationId: input.delegationId,
      submittedById: input.submittedById,
      organizationName: input.organizationName,
      organizationType: input.organizationType,
      headOfDelegationName: input.headOfDelegationName,
      delegateCount: input.delegateCount ?? 0,
      delegateList: input.delegateList ?? [],
      financialDeclaration: input.financialDeclaration,
      documents: (input.documents ?? []).map(d => ({
        ...d,
        uploadedAt: d.uploadedAt ?? new Date().toISOString(),
        verified: d.verified ?? false,
      })),
      status: "submitted",
      submittedAt: now,
      deadlineAt,
      submissionNotes: input.submissionNotes,
    };

    const [result] = await db
      .insert(credentialSubmissions)
      .values(submission);

    const [inserted] = await db
      .select()
      .from(credentialSubmissions)
      .where(eq(credentialSubmissions.id, Number(result.insertId)))
      .limit(1);

    // Update delegation status
    await db
      .update(ngaDelegations)
      .set({
        credentialFormSubmitted: true,
        credentialFormSubmittedAt: now,
        credentialStatus: "submitted",
      })
      .where(eq(ngaDelegations.id, input.delegationId));

    await logAuditEvent({
      action: "ccc.credential_form_submitted",
      entityType: "credential_submission",
      entityId: Number(result.insertId),
      after: {
        delegationId: input.delegationId,
        organizationName: input.organizationName,
        delegateCount: input.delegateCount,
      },
    });

    return inserted;
  },

  /**
   * Request revision on a credential submission.
   */
  requestRevision: async (
    submissionId: number,
    reviewerNotes: string,
    reviewedBy?: number
  ): Promise<CredentialSubmission> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const [submission] = await db
      .select()
      .from(credentialSubmissions)
      .where(eq(credentialSubmissions.id, submissionId))
      .limit(1);

    if (!submission) throw new Error(`Submission ${submissionId} not found.`);
    if (submission.status !== "submitted" && submission.status !== "resubmitted") {
      throw new Error(`Cannot request revision in status '${submission.status}'.`);
    }

    await db
      .update(credentialSubmissions)
      .set({
        status: "revision_requested",
        reviewerNotes,
        updatedAt: new Date(),
      })
      .where(eq(credentialSubmissions.id, submissionId));

    const [updated] = await db
      .select()
      .from(credentialSubmissions)
      .where(eq(credentialSubmissions.id, submissionId))
      .limit(1);

    return updated;
  },

  /**
   * Resubmit credential form after revision.
   */
  resubmitCredentialForm: async (
    submissionId: number,
    updates: Partial<CredentialSubmissionInput>
  ): Promise<CredentialSubmission> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const [submission] = await db
      .select()
      .from(credentialSubmissions)
      .where(eq(credentialSubmissions.id, submissionId))
      .limit(1);

    if (!submission) throw new Error(`Submission ${submissionId} not found.`);
    if (submission.status !== "revision_requested") {
      throw new Error(`Cannot resubmit in status '${submission.status}'.`);
    }

    await db
      .update(credentialSubmissions)
      .set({
        status: "resubmitted",
        delegateCount: updates.delegateCount ?? submission.delegateCount,
        delegateList: updates.delegateList ?? submission.delegateList,
        financialDeclaration: updates.financialDeclaration ?? submission.financialDeclaration,
        documents: (updates.documents ?? submission.documents) as any,
        submissionNotes: updates.submissionNotes ?? submission.submissionNotes,
        updatedAt: new Date(),
      })
      .where(eq(credentialSubmissions.id, submissionId));

    const [updated] = await db
      .select()
      .from(credentialSubmissions)
      .where(eq(credentialSubmissions.id, submissionId))
      .limit(1);

    return updated;
  },

  // ------------------------------------------------------------------
  // CREDENTIAL VALIDATION
  // ------------------------------------------------------------------

  /**
   * Validate a credential submission against all rules.
   */
  validateCredentials: async (
    submissionId: number
  ): Promise<CredentialValidationResult> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const [submission] = await db
      .select()
      .from(credentialSubmissions)
      .where(eq(credentialSubmissions.id, submissionId))
      .limit(1);

    if (!submission) throw new Error(`Submission ${submissionId} not found.`);

    const [delegation] = await db
      .select()
      .from(ngaDelegations)
      .where(eq(ngaDelegations.id, submission.delegationId))
      .limit(1);

    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Membership list validation
    const membershipListValid = (submission.delegateList?.length ?? 0) > 0;
    if (!membershipListValid) {
      errors.push("Delegate list is empty or missing.");
    }

    // 2. Member count validation
    const declaredCount = submission.delegateCount ?? 0;
    const listCount = submission.delegateList?.length ?? 0;
    const memberCountMatch = declaredCount === listCount;
    if (!memberCountMatch) {
      warnings.push(`Declared count (${declaredCount}) does not match list count (${listCount}).`);
    }

    // 3. Financial validation
    const financialClear = (submission.financialDeclaration?.outstandingAmount ?? 0) <= 0;
    if (!financialClear) {
      const outstanding = submission.financialDeclaration?.outstandingAmount ?? 0;
      const threshold = await getFinancialDebtThreshold();
      if (outstanding >= threshold) {
        errors.push(`Outstanding debt (PKR ${outstanding}) exceeds threshold (PKR ${threshold}).`);
      } else {
        warnings.push(`Outstanding debt (PKR ${outstanding}) is below threshold but still present.`);
      }
    }

    // 4. Document validation
    const requiredDocs = ["membership_list", "financial_report"];
    const attachedTypes = submission.documents?.map(d => d.type) ?? [];
    const documentsComplete = requiredDocs.every(type => attachedTypes.includes(type));
    if (!documentsComplete) {
      const missing = requiredDocs.filter(type => !attachedTypes.includes(type));
      errors.push(`Missing required documents: ${missing.join(", ")}.`);
    }

    // 5. Organization eligibility
    const eligibleTypes = ["permanent_lc", "temporary_lc", "candidate_lc", "ci"];
    const organizationEligible = eligibleTypes.includes(submission.organizationType);
    if (!organizationEligible) {
      errors.push(`Organization type '${submission.organizationType}' is not eligible for credentialing.`);
    }

    // 6. Delegate eligibility
    const delegateEligible = membershipListValid; // Simplified; full check would verify each delegate
    if (submission.delegateList) {
      for (const delegate of submission.delegateList) {
        if (!delegate.membershipId && delegate.role !== "staff" && delegate.role !== "faculty") {
          warnings.push(`Delegate '${delegate.name}' has no membership ID.`);
        }
      }
    }

    const valid = errors.length === 0;

    // Create validation checklist
    const checklist: InsertCccValidationChecklist = {
      submissionId,
      meetingId: submission.meetingId,
      membershipListValid,
      memberCountVerified: memberCountMatch,
      declaredCount,
      verifiedCount: listCount,
      duesPaidCurrent: financialClear,
      debtAmount: submission.financialDeclaration?.outstandingAmount ?? 0,
      financialDocumentsValid: documentsComplete,
      credentialFormComplete: documentsComplete,
      delegateListComplete: membershipListValid,
      resolutionAttached: attachedTypes.includes("resolution"),
      allDocumentsVerified: documentsComplete,
      organizationEligible,
      organizationTypeValid: eligibleTypes.includes(submission.organizationType),
      delegateEligibilityVerified: delegateEligible,
      overallStatus: valid ? "checks_passed" : "checks_failed",
    };

    // Upsert checklist
    const [existingChecklist] = await db
      .select()
      .from(cccValidationChecklist)
      .where(eq(cccValidationChecklist.submissionId, submissionId))
      .limit(1);

    if (existingChecklist) {
      await db
        .update(cccValidationChecklist)
        .set({ ...checklist, updatedAt: new Date() })
        .where(eq(cccValidationChecklist.id, existingChecklist.id));
    } else {
      await db.insert(cccValidationChecklist).values(checklist);
    }

    return {
      submissionId,
      delegationId: submission.delegationId,
      valid,
      checks: {
        membershipListValid,
        memberCountMatch,
        financialClear,
        documentsComplete,
        organizationEligible,
        delegateEligible: delegateEligible,
      },
      errors,
      warnings,
    };
  },

  // ------------------------------------------------------------------
  // CCC REVIEW & DECISION
  // ------------------------------------------------------------------

  /**
   * CCC reviews and decides on a credential submission.
   */
  reviewSubmission: async (
    submissionId: number,
    decision: "approved" | "rejected" | "conditional",
    reviewedBy: number,
    options: {
      reviewerNotes?: string;
      rejectionReason?: string;
      conditions?: string[];
    } = {}
  ): Promise<CredentialSubmission> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const [submission] = await db
      .select()
      .from(credentialSubmissions)
      .where(eq(credentialSubmissions.id, submissionId))
      .limit(1);

    if (!submission) throw new Error(`Submission ${submissionId} not found.`);
    if (!["submitted", "resubmitted", "under_review"].includes(submission.status)) {
      throw new Error(`Cannot review submission in status '${submission.status}'.`);
    }

    const now = new Date();

    // Update submission status
    await db
      .update(credentialSubmissions)
      .set({
        status: decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "approved",
        reviewCompletedAt: now,
        reviewerNotes: options.reviewerNotes,
        updatedAt: now,
      })
      .where(eq(credentialSubmissions.id, submissionId));

    // Update delegation credential status
    const credentialStatus = decision === "approved" ? "approved"
      : decision === "rejected" ? "rejected"
      : "approved"; // conditional = approved with notes

    await db
      .update(ngaDelegations)
      .set({
        credentialStatus: credentialStatus as any,
        status: decision === "approved" || decision === "conditional" ? "credentialed" : "registered",
      })
      .where(eq(ngaDelegations.id, submission.delegationId));

    // Create CCC review record
    await db.insert(cccReviews).values({
      meetingId: submission.meetingId,
      delegationId: submission.delegationId,
      status: decision,
      membershipValid: true,
      financialClear: true,
      documentsComplete: true,
      eligibilityVerified: decision !== "rejected",
      reviewerNotes: options.reviewerNotes,
      rejectionReason: options.rejectionReason,
      reviewedAt: now,
      reviewedBy,
    });

    // Update validation checklist
    await db
      .update(cccValidationChecklist)
      .set({
        overallStatus: decision === "approved" ? "checks_passed" : decision === "rejected" ? "checks_failed" : "conditional",
        checkedById: reviewedBy,
        checkedAt: now,
        updatedAt: now,
      })
      .where(eq(cccValidationChecklist.submissionId, submissionId));

    await logAuditEvent({
      userId: reviewedBy,
      action: `ccc.credential_${decision}`,
      entityType: "credential_submission",
      entityId: submissionId,
      after: { decision, notes: options.reviewerNotes },
    });

    const [updated] = await db
      .select()
      .from(credentialSubmissions)
      .where(eq(credentialSubmissions.id, submissionId))
      .limit(1);

    return updated;
  },

  // ------------------------------------------------------------------
  // CCC REPORTS
  // ------------------------------------------------------------------

  /**
   * Generate CCC preliminary report.
   */
  generatePreliminaryReport: async (
    meetingId: number,
    authoredById?: number
  ): Promise<CccReport> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const reportData = await cccEngine.getReportData(meetingId);

    const content = cccEngine.formatReportContent(reportData, "preliminary");

    const report: InsertCccReport = {
      meetingId,
      type: "preliminary",
      title: `CCC Preliminary Report - NGA ${new Date().getFullYear()}`,
      content,
      totalDelegations: reportData.totals.totalDelegations,
      approvedDelegations: reportData.totals.approved,
      rejectedDelegations: reportData.totals.rejected,
      pendingDelegations: reportData.totals.pending,
      overriddenDelegations: reportData.totals.overridden,
      totalPlenaryVotes: reportData.totals.totalPlenaryVotes,
      totalElectionVotes: reportData.totals.totalElectionVotes,
      status: "draft",
      authoredById,
    };

    const [result] = await db.insert(cccReports).values(report);

    const [inserted] = await db
      .select()
      .from(cccReports)
      .where(eq(cccReports.id, Number(result.insertId)))
      .limit(1);

    await logAuditEvent({
      userId: authoredById,
      action: "ccc.preliminary_report_generated",
      entityType: "ccc_report",
      entityId: Number(result.insertId),
      after: {
        totalDelegations: reportData.totals.totalDelegations,
        approved: reportData.totals.approved,
      },
    });

    return inserted;
  },

  /**
   * Generate CCC final report.
   */
  generateFinalReport: async (
    meetingId: number,
    authoredById?: number
  ): Promise<CccReport> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const reportData = await cccEngine.getReportData(meetingId);
    const content = cccEngine.formatReportContent(reportData, "final");

    // Get previous preliminary report
    const [preliminary] = await db
      .select()
      .from(cccReports)
      .where(
        and(
          eq(cccReports.meetingId, meetingId),
          eq(cccReports.type, "preliminary")
        )
      )
      .orderBy(desc(cccReports.version))
      .limit(1);

    const report: InsertCccReport = {
      meetingId,
      type: "final",
      version: (preliminary?.version ?? 0) + 1,
      title: `CCC Final Report - NGA ${new Date().getFullYear()}`,
      content,
      totalDelegations: reportData.totals.totalDelegations,
      approvedDelegations: reportData.totals.approved,
      rejectedDelegations: reportData.totals.rejected,
      pendingDelegations: reportData.totals.pending,
      overriddenDelegations: reportData.totals.overridden,
      totalPlenaryVotes: reportData.totals.totalPlenaryVotes,
      totalElectionVotes: reportData.totals.totalElectionVotes,
      status: "draft",
      authoredById,
    };

    const [result] = await db.insert(cccReports).values(report);

    const [inserted] = await db
      .select()
      .from(cccReports)
      .where(eq(cccReports.id, Number(result.insertId)))
      .limit(1);

    return inserted;
  },

  /**
   * Adopt CCC report by plenary motion.
   */
  adoptReport: async (
    reportId: number,
    motionId: number
  ): Promise<CccReport> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    await db
      .update(cccReports)
      .set({
        status: "adopted",
        adoptedAt: new Date(),
        adoptedByMotionId: motionId,
        updatedAt: new Date(),
      })
      .where(eq(cccReports.id, reportId));

    const [updated] = await db
      .select()
      .from(cccReports)
      .where(eq(cccReports.id, reportId))
      .limit(1);

    return updated;
  },

  /**
   * Get report data for a meeting.
   */
  getReportData: async (meetingId: number): Promise<CCCReportData> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const delegations = await db
      .select()
      .from(ngaDelegations)
      .where(eq(ngaDelegations.meetingId, meetingId))
      .orderBy(ngaDelegations.organizationName);

    const reportDelegations = delegations.map(d => ({
      delegationId: d.id,
      organizationName: d.organizationName,
      organizationType: d.organizationType,
      status: d.credentialStatus ?? "pending",
      plenaryVotes: d.plenaryVotes ?? 0,
      electionVotes: d.electionVotes ?? 0,
      checks: {
        credentialFormSubmitted: d.credentialFormSubmitted ?? false,
        financialClear: !d.hasOutstandingDebt,
      },
    }));

    const approved = delegations.filter(d => d.credentialStatus === "approved").length;
    const rejected = delegations.filter(d => d.credentialStatus === "rejected").length;
    const pending = delegations.filter(d => d.credentialStatus === "pending" || d.credentialStatus === "submitted").length;
    const overridden = delegations.filter(d => d.credentialStatus === "overridden").length;

    const totalPlenaryVotes = delegations
      .filter(d => d.credentialStatus === "approved" || d.credentialStatus === "overridden")
      .reduce((sum, d) => sum + (d.plenaryVotes ?? 0), 0);

    const totalElectionVotes = delegations
      .filter(d => d.credentialStatus === "approved" || d.credentialStatus === "overridden")
      .reduce((sum, d) => sum + (d.electionVotes ?? 0), 0);

    return {
      meetingId,
      reportType: "preliminary",
      delegations: reportDelegations,
      totals: {
        totalDelegations: delegations.length,
        approved,
        rejected,
        pending,
        overridden,
        totalPlenaryVotes,
        totalElectionVotes,
      },
    };
  },

  /**
   * Format report content as text.
   */
  formatReportContent: (data: CCCReportData, type: string): string => {
    const lines: string[] = [];
    lines.push(`========================================`);
    lines.push(`CONSTITUTION CREDENTIAL COMMITTEE`);
    lines.push(`${type.toUpperCase()} REPORT`);
    lines.push(`National General Assembly ${new Date().getFullYear()}`);
    lines.push(`========================================`);
    lines.push("");
    lines.push(`SUMMARY`);
    lines.push(`-------`);
    lines.push(`Total Delegations: ${data.totals.totalDelegations}`);
    lines.push(`Approved: ${data.totals.approved}`);
    lines.push(`Rejected: ${data.totals.rejected}`);
    lines.push(`Pending: ${data.totals.pending}`);
    lines.push(`Overridden: ${data.totals.overridden}`);
    lines.push(`Total Plenary Votes: ${data.totals.totalPlenaryVotes}`);
    lines.push(`Total Election Votes: ${data.totals.totalElectionVotes}`);
    lines.push("");
    lines.push(`DELEGATION DETAILS`);
    lines.push(`-----------------`);

    for (const d of data.delegations) {
      lines.push(``);
      lines.push(`  ${d.organizationName} (${d.organizationType})`);
      lines.push(`    Status: ${d.status.toUpperCase()}`);
      lines.push(`    Plenary Votes: ${d.plenaryVotes}`);
      lines.push(`    Election Votes: ${d.electionVotes}`);
      lines.push(`    Credential Form: ${d.checks.credentialFormSubmitted ? "Submitted" : "NOT SUBMITTED"}`);
      lines.push(`    Financial: ${d.checks.financialClear ? "Clear" : "OUTSTANDING DEBT"}`);
    }

    lines.push("");
    lines.push(`========================================`);
    lines.push(`END OF REPORT`);
    lines.push(`========================================`);

    return lines.join("\n");
  },

  // ------------------------------------------------------------------
  // APPEAL PROCESS
  // ------------------------------------------------------------------

  /**
   * File an appeal against CCC decision.
   */
  fileAppeal: async (
    meetingId: number,
    delegationId: number,
    submissionId: number,
    filedById: number,
    grounds: string
  ): Promise<CccAppeal> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    // Check if appeal already filed
    const [existing] = await db
      .select()
      .from(cccAppeals)
      .where(
        and(
          eq(cccAppeals.meetingId, meetingId),
          eq(cccAppeals.delegationId, delegationId),
          sql`${cccAppeals.status} IN ('filed', 'under_review')`
        )
      )
      .limit(1);

    if (existing) {
      throw new Error("An appeal has already been filed for this delegation.");
    }

    // Appeal deadline: 24 hours after CCC decision
    const deadlineAt = new Date();
    deadlineAt.setHours(deadlineAt.getHours() + 24);

    const appeal: InsertCccAppeal = {
      meetingId,
      delegationId,
      submissionId,
      filedById,
      grounds,
      status: "filed",
      deadlineAt,
    };

    const [result] = await db.insert(cccAppeals).values(appeal);

    const [inserted] = await db
      .select()
      .from(cccAppeals)
      .where(eq(cccAppeals.id, Number(result.insertId)))
      .limit(1);

    await logAuditEvent({
      userId: filedById,
      action: "ccc.appeal_filed",
      entityType: "ccc_appeal",
      entityId: Number(result.insertId),
      after: { delegationId, grounds },
    });

    return inserted;
  },

  /**
   * Review and decide on an appeal.
   */
  decideAppeal: async (
    appealId: number,
    decision: "upheld" | "dismissed",
    reviewedById: number,
    decisionText: string
  ): Promise<CccAppeal> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const [appeal] = await db
      .select()
      .from(cccAppeals)
      .where(eq(cccAppeals.id, appealId))
      .limit(1);

    if (!appeal) throw new Error(`Appeal ${appealId} not found.`);
    if (!["filed", "under_review"].includes(appeal.status)) {
      throw new Error(`Cannot decide appeal in status '${appeal.status}'.`);
    }

    await db
      .update(cccAppeals)
      .set({
        status: decision,
        reviewedById,
        reviewedAt: new Date(),
        decision: decisionText,
        updatedAt: new Date(),
      })
      .where(eq(cccAppeals.id, appealId));

    const [updated] = await db
      .select()
      .from(cccAppeals)
      .where(eq(cccAppeals.id, appealId))
      .limit(1);

    return updated;
  },

  // ------------------------------------------------------------------
  // OVERRIDE VIA PROCEDURAL MOTION (B-8.4.11q)
  // ------------------------------------------------------------------

  /**
   * Override CCC decision via procedural motion.
   * B-8.4.11q: Procedural motion to overrule CCC
   * Requires 2/3 majority vote.
   */
  overrideCCCDecision: async (
    meetingId: number,
    delegationId: number,
    motionId: number,
    overriddenById: number
  ): Promise<{ success: boolean; delegation: any }> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    // Verify motion was adopted (2/3 required)
    // In practice, the plenary engine would verify this; here we trust the caller

    // Update delegation status
    await db
      .update(ngaDelegations)
      .set({
        credentialStatus: "overridden",
        status: "credentialed",
        metadata: {
          overridden: true,
          overrideMotionId: motionId,
          overriddenAt: new Date().toISOString(),
          overriddenBy: overriddenById,
        },
      })
      .where(eq(ngaDelegations.id, delegationId));

    // Update submission if exists
    const [submission] = await db
      .select()
      .from(credentialSubmissions)
      .where(
        and(
          eq(credentialSubmissions.meetingId, meetingId),
          eq(credentialSubmissions.delegationId, delegationId)
        )
      )
      .limit(1);

    if (submission) {
      await db
        .update(credentialSubmissions)
        .set({
          status: "overridden",
          updatedAt: new Date(),
        })
        .where(eq(credentialSubmissions.id, submission.id));
    }

    // Update CCC review if exists
    const [review] = await db
      .select()
      .from(cccReviews)
      .where(
        and(
          eq(cccReviews.meetingId, meetingId),
          eq(cccReviews.delegationId, delegationId)
        )
      )
      .limit(1);

    if (review) {
      await db
        .update(cccReviews)
        .set({
          status: "overridden",
          overridden: true,
          overrideMotionId: motionId,
          overrideAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(cccReviews.id, review.id));
    }

    // Update validation checklist
    const [checklist] = await db
      .select()
      .from(cccValidationChecklist)
      .where(eq(cccValidationChecklist.submissionId, submission?.id ?? 0))
      .limit(1);

    if (checklist) {
      await db
        .update(cccValidationChecklist)
        .set({
          overallStatus: "overridden",
          updatedAt: new Date(),
        })
        .where(eq(cccValidationChecklist.id, checklist.id));
    }

    await logAuditEvent({
      userId: overriddenById,
      action: "ccc.decision_overridden",
      entityType: "nga_delegation",
      entityId: delegationId,
      after: { motionId, reason: "Procedural motion B-8.4.11q" },
    });

    const [delegation] = await db
      .select()
      .from(ngaDelegations)
      .where(eq(ngaDelegations.id, delegationId))
      .limit(1);

    return { success: true, delegation };
  },

  // ------------------------------------------------------------------
  // VOTING CARD MANAGEMENT
  // ------------------------------------------------------------------

  /**
   * Issue voting cards for credentialed delegations.
   */
  issueVotingCards: async (
    meetingId: number,
    issuedBy?: number
  ): Promise<VotingCard[]> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    // Get credentialed delegations
    const delegations = await db
      .select()
      .from(ngaDelegations)
      .where(
        and(
          eq(ngaDelegations.meetingId, meetingId),
          sql`${ngaDelegations.status} IN ('credentialed', 'active')`
        )
      );

    const cards: VotingCard[] = [];
    let cardCounter = 1;

    for (const delegation of delegations) {
      // Check if card already issued
      const [existingCard] = await db
        .select()
        .from(votingCards)
        .where(
          and(
            eq(votingCards.meetingId, meetingId),
            eq(votingCards.delegationId, delegation.id),
            sql`${votingCards.status} IN ('issued', 'active')`
          )
        )
        .limit(1);

      if (existingCard) {
        cards.push(existingCard);
        continue;
      }

      const cardNumber = `${meetingId}-${String(cardCounter).padStart(4, "0")}`;
      cardCounter++;

      const card: InsertVotingCard = {
        meetingId,
        delegationId: delegation.id,
        cardNumber,
        cardType: (delegation.plenaryVotes ?? 0) > 0 && (delegation.electionVotes ?? 0) > 0
          ? "both"
          : (delegation.plenaryVotes ?? 0) > 0
          ? "plenary"
          : "election",
        issuedAt: new Date(),
        issuedBy,
        plenaryVotes: delegation.plenaryVotes ?? 0,
        electionVotes: delegation.electionVotes ?? 0,
        status: "issued",
      };

      const [result] = await db.insert(votingCards).values(card);

      const [inserted] = await db
        .select()
        .from(votingCards)
        .where(eq(votingCards.id, Number(result.insertId)))
        .limit(1);

      cards.push(inserted);
    }

    await logAuditEvent({
      userId: issuedBy,
      action: "ccc.voting_cards_issued",
      entityType: "voting_cards",
      entityId: meetingId,
      after: { cardCount: cards.length },
    });

    return cards;
  },

  /**
   * Return a voting card.
   */
  returnVotingCard: async (
    cardId: number,
    returnedTo?: number
  ): Promise<VotingCard> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    await db
      .update(votingCards)
      .set({
        status: "returned",
        returnedAt: new Date(),
        returnedTo,
        updatedAt: new Date(),
      })
      .where(eq(votingCards.id, cardId));

    const [updated] = await db
      .select()
      .from(votingCards)
      .where(eq(votingCards.id, cardId))
      .limit(1);

    return updated;
  },

  /**
   * Revoke a voting card.
   */
  revokeVotingCard: async (
    cardId: number,
    reason: string
  ): Promise<VotingCard> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    await db
      .update(votingCards)
      .set({
        status: "revoked",
        revokedAt: new Date(),
        revokedReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(votingCards.id, cardId));

    const [updated] = await db
      .select()
      .from(votingCards)
      .where(eq(votingCards.id, cardId))
      .limit(1);

    return updated;
  },

  // ------------------------------------------------------------------
  // QUERIES
  // ------------------------------------------------------------------

  /**
   * Get all submissions for a meeting.
   */
  getSubmissionsForMeeting: async (
    meetingId: number,
    status?: string
  ): Promise<CredentialSubmission[]> => {
    const db = getDb();
    if (!db) return [];

    const conditions = [eq(credentialSubmissions.meetingId, meetingId)];
    if (status) {
      conditions.push(eq(credentialSubmissions.status, status as any));
    }

    return db
      .select()
      .from(credentialSubmissions)
      .where(and(...conditions))
      .orderBy(credentialSubmissions.organizationName);
  },

  /**
   * Get CCC reports for a meeting.
   */
  getReportsForMeeting: async (meetingId: number): Promise<CccReport[]> => {
    const db = getDb();
    if (!db) return [];

    return db
      .select()
      .from(cccReports)
      .where(eq(cccReports.meetingId, meetingId))
      .orderBy(desc(cccReports.createdAt));
  },

  /**
   * Get CCC summary for a meeting.
   */
  getCCCSummary: async (meetingId: number) => {
    const db = getDb();
    if (!db) return null;

    const [totalDelegations] = await db
      .select({ count: count() })
      .from(ngaDelegations)
      .where(eq(ngaDelegations.meetingId, meetingId));

    const [approved] = await db
      .select({ count: count() })
      .from(ngaDelegations)
      .where(
        and(
          eq(ngaDelegations.meetingId, meetingId),
          eq(ngaDelegations.credentialStatus, "approved")
        )
      );

    const [pending] = await db
      .select({ count: count() })
      .from(ngaDelegations)
      .where(
        and(
          eq(ngaDelegations.meetingId, meetingId),
          sql`${ngaDelegations.credentialStatus} IN ('pending', 'submitted')`
        )
      );

    const [rejected] = await db
      .select({ count: count() })
      .from(ngaDelegations)
      .where(
        and(
          eq(ngaDelegations.meetingId, meetingId),
          eq(ngaDelegations.credentialStatus, "rejected")
        )
      );

    const [overridden] = await db
      .select({ count: count() })
      .from(ngaDelegations)
      .where(
        and(
          eq(ngaDelegations.meetingId, meetingId),
          eq(ngaDelegations.credentialStatus, "overridden")
        )
      );

    const [totalPlenaryVotes] = await db
      .select({ sum: sql<number>`COALESCE(SUM(${ngaDelegations.plenaryVotes}), 0)` })
      .from(ngaDelegations)
      .where(
        and(
          eq(ngaDelegations.meetingId, meetingId),
          sql`${ngaDelegations.credentialStatus} IN ('approved', 'overridden')`
        )
      );

    const [totalElectionVotes] = await db
      .select({ sum: sql<number>`COALESCE(SUM(${ngaDelegations.electionVotes}), 0)` })
      .from(ngaDelegations)
      .where(
        and(
          eq(ngaDelegations.meetingId, meetingId),
          sql`${ngaDelegations.credentialStatus} IN ('approved', 'overridden')`
        )
      );

    return {
      totalDelegations: totalDelegations?.count ?? 0,
      approved: approved?.count ?? 0,
      pending: pending?.count ?? 0,
      rejected: rejected?.count ?? 0,
      overridden: overridden?.count ?? 0,
      totalPlenaryVotes: totalPlenaryVotes?.sum ?? 0,
      totalElectionVotes: totalElectionVotes?.sum ?? 0,
    };
  },
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get the financial debt threshold from governance rules.
 * B-8.7.6: Configurable threshold (currently PKR 2000).
 */
async function getFinancialDebtThreshold(): Promise<number> {
  const rule = await resolveEffectiveRule("voting.debt_threshold_pkr");
  if (rule) {
    return (rule.parameters.value as number) ?? 2000;
  }
  return 2000; // Default
}

export default cccEngine;
