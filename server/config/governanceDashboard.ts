/**
 * Governance Dashboard Service
 *
 * Aggregates data from NGA Engine, SGA Engine, Governance Calendar,
 * Governance Rules Engine, and Configuration Studio to provide
 * a comprehensive governance health overview for administrators.
 *
 * Sections:
 *   - Active NGA/SGA status with lifecycle progress
 *   - Upcoming deadlines (BCP, credentials, candidacy, term dates)
 *   - Active governance rules summary
 *   - Policy conflict alerts
 *   - Configuration health (modified vs default parameters)
 *   - Recent governance activity (audit trail)
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  governanceRules,
  governanceDocuments,
} from "../../drizzle/schema.governance_rules";
import {
  ngaMeetings,
  sgaMeetings,
  ngaDelegations,
} from "../../drizzle/schema.nga";
import { logAuditEvent } from "./auditService";
import {
  GOVERNANCE_CONFIG_DEFINITIONS,
} from "./organizationConfigStudio";

// ============================================================================
// Types
// ============================================================================

export interface DashboardData {
  summary: GovernanceSummary;
  ngaStatus: NGAStatusOverview[];
  sgaStatus: SGAStatusOverview[];
  upcomingDeadlines: DeadlineItem[];
  rulesSummary: RulesSummary;
  configHealth: ConfigHealthSummary;
}

export interface GovernanceSummary {
  activeNGAs: number;
  activeSGAs: number;
  totalDelegations: number;
  activeRules: number;
  governanceDocuments: number;
  overdueDeadlines: number;
}

export interface NGAStatusOverview {
  id: number;
  title: string;
  edition: string | null;
  status: string;
  mode: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  venue: string | null;
  city: string | null;
  delegationCount: number;
  quorumRequired: number | null;
  quorumMet: boolean;
  daysUntilStart: number | null;
  lifecycleProgress: number; // 0-100 percentage
  phase: "upcoming" | "in_progress" | "completed";
}

export interface SGAStatusOverview {
  id: number;
  title: string;
  reason: string;
  status: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  ebtoApproved: boolean;
  supcoApproved: boolean;
  delegationCount: number;
  daysUntilStart: number | null;
}

export interface DeadlineItem {
  id: string;
  type: string;
  title: string;
  deadline: Date;
  daysRemaining: number;
  priority: "critical" | "high" | "medium" | "low";
  relatedEntity: string;
  isOverdue: boolean;
}

export interface RulesSummary {
  totalActiveRules: number;
  byLevel: Array<{
    level: string;
    count: number;
  }>;
  recentlyUpdated: Array<{
    ruleKey: string;
    ruleType: string;
    updatedAt: Date;
  }>;
}

export interface ConfigHealthSummary {
  totalParameters: number;
  modifiedFromDefault: number;
  unchangedCount: number;
  modificationRate: number; // percentage
}

// ============================================================================
// NGA Lifecycle Phases
// ============================================================================

const NGA_LIFECYCLE_TOTAL = 15;

const NGA_STATUS_TO_PHASE: Record<string, "upcoming" | "in_progress" | "completed"> = {
  planning: "upcoming",
  organizing_committee: "upcoming",
  call_for_participation: "upcoming",
  registration: "upcoming",
  credentialing: "upcoming",
  preparation: "upcoming",
  opening: "in_progress",
  plenary: "in_progress",
  committees: "in_progress",
  elections: "in_progress",
  reports: "in_progress",
  bylaw_changes: "in_progress",
  closing: "in_progress",
  certification: "completed",
  archive: "completed",
};

const NGA_STATUS_ORDER = [
  "planning", "organizing_committee", "call_for_participation",
  "registration", "credentialing", "preparation",
  "opening", "plenary", "committees", "elections", "reports",
  "bylaw_changes", "closing", "certification", "archive",
];

function getLifecycleProgress(status: string): number {
  const idx = NGA_STATUS_ORDER.indexOf(status);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / NGA_LIFECYCLE_TOTAL) * 100);
}

// ============================================================================
// Dashboard Service
// ============================================================================

export const governanceDashboard = {
  /**
   * Get complete governance dashboard data.
   */
  getDashboardData: async (): Promise<DashboardData> => {
    const [
      summary,
      ngaStatus,
      sgaStatus,
      upcomingDeadlines,
      rulesSummary,
      configHealth,
    ] = await Promise.all([
      governanceDashboard.getSummary(),
      governanceDashboard.getNGAStatus(),
      governanceDashboard.getSGAStatus(),
      governanceDashboard.getUpcomingDeadlines(),
      governanceDashboard.getRulesSummary(),
      governanceDashboard.getConfigHealth(),
    ]);

    return {
      summary,
      ngaStatus,
      sgaStatus,
      upcomingDeadlines,
      rulesSummary,
      configHealth,
    };
  },

  /**
   * Get governance summary metrics.
   */
  getSummary: async (): Promise<GovernanceSummary> => {
    const db = getDb();

    let activeNGAs = 0;
    let activeSGAs = 0;
    let totalDelegations = 0;
    let activeRules = 0;
    let governanceDocCount = 0;

    if (db) {
      try {
        const [ngaCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(ngaMeetings)
          .where(sql`${ngaMeetings.status} NOT IN ('archive', 'certification')`);

        const [sgaCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(sgaMeetings)
          .where(sql`${sgaMeetings.status} NOT IN ('completed', 'cancelled')`);

        const [delCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(ngaDelegations);

        const [ruleCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(governanceRules)
          .where(eq(governanceRules.status, "active"));

        const [docCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(governanceDocuments as any)
          .where(eq((governanceDocuments as any).status, "effective"));

        activeNGAs = ngaCount?.count ?? 0;
        activeSGAs = sgaCount?.count ?? 0;
        totalDelegations = delCount?.count ?? 0;
        activeRules = ruleCount?.count ?? 0;
        governanceDocCount = docCount?.count ?? 0;
      } catch {
        // Tables may not exist yet
      }
    }

    // Count overdue deadlines
    const deadlines = await governanceDashboard.getUpcomingDeadlines();
    const overdueDeadlines = deadlines.filter((d) => d.isOverdue).length;

    return {
      activeNGAs,
      activeSGAs,
      totalDelegations,
      activeRules,
      governanceDocuments: governanceDocCount,
      overdueDeadlines,
    };
  },

  /**
   * Get NGA status overviews with lifecycle progress.
   */
  getNGAStatus: async (): Promise<NGAStatusOverview[]> => {
    const db = getDb();
    if (!db) return [];

    try {
      const meetings = await db
        .select()
        .from(ngaMeetings)
        .orderBy(desc(ngaMeetings.scheduledStart));

      const results: NGAStatusOverview[] = [];
      const now = new Date();

      for (const m of meetings) {
        // Get delegation count
        const [delCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(ngaDelegations)
          .where(eq(ngaDelegations.meetingId, m.id));

        const start = m.scheduledStart ?? new Date();
        const end = m.scheduledEnd ?? new Date();
        const daysUntilStart = Math.ceil(
          (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        let phase: "upcoming" | "in_progress" | "completed";
        if (daysUntilStart > 0) phase = "upcoming";
        else if (now <= end) phase = "in_progress";
        else phase = "completed";

        results.push({
          id: m.id,
          title: m.title,
          edition: m.edition,
          status: m.status as string,
          mode: m.mode as string,
          scheduledStart: start,
          scheduledEnd: end,
          venue: m.venue,
          city: m.city,
          delegationCount: delCount?.count ?? 0,
          quorumRequired: m.quorumRequired,
          quorumMet: m.quorumMet ?? false,
          daysUntilStart: daysUntilStart > 0 ? daysUntilStart : null,
          lifecycleProgress: getLifecycleProgress(m.status as string),
          phase,
        });
      }

      return results;
    } catch {
      return [];
    }
  },

  /**
   * Get SGA status overviews.
   */
  getSGAStatus: async (): Promise<SGAStatusOverview[]> => {
    const db = getDb();
    if (!db) return [];

    try {
      const meetings = await db
        .select()
        .from(sgaMeetings)
        .orderBy(desc(sgaMeetings.scheduledStart));

      const now = new Date();

      return meetings.map((m) => {
        const start = m.scheduledStart ?? new Date();
        const daysUntilStart = Math.ceil(
          (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          id: m.id,
          title: m.title,
          reason: m.reason ?? "",
          status: m.status as string,
          scheduledStart: start,
          scheduledEnd: m.scheduledEnd ?? start,
          ebtoApproved: m.ebtoApproved ?? false,
          supcoApproved: m.supcoApproved ?? false,
          delegationCount: 0,
          daysUntilStart: daysUntilStart > 0 ? daysUntilStart : null,
        };
      });
    } catch {
      return [];
    }
  },

  /**
   * Get upcoming governance deadlines.
   */
  getUpcomingDeadlines: async (): Promise<DeadlineItem[]> => {
    const db = getDb();
    const now = new Date();
    const deadlines: DeadlineItem[] = [];

    if (db) {
      try {
        // NGA BCP deadlines (3 weeks before NGA)
        const ngas = await db
          .select()
          .from(ngaMeetings)
          .where(sql`${ngaMeetings.status} NOT IN ('archive', 'certification')`);

        for (const nga of ngas) {
          if (nga.scheduledStart) {
            // BCP deadline: 3 weeks before
            const bcpDeadline = new Date(nga.scheduledStart);
            bcpDeadline.setDate(bcpDeadline.getDate() - 21);
            const bcpDays = Math.ceil(
              (bcpDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            deadlines.push({
              id: `bcp-${nga.id}`,
              type: "bcp_deadline",
              title: `BCP Submission — ${nga.title}`,
              deadline: bcpDeadline,
              daysRemaining: bcpDays,
              priority: bcpDays <= 0 ? "critical" : bcpDays <= 7 ? "critical" : bcpDays <= 14 ? "high" : "medium",
              relatedEntity: `NGA #${nga.id}`,
              isOverdue: bcpDays < 0,
            });

            // Credential deadline: 1 week before
            const credDeadline = new Date(nga.scheduledStart);
            credDeadline.setDate(credDeadline.getDate() - 7);
            const credDays = Math.ceil(
              (credDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            deadlines.push({
              id: `cred-${nga.id}`,
              type: "credential_deadline",
              title: `Credential Submission — ${nga.title}`,
              deadline: credDeadline,
              daysRemaining: credDays,
              priority: credDays <= 0 ? "critical" : credDays <= 3 ? "critical" : "high",
              relatedEntity: `NGA #${nga.id}`,
              isOverdue: credDays < 0,
            });

            // Candidacy deadline: 7 days before NGA
            const candDeadline = new Date(nga.scheduledStart);
            candDeadline.setDate(candDeadline.getDate() - 7);
            const candDays = Math.ceil(
              (candDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            deadlines.push({
              id: `cand-${nga.id}`,
              type: "candidacy_deadline",
              title: `Candidate Nominations — ${nga.title}`,
              deadline: candDeadline,
              daysRemaining: candDays,
              priority: candDays <= 0 ? "critical" : candDays <= 7 ? "high" : "medium",
              relatedEntity: `NGA #${nga.id}`,
              isOverdue: candDays < 0,
            });
          }
        }
      } catch {
        // Tables may not exist
      }
    }

    // Term dates (annual, September 1)
    const currentYear = now.getFullYear();
    const termStart = new Date(currentYear, 8, 1); // September
    const termEnd = new Date(currentYear, 7, 31); // August

    if (termEnd > now) {
      const termEndDays = Math.ceil(
        (termEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      deadlines.push({
        id: `term-end-${currentYear}`,
        type: "term_end",
        title: `Term ${currentYear - 1}-${currentYear} Ends`,
        deadline: termEnd,
        daysRemaining: termEndDays,
        priority: termEndDays <= 30 ? "high" : "medium",
        relatedEntity: "Term",
        isOverdue: false,
      });
    }

    const nextTermStart = new Date(currentYear + 1, 8, 1);
    const nextTermDays = Math.ceil(
      (nextTermStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    deadlines.push({
      id: `term-start-${currentYear + 1}`,
      type: "term_start",
      title: `Term ${currentYear + 1}-${currentYear + 2} Starts`,
      deadline: nextTermStart,
      daysRemaining: nextTermDays,
      priority: "medium",
      relatedEntity: "Term",
      isOverdue: false,
    });

    return deadlines.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  },

  /**
   * Get governance rules summary.
   */
  getRulesSummary: async (): Promise<RulesSummary> => {
    const db = getDb();
    const result: RulesSummary = {
      totalActiveRules: 0,
      byLevel: [],
      recentlyUpdated: [],
    };

    if (!db) return result;

    try {
      const [totalResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(governanceRules)
        .where(eq(governanceRules.status, "active"));

      result.totalActiveRules = totalResult?.count ?? 0;

      // Count by level
      const levels = ["constitution", "bylaws", "annex", "iog", "policy", "procedure", "local_rule"];
      for (const level of levels) {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(governanceRules)
          .where(
            and(
              eq(governanceRules.status, "active"),
              eq(governanceRules.ruleType, level)
            )
          );

        if ((countResult?.count ?? 0) > 0) {
          result.byLevel.push({ level, count: countResult!.count });
        }
      }

      // Recently updated rules
      const recentRules = await db
        .select({
          ruleKey: governanceRules.ruleKey,
          ruleType: governanceRules.ruleType,
          updatedAt: governanceRules.updatedAt,
        })
        .from(governanceRules)
        .orderBy(desc(governanceRules.updatedAt))
        .limit(5);

      result.recentlyUpdated = recentRules.map((r) => ({
        ruleKey: r.ruleKey,
        ruleType: r.ruleType ?? "unknown",
        updatedAt: r.updatedAt ?? new Date(),
      }));
    } catch {
      // Tables may not exist
    }

    return result;
  },

  /**
   * Get configuration health summary.
   */
  getConfigHealth: async (): Promise<ConfigHealthSummary> => {
    const total = GOVERNANCE_CONFIG_DEFINITIONS.length;
    let modified = 0;

    const db = getDb();
    if (db) {
      try {
        const keys = GOVERNANCE_CONFIG_DEFINITIONS.map((d) => d.key);
        if (keys.length > 0) {
          const rows = await db.execute(sql`
            SELECT \`key\`, \`value\` FROM \`configuration\`
            WHERE \`key\` IN (${sql.join(keys.map((k) => sql`${k}`), sql`, `)})
          `);

          const dbMap = new Map<string, string>();
          for (const row of (rows as any[])) {
            dbMap.set(row.key, row.value);
          }

          for (const def of GOVERNANCE_CONFIG_DEFINITIONS) {
            const dbValue = dbMap.get(def.key);
            if (dbValue !== undefined && dbValue !== def.defaultValue) {
              modified++;
            }
          }
        }
      } catch {
        // Config table may not exist
      }
    }

    return {
      totalParameters: total,
      modifiedFromDefault: modified,
      unchangedCount: total - modified,
      modificationRate: total > 0 ? Math.round((modified / total) * 100) : 0,
    };
  },
};

export default governanceDashboard;
