/**
 * National General Assembly (NGA) Engine
 *
 * Implements the complete NGA lifecycle as defined in Bylaws §8.1:
 *
 * Planning → Organizing Committee → Call for Participation →
 * Registration → Credentialing → Preparation → Opening →
 * Plenary → Committees → Elections → Reports →
 * Bylaw Changes → Closing → Certification → Archive
 *
 * Key rules (all configurable via governance engine):
 * - C-6.3: NGA window July 20 – August 20
 * - C-6.5: Invitations 2 months in advance
 * - B-8.1.3: NGA at least once/year
 * - B-8.1.4: Date decided by EBTO, tentative Jul 20 – Aug 20
 * - B-8.1.8: Quorum = 1/3 Permanent + Temporary LCs
 * - B-8.1.12: NGA must be in person
 * - B-8.1.13: Online NGA: EBTO + SupCo + 2/3 extraordinary voting
 * - B-8.1.15: Credential submission before 2nd plenary
 * - B-8.1.17: Participants categories (a–l)
 * - B-8.1.22–28: Speaking and proposing rights
 *
 * Usage:
 *   import { createNGA, registerDelegation, conductRollCall, startPlenary } from "./ngaEngine";
 *
 *   const nga = await createNGA({
 *     title: "3rd NGA MSA-Pakistan",
 *     scheduledStart: new Date("2026-07-25"),
 *     scheduledEnd: new Date("2026-07-28"),
 *   });
 *
 *   await registerDelegation(nga.id, { organizationId: kemuId, delegateCount: 8 });
 *   await conductRollCall(nga.id);
 *   await startPlenary(nga.id, 1);
 */

import { eq, and, desc, sql } from "drizzle-orm";
import {
  governanceDocuments,
  governanceClauses,
  governanceRules,
  governanceParameters,
} from "../../drizzle/schema.governance_rules";
import {
  ngaMeetings,
  ngaDelegations,
  ngaDelegates,
  ngaAgenda,
  cccMembers,
  cccReviews,
  financialCommittee,
  ngaRollCall,
  ngaDecisions,
  ngaMinutes,
  votingRightsCalculations,
} from "../../drizzle/schema.nga";
import { getDb } from "../db";
import { logAuditEvent } from "./auditService";
import { evaluateQuorum, resolveEffectiveRule, getParameter } from "./governanceRulesEngine";
import { getCurrentGovernanceVersion } from "./termService";

// ============================================================================
// Types
// ============================================================================

export interface CreateNGAInput {
  title: string;
  description?: string;
  edition?: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  venue?: string;
  city?: string;
  mode?: "in_person" | "online" | "hybrid";
  participationFee?: number;
  governanceVersion?: string;
  createdById?: number;
}

export interface RegisterDelegationInput {
  organizationId: number;
  organizationType: "permanent_lc" | "temporary_lc" | "candidate_lc" | "ci";
  organizationName: string;
  headOfDelegationId?: number;
  delegateCount?: number;
}

export interface NGAStatusResult {
  meeting: any;
  delegations: any[];
  agenda: any[];
  quorum: {
    eligibleBodies: number;
    presentBodies: number;
    quorumMet: boolean;
    required: number;
  };
  votingRights: any[];
  statusHistory: string[];
  canTransition: boolean;
  nextStatuses: string[];
}

// ============================================================================
// NGA Lifecycle Management
// ============================================================================

/**
 * Create a new NGA meeting.
 */
export async function createNGA(
  input: CreateNGAInput
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Validate date window (C-6.3: July 20 – August 20)
    const startDate = new Date(input.scheduledStart);
    const month = startDate.getMonth(); // 0-indexed, July = 6
    const day = startDate.getDate();

    if (month === 6 && day >= 20 || month === 7 && day <= 20) {
      // Within window - valid
    } else {
      console.warn("[NGA] Date outside recommended window (Jul 20 – Aug 20). Proceeding anyway.");
    }

    // Calculate quorum from governance rules
    const quorumRule = await resolveEffectiveRule("quorum.nga");
    let quorumRequired: number | null = null;
    if (quorumRule) {
      const numerator = (quorumRule.parameters.numerator as number) ?? 1;
      const denominator = (quorumRule.parameters.denominator as number) ?? 3;
      // Will be calculated when delegations are registered
      quorumRequired = null;
    }

    const [result] = await db.insert(ngaMeetings).values({
      title: input.title,
      description: input.description,
      edition: input.edition,
      status: "planning",
      mode: input.mode ?? "in_person",
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
      venue: input.venue,
      city: input.city,
      participationFee: input.participationFee,
      governanceVersion: input.governanceVersion ?? await getCurrentGovernanceVersion(),
      quorumRequired,
      createdById: input.createdById,
    });

    const id = Number((result as any)[0].insertId);

    // Create default agenda items
    await createDefaultAgenda(id);

    await logAuditEvent({
      userId: input.createdById,
      action: "nga.created",
      entityType: "nga_meeting",
      entityId: id,
      after: { title: input.title, scheduledStart: input.scheduledStart },
    });

    console.log(`[NGA] Created: "${input.title}" (id=${id})`);
    return { id };
  } catch (error) {
    console.error("[NGA] Failed to create:", error);
    return null;
  }
}

/**
 * Create default NGA agenda items.
 */
async function createDefaultAgenda(meetingId: number): Promise<void> {
  const db = getDb();
  if (!db) return;

  const defaultItems = [
    { order: 1, title: "Opening Ceremony", type: "opening" as const },
    { order: 2, title: "Adoption of Agenda", type: "plenary" as const },
    { order: 3, title: "Roll Call and Quorum", type: "plenary" as const },
    { order: 4, title: "Election of Plenary Team", type: "plenary" as const },
    { order: 5, title: "Approval of Previous Minutes", type: "plenary" as const },
    { order: 10, title: "Reports: President", type: "reports" as const },
    { order: 11, title: "Reports: VPI", type: "reports" as const },
    { order: 12, title: "Reports: VPE", type: "reports" as const },
    { order: 13, title: "Reports: VPA", type: "reports" as const },
    { order: 14, title: "Reports: VPCB", type: "reports" as const },
    { order: 15, title: "Reports: VPM", type: "reports" as const },
    { order: 16, title: "Reports: VPF", type: "reports" as const },
    { order: 17, title: "Reports: VPPRC", type: "reports" as const },
    { order: 18, title: "Reports: Supervising Council", type: "reports" as const },
    { order: 20, title: "Standing Committee Sessions", type: "standing_committee" as const },
    { order: 30, title: "Workshops", type: "workshop" as const },
    { order: 40, title: "Changes to the Constitution & Bylaws", type: "bylaw_changes" as const },
    { order: 50, title: "Election of New EBTO", type: "election" as const },
    { order: 51, title: "Election of Supervising Council", type: "election" as const },
    { order: 60, title: "LC Change of Status Applications", type: "plenary" as const },
    { order: 70, title: "Policy Statements", type: "plenary" as const },
    { order: 80, title: "Any Other Business", type: "plenary" as const },
    { order: 90, title: "Closing Ceremony", type: "closing" as const },
  ];

  for (const item of defaultItems) {
    await db.insert(ngaAgenda).values({
      meetingId,
      order: item.order,
      title: item.title,
      type: item.type,
      status: "proposed",
    });
  }
}

// ============================================================================
// NGA Status Transitions
// ============================================================================

/**
 * Transition NGA to the next status.
 */
export async function transitionNGAStatus(
  meetingId: number,
  newStatus: string,
  userId?: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [meeting] = await db
      .select()
      .from(ngaMeetings)
      .where(eq(ngaMeetings.id, meetingId))
      .limit(1);

    if (!meeting) return false;

    // Validate transition
    const validTransitions = getValidTransitions(meeting.status);
    if (!validTransitions.includes(newStatus)) {
      console.warn(`[NGA] Invalid transition: ${meeting.status} → ${newStatus}`);
      return false;
    }

    // Special validations
    if (newStatus === "opening" || newStatus === "plenary") {
      // Check quorum before starting plenary
      const quorumResult = await checkNGAQuorum(meetingId);
      if (!quorumResult.quorumMet) {
        console.warn(`[NGA] Cannot start plenary: quorum not met (${quorumResult.presentBodies}/${quorumResult.required})`);
        // Allow but warn - quorum can be reached during roll call
      }
    }

    await db
      .update(ngaMeetings)
      .set({
        status: newStatus as any,
        actualStart: newStatus === "opening" ? new Date() : meeting.actualStart,
        updatedAt: new Date(),
      })
      .where(eq(ngaMeetings.id, meetingId));

    // Set actual end for closing/archive
    if (newStatus === "closing" || newStatus === "archive") {
      await db
        .update(ngaMeetings)
        .set({ actualEnd: new Date() })
        .where(eq(ngaMeetings.id, meetingId));
    }

    await logAuditEvent({
      userId,
      action: "nga.status_changed",
      entityType: "nga_meeting",
      entityId: meetingId,
      before: { status: meeting.status },
      after: { status: newStatus },
    });

    return true;
  } catch (error) {
    console.error("[NGA] Failed to transition:", error);
    return false;
  }
}

/**
 * Get valid status transitions.
 */
function getValidTransitions(currentStatus: string): string[] {
  const transitions: Record<string, string[]> = {
    planning: ["organizing_committee"],
    organizing_committee: ["call_for_participation"],
    call_for_participation: ["registration"],
    registration: ["credentialing"],
    credentialing: ["preparation"],
    preparation: ["opening"],
    opening: ["plenary"],
    plenary: ["committees", "elections", "closing"],
    committees: ["plenary", "elections"],
    elections: ["reports", "plenary"],
    reports: ["plenary", "bylaw_changes"],
    bylaw_changes: ["closing"],
    closing: ["certification"],
    certification: ["archive"],
    archive: [],
  };

  return transitions[currentStatus] ?? [];
}

// ============================================================================
// Delegation Registration
// ============================================================================

/**
 * Register a delegation for the NGA.
 */
export async function registerDelegation(
  meetingId: number,
  input: RegisterDelegationInput
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Check for duplicate registration
    const [existing] = await db
      .select()
      .from(ngaDelegations)
      .where(
        and(
          eq(ngaDelegations.meetingId, meetingId),
          eq(ngaDelegations.organizationId, input.organizationId)
        )
      )
      .limit(1);

    if (existing) {
      console.warn("[NGA] Delegation already registered");
      return { id: existing.id };
    }

    // Calculate voting rights
    const votingRights = await calculateVotingRights(
      input.organizationType,
      input.delegateCount ?? 0
    );

    const [result] = await db.insert(ngaDelegations).values({
      meetingId,
      organizationId: input.organizationId,
      organizationType: input.organizationType,
      organizationName: input.organizationName,
      headOfDelegationId: input.headOfDelegationId,
      delegateCount: input.delegateCount ?? 0,
      maxDelegates: input.organizationType === "candidate_lc" || input.organizationType === "ci" ? 1 : 10,
      plenaryVotes: votingRights.plenaryVotes,
      electionVotes: votingRights.electionVotes,
      status: "registered",
    });

    const id = Number((result as any)[0].insertId);

    // Recalculate quorum
    await recalculateQuorum(meetingId);

    await logAuditEvent({
      action: "nga.delegation_registered",
      entityType: "nga_delegation",
      entityId: id,
      after: {
        organizationName: input.organizationName,
        organizationType: input.organizationType,
        plenaryVotes: votingRights.plenaryVotes,
        electionVotes: votingRights.electionVotes,
      },
    });

    return { id };
  } catch (error) {
    console.error("[NGA] Failed to register delegation:", error);
    return null;
  }
}

/**
 * Calculate voting rights for an organization type.
 * Uses the governance rules engine.
 */
async function calculateVotingRights(
  organizationType: string,
  delegateCount: number
): Promise<{ plenaryVotes: number; electionVotes: number }> {
  const ruleKey = `voting.${organizationType}`;
  const rule = await resolveEffectiveRule(ruleKey);

  if (!rule) {
    // Default fallback
    switch (organizationType) {
      case "permanent_lc":
      case "temporary_lc":
        return { plenaryVotes: 1, electionVotes: Math.min(delegateCount, 10) };
      case "candidate_lc":
      case "ci":
        return { plenaryVotes: 0, electionVotes: 1 };
      default:
        return { plenaryVotes: 0, electionVotes: 0 };
    }
  }

  const params = rule.parameters;
  let plenaryVotes = (params.plenary_votes as number) ?? 0;
  let electionVotes = (params.election_votes as number) ?? 0;

  // B-8.7.4: If <10 delegates, election votes = number of delegates
  const minDelegatesForFullVotes = 10;
  if (delegateCount > 0 && delegateCount < minDelegatesForFullVotes && electionVotes > 0) {
    electionVotes = delegateCount;
  }

  return { plenaryVotes, electionVotes };
}

// ============================================================================
// Roll Call & Quorum
// ============================================================================

/**
 * Conduct roll call for a plenary session.
 * B-8.7.8: Chair must conduct roll call at start of each plenary.
 */
export async function conductRollCall(
  meetingId: number,
  plenarySessionId?: number
): Promise<{
  quorumMet: boolean;
  presentBodies: number;
  required: number;
  eligibleBodies: number;
}> {
  const db = getDb();
  if (!db) return { quorumMet: false, presentBodies: 0, required: 0, eligibleBodies: 0 };

  try {
    // Get all delegations
    const delegations = await db
      .select()
      .from(ngaDelegations)
      .where(
        and(
          eq(ngaDelegations.meetingId, meetingId),
          eq(ngaDelegations.status, "credentialed")
        )
      );

    // Create roll call entries
    for (const delegation of delegations) {
      const [existing] = await db
        .select()
        .from(ngaRollCall)
        .where(
          and(
            eq(ngaRollCall.meetingId, meetingId),
            eq(ngaRollCall.delegationId, delegation.id)
          )
        )
        .limit(1);

      if (!existing) {
        await db.insert(ngaRollCall).values({
          meetingId,
          plenarySessionId,
          delegationId: delegation.id,
          organizationName: delegation.organizationName,
          plenaryVotes: delegation.plenaryVotes,
          electionVotes: delegation.electionVotes,
        });
      }
    }

    // Check quorum
    const quorumResult = await checkNGAQuorum(meetingId);

    // Update meeting quorum status
    await db
      .update(ngaMeetings)
      .set({
        quorumMet: quorumResult.quorumMet,
        quorumRequired: quorumResult.required,
      })
      .where(eq(ngaMeetings.id, meetingId));

    await logAuditEvent({
      action: "nga.roll_call_conducted",
      entityType: "nga_meeting",
      entityId: meetingId,
      after: {
        presentBodies: quorumResult.presentBodies,
        required: quorumResult.required,
        quorumMet: quorumResult.quorumMet,
      },
    });

    return quorumResult;
  } catch (error) {
    console.error("[NGA] Failed to conduct roll call:", error);
    return { quorumMet: false, presentBodies: 0, required: 0, eligibleBodies: 0 };
  }
}

/**
 * Check NGA quorum.
 * B-8.1.8: 1/3 of Permanent and Temporary LCs with voting rights.
 */
export async function checkNGAQuorum(
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
    // Count eligible bodies (Permanent + Temporary LCs with voting rights)
    const [eligibleResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(ngaDelegations)
      .where(
        and(
          eq(ngaDelegations.meetingId, meetingId),
          sql`${ngaDelegations.organizationType} IN ('permanent_lc', 'temporary_lc')`,
          eq(ngaDelegations.status, "credentialed")
        )
      );

    // Count present bodies
    const [presentResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(ngaRollCall)
      .where(
        and(
          eq(ngaRollCall.meetingId, meetingId),
          eq(ngaRollCall.present, true)
        )
      );

    const eligibleBodies = eligibleResult?.count ?? 0;
    const presentBodies = presentResult?.count ?? 0;

    // Calculate quorum using governance engine
    const quorumResult = await evaluateQuorum("nga", {
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
    console.error("[NGA] Failed to check quorum:", error);
    return { quorumMet: false, presentBodies: 0, required: 0, eligibleBodies: 0 };
  }
}

/**
 * Recalculate quorum requirement based on current delegations.
 */
async function recalculateQuorum(meetingId: number): Promise<void> {
  const db = getDb();
  if (!db) return;

  const [eligibleResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(ngaDelegations)
    .where(
      and(
        eq(ngaDelegations.meetingId, meetingId),
        sql`${ngaDelegations.organizationType} IN ('permanent_lc', 'temporary_lc')`
      )
    );

  const eligibleBodies = eligibleResult?.count ?? 0;
  const quorumResult = await evaluateQuorum("nga", {
    eligibleBodies,
    presentBodies: 0,
  });

  await db
    .update(ngaMeetings)
    .set({ quorumRequired: quorumResult.required })
    .where(eq(ngaMeetings.id, meetingId));
}

// ============================================================================
// Agenda Management
// ============================================================================

/**
 * Add an agenda item to the NGA.
 */
export async function addAgendaItem(
  meetingId: number,
  title: string,
  type: string,
  options: {
    description?: string;
    timeAllotted?: number;
    order?: number;
  } = {}
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Get next order
    const [maxOrder] = await db
      .select({ maxOrder: ngaAgenda.order })
      .from(ngaAgenda)
      .where(eq(ngaAgenda.meetingId, meetingId))
      .orderBy(desc(ngaAgenda.order))
      .limit(1);

    const order = options.order ?? ((maxOrder?.maxOrder ?? 0) + 1);

    const [result] = await db.insert(ngaAgenda).values({
      meetingId,
      order,
      title,
      type: type as any,
      description: options.description,
      timeAllotted: options.timeAllotted,
    });

    return { id: Number((result as any)[0].insertId) };
  } catch (error) {
    console.error("[NGA] Failed to add agenda item:", error);
    return null;
  }
}

/**
 * Lock the bylaw changes agenda item.
 * B-17.2.3, B-17.2.8: Cannot reopen in same NGA.
 */
export async function lockBylawAgenda(
  meetingId: number,
  lockedBy?: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .update(ngaAgenda)
      .set({
        isLocked: true,
        lockedBy,
        lockedAt: new Date(),
      })
      .where(
        and(
          eq(ngaAgenda.meetingId, meetingId),
          eq(ngaAgenda.type, "bylaw_changes")
        )
      );

    return true;
  } catch (error) {
    console.error("[NGA] Failed to lock bylaw agenda:", error);
    return false;
  }
}

// ============================================================================
// Credential Management
// ============================================================================

/**
 * Submit credential form for a delegation.
 * B-8.1.15: Must be done before 2nd plenary.
 */
export async function submitCredentials(
  delegationId: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .update(ngaDelegations)
      .set({
        credentialFormSubmitted: true,
        credentialFormSubmittedAt: new Date(),
        credentialStatus: "submitted",
      })
      .where(eq(ngaDelegations.id, delegationId));

    return true;
  } catch (error) {
    console.error("[NGA] Failed to submit credentials:", error);
    return false;
  }
}

/**
 * CCC review of a delegation's credentials.
 */
export async function reviewCredentials(
  delegationId: number,
  approved: boolean,
  reviewedBy?: number,
  notes?: string
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .update(ngaDelegations)
      .set({
        credentialStatus: approved ? "approved" : "rejected",
      })
      .where(eq(ngaDelegations.id, delegationId));

    // Create CCC review record
    const [delegation] = await db
      .select()
      .from(ngaDelegations)
      .where(eq(ngaDelegations.id, delegationId))
      .limit(1);

    if (delegation) {
      await db.insert(cccReviews).values({
        meetingId: delegation.meetingId,
        delegationId,
        status: approved ? "approved" : "rejected",
        membershipValid: approved,
        financialClear: !delegation.hasOutstandingDebt,
        documentsComplete: delegation.credentialFormSubmitted,
        eligibilityVerified: approved,
        reviewerNotes: notes,
        reviewedAt: new Date(),
        reviewedBy,
      });
    }

    await logAuditEvent({
      userId: reviewedBy,
      action: approved ? "nga.credentials_approved" : "nga.credentials_rejected",
      entityType: "nga_delegation",
      entityId: delegationId,
      after: { approved, notes },
    });

    return true;
  } catch (error) {
    console.error("[NGA] Failed to review credentials:", error);
    return false;
  }
}

// ============================================================================
// Meeting Status Query
// ============================================================================

/**
 * Get comprehensive NGA status.
 */
export async function getNGAStatus(
  meetingId: number
): Promise<NGAStatusResult | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [meeting] = await db
      .select()
      .from(ngaMeetings)
      .where(eq(ngaMeetings.id, meetingId))
      .limit(1);

    if (!meeting) return null;

    const delegations = await db
      .select()
      .from(ngaDelegations)
      .where(eq(ngaDelegations.meetingId, meetingId))
      .orderBy(ngaDelegations.organizationName);

    const agenda = await db
      .select()
      .from(ngaAgenda)
      .where(eq(ngaAgenda.meetingId, meetingId))
      .orderBy(ngaAgenda.order);

    const quorum = await checkNGAQuorum(meetingId);

    const votingRights = await db
      .select()
      .from(votingRightsCalculations)
      .where(eq(votingRightsCalculations.meetingId, meetingId));

    const nextStatuses = getValidTransitions(meeting.status);

    return {
      meeting,
      delegations,
      agenda,
      quorum,
      votingRights,
      statusHistory: [], // Would need audit log query
      canTransition: nextStatuses.length > 0,
      nextStatuses,
    };
  } catch (error) {
    console.error("[NGA] Failed to get status:", error);
    return null;
  }
}

/**
 * List all NGA meetings.
 */
export async function listNGAs(
  options: { status?: string; limit?: number } = {}
): Promise<any[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const where = options.status
      ? eq(ngaMeetings.status, options.status as any)
      : undefined;

    return await db
      .select()
      .from(ngaMeetings)
      .where(where)
      .orderBy(desc(ngaMeetings.scheduledStart))
      .limit(options.limit ?? 50);
  } catch (error) {
    console.error("[NGA] Failed to list:", error);
    return [];
  }
}

// ============================================================================
// Online NGA Mode
// ============================================================================

/**
 * Request online NGA mode.
 * B-8.1.13: Requires EBTO + SupCo approval + 2/3 extraordinary voting.
 */
export async function requestOnlineMode(
  meetingId: number,
  requestedBy?: number
): Promise<{ requiresApproval: boolean; approvalsNeeded: string[] }> {
  const db = getDb();
  if (!db) return { requiresApproval: true, approvalsNeeded: [] };

  // Online mode requires special approval
  return {
    requiresApproval: true,
    approvalsNeeded: [
      "EBTO approval",
      "Supervising Council approval",
      "2/3 extraordinary voting from LCs",
    ],
  };
}
