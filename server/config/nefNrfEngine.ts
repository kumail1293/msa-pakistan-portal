/**
 * NEF/NRF Engine — Per Bylaws §16 (Activities)
 *
 * NEF = National Enrollment Form (§16.1-16.3)
 *   - Activities are proposed/enrolled through the NEF
 *   - Disseminated by the National VPA and team
 *   - Must be submitted ≥14 days before activity start (§16.1)
 *   - Must be filled through official Local VPA email (§16.3)
 *
 * NRF = National Report Form (§16.11-16.12)
 *   - Activities reported after successful completion
 *   - Disseminated by the National VPA and team
 *   - Must be filled through official Local VPA email (§16.12)
 *   - Required before certificates can be issued (§16.10)
 *
 * Activity Levels (§16.6-16.9):
 *   - local: 1 LC or ≤2 LC collaboration
 *   - national: EBTO member involved, ≥3 LCs, or national team proposal
 *   - regional: 2 NMOs in same region
 *   - international: organizations in different regions
 *
 * Standing Committees (§10.2):
 *   SCOPH, SCORA, SCOME, SCORP, SCOPE, SCORE
 *
 * VPA Responsibilities (§11.5):
 *   - Review NEF within 14 days (§11.5.15)
 *   - Ensure NRF filled after activity completion (§11.5.19)
 *   - Process certificates within 15 days after NRF (§11.5.11)
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { activities, activityParticipants, activityReports } from "../../drizzle/schema.modules";

export const nefNrfEngine = {
  // ── NEF (National Enrollment Form) ──────────────────────────────

  /** Submit an NEF — creates or updates an activity enrollment (§16.1-16.3) */
  submitNef: async (input: {
    activityId?: number; // if updating existing draft
    title: string;
    description: string;
    activityLevel: "local" | "national" | "regional" | "international";
    standingCommittee?: string;
    coordinators?: number[];
    startDate?: Date;
    endDate?: Date;
    venue?: string;
    city?: string;
    mode?: "in_person" | "online" | "hybrid";
    maxParticipants?: number;
    budget?: number;
    submittedById: number;
    organizationId?: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      if (input.activityId) {
        // Update existing draft NEF
        await db.update(activities).set({
          title: input.title,
          description: input.description,
          activityLevel: input.activityLevel,
          standingCommittee: input.standingCommittee,
          coordinators: input.coordinators as any,
          startDate: input.startDate,
          endDate: input.endDate,
          venue: input.venue,
          city: input.city,
          mode: input.mode,
          maxParticipants: input.maxParticipants,
          budget: input.budget,
          nefSubmittedAt: new Date(),
          nefSubmittedBy: input.submittedById,
          status: "submitted",
          updatedAt: new Date(),
        }).where(eq(activities.id, input.activityId));
        return { id: input.activityId };
      }

      // Create new NEF submission
      const [result] = await db.insert(activities).values({
        title: input.title,
        description: input.description,
        type: "activity",
        category: "nef",
        activityLevel: input.activityLevel,
        standingCommittee: input.standingCommittee,
        coordinators: input.coordinators as any,
        startDate: input.startDate,
        endDate: input.endDate,
        venue: input.venue,
        city: input.city,
        mode: input.mode,
        maxParticipants: input.maxParticipants,
        budget: input.budget,
        nefSubmittedAt: new Date(),
        nefSubmittedBy: input.submittedById,
        status: "submitted",
        organizedBy: input.submittedById,
        createdBy: input.submittedById,
        organizationId: input.organizationId,
      } as any);
      return { id: Number((result as any)[0].insertId) };
    } catch {
      return null;
    }
  },

  /** List NEF submissions (activities in NEF lifecycle) */
  listNefSubmissions: async (options: {
    status?: string;
    activityLevel?: string;
    standingCommittee?: string;
    submittedById?: number;
    limit?: number;
  } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      // NEF submissions are activities in submission/approval lifecycle
      conditions.push(sql`${activities.status} IN ('draft', 'submitted', 'under_review', 'approved', 'rejected')`);
      if (options.status) conditions.push(eq(activities.status, options.status as any));
      if (options.activityLevel) conditions.push(eq(activities.activityLevel, options.activityLevel as any));
      if (options.standingCommittee) conditions.push(eq(activities.standingCommittee, options.standingCommittee));
      if (options.submittedById) conditions.push(eq(activities.nefSubmittedBy, options.submittedById));
      const where = and(...conditions);
      return db.select().from(activities).where(where).orderBy(desc(activities.nefSubmittedAt)).limit(options.limit ?? 50);
    } catch {
      return [];
    }
  },

  /** Get a single NEF submission */
  getNefSubmission: async (activityId: number): Promise<any | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [activity] = await db.select().from(activities).where(eq(activities.id, activityId)).limit(1);
      return activity ?? null;
    } catch {
      return null;
    }
  },

  /** VPA reviews and decides on an NEF submission (§11.5.15) — must decide within 14 days */
  reviewNef: async (
    activityId: number,
    decision: "accepted" | "rejected" | "revision_needed",
    reviewedById: number,
    notes?: string
  ): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      const status = decision === "accepted" ? "approved" : decision === "rejected" ? "rejected" : "under_review";
      await db.update(activities).set({
        status: status as any,
        nefDecision: decision,
        nefDecisionNotes: notes,
        nefDecisionAt: new Date(),
        nefApprovedAt: decision === "accepted" ? new Date() : undefined,
        approvedBy: reviewedById,
        updatedAt: new Date(),
      }).where(eq(activities.id, activityId));
      return true;
    } catch {
      return false;
    }
  },

  // ── NRF (National Report Form) ──────────────────────────────────

  /** Submit an NRF — report on completed activity (§16.11-16.12) */
  submitNrf: async (input: {
    activityId: number;
    content: {
      summary: string;
      participants?: number;
      impact?: string;
      photos?: string[];
      feedback?: string;
      outcomes?: string;
      budgetActual?: number;
      challenges?: string;
      recommendations?: string;
    };
    submittedById: number;
  }): Promise<{ id: number } | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      // Create NRF report in activity_reports table
      const [result] = await db.insert(activityReports).values({
        activityId: input.activityId,
        reportType: "nrf",
        content: input.content as any,
        submittedBy: input.submittedById,
        submittedAt: new Date(),
        status: "submitted",
      });

      // Update activity with NRF tracking
      await db.update(activities).set({
        nrfSubmittedAt: new Date(),
        nrfSubmittedBy: input.submittedById,
        status: "reporting",
        updatedAt: new Date(),
      }).where(eq(activities.id, input.activityId));

      return { id: Number((result as any)[0].insertId) };
    } catch {
      return null;
    }
  },

  /** List NRF reports */
  listNrfReports: async (options: {
    activityId?: number;
    status?: string;
    submittedById?: number;
    limit?: number;
  } = {}): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const conditions = [];
      conditions.push(eq(activityReports.reportType, "nrf"));
      if (options.activityId) conditions.push(eq(activityReports.activityId, options.activityId));
      if (options.status) conditions.push(eq(activityReports.status, options.status as any));
      if (options.submittedById) conditions.push(eq(activityReports.submittedBy, options.submittedById));
      const where = and(...conditions);
      return db.select().from(activityReports).where(where).orderBy(desc(activityReports.submittedAt)).limit(options.limit ?? 50);
    } catch {
      return [];
    }
  },

  /** Get a single NRF report */
  getNrfReport: async (reportId: number): Promise<any | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const [report] = await db.select().from(activityReports).where(eq(activityReports.id, reportId)).limit(1);
      return report ?? null;
    } catch {
      return null;
    }
  },

  /** VPA approves NRF — triggers certificate eligibility (§16.10, §11.5.11) */
  approveNrf: async (
    reportId: number,
    activityId: number,
    approvedById: number
  ): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      // Approve the report
      await db.update(activityReports).set({
        status: "approved",
      }).where(eq(activityReports.id, reportId));

      // Update activity status
      await db.update(activities).set({
        nrfApprovedAt: new Date(),
        status: "evaluation",
        updatedAt: new Date(),
      }).where(eq(activities.id, activityId));

      return true;
    } catch {
      return false;
    }
  },

  /** Issue certificate after NRF approved (§16.10) */
  issueCertificate: async (activityId: number): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(activities).set({
        certificateIssued: true,
        certificateIssuedAt: new Date(),
        status: "completed",
        updatedAt: new Date(),
      }).where(eq(activities.id, activityId));
      return true;
    } catch {
      return false;
    }
  },

  // ── Budget Approval (§16.14) ────────────────────────────────────

  /** Approve budget for activity requiring national treasury funds (§16.14) */
  approveBudget: async (
    activityId: number,
    approvedById: number
  ): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      await db.update(activities).set({
        budgetApprovedBy: approvedById,
        budgetApprovedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(activities.id, activityId));
      return true;
    } catch {
      return false;
    }
  },

  // ── Stats ────────────────────────────────────────────────────────

  /** Get NEF/NRF stats */
  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb();
    if (!db) return {};
    try {
      // Count by status
      const statusCounts = await db
        .select({ status: activities.status, count: sql<number>`count(*)` })
        .from(activities)
        .groupBy(activities.status);

      // Count by activity level
      const levelCounts = await db
        .select({ level: activities.activityLevel, count: sql<number>`count(*)` })
        .from(activities)
        .groupBy(activities.activityLevel);

      // Count by standing committee
      const scCounts = await db
        .select({ sc: activities.standingCommittee, count: sql<number>`count(*)` })
        .from(activities)
        .where(sql`${activities.standingCommittee} IS NOT NULL`)
        .groupBy(activities.standingCommittee);

      // Count NRF reports
      const nrfCounts = await db
        .select({ status: activityReports.status, count: sql<number>`count(*)` })
        .from(activityReports)
        .where(eq(activityReports.reportType, "nrf"))
        .groupBy(activityReports.status);

      const result: Record<string, number> = {};
      for (const row of statusCounts) result[`status_${row.status}`] = row.count;
      for (const row of levelCounts) result[`level_${row.level ?? "unknown"}`] = row.count;
      for (const row of scCounts) result[`sc_${row.sc}`] = row.count;
      for (const row of nrfCounts) result[`nrf_${row.status}`] = row.count;

      // Total counts
      const [totalNef] = await db.select({ count: sql<number>`count(*)` }).from(activities)
        .where(sql`${activities.status} IN ('draft', 'submitted', 'under_review', 'approved', 'rejected')`);
      const [totalNrf] = await db.select({ count: sql<number>`count(*)` }).from(activityReports)
        .where(eq(activityReports.reportType, "nrf"));
      const [pendingReview] = await db.select({ count: sql<number>`count(*)` }).from(activities)
        .where(eq(activities.status, "submitted"));
      const [certificatesIssued] = await db.select({ count: sql<number>`count(*)` }).from(activities)
        .where(eq(activities.certificateIssued, true));

      result.totalNef = totalNef?.count ?? 0;
      result.totalNrf = totalNrf?.count ?? 0;
      result.pendingReview = pendingReview?.count ?? 0;
      result.certificatesIssued = certificatesIssued?.count ?? 0;

      return result;
    } catch {
      return {};
    }
  },

  /** Get member's NEF submissions */
  getMyNefSubmissions: async (userId: number): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      return db.select().from(activities)
        .where(eq(activities.nefSubmittedBy, userId))
        .orderBy(desc(activities.nefSubmittedAt))
        .limit(50);
    } catch {
      return [];
    }
  },

  /** Get member's NRF reports */
  getMyNrfReports: async (userId: number): Promise<any[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      return db.select().from(activityReports)
        .where(and(
          eq(activityReports.reportType, "nrf"),
          eq(activityReports.submittedBy, userId),
        ))
        .orderBy(desc(activityReports.submittedAt))
        .limit(50);
    } catch {
      return [];
    }
  },

  /** Get member's activity summary */
  getMemberSummary: async (userId: number): Promise<{
    totalNef: number;
    approvedNef: number;
    totalNrf: number;
    certificatesEarned: number;
    pendingNef: number;
  }> => {
    const db = getDb();
    if (!db) return { totalNef: 0, approvedNef: 0, totalNrf: 0, certificatesEarned: 0, pendingNef: 0 };
    try {
      const filter = eq(activities.nefSubmittedBy, userId);
      const [totalNef] = await db.select({ count: sql<number>`count(*)` }).from(activities).where(filter);
      const [approvedNef] = await db.select({ count: sql<number>`count(*)` }).from(activities).where(and(filter, eq(activities.status, "approved")));
      const [pendingNef] = await db.select({ count: sql<number>`count(*)` }).from(activities).where(and(filter, sql`${activities.status} IN ('submitted', 'under_review')`));
      const [certificates] = await db.select({ count: sql<number>`count(*)` }).from(activities).where(and(filter, eq(activities.certificateIssued, true)));
      const [nrfCount] = await db.select({ count: sql<number>`count(*)` }).from(activityReports).where(and(
        eq(activityReports.reportType, "nrf"),
        eq(activityReports.submittedBy, userId),
      ));
      return {
        totalNef: totalNef?.count ?? 0,
        approvedNef: approvedNef?.count ?? 0,
        totalNrf: nrfCount?.count ?? 0,
        certificatesEarned: certificates?.count ?? 0,
        pendingNef: pendingNef?.count ?? 0,
      };
    } catch {
      return { totalNef: 0, approvedNef: 0, totalNrf: 0, certificatesEarned: 0, pendingNef: 0 };
    }
  },
};
