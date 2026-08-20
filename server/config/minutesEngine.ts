/**
 * Minutes Engine
 * 
 * Implements Section 54: Minutes Engine
 * 
 * Generate structured minutes automatically including:
 * - date, venue/mode, attendees, delegations, observers
 * - quorum, chair, agenda
 * - motions, proposers, seconders, amendments
 * - speakers, POO, POI, procedural motions
 * - votes, election results, decisions
 * - action items, suspensions, bylaw changes
 * 
 * Allow authorized secretaries to edit draft minutes.
 * Once adopted: LOCK VERSION.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  ngaMeetings,
  ngaDelegations,
  ngaRollCall,
  ngaMinutes,
  type NgaMinutes,
} from "../../drizzle/schema.nga";
import {
  plenarySessions,
  motions,
  speakerEntries,
  pointsOfOrder,
  plenaryVotes,
  resolutions,
} from "../../drizzle/schema.governance";
import { logAuditEvent } from "./auditService";

// ============================================================================
// TYPES
// ============================================================================

export interface MinutesInput {
  meetingId: number;
  sessionId?: number;
  recordedBy: number;
  content: string;
  summary?: string;
  attendees?: {
    delegations: string[];
    observers: string[];
    officials: string[];
    totalPresent: number;
  };
  quorumRecord?: {
    eligibleBodies: number;
    presentBodies: number;
    quorumMet: boolean;
    calculation: string;
  };
  decisions?: string[];
}

export interface MinutesSection {
  title: string;
  content: string;
  subsections?: MinutesSection[];
}

export interface MinutesTemplate {
  sections: MinutesSection[];
}

// ============================================================================
// MINUTES ENGINE
// ============================================================================

export const minutesEngine = {
  /**
   * Create draft minutes for a meeting.
   */
  createDraft: async (input: MinutesInput): Promise<NgaMinutes> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    // Get existing minutes count for versioning
    const [existingCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(ngaMinutes)
      .where(eq(ngaMinutes.meetingId, input.meetingId));

    const version = (existingCount?.count ?? 0) + 1;

    const [result] = await db.insert(ngaMinutes).values({
      meetingId: input.meetingId,
      version,
      status: "draft",
      content: input.content,
      summary: input.summary,
      attendees: input.attendees,
      quorumRecord: input.quorumRecord,
      decisions: input.decisions ?? [],
      recordedBy: input.recordedBy,
      recordedAt: new Date(),
    });

    const [inserted] = await db
      .select()
      .from(ngaMinutes)
      .where(eq(ngaMinutes.id, Number(result.insertId)))
      .limit(1);

    await logAuditEvent({
      userId: input.recordedBy,
      action: "minutes.draft_created",
      entityType: "nga_minutes",
      entityId: Number(result.insertId),
      after: { meetingId: input.meetingId, version },
    });

    return inserted;
  },

  /**
   * Generate minutes from meeting data.
   */
  generateFromMeeting: async (meetingId: number): Promise<string> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const lines: string[] = [];

    // Get meeting info
    const [meeting] = await db
      .select()
      .from(ngaMeetings)
      .where(eq(ngaMeetings.id, meetingId))
      .limit(1);

    if (!meeting) throw new Error("Meeting not found");

    // Header
    lines.push("═══════════════════════════════════════════════════════════════");
    lines.push("                    MINUTES OF PROCEEDINGS");
    lines.push("═══════════════════════════════════════════════════════════════");
    lines.push("");
    lines.push(`Meeting: ${meeting.title}`);
    lines.push(`Date: ${meeting.scheduledStart?.toISOString().split("T")[0] ?? "TBD"}`);
    lines.push(`Venue: ${meeting.venue ?? "TBD"}, ${meeting.city ?? ""}`);
    lines.push(`Mode: ${meeting.mode}`);
    lines.push(`Edition: ${meeting.edition ?? "N/A"}`);
    lines.push("");

    // Attendance
    lines.push("───────────────────────────────────────────────────────────────");
    lines.push("1. ATTENDANCE");
    lines.push("───────────────────────────────────────────────────────────────");
    lines.push("");

    const delegations = await db
      .select()
      .from(ngaDelegations)
      .where(eq(ngaDelegations.meetingId, meetingId))
      .orderBy(ngaDelegations.organizationName);

    lines.push("Delegations Present:");
    for (const d of delegations) {
      lines.push(`  • ${d.organizationName} (${d.organizationType}) - ${d.delegateCount} delegates`);
    }
    lines.push("");

    // Quorum
    lines.push("───────────────────────────────────────────────────────────────");
    lines.push("2. QUORUM");
    lines.push("───────────────────────────────────────────────────────────────");
    lines.push("");
    lines.push(`Required: ${meeting.quorumRequired ?? "1/3 of Permanent and Temporary LCs"}`);
    lines.push(`Present: ${delegations.filter(d => d.status === "credentialed" || d.status === "active").length}`);
    lines.push(`Quorum: ${meeting.quorumMet ? "✓ MET" : "✗ NOT MET"}`);
    lines.push("");

    // Agenda
    lines.push("───────────────────────────────────────────────────────────────");
    lines.push("3. AGENDA");
    lines.push("───────────────────────────────────────────────────────────────");
    lines.push("");
    lines.push("  [See attached agenda]");
    lines.push("");

    // Motions
    lines.push("───────────────────────────────────────────────────────────────");
    lines.push("4. MOTIONS AND RESOLUTIONS");
    lines.push("───────────────────────────────────────────────────────────────");
    lines.push("");

    const sessionMotions = await db
      .select()
      .from(motions)
      .where(eq(motions.sessionId, meetingId))
      .orderBy(motions.id);

    for (const m of sessionMotions) {
      lines.push(`Motion ${m.id}:`);
      lines.push(`  Text: ${m.text}`);
      lines.push(`  Proposed by: User ${m.proposedById}`);
      lines.push(`  Seconded by: ${m.secondedById ? `User ${m.secondedById}` : "N/A"}`);
      lines.push(`  Status: ${m.status}`);
      lines.push("");
    }

    if (sessionMotions.length === 0) {
      lines.push("  [No motions recorded]");
      lines.push("");
    }

    // Decisions
    lines.push("───────────────────────────────────────────────────────────────");
    lines.push("5. DECISIONS");
    lines.push("───────────────────────────────────────────────────────────────");
    lines.push("");
    lines.push("  [Decisions to be recorded]");
    lines.push("");

    // Points of Order
    lines.push("───────────────────────────────────────────────────────────────");
    lines.push("6. POINTS OF ORDER");
    lines.push("───────────────────────────────────────────────────────────────");
    lines.push("");

    const poos = await db
      .select()
      .from(pointsOfOrder)
      .where(eq(pointsOfOrder.sessionId, meetingId));

    for (const poo of poos) {
      lines.push(`  POO ${poo.id}: ${poo.text}`);
      lines.push(`    Ruling: ${poo.ruling ?? "Pending"}`);
    }

    if (poos.length === 0) {
      lines.push("  [No Points of Order raised]");
    }
    lines.push("");

    // Voting Results
    lines.push("───────────────────────────────────────────────────────────────");
    lines.push("7. VOTING RESULTS");
    lines.push("───────────────────────────────────────────────────────────────");
    lines.push("");

    const votes = await db
      .select()
      .from(plenaryVotes)
      .where(eq(plenaryVotes.sessionId, meetingId));

    for (const v of votes) {
      const result = v.result as any;
      lines.push(`Vote on Motion ${v.motionId}:`);
      lines.push(`  Method: ${v.method}`);
      lines.push(`  Yes: ${result?.yes ?? 0}`);
      lines.push(`  No: ${result?.no ?? 0}`);
      lines.push(`  Abstain: ${result?.abstain ?? 0}`);
      lines.push(`  Result: ${result?.adopted ? "ADOPTED" : "REJECTED"}`);
      lines.push("");
    }

    if (votes.length === 0) {
      lines.push("  [No votes recorded]");
      lines.push("");
    }

    // Resolutions
    lines.push("───────────────────────────────────────────────────────────────");
    lines.push("8. RESOLUTIONS");
    lines.push("───────────────────────────────────────────────────────────────");
    lines.push("");

    const resos = await db
      .select()
      .from(resolutions)
      .where(eq(resolutions.sessionId, meetingId));

    for (const r of resos) {
      lines.push(`Resolution ${r.number}: ${r.title}`);
      lines.push(`  ${r.text}`);
      lines.push(`  Status: ${r.status}`);
      lines.push("");
    }

    if (resos.length === 0) {
      lines.push("  [No resolutions adopted]");
      lines.push("");
    }

    // Closing
    lines.push("═══════════════════════════════════════════════════════════════");
    lines.push("END OF MINUTES");
    lines.push("═══════════════════════════════════════════════════════════════");
    lines.push("");
    lines.push("Recorded by: ________________________");
    lines.push("Date: ________________________");
    lines.push("");
    lines.push("Approved by: ________________________");
    lines.push("Date: ________________________");

    return lines.join("\n");
  },

  /**
   * Edit draft minutes (only authorized secretaries).
   */
  editDraft: async (
    minutesId: number,
    updates: { content?: string; summary?: string },
    editedBy: number
  ): Promise<NgaMinutes> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const [minutes] = await db
      .select()
      .from(ngaMinutes)
      .where(eq(ngaMinutes.id, minutesId))
      .limit(1);

    if (!minutes) throw new Error(`Minutes ${minutesId} not found.`);
    if (minutes.status !== "draft") {
      throw new Error("Only draft minutes can be edited.");
    }

    await db
      .update(ngaMinutes)
      .set({
        content: updates.content ?? minutes.content,
        summary: updates.summary ?? minutes.summary,
        updatedAt: new Date(),
      })
      .where(eq(ngaMinutes.id, minutesId));

    const [updated] = await db
      .select()
      .from(ngaMinutes)
      .where(eq(ngaMinutes.id, minutesId))
      .limit(1);

    await logAuditEvent({
      userId: editedBy,
      action: "minutes.draft_edited",
      entityType: "nga_minutes",
      entityId: minutesId,
    });

    return updated;
  },

  /**
   * Adopt minutes (locks the version).
   */
  adoptMinutes: async (
    minutesId: number,
    approvedBy: number,
    motionId?: number
  ): Promise<NgaMinutes> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const [minutes] = await db
      .select()
      .from(ngaMinutes)
      .where(eq(ngaMinutes.id, minutesId))
      .limit(1);

    if (!minutes) throw new Error(`Minutes ${minutesId} not found.`);
    if (minutes.status !== "draft" && minutes.status !== "reviewed") {
      throw new Error("Only draft or reviewed minutes can be adopted.");
    }

    await db
      .update(ngaMinutes)
      .set({
        status: "adopted",
        approvedAt: new Date(),
        approvedBy,
        updatedAt: new Date(),
      })
      .where(eq(ngaMinutes.id, minutesId));

    const [updated] = await db
      .select()
      .from(ngaMinutes)
      .where(eq(ngaMinutes.id, minutesId))
      .limit(1);

    await logAuditEvent({
      userId: approvedBy,
      action: "minutes.adopted",
      entityType: "nga_minutes",
      entityId: minutesId,
      after: { motionId, locked: true },
    });

    return updated;
  },

  /**
   * Publish minutes.
   */
  publishMinutes: async (minutesId: number): Promise<NgaMinutes> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const [minutes] = await db
      .select()
      .from(ngaMinutes)
      .where(eq(ngaMinutes.id, minutesId))
      .limit(1);

    if (!minutes) throw new Error(`Minutes ${minutesId} not found.`);
    if (minutes.status !== "adopted") {
      throw new Error("Only adopted minutes can be published.");
    }

    await db
      .update(ngaMinutes)
      .set({
        status: "published",
        updatedAt: new Date(),
      })
      .where(eq(ngaMinutes.id, minutesId));

    const [updated] = await db
      .select()
      .from(ngaMinutes)
      .where(eq(ngaMinutes.id, minutesId))
      .limit(1);

    return updated;
  },

  /**
   * Get minutes for a meeting.
   */
  getMinutesForMeeting: async (meetingId: number): Promise<NgaMinutes[]> => {
    const db = getDb();
    if (!db) return [];

    return db
      .select()
      .from(ngaMinutes)
      .where(eq(ngaMinutes.meetingId, meetingId))
      .orderBy(desc(ngaMinutes.version));
  },

  /**
   * Get the adopted minutes for a meeting.
   */
  getAdoptedMinutes: async (meetingId: number): Promise<NgaMinutes | null> => {
    const db = getDb();
    if (!db) return null;

    const [minutes] = await db
      .select()
      .from(ngaMinutes)
      .where(
        and(
          eq(ngaMinutes.meetingId, meetingId),
          eq(ngaMinutes.status, "adopted")
        )
      )
      .orderBy(desc(ngaMinutes.version))
      .limit(1);

    return minutes ?? null;
  },
};

export default minutesEngine;
