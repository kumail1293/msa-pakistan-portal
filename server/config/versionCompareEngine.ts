/**
 * Version Comparison Engine
 *
 * Provides visual diff comparison between governance document versions.
 * Shows: ADDED, REMOVED, MODIFIED, RENAMED, RE-NUMBERED, SUSPENDED, REACTIVATED
 *
 * Usage:
 *   import { compareVersions, getClauseHistory, getVersionTimeline } from "./versionCompareEngine";
 *
 *   const diff = await compareVersions(bylaws2025Id, bylaws2026Id);
 *   // Returns: { added: [...], removed: [...], modified: [...], unchanged: [...] }
 *
 *   const history = await getClauseHistory("BYLAW-8.7.1");
 *   // Returns: [{ version: 1, content: "...", effectiveFrom: ..., ... }, ...]
 */

import { eq, and, desc, asc, sql } from "drizzle-orm";
import {
  governanceDocuments,
  governanceClauses,
} from "../../drizzle/schema.governance_rules";
import { getDb } from "../db";

// ============================================================================
// Types
// ============================================================================

export interface ClauseDiff {
  clauseId: string;
  status: "added" | "removed" | "modified" | "unchanged" | "renamed" | "suspended" | "reactivated";
  oldContent?: string;
  newContent?: string;
  oldTitle?: string;
  newTitle?: string;
  changes?: TextChange[];
  sourcePage?: number;
}

export interface TextChange {
  type: "added" | "removed" | "unchanged";
  text: string;
  oldLine?: number;
  newLine?: number;
}

export interface VersionComparison {
  oldDocument: any;
  newDocument: any;
  summary: {
    totalAdded: number;
    totalRemoved: number;
    totalModified: number;
    totalUnchanged: number;
    totalSuspended: number;
    totalReactivated: number;
  };
  clauses: ClauseDiff[];
  impactAnalysis?: ImpactAnalysis;
}

export interface ImpactAnalysis {
  affectedMembers: string[];
  affectedRoles: string[];
  affectedElections: boolean;
  affectedMeetings: string[];
  affectedWorkflows: string[];
  affectedPermissions: string[];
  affectedVoting: boolean;
  affectedHistoricalRecords: boolean;
}

export interface ClauseHistory {
  clauseId: string;
  versions: Array<{
    version: number;
    content: string;
    title: string;
    status: string;
    effectiveFrom: Date | null;
    effectiveUntil: Date | null;
    documentVersion: string;
  }>;
}

export interface VersionTimeline {
  date: Date;
  eventType: "created" | "modified" | "suspended" | "resumed" | "superseded";
  clauseId: string;
  description: string;
}

// ============================================================================
// Version Comparison
// ============================================================================

/**
 * Compare two versions of a governance document.
 */
export async function compareVersions(
  oldDocumentId: number,
  newDocumentId: number,
  options: { includeImpactAnalysis?: boolean } = {}
): Promise<VersionComparison | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Get both documents
    const [oldDoc] = await db
      .select()
      .from(governanceDocuments)
      .where(eq(governanceDocuments.id, oldDocumentId))
      .limit(1);

    const [newDoc] = await db
      .select()
      .from(governanceDocuments)
      .where(eq(governanceDocuments.id, newDocumentId))
      .limit(1);

    if (!oldDoc || !newDoc) return null;

    // Get clauses for both documents
    const oldClauses = await db
      .select()
      .from(governanceClauses)
      .where(
        and(
          eq(governanceClauses.documentId, oldDocumentId),
          eq(governanceClauses.status, "active")
        )
      )
      .orderBy(governanceClauses.clauseId);

    const newClauses = await db
      .select()
      .from(governanceClauses)
      .where(
        and(
          eq(governanceClauses.documentId, newDocumentId),
          eq(governanceClauses.status, "active")
        )
      )
      .orderBy(governanceClauses.clauseId);

    // Build maps for comparison
    const oldMap = new Map(oldClauses.map((c) => [c.clauseId, c]));
    const newMap = new Map(newClauses.map((c) => [c.clauseId, c]));

    const clauses: ClauseDiff[] = [];
    let totalAdded = 0;
    let totalRemoved = 0;
    let totalModified = 0;
    let totalUnchanged = 0;

    // Find added and modified clauses
    for (const [clauseId, newClause] of Array.from(newMap.entries())) {
      const oldClause = oldMap.get(clauseId);

      if (!oldClause) {
        // Added
        clauses.push({
          clauseId,
          status: "added",
          newContent: newClause.content,
          newTitle: newClause.title,
          sourcePage: newClause.sourcePage ?? undefined,
        });
        totalAdded++;
      } else if (
        oldClause.content !== newClause.content ||
        oldClause.title !== newClause.title
      ) {
        // Modified
        const changes = computeTextChanges(oldClause.content, newClause.content);
        clauses.push({
          clauseId,
          status: "modified",
          oldContent: oldClause.content,
          newContent: newClause.content,
          oldTitle: oldClause.title,
          newTitle: newClause.title,
          changes,
          sourcePage: newClause.sourcePage ?? undefined,
        });
        totalModified++;
      } else {
        // Unchanged
        clauses.push({
          clauseId,
          status: "unchanged",
          oldContent: oldClause.content,
          newContent: newClause.content,
          sourcePage: newClause.sourcePage ?? undefined,
        });
        totalUnchanged++;
      }
    }

    // Find removed clauses
    for (const [clauseId, oldClause] of Array.from(oldMap.entries())) {
      if (!newMap.has(clauseId)) {
        clauses.push({
          clauseId,
          status: "removed",
          oldContent: oldClause.content,
          oldTitle: oldClause.title,
          sourcePage: oldClause.sourcePage ?? undefined,
        });
        totalRemoved++;
      }
    }

    // Sort by clause ID for readability
    clauses.sort((a, b) => a.clauseId.localeCompare(b.clauseId));

    const result: VersionComparison = {
      oldDocument: oldDoc,
      newDocument: newDoc,
      summary: {
        totalAdded,
        totalRemoved,
        totalModified,
        totalUnchanged,
        totalSuspended: 0,
        totalReactivated: 0,
      },
      clauses,
    };

    // Optional impact analysis
    if (options.includeImpactAnalysis) {
      result.impactAnalysis = await analyzeImpact(clauses);
    }

    return result;
  } catch (error) {
    console.error("[VersionCompare] Failed to compare:", error);
    return null;
  }
}

/**
 * Compute text changes between two strings (line-by-line diff).
 */
function computeTextChanges(oldText: string, newText: string): TextChange[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const changes: TextChange[] = [];

  // Simple line-by-line comparison
  const maxLines = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === undefined) {
      // Added line
      changes.push({
        type: "added",
        text: newLine,
        newLine: i + 1,
      });
    } else if (newLine === undefined) {
      // Removed line
      changes.push({
        type: "removed",
        text: oldLine,
        oldLine: i + 1,
      });
    } else if (oldLine === newLine) {
      // Unchanged
      changes.push({
        type: "unchanged",
        text: oldLine,
        oldLine: i + 1,
        newLine: i + 1,
      });
    } else {
      // Modified (show both)
      changes.push({
        type: "removed",
        text: oldLine,
        oldLine: i + 1,
      });
      changes.push({
        type: "added",
        text: newLine,
        newLine: i + 1,
      });
    }
  }

  return changes;
}

/**
 * Analyze impact of changes.
 */
async function analyzeImpact(
  clauses: ClauseDiff[]
): Promise<ImpactAnalysis> {
  const modifiedClauses = clauses.filter(
    (c) => c.status === "modified" || c.status === "added" || c.status === "removed"
  );

  const affectedRoles: string[] = [];
  const affectedMembers: string[] = [];
  let affectedVoting = false;
  let affectedElections = false;
  const affectedMeetings: string[] = [];

  for (const clause of modifiedClauses) {
    const id = clause.clauseId.toLowerCase();

    // Detect affected areas from clause ID
    if (id.includes("voting") || id.includes("8.7")) {
      affectedVoting = true;
    }
    if (id.includes("election") || id.includes("13")) {
      affectedElections = true;
    }
    if (id.includes("nga") || id.includes("8.1")) {
      affectedMeetings.push("NGA");
    }
    if (id.includes("sga") || id.includes("8.2")) {
      affectedMeetings.push("SGA");
    }
    if (id.includes("eb") || id.includes("11")) {
      affectedRoles.push("Executive Board");
    }
    if (id.includes("supco") || id.includes("9.3")) {
      affectedRoles.push("Supervising Council");
    }
    if (id.includes("membership") || id.includes("6")) {
      affectedMembers.push("Members");
    }
    if (id.includes("president")) {
      affectedRoles.push("President");
    }
  }

  return {
    affectedRoles: Array.from(new Set(affectedRoles)),
    affectedMembers: Array.from(new Set(affectedMembers)),
    affectedElections,
    affectedMeetings: Array.from(new Set(affectedMeetings)),
    affectedWorkflows: [],
    affectedPermissions: [],
    affectedVoting,
    affectedHistoricalRecords: affectedVoting || affectedElections,
  };
}

// ============================================================================
// Clause History
// ============================================================================

/**
 * Get the complete version history of a clause.
 */
export async function getClauseHistory(
  clauseId: string
): Promise<ClauseHistory | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const versions = await db
      .select({
        version: governanceClauses.version,
        content: governanceClauses.content,
        title: governanceClauses.title,
        status: governanceClauses.status,
        effectiveFrom: governanceClauses.effectiveFrom,
        effectiveUntil: governanceClauses.effectiveUntil,
        documentId: governanceClauses.documentId,
      })
      .from(governanceClauses)
      .where(eq(governanceClauses.clauseId, clauseId))
      .orderBy(asc(governanceClauses.version));

    if (versions.length === 0) return null;

    // Get document versions for each clause version
    const enrichedVersions = await Promise.all(
      versions.map(async (v) => {
        const [doc] = await db
          .select({ version: governanceDocuments.version })
          .from(governanceDocuments)
          .where(eq(governanceDocuments.id, v.documentId))
          .limit(1);

        return {
          version: v.version,
          content: v.content,
          title: v.title,
          status: v.status,
          effectiveFrom: v.effectiveFrom,
          effectiveUntil: v.effectiveUntil,
          documentVersion: doc?.version ?? "unknown",
        };
      })
    );

    return {
      clauseId,
      versions: enrichedVersions,
    };
  } catch (error) {
    console.error("[VersionCompare] Failed to get history:", error);
    return null;
  }
}

// ============================================================================
// Version Timeline
// ============================================================================

/**
 * Get a timeline of all changes to a clause.
 */
export async function getVersionTimeline(
  clauseId: string
): Promise<VersionTimeline[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const versions = await db
      .select()
      .from(governanceClauses)
      .where(eq(governanceClauses.clauseId, clauseId))
      .orderBy(asc(governanceClauses.version));

    const timeline: VersionTimeline[] = [];

    for (const version of versions) {
      if (version.effectiveFrom) {
        let eventType: VersionTimeline["eventType"] = "created";
        let description = `Clause created (v${version.version})`;

        if (version.status === "superseded") {
          eventType = "superseded";
          description = `Clause superseded by newer version`;
        } else if (version.status === "suspended") {
          eventType = "suspended";
          description = `Clause suspended`;
        } else if (version.version > 1) {
          eventType = "modified";
          description = `Clause modified (v${version.version})`;
        }

        timeline.push({
          date: new Date(version.effectiveFrom),
          eventType,
          clauseId,
          description,
        });
      }

      if (version.effectiveUntil) {
        timeline.push({
          date: new Date(version.effectiveUntil),
          eventType: version.status === "suspended" ? "resumed" : "superseded",
          clauseId,
          description: version.status === "suspended"
            ? "Suspension ended"
            : "Clause superseded by newer version",
        });
      }
    }

    return timeline.sort((a, b) => a.date.getTime() - b.date.getTime());
  } catch (error) {
    console.error("[VersionCompare] Failed to get timeline:", error);
    return [];
  }
}

// ============================================================================
// Format Diff for Display
// ============================================================================

/**
 * Format a version comparison as a readable report.
 */
export function formatComparisonReport(comparison: VersionComparison): string {
  const { oldDocument, newDocument, summary, clauses } = comparison;

  let report = `# Version Comparison Report\n\n`;
  report += `## ${oldDocument.title} (${oldDocument.version})\n`;
  report += `vs\n`;
  report += `## ${newDocument.title} (${newDocument.version})\n\n`;

  report += `### Summary\n`;
  report += `| Status | Count |\n`;
  report += `|--------|-------|\n`;
  report += `| Added | ${summary.totalAdded} |\n`;
  report += `| Removed | ${summary.totalRemoved} |\n`;
  report += `| Modified | ${summary.totalModified} |\n`;
  report += `| Unchanged | ${summary.totalUnchanged} |\n\n`;

  // Group by status
  const added = clauses.filter((c) => c.status === "added");
  const removed = clauses.filter((c) => c.status === "removed");
  const modified = clauses.filter((c) => c.status === "modified");

  if (added.length > 0) {
    report += `### Added Clauses\n\n`;
    for (const clause of added) {
      report += `#### ${clause.clauseId}\n`;
      report += `**${clause.newTitle}**\n\n`;
      report += `\`\`\`\n${clause.newContent}\n\`\`\`\n\n`;
    }
  }

  if (removed.length > 0) {
    report += `### Removed Clauses\n\n`;
    for (const clause of removed) {
      report += `#### ${clause.clauseId}\n`;
      report += `**${clause.oldTitle}**\n\n`;
      report += `\`\`\`\n${clause.oldContent}\n\`\`\`\n\n`;
    }
  }

  if (modified.length > 0) {
    report += `### Modified Clauses\n\n`;
    for (const clause of modified) {
      report += `#### ${clause.clauseId}\n`;
      report += `**${clause.oldTitle}** → **${clause.newTitle}**\n\n`;

      if (clause.changes) {
        for (const change of clause.changes) {
          if (change.type === "added") {
            report += `+ ${change.text}\n`;
          } else if (change.type === "removed") {
            report += `- ${change.text}\n`;
          }
        }
      }
      report += `\n`;
    }
  }

  if (comparison.impactAnalysis) {
    const impact = comparison.impactAnalysis;
    report += `### Impact Analysis\n\n`;
    if (impact.affectedVoting) report += `- ⚠️ **Voting rules affected**\n`;
    if (impact.affectedElections) report += `- ⚠️ **Election rules affected**\n`;
    if (impact.affectedRoles.length > 0) report += `- Roles affected: ${impact.affectedRoles.join(", ")}\n`;
    if (impact.affectedMeetings.length > 0) report += `- Meetings affected: ${impact.affectedMeetings.join(", ")}\n`;
    if (impact.affectedHistoricalRecords) report += `- ⚠️ **Historical records may be affected**\n`;
  }

  return report;
}

/**
 * Format a clause history as a readable report.
 */
export function formatClauseHistoryReport(history: ClauseHistory): string {
  let report = `# Clause History: ${history.clauseId}\n\n`;

  for (const version of history.versions) {
    report += `## Version ${version.version} (${version.documentVersion})\n`;
    report += `- Status: ${version.status}\n`;
    report += `- Effective: ${version.effectiveFrom?.toISOString() ?? "N/A"}`;
    if (version.effectiveUntil) {
      report += ` → ${version.effectiveUntil.toISOString()}`;
    }
    report += `\n\n`;
    report += `\`\`\`\n${version.content}\n\`\`\`\n\n`;
  }

  return report;
}
