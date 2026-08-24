/**
 * Voting Rights Engine
 * 
 * Implements the complete voting rights system for MSA-Pakistan:
 * - Plenary-Election voting matrix (B-8.7.1, B-8.7.2)
 * - Configurable voting entitlements per organization type
 * - Delegate count adjustments (B-8.7.4)
 * - Voter nomination for >10 delegate delegations (B-8.7.5)
 * - Financial debt eligibility (B-8.7.6)
 * - Eligibility snapshots for historical records
 * - Voting credential issuance
 * - Historical voting rights calculation
 *
 * Current MSA-Pakistan rules (configurable via governance engine):
 *
 *                PLENARY          ELECTION
 * Permanent LC    1 vote          10 votes (max)
 * Temporary LC    1 vote          10 votes (max)
 * Candidate LC    0 votes         1 vote
 * Coordinator I   0 votes         1 vote
 *
 * If <10 delegates: election votes = delegate count
 * If ≥10 delegates: Head of Delegation nominates 10 voters
 *
 * Key architectural principle:
 *   DO NOT hardcode: if (isPermanentLC) vote = 1
 *   DO build: votingRightsEngine.calculate({ organization, meetingType, governanceVersion })
 */

import { eq, and, desc, sql, count } from "drizzle-orm";
import { getDb } from "../db";
import {
  ngaMeetings,
  ngaDelegations,
  ngaDelegates,
  votingRightsCalculations,
  type VotingRightsCalculation,
  type InsertVotingRightsCalculation,
} from "../../drizzle/schema.nga";
import { logAuditEvent } from "./auditService";
import { getCurrentGovernanceVersion } from "./termService";
import { resolveEffectiveRule, getParameter } from "./governanceRulesEngine";

// ============================================================================
// TYPES
// ============================================================================

export interface VotingEntitlementInput {
  organizationType: "permanent_lc" | "temporary_lc" | "candidate_lc" | "ci";
  organizationName: string;
  delegateCount: number;
  hasOutstandingDebt: boolean;
  debtAmount: number;
  credentialStatus: string;
  meetingType: "plenary" | "election";
  governanceVersion?: string;
}

export interface VotingEntitlementResult {
  organizationType: string;
  organizationName: string;
  plenaryVotes: number;
  electionVotes: number;
  delegateCount: number;
  eligible: boolean;
  eligibilityReasons: string[];
  calculation: string;
  ruleSource: string;
  governanceVersion: string;
}

export interface VotingMatrixResult {
  meetingId: number;
  meetingType: "nga" | "sga";
  matrix: VotingMatrixRow[];
  totals: {
    plenaryVotes: number;
    electionVotes: number;
    totalDelegations: number;
    eligibleDelegations: number;
    ineligibleDelegations: number;
  };
  calculatedAt: Date;
  governanceVersion: string;
}

export interface VotingMatrixRow {
  organizationType: string;
  plenaryVotes: number;
  electionVotes: number;
  delegationCount: number;
  delegateCount: number;
  delegations: Array<{
    id: number;
    name: string;
    eligible: boolean;
    plenaryVotes: number;
    electionVotes: number;
    reason: string;
  }>;
}

export interface VoterNominationRecord {
  delegationId: number;
  meetingId: number;
  nominatedVoters: Array<{
    userId: number;
    name: string;
    nominatedBy: number;
    nominatedAt: Date;
  }>;
  totalNominated: number;
  maxVoters: number;
}

export interface EligibilitySnapshotRecord {
  snapshotId: string;
  meetingId: number;
  meetingType: string;
  snapshotDate: Date;
  governanceVersion: string;
  delegations: Array<{
    delegationId: number;
    organizationName: string;
    organizationType: string;
    plenaryVotes: number;
    electionVotes: number;
    eligible: boolean;
    financialClear: boolean;
    credentialApproved: boolean;
    eligibilityReasons: string[];
  }>;
  totals: {
    totalDelegations: number;
    eligibleDelegations: number;
    totalPlenaryVotes: number;
    totalElectionVotes: number;
  };
}

// ============================================================================
// VOTING RIGHTS ENGINE
// ============================================================================

export const votingRightsEngine = {
  // ------------------------------------------------------------------
  // CALCULATE VOTING ENTITLEMENT
  // ------------------------------------------------------------------

  /**
   * Calculate voting entitlement for a single organization.
   * Uses the governance rules engine for all calculations.
   */
  calculateEntitlement: async (
    input: VotingEntitlementInput
  ): Promise<VotingEntitlementResult> => {
    const eligibilityReasons: string[] = [];
    let eligible = true;

    // 1. Check credential status
    if (input.credentialStatus !== "approved" && input.credentialStatus !== "overridden") {
      eligible = false;
      eligibilityReasons.push(`Credential status is '${input.credentialStatus}' (required: 'approved' or 'overridden')`);
    }

    // 2. Check financial eligibility (B-8.7.6)
    const debtThreshold = (await getParameter("voting.debt_threshold_pkr") as number) ?? 2000;
    if (input.hasOutstandingDebt && input.debtAmount > debtThreshold) {
      eligible = false;
      eligibilityReasons.push(`Outstanding debt (PKR ${input.debtAmount}) exceeds threshold (PKR ${debtThreshold}) - B-8.7.6`);
    } else if (input.hasOutstandingDebt && input.debtAmount > 0) {
      eligibilityReasons.push(`Warning: Outstanding debt (PKR ${input.debtAmount}) below threshold`);
    }

    // 3. Resolve voting rule from governance engine
    const ruleKey = `voting.${input.organizationType}`;
    const rule = await resolveEffectiveRule(ruleKey);

    let plenaryVotes = 0;
    let electionVotes = 0;
    let ruleSource = "DEFAULT";
    let calculation = "";

    if (rule) {
      const params = rule.parameters;
      plenaryVotes = (params.plenary_votes as number) ?? 0;
      electionVotes = (params.election_votes as number) ?? 0;
      ruleSource = rule.sourceClause;

      // B-8.7.4: If <10 delegates, election votes = delegate count
      const minDelegatesForFullVotes = (await getParameter("voting.min_delegates_for_full_votes") as number) ?? 10;

      if (input.delegateCount > 0 && input.delegateCount < minDelegatesForFullVotes && electionVotes > 0) {
        const adjustedVotes = input.delegateCount;
        calculation = `${input.organizationType}: ${adjustedVotes} election votes (B-8.7.4: delegate count ${input.delegateCount} < ${minDelegatesForFullVotes})`;
        electionVotes = adjustedVotes;
      } else if (input.delegateCount >= minDelegatesForFullVotes) {
        calculation = `${input.organizationType}: ${electionVotes} election votes (full ${minDelegatesForFullVotes} delegates)`;
      } else {
        calculation = `${input.organizationType}: ${plenaryVotes} plenary, ${electionVotes} election votes`;
      }
    } else {
      // Default fallback
      switch (input.organizationType) {
        case "permanent_lc":
        case "temporary_lc":
          plenaryVotes = 1;
          electionVotes = Math.min(input.delegateCount || 10, 10);
          calculation = `${input.organizationType}: default ${plenaryVotes} plenary, ${electionVotes} election votes`;
          break;
        case "candidate_lc":
        case "ci":
          plenaryVotes = 0;
          electionVotes = 1;
          calculation = `${input.organizationType}: default 0 plenary, 1 election vote`;
          break;
        default:
          calculation = `${input.organizationType}: no voting rights configured`;
      }
    }

    // 4. Apply eligibility to votes
    const finalPlenaryVotes = eligible ? plenaryVotes : 0;
    const finalElectionVotes = eligible ? electionVotes : 0;

    if (!eligible && (plenaryVotes > 0 || electionVotes > 0)) {
      calculation += ` | INELIGIBLE: votes zeroed out`;
    }

    return {
      organizationType: input.organizationType,
      organizationName: input.organizationName,
      plenaryVotes: finalPlenaryVotes,
      electionVotes: finalElectionVotes,
      delegateCount: input.delegateCount,
      eligible,
      eligibilityReasons,
      calculation,
      ruleSource,
      governanceVersion: input.governanceVersion ?? await getCurrentGovernanceVersion(),
    };
  },

  // ------------------------------------------------------------------
  // CALCULATE FULL VOTING MATRIX
  // ------------------------------------------------------------------

  /**
   * Calculate the complete voting matrix for a meeting.
   * Returns per-delegation and aggregate voting rights.
   */
  calculateVotingMatrix: async (
    meetingId: number,
    meetingType: "nga" | "sga" = "nga"
  ): Promise<VotingMatrixResult> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    // Get meeting governance version
    const [meeting] = await db
      .select()
      .from(ngaMeetings)
      .where(eq(ngaMeetings.id, meetingId))
      .limit(1);

    const governanceVersion = meeting?.governanceVersion ?? await getCurrentGovernanceVersion();

    // Get all delegations
    const delegations = await db
      .select()
      .from(ngaDelegations)
      .where(eq(ngaDelegations.meetingId, meetingId))
      .orderBy(ngaDelegations.organizationName);

    // Group by organization type
    const grouped = new Map<string, VotingMatrixRow>();

    const allTypes = ["permanent_lc", "temporary_lc", "candidate_lc", "ci"];
    for (const type of allTypes) {
      grouped.set(type, {
        organizationType: type,
        plenaryVotes: 0,
        electionVotes: 0,
        delegationCount: 0,
        delegateCount: 0,
        delegations: [],
      });
    }

    let totalEligible = 0;
    let totalIneligible = 0;

    for (const d of delegations) {
      const entitlement = await votingRightsEngine.calculateEntitlement({
        organizationType: d.organizationType as any,
        organizationName: d.organizationName,
        delegateCount: d.delegateCount ?? 0,
        hasOutstandingDebt: d.hasOutstandingDebt ?? false,
        debtAmount: d.debtAmount ?? 0,
        credentialStatus: d.credentialStatus ?? "pending",
        meetingType: meetingType === "nga" ? "plenary" : "plenary",
        governanceVersion,
      });

      const row = grouped.get(d.organizationType) ?? {
        organizationType: d.organizationType,
        plenaryVotes: 0,
        electionVotes: 0,
        delegationCount: 0,
        delegateCount: 0,
        delegations: [],
      };

      row.plenaryVotes += entitlement.plenaryVotes;
      row.electionVotes += entitlement.electionVotes;
      row.delegationCount += 1;
      row.delegateCount += d.delegateCount ?? 0;
      row.delegations.push({
        id: d.id,
        name: d.organizationName,
        eligible: entitlement.eligible,
        plenaryVotes: entitlement.plenaryVotes,
        electionVotes: entitlement.electionVotes,
        reason: entitlement.eligibilityReasons.join("; ") || "Eligible",
      });

      grouped.set(d.organizationType, row);

      if (entitlement.eligible) {
        totalEligible++;
      } else {
        totalIneligible++;
      }
    }

    const matrix = Array.from(grouped.values());

    const totals = matrix.reduce(
      (acc, row) => ({
        plenaryVotes: acc.plenaryVotes + row.plenaryVotes,
        electionVotes: acc.electionVotes + row.electionVotes,
        totalDelegations: acc.totalDelegations + row.delegationCount,
        eligibleDelegations: acc.eligibleDelegations,
        ineligibleDelegations: acc.ineligibleDelegations,
      }),
      {
        plenaryVotes: 0,
        electionVotes: 0,
        totalDelegations: 0,
        eligibleDelegations: totalEligible,
        ineligibleDelegations: totalIneligible,
      }
    );

    return {
      meetingId,
      meetingType,
      matrix,
      totals,
      calculatedAt: new Date(),
      governanceVersion,
    };
  },

  // ------------------------------------------------------------------
  // PERSIST VOTING RIGHTS CALCULATIONS
  // ------------------------------------------------------------------

  /**
   * Calculate and persist voting rights for all delegations in a meeting.
   * Creates immutable calculation records for historical reference.
   */
  persistVotingRights: async (
    meetingId: number,
    meetingType: "nga" | "sga" = "nga"
  ): Promise<VotingRightsCalculation[]> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const matrix = await votingRightsEngine.calculateVotingMatrix(meetingId, meetingType);
    const results: VotingRightsCalculation[] = [];

    // Get all delegations
    const delegations = await db
      .select()
      .from(ngaDelegations)
      .where(eq(ngaDelegations.meetingId, meetingId));

    for (const d of delegations) {
      const entitlement = await votingRightsEngine.calculateEntitlement({
        organizationType: d.organizationType as any,
        organizationName: d.organizationName,
        delegateCount: d.delegateCount ?? 0,
        hasOutstandingDebt: d.hasOutstandingDebt ?? false,
        debtAmount: d.debtAmount ?? 0,
        credentialStatus: d.credentialStatus ?? "pending",
        meetingType: meetingType === "nga" ? "plenary" : "plenary",
        governanceVersion: matrix.governanceVersion,
      });

      // Check if calculation already exists
      const [existing] = await db
        .select()
        .from(votingRightsCalculations)
        .where(
          and(
            eq(votingRightsCalculations.meetingId, meetingId),
            eq(votingRightsCalculations.delegationId, d.id)
          )
        )
        .limit(1);

      const calcData: InsertVotingRightsCalculation = {
        meetingId,
        meetingType,
        delegationId: d.id,
        organizationType: d.organizationType,
        plenaryVotes: entitlement.plenaryVotes,
        electionVotes: entitlement.electionVotes,
        ruleKey: `voting.${d.organizationType}`,
        ruleVersion: matrix.governanceVersion,
        eligible: entitlement.eligible,
        eligibilityReason: entitlement.eligibilityReasons.join("; "),
        financialClear: !d.hasOutstandingDebt || (d.debtAmount ?? 0) <= 2000,
        debtAmount: d.debtAmount ?? 0,
        debtThreshold: 2000,
        credentialApproved: d.credentialStatus === "approved" || d.credentialStatus === "overridden",
        calculation: entitlement.calculation,
        governanceVersion: matrix.governanceVersion,
      };

      if (existing) {
        await db
          .update(votingRightsCalculations)
          .set(calcData)
          .where(eq(votingRightsCalculations.id, existing.id));

        const [updated] = await db
          .select()
          .from(votingRightsCalculations)
          .where(eq(votingRightsCalculations.id, existing.id))
          .limit(1);

        results.push(updated);
      } else {
        const [result] = await db
          .insert(votingRightsCalculations)
          .values(calcData);

        const [inserted] = await db
          .select()
          .from(votingRightsCalculations)
          .where(eq(votingRightsCalculations.id, Number(result.insertId)))
          .limit(1);

        results.push(inserted);
      }
    }

    await logAuditEvent({
      action: "voting_rights.calculated",
      entityType: "voting_rights",
      entityId: meetingId,
      after: {
        meetingType,
        totalDelegations: delegations.length,
        totalPlenaryVotes: matrix.totals.plenaryVotes,
        totalElectionVotes: matrix.totals.electionVotes,
      },
    });

    return results;
  },

  // ------------------------------------------------------------------
  // VOTER NOMINATION (>10 delegates)
  // ------------------------------------------------------------------

  /**
   * Nominate voters for a delegation with >10 delegates.
   * B-8.7.5: Head of Delegation nominates voters.
   */
  nominateVoters: async (
    delegationId: number,
    nominatedBy: number,
    voterIds: number[]
  ): Promise<VoterNominationRecord> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const [delegation] = await db
      .select()
      .from(ngaDelegations)
      .where(eq(ngaDelegations.id, delegationId))
      .limit(1);

    if (!delegation) throw new Error(`Delegation ${delegationId} not found.`);

    // Only required if >10 delegates
    const maxVoters = delegation.electionVotes ?? 10;
    if (voterIds.length > maxVoters) {
      throw new Error(`Cannot nominate ${voterIds.length} voters. Maximum is ${maxVoters}.`);
    }

    // Verify all nominated voters are delegates in this delegation
    const delegates = await db
      .select()
      .from(ngaDelegates)
      .where(
        and(
          eq(ngaDelegates.delegationId, delegationId),
          eq(ngaDelegates.meetingId, delegation.meetingId)
        )
      );

    const delegateUserIds = delegates.map(d => d.userId);
    const invalidNominations = voterIds.filter(id => !delegateUserIds.includes(id));

    if (invalidNominations.length > 0) {
      throw new Error(`Invalid nominations: users ${invalidNominations.join(", ")} are not delegates in this delegation.`);
    }

    // Get delegate names
    const nominatedVoters = voterIds.map(userId => {
      const delegate = delegates.find(d => d.userId === userId);
      return {
        userId,
        name: `User ${userId}`, // Would be resolved from users table in production
        nominatedBy,
        nominatedAt: new Date(),
      };
    });

    // Store nominations in delegation metadata
    const metadata = (delegation.metadata as Record<string, unknown>) ?? {};
    await db
      .update(ngaDelegations)
      .set({
        metadata: {
          ...metadata,
          voterNominations: {
            nominatedVoters: nominatedVoters.map(v => ({
              ...v,
              nominatedAt: v.nominatedAt.toISOString(),
            })),
            nominatedBy,
            nominatedAt: new Date().toISOString(),
          },
        },
      })
      .where(eq(ngaDelegations.id, delegationId));

    await logAuditEvent({
      userId: nominatedBy,
      action: "voting_rights.voters_nominated",
      entityType: "nga_delegation",
      entityId: delegationId,
      after: { voterIds, maxVoters },
    });

    return {
      delegationId,
      meetingId: delegation.meetingId,
      nominatedVoters,
      totalNominated: voterIds.length,
      maxVoters,
    };
  },

  // ------------------------------------------------------------------
  // ELIGIBILITY SNAPSHOTS
  // ------------------------------------------------------------------

  /**
   * Take an eligibility snapshot for a meeting.
   * Creates an immutable record of voting eligibility at a point in time.
   */
  takeEligibilitySnapshot: async (
    meetingId: number,
    meetingType: "nga" | "sga" = "nga"
  ): Promise<EligibilitySnapshotRecord> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const [meeting] = await db
      .select()
      .from(ngaMeetings)
      .where(eq(ngaMeetings.id, meetingId))
      .limit(1);

    const governanceVersion = meeting?.governanceVersion ?? await getCurrentGovernanceVersion();
    const now = new Date();

    // Get all delegations
    const delegations = await db
      .select()
      .from(ngaDelegations)
      .where(eq(ngaDelegations.meetingId, meetingId));

    const snapshotDelegations = [];
    let totalPlenaryVotes = 0;
    let totalElectionVotes = 0;
    let eligibleCount = 0;

    for (const d of delegations) {
      const entitlement = await votingRightsEngine.calculateEntitlement({
        organizationType: d.organizationType as any,
        organizationName: d.organizationName,
        delegateCount: d.delegateCount ?? 0,
        hasOutstandingDebt: d.hasOutstandingDebt ?? false,
        debtAmount: d.debtAmount ?? 0,
        credentialStatus: d.credentialStatus ?? "pending",
        meetingType: meetingType === "nga" ? "plenary" : "plenary",
        governanceVersion,
      });

      snapshotDelegations.push({
        delegationId: d.id,
        organizationName: d.organizationName,
        organizationType: d.organizationType,
        plenaryVotes: entitlement.plenaryVotes,
        electionVotes: entitlement.electionVotes,
        eligible: entitlement.eligible,
        financialClear: !d.hasOutstandingDebt || (d.debtAmount ?? 0) <= 2000,
        credentialApproved: d.credentialStatus === "approved" || d.credentialStatus === "overridden",
        eligibilityReasons: entitlement.eligibilityReasons,
      });

      totalPlenaryVotes += entitlement.plenaryVotes;
      totalElectionVotes += entitlement.electionVotes;
      if (entitlement.eligible) eligibleCount++;
    }

    const snapshot: EligibilitySnapshotRecord = {
      snapshotId: `SNAP-${meetingId}-${now.getTime()}`,
      meetingId,
      meetingType,
      snapshotDate: now,
      governanceVersion,
      delegations: snapshotDelegations,
      totals: {
        totalDelegations: delegations.length,
        eligibleDelegations: eligibleCount,
        totalPlenaryVotes,
        totalElectionVotes,
      },
    };

    // Store snapshot in meeting metadata
    const metadata = (meeting?.metadata as Record<string, unknown>) ?? {};
    const snapshots = (metadata.eligibilitySnapshots as any[]) ?? [];
    snapshots.push(snapshot);

    await db
      .update(ngaMeetings)
      .set({
        metadata: {
          ...metadata,
          eligibilitySnapshots: snapshots,
          lastSnapshotAt: now.toISOString(),
        },
      })
      .where(eq(ngaMeetings.id, meetingId));

    await logAuditEvent({
      action: "voting_rights.snapshot_taken",
      entityType: "nga_meeting",
      entityId: meetingId,
      after: {
        snapshotId: snapshot.snapshotId,
        totalDelegations: snapshot.totals.totalDelegations,
        eligibleDelegations: snapshot.totals.eligibleDelegations,
        totalPlenaryVotes: snapshot.totals.totalPlenaryVotes,
        totalElectionVotes: snapshot.totals.totalElectionVotes,
      },
    });

    return snapshot;
  },

  /**
   * Get the most recent eligibility snapshot for a meeting.
   */
  getLatestSnapshot: async (meetingId: number): Promise<EligibilitySnapshotRecord | null> => {
    const db = getDb();
    if (!db) return null;

    const [meeting] = await db
      .select()
      .from(ngaMeetings)
      .where(eq(ngaMeetings.id, meetingId))
      .limit(1);

    if (!meeting) return null;

    const metadata = (meeting.metadata as Record<string, unknown>) ?? {};
    const snapshots = (metadata.eligibilitySnapshots as any[]) ?? [];

    if (snapshots.length === 0) return null;

    return snapshots[snapshots.length - 1];
  },

  /**
   * Compare two eligibility snapshots.
   */
  compareSnapshots: (
    before: EligibilitySnapshotRecord,
    after: EligibilitySnapshotRecord
  ): {
    addedDelegations: string[];
    removedDelegations: string[];
    eligibilityChanges: Array<{
      delegationName: string;
      wasEligible: boolean;
      nowEligible: boolean;
      reason: string;
    }>;
    votingPowerChanges: {
      plenaryVotesDelta: number;
      electionVotesDelta: number;
    };
  } => {
    const beforeDelegations = new Map(before.delegations.map(d => [d.delegationId, d]));
    const afterDelegations = new Map(after.delegations.map(d => [d.delegationId, d]));

    const addedDelegations: string[] = [];
    const removedDelegations: string[] = [];
    const eligibilityChanges: Array<{
      delegationName: string;
      wasEligible: boolean;
      nowEligible: boolean;
      reason: string;
    }> = [];

    // Check for added delegations
    for (const [id, d] of Array.from(afterDelegations.entries())) {
      if (!beforeDelegations.has(id)) {
        addedDelegations.push(d.organizationName);
      }
    }

    // Check for removed delegations
    for (const [id, d] of Array.from(beforeDelegations.entries())) {
      if (!afterDelegations.has(id)) {
        removedDelegations.push(d.organizationName);
      }
    }

    // Check for eligibility changes
    for (const [id, afterD] of Array.from(afterDelegations.entries())) {
      const beforeD = beforeDelegations.get(id);
      if (beforeD && beforeD.eligible !== afterD.eligible) {
        const reason = afterD.eligibilityReasons.join("; ") || "Status changed";
        eligibilityChanges.push({
          delegationName: afterD.organizationName,
          wasEligible: beforeD.eligible,
          nowEligible: afterD.eligible,
          reason,
        });
      }
    }

    return {
      addedDelegations,
      removedDelegations,
      eligibilityChanges,
      votingPowerChanges: {
        plenaryVotesDelta: after.totals.totalPlenaryVotes - before.totals.totalPlenaryVotes,
        electionVotesDelta: after.totals.totalElectionVotes - before.totals.totalElectionVotes,
      },
    };
  },

  // ------------------------------------------------------------------
  // VOTING CREDENTIAL INTEGRATION
  // ------------------------------------------------------------------

  /**
   * Calculate voting credentials for a delegation.
   * Returns the credentials that should be issued.
   */
  calculateVotingCredentials: async (
    delegationId: number
  ): Promise<{
    plenaryCard: boolean;
    electionCard: boolean;
    plenaryVotes: number;
    electionVotes: number;
    reason: string;
  }> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const [delegation] = await db
      .select()
      .from(ngaDelegations)
      .where(eq(ngaDelegations.id, delegationId))
      .limit(1);

    if (!delegation) throw new Error(`Delegation ${delegationId} not found.`);

    const entitlement = await votingRightsEngine.calculateEntitlement({
      organizationType: delegation.organizationType as any,
      organizationName: delegation.organizationName,
      delegateCount: delegation.delegateCount ?? 0,
      hasOutstandingDebt: delegation.hasOutstandingDebt ?? false,
      debtAmount: delegation.debtAmount ?? 0,
      credentialStatus: delegation.credentialStatus ?? "pending",
      meetingType: "plenary",
      governanceVersion: delegation.metadata as any,
    });

    return {
      plenaryCard: entitlement.plenaryVotes > 0,
      electionCard: entitlement.electionVotes > 0,
      plenaryVotes: entitlement.plenaryVotes,
      electionVotes: entitlement.electionVotes,
      reason: entitlement.calculation,
    };
  },

  // ------------------------------------------------------------------
  // QUERIES
  // ------------------------------------------------------------------

  /**
   * Get voting rights calculations for a meeting.
   */
  getVotingRightsForMeeting: async (meetingId: number): Promise<VotingRightsCalculation[]> => {
    const db = getDb();
    if (!db) return [];

    return db
      .select()
      .from(votingRightsCalculations)
      .where(eq(votingRightsCalculations.meetingId, meetingId))
      .orderBy(votingRightsCalculations.organizationType);
  },

  /**
   * Get voting rights explanation for a delegation.
   */
  explainVotingRights: async (delegationId: number): Promise<{
    delegation: any;
    entitlement: VotingEntitlementResult;
    ruleExplanation: string;
  }> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const [delegation] = await db
      .select()
      .from(ngaDelegations)
      .where(eq(ngaDelegations.id, delegationId))
      .limit(1);

    if (!delegation) throw new Error(`Delegation ${delegationId} not found.`);

    const entitlement = await votingRightsEngine.calculateEntitlement({
      organizationType: delegation.organizationType as any,
      organizationName: delegation.organizationName,
      delegateCount: delegation.delegateCount ?? 0,
      hasOutstandingDebt: delegation.hasOutstandingDebt ?? false,
      debtAmount: delegation.debtAmount ?? 0,
      credentialStatus: delegation.credentialStatus ?? "pending",
      meetingType: "plenary",
    });

    const ruleExplanation = [
      `Delegation: ${delegation.organizationName}`,
      `Type: ${delegation.organizationType}`,
      `Credential Status: ${delegation.credentialStatus}`,
      `Financial: ${delegation.hasOutstandingDebt ? `PKR ${delegation.debtAmount} outstanding` : "Clear"}`,
      `Delegate Count: ${delegation.delegateCount}`,
      ``,
      `Voting Rights:`,
      `  Plenary Votes: ${entitlement.plenaryVotes}`,
      `  Election Votes: ${entitlement.electionVotes}`,
      `  Eligible: ${entitlement.eligible ? "Yes" : "No"}`,
      ``,
      `Calculation: ${entitlement.calculation}`,
      `Rule Source: ${entitlement.ruleSource}`,
      ...entitlement.eligibilityReasons.map(r => `  - ${r}`),
    ].join("\n");

    return {
      delegation,
      entitlement,
      ruleExplanation,
    };
  },

  /**
   * Get summary of voting rights across all meetings.
   */
  getVotingRightsSummary: async (organizationId?: number) => {
    const db = getDb();
    if (!db) return null;

    const [totalCalculations] = await db
      .select({ count: count() })
      .from(votingRightsCalculations);

    const [eligible] = await db
      .select({ count: count() })
      .from(votingRightsCalculations)
      .where(eq(votingRightsCalculations.eligible, true));

    const [ineligible] = await db
      .select({ count: count() })
      .from(votingRightsCalculations)
      .where(eq(votingRightsCalculations.eligible, false));

    return {
      totalCalculations: totalCalculations?.count ?? 0,
      eligible: eligible?.count ?? 0,
      ineligible: ineligible?.count ?? 0,
    };
  },
};

export default votingRightsEngine;
