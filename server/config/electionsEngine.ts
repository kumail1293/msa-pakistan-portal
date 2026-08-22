/**
 * Elections Engine
 *
 * Handles all democratic processes: nominations, eligibility, campaigning,
 * ballots, voting, counting, disputes, certification, and publication.
 *
 * Usage:
 *   import { createElection, nominateCandidate, castBallot, certifyResults } from "./electionsEngine";
 *
 *   const election = await createElection({
 *     title: "Presidential Election 2025",
 *     type: "presidential",
 *     votingMethod: { type: "plurality" },
 *     votingStart: new Date("2025-03-01"),
 *     votingEnd: new Date("2025-03-08"),
 *   });
 *
 *   await nominateCandidate(election.id, userId, { statement: "..." });
 *   await castBallot(election.id, voterId, { candidateId: 1 });
 *   await certifyResults(election.id, certifierId);
 */

import { eq, and, desc, sql } from "drizzle-orm";
import {
  elections,
  candidates,
  ballots,
  electionResults,
  electionDisputes,
} from "../../drizzle/schema.governance";
import { users } from "../../drizzle/schema";
import { getDb } from "../db";
import { logAuditEvent } from "./auditService";

// ============================================================================
// Types
// ============================================================================

export interface CreateElectionInput {
  title: string;
  description?: string;
  type: "presidential" | "board" | "national_team" | "regional" | "chapter" | "committee" | "referendum";
  organizationId?: number;
  votingMethod: {
    type: "plurality" | "majority" | "ranked_choice" | "runoff" | "weighted" | "secret_ballot" | "consensus" | "unanimity";
    requireSecondRound?: boolean;
    weightedRoles?: Record<string, number>;
  };
  nominationsStart?: Date;
  nominationsEnd?: Date;
  campaignStart?: Date;
  campaignEnd?: Date;
  votingStart: Date;
  votingEnd: Date;
  disputeEnd?: Date;
  eligibilityCriteria?: {
    minMembershipMonths?: number;
    membershipStatus?: string[];
    minAge?: number;
    customRules?: Array<{
      type: string;
      params: Record<string, unknown>;
      message: string;
    }>;
  };
  nominationConfig?: {
    requireEndorsement?: boolean;
    minEndorsements?: number;
    requireStatement?: boolean;
    maxCandidates?: number;
    customFields?: Array<{
      name: string;
      label: string;
      type: string;
      required: boolean;
    }>;
  };
  resultConfig?: {
    disputePeriodDays?: number;
    requireCertification?: boolean;
    publishResults?: boolean;
    showTurnout?: boolean;
  };
}

export interface NominateCandidateInput {
  electionId: number;
  userId: number;
  position?: string;
  nominationData?: Record<string, unknown>;
  endorsements?: Array<{ userId: number }>;
}

export interface CastBallotInput {
  electionId: number;
  voterId: number;
  ballotData: Record<string, unknown>;
}

export interface ElectionFilters {
  organizationId?: number;
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Election Management
// ============================================================================

/**
 * Create a new election.
 */
export async function createElection(
  input: CreateElectionInput,
  createdById?: number
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [result] = await db.insert(elections).values({
      title: input.title,
      description: input.description,
      type: input.type,
      organizationId: input.organizationId,
      status: "draft",
      nominationsStart: input.nominationsStart,
      nominationsEnd: input.nominationsEnd,
      campaignStart: input.campaignStart,
      campaignEnd: input.campaignEnd,
      votingStart: input.votingStart,
      votingEnd: input.votingEnd,
      disputeEnd: input.disputeEnd,
      votingMethod: input.votingMethod,
      eligibilityCriteria: input.eligibilityCriteria,
      nominationConfig: input.nominationConfig,
      resultConfig: input.resultConfig,
      createdById,
    });

    const electionId = Number((result as any)[0].insertId);

    await logAuditEvent({
      userId: createdById,
      action: "election.created",
      entityType: "election",
      entityId: electionId,
      after: { title: input.title, type: input.type },
    });

    console.log(`[Elections] Created election "${input.title}" (#${electionId}).`);
    return { id: electionId };
  } catch (error) {
    console.error("[Elections] Failed to create election:", error);
    return null;
  }
}

/**
 * List elections with optional filters.
 */
export async function listElections(
  filters: ElectionFilters = {}
): Promise<Array<{
  id: number;
  title: string;
  description: string | null;
  type: string;
  status: string;
  votingStart: Date;
  votingEnd: Date;
  createdAt: Date;
}>> {
  const db = getDb();
  if (!db) return [];

  try {
    const conditions = [];
    if (filters.organizationId) conditions.push(eq(elections.organizationId, filters.organizationId));
    if (filters.type) conditions.push(eq(elections.type, filters.type as any));
    if (filters.status) conditions.push(eq(elections.status, filters.status as any));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    return await db
      .select()
      .from(elections)
      .where(where)
      .orderBy(desc(elections.createdAt))
      .limit(filters.limit ?? 50)
      .offset(filters.offset ?? 0);
  } catch (error) {
    console.error("[Elections] Failed to list elections:", error);
    return [];
  }
}

/**
 * Get election details.
 */
export async function getElection(
  electionId: number
): Promise<{
  election: any;
  candidates: any[];
  result: any | null;
} | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [election] = await db
      .select()
      .from(elections)
      .where(eq(elections.id, electionId))
      .limit(1);

    if (!election) return null;

    const candidateList = await db
      .select()
      .from(candidates)
      .where(eq(candidates.electionId, electionId))
      .orderBy(candidates.nominationDate);

    const [result] = await db
      .select()
      .from(electionResults)
      .where(eq(electionResults.electionId, electionId))
      .limit(1);

    return { election, candidates: candidateList, result };
  } catch (error) {
    console.error("[Elections] Failed to get election:", error);
    return null;
  }
}

/**
 * Update election status.
 */
export async function updateElectionStatus(
  electionId: number,
  status: string,
  userId?: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [election] = await db
      .select()
      .from(elections)
      .where(eq(elections.id, electionId))
      .limit(1);

    if (!election) return false;

    await db
      .update(elections)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(elections.id, electionId));

    await logAuditEvent({
      userId,
      action: "election.status_changed",
      entityType: "election",
      entityId: electionId,
      before: { status: election.status },
      after: { status },
    });

    return true;
  } catch (error) {
    console.error("[Elections] Failed to update election status:", error);
    return false;
  }
}

// ============================================================================
// Candidate Management
// ============================================================================

/**
 * Nominate a candidate for an election.
 */
export async function nominateCandidate(
  input: NominateCandidateInput
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Check election exists and is in nominations phase
    const [election] = await db
      .select()
      .from(elections)
      .where(eq(elections.id, input.electionId))
      .limit(1);

    if (!election) {
      console.warn("[Elections] Election not found.");
      return null;
    }

    if (election.status !== "nominations_open" && election.status !== "published") {
      console.warn(`[Elections] Election is not accepting nominations (status: ${election.status}).`);
      return null;
    }

    // Check eligibility
    const eligibility = await checkEligibility(input.electionId, input.userId);
    if (!eligibility.eligible) {
      console.warn(`[Elections] User ${input.userId} is not eligible: ${eligibility.reasons.join(", ")}`);
      return null;
    }

    // Check for duplicate nomination
    const [existing] = await db
      .select()
      .from(candidates)
      .where(
        and(
          eq(candidates.electionId, input.electionId),
          eq(candidates.userId, input.userId)
        )
      )
      .limit(1);

    if (existing) {
      console.warn("[Elections] User has already nominated for this election.");
      return null;
    }

    // Check max candidates limit
    const nominationConfig = election.nominationConfig as Record<string, unknown> | undefined;
    if (nominationConfig?.maxCandidates) {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(candidates)
        .where(
          and(
            eq(candidates.electionId, input.electionId),
            sql`${candidates.status} != 'withdrawn'`
          )
        );

      if (countResult && countResult.count >= (nominationConfig.maxCandidates as number)) {
        console.warn("[Elections] Maximum number of candidates reached.");
        return null;
      }
    }

    // Create nomination
    const [result] = await db.insert(candidates).values({
      electionId: input.electionId,
      userId: input.userId,
      position: input.position,
      nominationData: input.nominationData,
      endorsements: input.endorsements,
      status: "nominated",
    });

    const candidateId = Number((result as any)[0].insertId);

    await logAuditEvent({
      action: "election.candidate_nominated",
      entityType: "candidate",
      entityId: candidateId,
      after: { electionId: input.electionId, userId: input.userId },
    });

    console.log(`[Elections] Candidate nominated (#${candidateId}) for election #${input.electionId}.`);
    return { id: candidateId };
  } catch (error) {
    console.error("[Elections] Failed to nominate candidate:", error);
    return null;
  }
}

/**
 * Verify a candidate's eligibility.
 */
export async function verifyCandidate(
  candidateId: number,
  verifiedBy: number,
  approved: boolean
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [candidate] = await db
      .select()
      .from(candidates)
      .where(eq(candidates.id, candidateId))
      .limit(1);

    if (!candidate || candidate.status !== "nominated") return false;

    await db
      .update(candidates)
      .set({
        status: approved ? "approved" : "disqualified",
        verifiedAt: new Date(),
        verifiedBy,
        updatedAt: new Date(),
      })
      .where(eq(candidates.id, candidateId));

    await logAuditEvent({
      userId: verifiedBy,
      action: approved ? "election.candidate_approved" : "election.candidate_disqualified",
      entityType: "candidate",
      entityId: candidateId,
    });

    return true;
  } catch (error) {
    console.error("[Elections] Failed to verify candidate:", error);
    return false;
  }
}

/**
 * Withdraw a candidate nomination.
 */
export async function withdrawCandidate(
  candidateId: number,
  userId: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [candidate] = await db
      .select()
      .from(candidates)
      .where(eq(candidates.id, candidateId))
      .limit(1);

    if (!candidate || candidate.userId !== userId) return false;
    if (candidate.status === "withdrawn") return false;

    await db
      .update(candidates)
      .set({
        status: "withdrawn",
        updatedAt: new Date(),
      })
      .where(eq(candidates.id, candidateId));

    await logAuditEvent({
      userId,
      action: "election.candidate_withdrawn",
      entityType: "candidate",
      entityId: candidateId,
    });

    return true;
  } catch (error) {
    console.error("[Elections] Failed to withdraw candidate:", error);
    return false;
  }
}

// ============================================================================
// Eligibility Checking
// ============================================================================

/**
 * Check if a user is eligible to vote/nominate in an election.
 */
export async function checkEligibility(
  electionId: number,
  userId: number
): Promise<{
  eligible: boolean;
  reasons: string[];
  criteria: Record<string, boolean>;
}> {
  const db = getDb();
  if (!db) return { eligible: false, reasons: ["Database not available"], criteria: {} };

  try {
    const [election] = await db
      .select()
      .from(elections)
      .where(eq(elections.id, electionId))
      .limit(1);

    if (!election) {
      return { eligible: false, reasons: ["Election not found"], criteria: {} };
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return { eligible: false, reasons: ["User not found"], criteria: {} };
    }

    const criteria: Record<string, boolean> = {};
    const reasons: string[] = [];

    // Check membership status
    const eligibility = election.eligibilityCriteria as Record<string, unknown> | undefined;
    
    if (eligibility?.membershipStatus) {
      const allowedStatuses = eligibility.membershipStatus as string[];
      const userStatus = user.membershipStatus ?? "Pending";
      criteria.membershipStatus = allowedStatuses.includes(userStatus);
      if (!criteria.membershipStatus) {
        reasons.push(`Membership status must be one of: ${allowedStatuses.join(", ")}`);
      }
    } else {
      criteria.membershipStatus = true;
    }

    // Check membership duration
    if (eligibility?.minMembershipMonths && user.membershipStartDate) {
      const monthsSinceJoin = Math.floor(
        (Date.now() - new Date(user.membershipStartDate).getTime()) / (30 * 24 * 60 * 60 * 1000)
      );
      criteria.membershipDuration = monthsSinceJoin >= (eligibility.minMembershipMonths as number);
      if (!criteria.membershipDuration) {
        reasons.push(`Must be a member for at least ${eligibility.minMembershipMonths} months`);
      }
    } else {
      criteria.membershipDuration = true;
    }

    // Note: Age check requires membership application data (dateOfBirth is on membershipApplications, not users)
    // For now, skip age check at this level - should be checked during application review
    criteria.ageRequirement = true;

    const eligible = Object.values(criteria).every(Boolean);

    return { eligible, reasons, criteria };
  } catch (error) {
    console.error("[Elections] Failed to check eligibility:", error);
    return { eligible: false, reasons: ["Error checking eligibility"], criteria: {} };
  }
}

// ============================================================================
// Voting
// ============================================================================

/**
 * Cast a ballot in an election.
 */
export async function castBallot(
  input: CastBallotInput
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    // Check election exists and is in voting phase
    const [election] = await db
      .select()
      .from(elections)
      .where(eq(elections.id, input.electionId))
      .limit(1);

    if (!election) {
      return { success: false, error: "Election not found" };
    }

    if (election.status !== "voting_active") {
      return { success: false, error: "Election is not in voting phase" };
    }

    // Check voting period
    const now = new Date();
    if (now < election.votingStart || now > election.votingEnd) {
      return { success: false, error: "Voting period has ended" };
    }

    // Check eligibility
    const eligibility = await checkEligibility(input.electionId, input.voterId);
    if (!eligibility.eligible) {
      return { success: false, error: "Not eligible to vote" };
    }

    // Check if already voted (using voter hash)
    const voterHash = await generateVoterHash(input.electionId, input.voterId);
    const [existingBallot] = await db
      .select()
      .from(ballots)
      .where(
        and(
          eq(ballots.electionId, input.electionId),
          eq(ballots.voterHash, voterHash)
        )
      )
      .limit(1);

    if (existingBallot) {
      return { success: false, error: "Already voted" };
    }

    // Encrypt ballot
    const { encryptedBallot, iv } = await encryptBallot(
      input.ballotData,
      input.electionId
    );

    // Store ballot
    const [result] = await db.insert(ballots).values({
      electionId: input.electionId,
      voterHash,
      encryptedBallot,
      iv,
      method: (election.votingMethod as Record<string, unknown>).type as string,
    });

    await logAuditEvent({
      userId: input.voterId,
      action: "election.ballot_cast",
      entityType: "ballot",
      entityId: Number((result as any)[0].insertId),
      after: { electionId: input.electionId },
      // Note: ballot content is NOT logged for secrecy
    });

    return { success: true };
  } catch (error) {
    console.error("[Elections] Failed to cast ballot:", error);
    return { success: false, error: "Internal error" };
  }
}

/**
 * Check if a user has already voted.
 */
export async function hasVoted(
  electionId: number,
  voterId: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const voterHash = await generateVoterHash(electionId, voterId);
    const [existing] = await db
      .select({ id: ballots.id })
      .from(ballots)
      .where(
        and(
          eq(ballots.electionId, electionId),
          eq(ballots.voterHash, voterHash)
        )
      )
      .limit(1);

    return !!existing;
  } catch (error) {
    console.error("[Elections] Failed to check vote status:", error);
    return false;
  }
}

/**
 * Get election turnout.
 */
export async function getTurnout(
  electionId: number
): Promise<{
  totalVoted: number;
  totalEligible: number;
  turnoutPercentage: number;
}> {
  const db = getDb();
  if (!db) return { totalVoted: 0, totalEligible: 0, turnoutPercentage: 0 };

  try {
    const [votedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(ballots)
      .where(eq(ballots.electionId, electionId));

    // For now, use a simplified eligible count
    // In production, this would query based on eligibility criteria
    const [eligibleResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.membershipStatus, "Active"));

    const totalVoted = votedResult?.count ?? 0;
    const totalEligible = eligibleResult?.count ?? 0;
    const turnoutPercentage = totalEligible > 0 ? (totalVoted / totalEligible) * 100 : 0;

    return { totalVoted, totalEligible, turnoutPercentage };
  } catch (error) {
    console.error("[Elections] Failed to get turnout:", error);
    return { totalVoted: 0, totalEligible: 0, turnoutPercentage: 0 };
  }
}

// ============================================================================
// Result Counting & Certification
// ============================================================================

/**
 * Count votes and generate results.
 */
export async function countVotes(
  electionId: number
): Promise<{ success: boolean; resultId?: number; error?: string }> {
  const db = getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    // Get election
    const [election] = await db
      .select()
      .from(elections)
      .where(eq(elections.id, electionId))
      .limit(1);

    if (!election) {
      return { success: false, error: "Election not found" };
    }

    // Get all ballots
    const electionBallots = await db
      .select()
      .from(ballots)
      .where(eq(ballots.electionId, electionId));

    if (electionBallots.length === 0) {
      return { success: false, error: "No ballots to count" };
    }

    // Decrypt and count votes
    const votingMethod = election.votingMethod as Record<string, unknown>;
    const method = votingMethod.type as string;

    let results: Array<{
      candidateId: number;
      votes: number;
      percentage: number;
      rank: number;
      elected: boolean;
    }>;

    if (method === "plurality") {
      results = countPlurality(electionBallots);
    } else if (method === "ranked_choice") {
      results = await countRankedChoice(electionBallots, electionId);
    } else {
      // Default to plurality
      results = countPlurality(electionBallots);
    }

    // Get turnout
    const turnout = await getTurnout(electionId);

    // Store results
    const [result] = await db.insert(electionResults).values({
      electionId,
      totalVotes: turnout.totalVoted,
      totalEligible: turnout.totalEligible,
      turnout: turnout.turnoutPercentage.toString(),
      results,
      method,
    });

    const resultId = Number((result as any)[0].insertId);

    // Update election status
    await db
      .update(elections)
      .set({ status: "counting", updatedAt: new Date() })
      .where(eq(elections.id, electionId));

    await logAuditEvent({
      action: "election.votes_counted",
      entityType: "election",
      entityId: electionId,
      after: { resultId, totalVotes: turnout.totalVoted },
    });

    console.log(`[Elections] Counted ${turnout.totalVoted} votes for election #${electionId}.`);
    return { success: true, resultId };
  } catch (error) {
    console.error("[Elections] Failed to count votes:", error);
    return { success: false, error: "Internal error" };
  }
}

/**
 * Certify election results.
 */
export async function certifyResults(
  electionId: number,
  certifiedBy: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [result] = await db
      .select()
      .from(electionResults)
      .where(eq(electionResults.electionId, electionId))
      .limit(1);

    if (!result) return false;

    await db
      .update(electionResults)
      .set({
        certifiedAt: new Date(),
        certifiedBy,
        updatedAt: new Date(),
      })
      .where(eq(electionResults.id, result.id));

    await db
      .update(elections)
      .set({ status: "certified", updatedAt: new Date() })
      .where(eq(elections.id, electionId));

    await logAuditEvent({
      userId: certifiedBy,
      action: "election.results_certified",
      entityType: "election",
      entityId: electionId,
      after: { resultId: result.id },
    });

    return true;
  } catch (error) {
    console.error("[Elections] Failed to certify results:", error);
    return false;
  }
}

// ============================================================================
// Disputes
// ============================================================================

/**
 * File a dispute about an election.
 */
export async function fileDispute(
  electionId: number,
  filedBy: number,
  type: "recount" | "eligibility" | "process" | "result",
  description: string,
  evidence?: string
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [result] = await db.insert(electionDisputes).values({
      electionId,
      filedBy,
      type,
      description,
      evidence,
      status: "filed",
    });

    const disputeId = Number((result as any)[0].insertId);

    await logAuditEvent({
      userId: filedBy,
      action: "election.dispute_filed",
      entityType: "election_dispute",
      entityId: disputeId,
      after: { electionId, type },
    });

    return { id: disputeId };
  } catch (error) {
    console.error("[Elections] Failed to file dispute:", error);
    return null;
  }
}

/**
 * Resolve a dispute.
 */
export async function resolveDispute(
  disputeId: number,
  resolvedBy: number,
  resolution: string,
  dismiss: boolean = false
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .update(electionDisputes)
      .set({
        status: dismiss ? "dismissed" : "resolved",
        resolution,
        resolvedAt: new Date(),
        resolvedBy,
        updatedAt: new Date(),
      })
      .where(eq(electionDisputes.id, disputeId));

    await logAuditEvent({
      userId: resolvedBy,
      action: dismiss ? "election.dispute_dismissed" : "election.dispute_resolved",
      entityType: "election_dispute",
      entityId: disputeId,
      after: { resolution },
    });

    return true;
  } catch (error) {
    console.error("[Elections] Failed to resolve dispute:", error);
    return false;
  }
}

// ============================================================================
// Voting Methods
// ============================================================================

/**
 * Count votes using plurality method.
 */
function countPlurality(
  electionBallots: any[]
): Array<{
  candidateId: number;
  votes: number;
  percentage: number;
  rank: number;
  elected: boolean;
}> {
  const counts = new Map<number, number>();

  for (const ballot of electionBallots) {
    try {
      // In a real implementation, this would decrypt the ballot
      // For now, assume ballotData is accessible
      const data = JSON.parse(ballot.encryptedBallot); // Placeholder
      const candidateId = data.candidateId;
      if (candidateId) {
        counts.set(candidateId, (counts.get(candidateId) ?? 0) + 1);
      }
    } catch {
      // Skip invalid ballots
    }
  }

  const total = electionBallots.length;

  return Array.from(counts.entries())
    .map(([candidateId, votes]) => ({
      candidateId,
      votes,
      percentage: total > 0 ? (votes / total) * 100 : 0,
      rank: 0,
      elected: false,
    }))
    .sort((a, b) => b.votes - a.votes)
    .map((result, index) => ({
      ...result,
      rank: index + 1,
      elected: index === 0, // Top candidate wins in plurality
    }));
}

/**
 * Count votes using ranked choice method.
 */
async function countRankedChoice(
  electionBallots: any[],
  electionId: number
): Promise<Array<{
  candidateId: number;
  votes: number;
  percentage: number;
  rank: number;
  elected: boolean;
}>> {
  // Get candidates
  const db = getDb();
  if (!db) return [];

  const electionCandidates = await db
    .select()
    .from(candidates)
    .where(
      and(
        eq(candidates.electionId, electionId),
        eq(candidates.status, "approved")
      )
    );

  const candidateIds = new Set(electionCandidates.map((c) => c.userId));
  let remainingCandidates = Array.from(candidateIds);
  const elected: number[] = [];
  const rounds: Array<{ round: number; counts: Record<number, number> }> = [];

  let round = 1;
  while (remainingCandidates.length > 1 && elected.length === 0) {
    // Count first preferences
    const countsMap = new Map<number, number>();
    for (const ballot of electionBallots) {
      try {
        const data = JSON.parse(ballot.encryptedBallot);
        const rankings = data.rankings as number[] | undefined;
        if (rankings && rankings.length > 0) {
          // Find first remaining candidate in rankings
          for (const candidateId of rankings) {
            if (remainingCandidates.includes(candidateId)) {
              countsMap.set(candidateId, (countsMap.get(candidateId) ?? 0) + 1);
              break;
            }
          }
        }
      } catch {
        // Skip invalid ballots
      }
    }
    const counts = Object.fromEntries(countsMap.entries());

    rounds.push({ round, counts });

    // Check for majority
    const totalValid = electionBallots.length;
    for (const [candidateIdStr, votes] of Object.entries(counts)) {
      const candidateId = Number(candidateIdStr);
      if (votes > totalValid / 2) {
        elected.push(candidateId);
        break;
      }
    }

    // If no majority, eliminate lowest
    if (elected.length === 0 && remainingCandidates.length > 1) {
      let lowestCandidate = remainingCandidates[0];
      let lowestCount = counts[lowestCandidate] ?? 0;

      for (const candidateId of remainingCandidates) {
        const count = counts[candidateId] ?? 0;
        if (count < lowestCount) {
          lowestCount = count;
          lowestCandidate = candidateId;
        }
      }

      remainingCandidates = remainingCandidates.filter((id) => id !== lowestCandidate);
    }

    round++;
  }

  // If no one got majority, last remaining wins
  if (elected.length === 0 && remainingCandidates.length === 1) {
    elected.push(remainingCandidates[0]);
  }

  const total = electionBallots.length;

  return electionCandidates
    .map((c) => {
      const electedIndex = elected.indexOf(c.userId);
      return {
        candidateId: c.userId,
        votes: (rounds[rounds.length - 1]?.counts as Record<number, number>)?.[c.userId] ?? 0,
        percentage: total > 0 ? (((rounds[rounds.length - 1]?.counts as Record<number, number>)?.[c.userId] ?? 0) / total) * 100 : 0,
        rank: electedIndex >= 0 ? electedIndex + 1 : electionCandidates.length,
        elected: electedIndex >= 0,
      };
    })
    .sort((a, b) => a.rank - b.rank);
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate a hash for voter identity (anonymous voting).
 */
async function generateVoterHash(
  electionId: number,
  voterId: number
): Promise<string> {
  // In production, use a proper hash with a salt
  const data = `${electionId}:${voterId}:${process.env.ELECTION_SALT || "default-salt"}`;
  // Simple hash for demo - use crypto.createHash in production
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `voter_${Math.abs(hash).toString(16)}`;
}

/**
 * Encrypt ballot data.
 */
async function encryptBallot(
  ballotData: Record<string, unknown>,
  electionId: number
): Promise<{ encryptedBallot: string; iv: string }> {
  // In production, use proper encryption (AES-256)
  // For now, base64 encode (NOT secure - placeholder)
  const plaintext = JSON.stringify(ballotData);
  const encryptedBallot = Buffer.from(plaintext).toString("base64");
  const iv = `iv_${electionId}_${Date.now()}`;
  
  return { encryptedBallot, iv };
}

/**
 * Decrypt ballot data.
 */
async function decryptBallot(
  encryptedBallot: string,
  _iv: string
): Promise<Record<string, unknown>> {
  // In production, use proper decryption
  // For now, base64 decode (NOT secure - placeholder)
  const plaintext = Buffer.from(encryptedBallot, "base64").toString("utf-8");
  return JSON.parse(plaintext);
}

// ============================================================================
// Stats & Disputes List
// ============================================================================

/**
 * Get election stats (counts by type).
 */
export async function getElectionStats(): Promise<Record<string, number>> {
  const db = getDb();
  if (!db) return {};
  try {
    const counts = await db
      .select({ type: elections.type, count: sql<number>`count(*)` })
      .from(elections)
      .groupBy(elections.type);
    return Object.fromEntries(counts.map((c) => [c.type ?? "unknown", c.count]));
  } catch {
    return {};
  }
}

/**
 * List election disputes with optional filters.
 */
export async function listElectionDisputes(
  filters: { electionId?: number; status?: string } = {}
): Promise<any[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const conditions = [];
    if (filters.electionId) conditions.push(eq(electionDisputes.electionId, filters.electionId));
    if (filters.status) conditions.push(eq(electionDisputes.status, filters.status as any));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return db
      .select()
      .from(electionDisputes)
      .where(where)
      .orderBy(desc(electionDisputes.createdAt))
      .limit(50);
  } catch {
    return [];
  }
}

/**
 * Get all elections a member has voted in.
 * Note: Ballots use anonymized voter hashes for secrecy, so we cannot
 * directly query by userId. This is a placeholder that returns empty;
 * a proper implementation would use a separate ballot-tracker table.
 */
export async function getMyVotes(_userId: number): Promise<any[]> {
  // TODO: Implement ballot-tracker table for non-anonymous vote tracking.
  // The ballots table uses voterHash for ballot secrecy, so userId is not stored.
  return [];
}
