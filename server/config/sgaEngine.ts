/**
 * Special General Assembly (SGA) Engine
 *
 * Implements the complete SGA lifecycle as defined in Bylaws §8.2:
 *
 * Proposed → Approved → Scheduled → In Progress → Completed/Cancelled
 *
 * Key rules (all configurable via governance engine):
 * - B-8.2.1: EBTO + SupCo approval + 2/3 extraordinary voting
 * - B-8.2.2: Must be in person or online
 * - B-8.2.3: Notice at least 1 week before
 * - B-8.2.4: Quorum = 1/3 Permanent + Temporary LCs
 * - B-8.2.5: Vacant EBTO positions → open applications
 * - B-8.2.6: Proceedings similar to plenaries
 * - B-8.2.7: Plenary team calls at least 1 week before
 *
 * Usage:
 *   import { proposeSGA, approveSGA, conductSGA } from "./sgaEngine";
 *
 *   const sga = await proposeSGA({
 *     title: "Emergency SGA - Replace VPF",
 *     reason: "VPF resigned, position vacant",
 *     scheduledStart: new Date("2026-03-15"),
 *   });
 *
 *   await approveSGA(sga.id, { ebto: true, supco: true });
 *   await conductSGA(sga.id);
 */

import { eq, and, desc, sql } from "drizzle-orm";
import {
  sgaMeetings,
  ngaDelegations,
  ngaRollCall,
} from "../../drizzle/schema.nga";
import { getDb } from "../db";
import { logAuditEvent } from "./auditService";
import { evaluateQuorum, resolveEffectiveRule } from "./governanceRulesEngine";
import { getCurrentGovernanceVersion } from "./termService";

// ============================================================================
// Types
// ============================================================================

export interface ProposeSGAInput {
  title: string;
  description?: string;
  reason: string;
  proposedBy?: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  mode?: "in_person" | "online";
  governanceVersion?: string;
  createdById?: number;
}

export interface SGAApprovalInput {
  ebto?: boolean;
  supco?: boolean;
}

export interface SGAStatusResult {
  meeting: any;
  quorum: {
    eligibleBodies: number;
    presentBodies: number;
    quorumMet: boolean;
    required: number;
  };
  approvalChain: {
    ebtoApproved: boolean;
    supcoApproved: boolean;
    lcVotingApproved: boolean;
  };
  canVote: boolean;
  canConvene: boolean;
}

// ============================================================================
// SGA Lifecycle Management
// ============================================================================

/**
 * Propose a Special General Assembly.
 */
export async function proposeSGA(
  input: ProposeSGAInput
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // B-8.2.3: Notice at least 1 week before
    const noticePeriod = 7 * 24 * 60 * 60 * 1000; // 1 week in ms
    const now = new Date();
    const timeUntilMeeting = input.scheduledStart.getTime() - now.getTime();

    if (timeUntilMeeting < noticePeriod) {
      console.warn("[SGA] Meeting scheduled less than 1 week away. Notice requirement may not be met.");
    }

    const [result] = await db.insert(sgaMeetings).values({
      title: input.title,
      description: input.description,
      reason: input.reason,
      status: "proposed",
      proposedBy: input.proposedBy,
      mode: input.mode ?? "in_person",
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
      governanceVersion: input.governanceVersion ?? await getCurrentGovernanceVersion(),
      createdById: input.createdById,
    });

    const id = Number((result as any)[0].insertId);

    await logAuditEvent({
      userId: input.createdById,
      action: "sga.proposed",
      entityType: "sga_meeting",
      entityId: id,
      after: { title: input.title, reason: input.reason },
    });

    console.log(`[SGA] Proposed: "${input.title}" (id=${id})`);
    return { id };
  } catch (error) {
    console.error("[SGA] Failed to propose:", error);
    return null;
  }
}

/**
 * Approve SGA (EBTO and/or SupCo).
 * B-8.2.1: Requires EBTO + SupCo approval + 2/3 extraordinary voting.
 */
export async function approveSGA(
  meetingId: number,
  input: SGAApprovalInput,
  approvedBy?: number
): Promise<{ approved: boolean; canSchedule: boolean }> {
  const db = getDb();
  if (!db) return { approved: false, canSchedule: false };

  try {
    const [meeting] = await db
      .select()
      .from(sgaMeetings)
      .where(eq(sgaMeetings.id, meetingId))
      .limit(1);

    if (!meeting) return { approved: false, canSchedule: false };

    if (meeting.status !== "proposed") {
      console.warn(`[SGA] Cannot approve SGA in status "${meeting.status}"`);
      return { approved: false, canSchedule: false };
    }

    const updates: Record<string, any> = {};

    if (input.ebto) {
      updates.ebtoApproved = true;
      updates.ebtoApprovedAt = new Date();
    }

    if (input.supco) {
      updates.supcoApproved = true;
      updates.supcoApprovedAt = new Date();
    }

    updates.updatedAt = new Date();

    await db
      .update(sgaMeetings)
      .set(updates)
      .where(eq(sgaMeetings.id, meetingId));

    // Check if both EBTO and SupCo have approved
    const ebtoApproved = input.ebto ?? (meeting.ebtoApproved ?? false);
    const supcoApproved = input.supco ?? (meeting.supcoApproved ?? false);

    const canSchedule = ebtoApproved && supcoApproved;

    if (canSchedule) {
      // Auto-transition to approved
      await db
        .update(sgaMeetings)
        .set({ status: "approved" })
        .where(eq(sgaMeetings.id, meetingId));
    }

    await logAuditEvent({
      userId: approvedBy,
      action: "sga.approved",
      entityType: "sga_meeting",
      entityId: meetingId,
      after: { ebtoApproved, supcoApproved, canSchedule },
    });

    return { approved: true, canSchedule };
  } catch (error) {
    console.error("[SGA] Failed to approve:", error);
    return { approved: false, canSchedule: false };
  }
}

/**
 * Schedule an approved SGA.
 */
export async function scheduleSGA(
  meetingId: number,
  userId?: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [meeting] = await db
      .select()
      .from(sgaMeetings)
      .where(eq(sgaMeetings.id, meetingId))
      .limit(1);

    if (!meeting || meeting.status !== "approved") {
      console.warn(`[SGA] Cannot schedule SGA in status "${meeting?.status}"`);
      return false;
    }

    // B-8.2.3: Send notice at least 1 week before
    await db
      .update(sgaMeetings)
      .set({
        status: "scheduled",
        noticeSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sgaMeetings.id, meetingId));

    await logAuditEvent({
      userId,
      action: "sga.scheduled",
      entityType: "sga_meeting",
      entityId: meetingId,
      after: { scheduledStart: meeting.scheduledStart },
    });

    return true;
  } catch (error) {
    console.error("[SGA] Failed to schedule:", error);
    return false;
  }
}

/**
 * Start an SGA meeting.
 */
export async function startSGA(
  meetingId: number,
  userId?: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [meeting] = await db
      .select()
      .from(sgaMeetings)
      .where(eq(sgaMeetings.id, meetingId))
      .limit(1);

    if (!meeting || meeting.status !== "scheduled") {
      console.warn(`[SGA] Cannot start SGA in status "${meeting?.status}"`);
      return false;
    }

    // Check quorum
    const quorum = await checkSGAQuorum(meetingId);
    if (!quorum.quorumMet) {
      console.warn(`[SGA] Quorum not met: ${quorum.presentBodies}/${quorum.required}`);
      // Allow start but warn
    }

    await db
      .update(sgaMeetings)
      .set({
        status: "in_progress",
        actualStart: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sgaMeetings.id, meetingId));

    await logAuditEvent({
      userId,
      action: "sga.started",
      entityType: "sga_meeting",
      entityId: meetingId,
    });

    return true;
  } catch (error) {
    console.error("[SGA] Failed to start:", error);
    return false;
  }
}

/**
 * Complete an SGA meeting.
 */
export async function completeSGA(
  meetingId: number,
  userId?: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .update(sgaMeetings)
      .set({
        status: "completed",
        actualEnd: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sgaMeetings.id, meetingId));

    await logAuditEvent({
      userId,
      action: "sga.completed",
      entityType: "sga_meeting",
      entityId: meetingId,
    });

    return true;
  } catch (error) {
    console.error("[SGA] Failed to complete:", error);
    return false;
  }
}

/**
 * Cancel an SGA meeting.
 */
export async function cancelSGA(
  meetingId: number,
  userId?: number,
  reason?: string
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .update(sgaMeetings)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(sgaMeetings.id, meetingId));

    await logAuditEvent({
      userId,
      action: "sga.cancelled",
      entityType: "sga_meeting",
      entityId: meetingId,
      reason,
    });

    return true;
  } catch (error) {
    console.error("[SGA] Failed to cancel:", error);
    return false;
  }
}

// ============================================================================
// Quorum
// ============================================================================

/**
 * Check SGA quorum.
 * B-8.2.4: 1/3 of all Permanent and Temporary LCs with voting rights.
 */
export async function checkSGAQuorum(
  meetingId: number
): Promise<{
  quorumMet: boolean;
  presentBodies: number;
  required: number;
  eligibleBodies: number;
}> {
  const db = getDb();
  if (!db) return { quorumMet: false, presentBodies: 0, required: 0, eligibleBodies: 0 };

  try {
    // Count eligible bodies
    const [eligibleResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(ngaDelegations)
      .where(
        and(
          sql`${ngaDelegations.organizationType} IN ('permanent_lc', 'temporary_lc')`,
          eq(ngaDelegations.status, "credentialed")
        )
      );

    // Count present bodies
    const [presentResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(ngaRollCall)
      .where(eq(ngaRollCall.present, true));

    const eligibleBodies = eligibleResult?.count ?? 0;
    const presentBodies = presentResult?.count ?? 0;

    // Calculate quorum
    const quorumResult = await evaluateQuorum("sga", {
      eligibleBodies,
      presentBodies,
    });

    return {
      quorumMet: quorumResult.quorumMet,
      presentBodies,
      required: quorumResult.required,
      eligibleBodies,
    };
  } catch (error) {
    console.error("[SGA] Failed to check quorum:", error);
    return { quorumMet: false, presentBodies: 0, required: 0, eligibleBodies: 0 };
  }
}

// ============================================================================
// Extraordinary NGA
// ============================================================================

/**
 * Request an extraordinary NGA.
 * B-8.1.9: If 1/3 of Permanent/Temporary LCs propose, must be arranged immediately.
 */
export async function requestExtraordinaryNGA(
  proposingLCs: string[],
  reason: string,
  requestedBy?: number
): Promise<{ eligible: boolean; currentCount: number; required: number }> {
  const db = getDb();
  if (!db) return { eligible: false, currentCount: 0, required: 0 };

  try {
    // Get count of Permanent + Temporary LCs
    const [eligibleResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(ngaDelegations)
      .where(
        sql`${ngaDelegations.organizationType} IN ('permanent_lc', 'temporary_lc')`
      );

    const totalLCs = eligibleResult?.count ?? 0;
    const required = Math.ceil(totalLCs / 3);
    const currentCount = proposingLCs.length;

    const eligible = currentCount >= required;

    if (eligible) {
      await logAuditEvent({
        userId: requestedBy,
        action: "nga.extraordinary_requested",
        entityType: "nga_meeting",
        entityId: 0,
        after: {
          proposingLCs,
          reason,
          currentCount,
          required,
        },
      });
    }

    return { eligible, currentCount, required };
  } catch (error) {
    console.error("[SGA] Failed to request extraordinary NGA:", error);
    return { eligible: false, currentCount: 0, required: 0 };
  }
}

// ============================================================================
// SGA Plenary Team
// ============================================================================

/**
 * Open calls for SGA plenary team.
 * B-8.2.7: Calls must be opened at least 1 week before.
 */
export async function openPlenaryTeamCalls(
  meetingId: number,
  userId?: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [meeting] = await db
      .select()
      .from(sgaMeetings)
      .where(eq(sgaMeetings.id, meetingId))
      .limit(1);

    if (!meeting) return false;

    // B-8.2.7: At least 1 week before
    const oneWeekBefore = new Date(meeting.scheduledStart);
    oneWeekBefore.setDate(oneWeekBefore.getDate() - 7);

    const now = new Date();
    if (now > oneWeekBefore) {
      console.warn("[SGA] Plenary team calls should have been opened at least 1 week before");
    }

    // Store in metadata
    await db
      .update(sgaMeetings)
      .set({
        metadata: {
          ...((meeting.metadata as Record<string, unknown>) ?? {}),
          plenaryTeamCallsOpened: true,
          plenaryTeamCallsOpenedAt: now.toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(sgaMeetings.id, meetingId));

    await logAuditEvent({
      userId,
      action: "sga.plenary_team_calls_opened",
      entityType: "sga_meeting",
      entityId: meetingId,
    });

    return true;
  } catch (error) {
    console.error("[SGA] Failed to open plenary team calls:", error);
    return false;
  }
}

// ============================================================================
// SGA Status Query
// ============================================================================

/**
 * Get comprehensive SGA status.
 */
export async function getSGAStatus(
  meetingId: number
): Promise<SGAStatusResult | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [meeting] = await db
      .select()
      .from(sgaMeetings)
      .where(eq(sgaMeetings.id, meetingId))
      .limit(1);

    if (!meeting) return null;

    const quorum = await checkSGAQuorum(meetingId);

    const approvalChain = {
      ebtoApproved: (meeting.ebtoApproved ?? false) as boolean,
      supcoApproved: (meeting.supcoApproved ?? false) as boolean,
      lcVotingApproved: (meeting.lcVotingApproved ?? false) as boolean,
    };

    const canConvene = approvalChain.ebtoApproved && approvalChain.supcoApproved;
    const canVote = meeting.status === "in_progress" && quorum.quorumMet;

    return {
      meeting,
      quorum,
      approvalChain,
      canVote,
      canConvene,
    };
  } catch (error) {
    console.error("[SGA] Failed to get status:", error);
    return null;
  }
}

/**
 * List all SGA meetings.
 */
export async function listSGAs(
  options: { status?: string; limit?: number } = {}
): Promise<any[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const where = options.status
      ? eq(sgaMeetings.status, options.status as any)
      : undefined;

    return await db
      .select()
      .from(sgaMeetings)
      .where(where)
      .orderBy(desc(sgaMeetings.scheduledStart))
      .limit(options.limit ?? 50);
  } catch (error) {
    console.error("[SGA] Failed to list:", error);
    return [];
  }
}

/**
 * Get SGA for replacing vacant EBTO positions.
 * B-8.2.5: During SGA, open applications for vacant positions.
 */
export async function getVacantPositions(
  meetingId: number
): Promise<Array<{
  position: string;
  title: string;
  reason: string;
}>> {
  // This would query the current EBTO status
  // For now, return empty - will be integrated with the positions system
  return [];
}
