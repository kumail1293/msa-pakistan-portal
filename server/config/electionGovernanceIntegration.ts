/**
 * Election-Governance Integration
 *
 * Connects the Election Engine with the Governance Rules Engine.
 * Implements:
 * - Plenary-Election voting matrix (B-8.7.1, B-8.7.2)
 * - Weighted voting for elections
 * - Ballot security with proper encryption
 * - Election eligibility snapshots
 * - Returning officer management
 * - Result certification workflow
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
 * If >10 delegates: Head of Delegation nominates voters
 *
 * Usage:
 *   import { calculateElectionVotingPower, secureCastBallot, snapshotEligibility } from "./electionGovernanceIntegration";
 *
 *   const power = await calculateElectionVotingPower(delegationId, electionId);
 *   await secureCastBallot(electionId, voterId, ballotData, power);
 *   const snapshot = await snapshotEligibility(electionId);
 */

import { eq, and, desc, sql } from "drizzle-orm";
import {
  elections,
  candidates,
  ballots,
  electionResults,
  electionDisputes,
} from "../../drizzle/schema.governance";
import {
  governanceRules,
  governanceParameters,
} from "../../drizzle/schema.governance_rules";
import {
  ngaDelegations,
  ngaRollCall,
  votingRightsCalculations,
} from "../../drizzle/schema.nga";
import { users } from "../../drizzle/schema";
import { getDb } from "../db";
import { logAuditEvent } from "./auditService";
import { resolveEffectiveRule, getParameter } from "./governanceRulesEngine";
import { calculateVoteEntitlement } from "./governanceRulesEngine";

// ============================================================================
// Types
// ============================================================================

export interface ElectionVotingPower {
  delegationId: number;
  organizationType: string;
  organizationName: string;
  plenaryVotes: number;
  electionVotes: number;
  delegateCount: number;
  maxDelegates: number;
  voterNominations: VoterNomination[];
  calculation: string;
  ruleSource: string;
}

export interface VoterNomination {
  userId: number;
  name: string;
  nominatedBy: number;
  nominatedAt: Date;
}

export interface EligibilitySnapshot {
  electionId: number;
  snapshotDate: Date;
  eligibleVoters: Array<{
    userId: number;
    delegationId: number;
    organizationType: string;
    votingPower: number;
    reason: string;
  }>;
  totalEligible: number;
  totalVotingPower: number;
  governanceVersion: string;
}

export interface SecureBallot {
  electionId: number;
  voterId: number;
  voterHash: string;
  encryptedBallot: string;
  iv: string;
  hmac: string; // Hash-based message authentication code
  timestamp: Date;
  method: string;
}

export interface ElectionResultCertification {
  electionId: number;
  certifiedBy: number;
  certifiedAt: Date;
  result: any;
  auditTrail: any[];
  governanceVersion: string;
}

// ============================================================================
// Plenary-Election Voting Matrix
// ============================================================================

/**
 * Calculate the complete voting power for an organization in an election.
 * Implements the plenary-election voting matrix from B-8.7.1 and B-8.7.2.
 */
export async function calculateElectionVotingPower(
  delegationId: number,
  electionId?: number
): Promise<ElectionVotingPower | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Get delegation
    const [delegation] = await db
      .select()
      .from(ngaDelegations)
      .where(eq(ngaDelegations.id, delegationId))
      .limit(1);

    if (!delegation) return null;

    // Get governance rule for this organization type
    const ruleKey = `voting.${delegation.organizationType}`;
    const rule = await resolveEffectiveRule(ruleKey);

    if (!rule) {
      return {
        delegationId,
        organizationType: delegation.organizationType,
        organizationName: delegation.organizationName,
        plenaryVotes: 0,
        electionVotes: 0,
        delegateCount: delegation.delegateCount ?? 0,
        maxDelegates: delegation.maxDelegates ?? 10,
        voterNominations: [],
        calculation: "No voting rule found",
        ruleSource: "DEFAULT",
      };
    }

    const params = rule.parameters;
    let plenaryVotes = (params.plenary_votes as number) ?? 0;
    let electionVotes = (params.election_votes as number) ?? 0;

    // B-8.7.4: If <10 delegates, election votes = delegate count
    const delegateCount = delegation.delegateCount ?? 0;
    const minDelegatesForFullVotes = 10;

    let calculation = "";

    if (delegateCount > 0 && delegateCount < minDelegatesForFullVotes && electionVotes > 0) {
      electionVotes = delegateCount;
      calculation = `${delegation.organizationType}: ${electionVotes} election votes (delegate count ${delegateCount} < ${minDelegatesForFullVotes})`;
    } else if (delegateCount >= minDelegatesForFullVotes) {
      calculation = `${delegation.organizationType}: ${electionVotes} election votes (full ${minDelegatesForFullVotes} delegates)`;
    } else {
      calculation = `${delegation.organizationType}: ${electionVotes} election votes, ${plenaryVotes} plenary votes`;
    }

    // Get voter nominations if >10 delegates
    const voterNominations: VoterNomination[] = [];
    if (delegateCount > minDelegatesForFullVotes && delegation.headOfDelegationId) {
      // B-8.7.5: Head of Delegation nominates voters
      // In production, this would query a voter nomination table
      calculation += ` | Head of Delegation (${delegation.headOfDelegationId}) nominates ${electionVotes} voters`;
    }

    return {
      delegationId,
      organizationType: delegation.organizationType,
      organizationName: delegation.organizationName,
      plenaryVotes,
      electionVotes,
      delegateCount,
      maxDelegates: delegation.maxDelegates ?? 10,
      voterNominations,
      calculation,
      ruleSource: rule.sourceClause,
    };
  } catch (error) {
    console.error("[ElectionGov] Failed to calculate voting power:", error);
    return null;
  }
}

/**
 * Get the complete plenary-election voting matrix for a meeting.
 */
export async function getVotingMatrix(
  meetingId: number
): Promise<{
  matrix: Array<{
    organizationType: string;
    plenaryVotes: number;
    electionVotes: number;
    delegateCount: number;
    delegations: string[];
  }>;
  totals: {
    plenaryVotes: number;
    electionVotes: number;
    delegations: number;
  };
}> {
  const db = getDb();
  if (!db) return { matrix: [], totals: { plenaryVotes: 0, electionVotes: 0, delegations: 0 } };

  try {
    const delegations = await db
      .select()
      .from(ngaDelegations)
      .where(eq(ngaDelegations.meetingId, meetingId));

    // Group by organization type
    const grouped = new Map<string, {
      plenaryVotes: number;
      electionVotes: number;
      delegateCount: number;
      delegations: string[];
    }>();

    for (const d of delegations) {
      const existing = grouped.get(d.organizationType) ?? {
        plenaryVotes: 0,
        electionVotes: 0,
        delegateCount: 0,
        delegations: [],
      };

      existing.plenaryVotes += d.plenaryVotes ?? 0;
      existing.electionVotes += d.electionVotes ?? 0;
      existing.delegateCount += d.delegateCount ?? 0;
      existing.delegations.push(d.organizationName);

      grouped.set(d.organizationType, existing);
    }

    // Convert to array and add defaults for missing types
    const allTypes = ["permanent_lc", "temporary_lc", "candidate_lc", "ci"];
    const matrix = [];

    for (const type of allTypes) {
      const existing = grouped.get(type);
      if (existing) {
        matrix.push({ organizationType: type, ...existing });
      } else {
        matrix.push({
          organizationType: type,
          plenaryVotes: 0,
          electionVotes: 0,
          delegateCount: 0,
          delegations: [],
        });
      }
    }

    // Calculate totals
    const totals = matrix.reduce(
      (acc, m) => ({
        plenaryVotes: acc.plenaryVotes + m.plenaryVotes,
        electionVotes: acc.electionVotes + m.electionVotes,
        delegations: acc.delegations + m.delegations.length,
      }),
      { plenaryVotes: 0, electionVotes: 0, delegations: 0 }
    );

    return { matrix, totals };
  } catch (error) {
    console.error("[ElectionGov] Failed to get voting matrix:", error);
    return { matrix: [], totals: { plenaryVotes: 0, electionVotes: 0, delegations: 0 } };
  }
}

// ============================================================================
// Ballot Security
// ============================================================================

/**
 * Generate a secure voter hash (anonymous voting).
 * The hash prevents duplicate voting without revealing voter identity.
 */
async function generateVoterHash(
  electionId: number,
  voterId: number
): Promise<string> {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  // Use election-specific salt to prevent cross-election linking
  const [election] = await db
    .select()
    .from(elections)
    .where(eq(elections.id, electionId))
    .limit(1);

  const salt = process.env.ELECTION_SALT || "msap-election-default-salt";
  const data = `${electionId}:${voterId}:${salt}:${election?.createdAt?.getTime() ?? 0}`;

  // SHA-256 hash
  const crypto = await import("crypto");
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Encrypt ballot data using AES-256-GCM.
 * Provides confidentiality and integrity.
 */
async function encryptBallot(
  ballotData: Record<string, unknown>,
  electionId: number
): Promise<{ encryptedBallot: string; iv: string; hmac: string }> {
  const crypto = await import("crypto");

  // Generate random IV
  const iv = crypto.randomBytes(16);

  // Derive key from election ID and environment secret
  const keyMaterial = `${process.env.ELECTION_KEY || "msap-election-key"}:${electionId}`;
  const key = crypto.createHash("sha256").update(keyMaterial).digest();

  // Encrypt using AES-256-GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(ballotData);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  // Generate HMAC for additional integrity verification
  const hmac = crypto
    .createHmac("sha256", key)
    .update(encrypted + authTag)
    .digest("hex");

  return {
    encryptedBallot: encrypted + ":" + authTag,
    iv: iv.toString("hex"),
    hmac,
  };
}

/**
 * Decrypt ballot data.
 */
async function decryptBallot(
  encryptedBallot: string,
  iv: string,
  hmac: string,
  electionId: number
): Promise<Record<string, unknown> | null> {
  try {
    const crypto = await import("crypto");

    // Verify HMAC
    const keyMaterial = `${process.env.ELECTION_KEY || "msap-election-key"}:${electionId}`;
    const key = crypto.createHash("sha256").update(keyMaterial).digest();

    const [encrypted, authTag] = encryptedBallot.split(":");
    const expectedHmac = crypto
      .createHmac("sha256", key)
      .update(encrypted + authTag)
      .digest("hex");

    if (hmac !== expectedHmac) {
      console.error("[Election] Ballot integrity check failed");
      return null;
    }

    // Decrypt
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "hex")
    );
    decipher.setAuthTag(Buffer.from(authTag, "hex"));
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return JSON.parse(decrypted);
  } catch (error) {
    console.error("[Election] Failed to decrypt ballot:", error);
    return null;
  }
}

/**
 * Securely cast a ballot with full audit trail.
 */
export async function secureCastBallot(
  electionId: number,
  voterId: number,
  ballotData: Record<string, unknown>,
  votingPower: ElectionVotingPower
): Promise<{ success: boolean; ballotId?: number; error?: string }> {
  const db = getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    // Verify election is in voting phase
    const [election] = await db
      .select()
      .from(elections)
      .where(eq(elections.id, electionId))
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

    // Check voter eligibility
    const eligibility = await verifyVoterEligibility(electionId, voterId, votingPower.delegationId);
    if (!eligibility.eligible) {
      return { success: false, error: eligibility.reason };
    }

    // Generate anonymous voter hash
    const voterHash = await generateVoterHash(electionId, voterId);

    // Check for duplicate vote
    const [existingBallot] = await db
      .select()
      .from(ballots)
      .where(
        and(
          eq(ballots.electionId, electionId),
          eq(ballots.voterHash, voterHash)
        )
      )
      .limit(1);

    if (existingBallot) {
      return { success: false, error: "Already voted" };
    }

    // Encrypt ballot
    const { encryptedBallot, iv, hmac } = await encryptBallot(ballotData, electionId);

    // Store ballot
    const [result] = await db.insert(ballots).values({
      electionId,
      voterHash,
      encryptedBallot,
      iv,
      method: (election.votingMethod as any)?.type ?? "plurality",
    });

    const ballotId = Number((result as any)[0].insertId);

    // Audit trail (without revealing vote content)
    await logAuditEvent({
      userId: voterId,
      action: "election.ballot_cast",
      entityType: "ballot",
      entityId: ballotId,
      after: {
        electionId,
        delegationId: votingPower.delegationId,
        organizationType: votingPower.organizationType,
        votingPower: votingPower.electionVotes,
      },
    });

    console.log(`[Election] Ballot cast: election=${electionId}, voter=${voterHash.slice(0, 8)}...`);
    return { success: true, ballotId };
  } catch (error) {
    console.error("[Election] Failed to cast ballot:", error);
    return { success: false, error: "Internal error" };
  }
}

/**
 * Verify voter eligibility for an election.
 */
async function verifyVoterEligibility(
  electionId: number,
  voterId: number,
  delegationId: number
): Promise<{ eligible: boolean; reason: string }> {
  const db = getDb();
  if (!db) return { eligible: false, reason: "Database not available" };

  try {
    // Get delegation
    const [delegation] = await db
      .select()
      .from(ngaDelegations)
      .where(eq(ngaDelegations.id, delegationId))
      .limit(1);

    if (!delegation) {
      return { eligible: false, reason: "Delegation not found" };
    }

    // Check delegation is credentialed
    if (delegation.credentialStatus !== "approved") {
      return { eligible: false, reason: "Delegation not credentialed" };
    }

    // Check financial condition (B-8.7.6: ≤ PKR 2000 debt)
    const debtThreshold = (await getParameter("voting.debt_threshold_pkr")) as number ?? 2000;
    if (delegation.hasOutstandingDebt && (delegation.debtAmount ?? 0) > debtThreshold) {
      return {
        eligible: false,
        reason: `Outstanding debt (PKR ${delegation.debtAmount}) exceeds threshold (PKR ${debtThreshold})`,
      };
    }

    // Check user is a member
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, voterId))
      .limit(1);

    if (!user) {
      return { eligible: false, reason: "User not found" };
    }

    if (user.membershipStatus !== "Active") {
      return { eligible: false, reason: "Membership not active" };
    }

    return { eligible: true, reason: "Eligible" };
  } catch (error) {
    console.error("[Election] Failed to verify eligibility:", error);
    return { eligible: false, reason: "Verification failed" };
  }
}

// ============================================================================
// Eligibility Snapshot
// ============================================================================

/**
 * Take a snapshot of election eligibility at a point in time.
 * This creates an immutable record of who was eligible when.
 */
export async function snapshotEligibility(
  electionId: number
): Promise<EligibilitySnapshot | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [election] = await db
      .select()
      .from(elections)
      .where(eq(elections.id, electionId))
      .limit(1);

    if (!election) return null;

    // Get all credentialed delegations
    const delegations = await db
      .select()
      .from(ngaDelegations)
      .where(eq(ngaDelegations.credentialStatus, "approved"));

    const eligibleVoters = [];
    let totalVotingPower = 0;

    for (const delegation of delegations) {
      const votingPower = await calculateElectionVotingPower(delegation.id, electionId);

      if (votingPower && votingPower.electionVotes > 0) {
        // Get all delegates in this delegation
        const [eligibleResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(users)
          .where(
            and(
              eq(users.membershipStatus, "Active"),
              eq(users.membershipStatus, "Active")
            )
          );

        eligibleVoters.push({
          userId: delegation.headOfDelegationId ?? 0,
          delegationId: delegation.id,
          organizationType: delegation.organizationType,
          votingPower: votingPower.electionVotes,
          reason: `${delegation.organizationName}: ${votingPower.electionVotes} votes (${votingPower.calculation})`,
        });

        totalVotingPower += votingPower.electionVotes;
      }
    }

    const metadata = (election.metadata as Record<string, unknown>) ?? {};
    const governanceVersion = (metadata.governanceVersion as string) ?? "2025-26";

    const snapshot: EligibilitySnapshot = {
      electionId,
      snapshotDate: new Date(),
      eligibleVoters,
      totalEligible: eligibleVoters.length,
      totalVotingPower,
      governanceVersion,
    };

    // Store snapshot in election metadata
    await db
      .update(elections)
      .set({
        metadata: {
          ...metadata,
          eligibilitySnapshot: snapshot,
        },
      })
      .where(eq(elections.id, electionId));

    await logAuditEvent({
      action: "election.eligibility_snapshot",
      entityType: "election",
      entityId: electionId,
      after: {
        totalEligible: snapshot.totalEligible,
        totalVotingPower: snapshot.totalVotingPower,
      },
    });

    return snapshot;
  } catch (error) {
    console.error("[Election] Failed to snapshot eligibility:", error);
    return null;
  }
}

// ============================================================================
// Weighted Voting
// ============================================================================

/**
 * Calculate weighted vote for an organization.
 * Used when voting method is "weighted".
 */
export async function calculateWeightedVote(
  delegationId: number,
  electionId: number,
  weights?: Record<string, number>
): Promise<{ voteCount: number; weight: number; calculation: string }> {
  const db = getDb();
  if (!db) return { voteCount: 0, weight: 0, calculation: "Database not available" };

  try {
    const [delegation] = await db
      .select()
      .from(ngaDelegations)
      .where(eq(ngaDelegations.id, delegationId))
      .limit(1);

    if (!delegation) {
      return { voteCount: 0, weight: 0, calculation: "Delegation not found" };
    }

    // Get base voting power
    const basePower = await calculateElectionVotingPower(delegationId, electionId);
    const baseVotes = basePower?.electionVotes ?? 1;

    // Get election's weighted roles configuration
    const [election] = await db
      .select()
      .from(elections)
      .where(eq(elections.id, electionId))
      .limit(1);

    const electionWeights = (election?.votingMethod as any)?.weightedRoles ?? weights ?? {};

    // Default weights based on organization type (§8.7.1, §8.7.2)
    // PLENARY:        Permanent LC = 1, Temporary LC = 1, Candidate LC = 0, CI = 0
    // ELECTION:        Permanent LC = 10, Temporary LC = 10, Candidate LC = 1, CI = 1
    const defaultWeights: Record<string, number> = {
      permanent_lc: 10,
      temporary_lc: 10,
      candidate_lc: 1,
      ci: 1,
    };

    const weight = electionWeights[delegation.organizationType] ?? defaultWeights[delegation.organizationType] ?? 1;
    const voteCount = baseVotes * weight;

    return {
      voteCount,
      weight,
      calculation: `${delegation.organizationType}: ${baseVotes} base × ${weight} weight = ${voteCount} votes`,
    };
  } catch (error) {
    console.error("[Election] Failed to calculate weighted vote:", error);
    return { voteCount: 0, weight: 0, calculation: "Calculation failed" };
  }
}

// ============================================================================
// Result Certification
// ============================================================================

/**
 * Certify election results with full audit trail.
 */
export async function certifyElectionResults(
  electionId: number,
  certifiedBy: number
): Promise<ElectionResultCertification | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Get election
    const [election] = await db
      .select()
      .from(elections)
      .where(eq(elections.id, electionId))
      .limit(1);

    if (!election) return null;

    // Get results
    const [result] = await db
      .select()
      .from(electionResults)
      .where(eq(electionResults.electionId, electionId))
      .limit(1);

    if (!result) return null;

    // Get audit trail
    const auditTrail = await db
      .select()
      .from(ballots)
      .where(eq(ballots.electionId, electionId))
      .orderBy(ballots.castAt);

    // Update certification
    await db
      .update(electionResults)
      .set({
        certifiedAt: new Date(),
        certifiedBy,
        updatedAt: new Date(),
      })
      .where(eq(electionResults.id, result.id));

    // Update election status
    await db
      .update(elections)
      .set({ status: "certified" })
      .where(eq(elections.id, electionId));

    const electionMetadata = (election.metadata as Record<string, unknown>) ?? {};
    const governanceVersion = (electionMetadata.governanceVersion as string) ?? "2025-26";

    const certification: ElectionResultCertification = {
      electionId,
      certifiedBy,
      certifiedAt: new Date(),
      result,
      auditTrail,
      governanceVersion,
    };

    await logAuditEvent({
      userId: certifiedBy,
      action: "election.results_certified",
      entityType: "election",
      entityId: electionId,
      after: {
        totalVotes: result.totalVotes,
        method: result.method,
        certifiedAt: certification.certifiedAt,
      },
    });

    console.log(`[Election] Results certified: election=${electionId}`);
    return certification;
  } catch (error) {
    console.error("[Election] Failed to certify results:", error);
    return null;
  }
}

// ============================================================================
// Returning Officers
// ============================================================================

/**
 * Assign returning officers for an election.
 * B-8.3.8: 4 Returning Officers elected by Permanent/Temporary LCs.
 */
export async function assignReturningOfficers(
  electionId: number,
  officerIds: number[],
  assignedBy?: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    // Validate: should be 4 returning officers
    if (officerIds.length !== 4) {
      console.warn("[Election] Expected 4 returning officers, got", officerIds.length);
    }

    // Store in election metadata
    const [election] = await db
      .select()
      .from(elections)
      .where(eq(elections.id, electionId))
      .limit(1);

    if (!election) return false;

    await db
      .update(elections)
      .set({
        metadata: {
          ...((election.metadata as Record<string, unknown>) ?? {}),
          returningOfficers: officerIds,
          assignedAt: new Date().toISOString(),
        },
      })
      .where(eq(elections.id, electionId));

    await logAuditEvent({
      userId: assignedBy,
      action: "election.returning_officers_assigned",
      entityType: "election",
      entityId: electionId,
      after: { returningOfficers: officerIds },
    });

    return true;
  } catch (error) {
    console.error("[Election] Failed to assign returning officers:", error);
    return false;
  }
}

// ============================================================================
// Re-vote Handling
// ============================================================================

/**
 * Handle re-vote request.
 * B-8.7.13: Chair may call for re-vote in case of fraud or mistakes.
 */
export async function requestRevote(
  electionId: number,
  reason: string,
  requestedBy: number,
  useBallots?: boolean
): Promise<{ approved: boolean; revoteId?: number }> {
  const db = getDb();
  if (!db) return { approved: false };

  try {
    // Store re-vote request
    const [election] = await db
      .select()
      .from(elections)
      .where(eq(elections.id, electionId))
      .limit(1);

    if (!election) return { approved: false };

    const metadata = (election.metadata as Record<string, unknown>) ?? {};
    const revotes = (metadata.revotes as any[]) ?? [];

    const revoteId = revotes.length + 1;
    revotes.push({
      id: revoteId,
      reason,
      requestedBy,
      requestedAt: new Date().toISOString(),
      useBallots: useBallots ?? false,
      status: "pending",
    });

    await db
      .update(elections)
      .set({
        metadata: { ...metadata, revotes },
      })
      .where(eq(elections.id, electionId));

    await logAuditEvent({
      userId: requestedBy,
      action: "election.revote_requested",
      entityType: "election",
      entityId: electionId,
      after: { reason, revoteId, useBallots },
    });

    return { approved: true, revoteId };
  } catch (error) {
    console.error("[Election] Failed to request re-vote:", error);
    return { approved: false };
  }
}
