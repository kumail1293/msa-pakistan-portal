/**
 * Governance Rules Engine
 *
 * Provides configurable, versioned governance rule evaluation.
 * All rules are resolved against the effective governance version.
 *
 * Core principle: The application executes the ACTIVE GOVERNANCE RULE SET.
 * Never hardcode MSA-specific conditions.
 */

import { eq, and, desc, sql, lte, or, isNull, gt } from "drizzle-orm";
import {
  governanceDocuments,
  governanceClauses,
  governanceRules,
  governanceParameters,
  governanceDecisions,
  governanceAmendments,
  governanceSuspensions,
} from "../../drizzle/schema.governance_rules";
import { getDb } from "../db";
import { logAuditEvent } from "./auditService";

// ============================================================================
// Types
// ============================================================================

export interface RuleResolution {
  rule: any;
  parameters: Record<string, unknown>;
  sourceClause: string;
  governanceVersion: string;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  appliedRule: RuleResolution;
}

export interface VoteEntitlementResult {
  plenaryVotes: number;
  electionVotes: number;
  appliedRule: RuleResolution;
}

export interface QuorumResult {
  quorumMet: boolean;
  required: number;
  present: number;
  eligible: number;
  calculation: string;
  appliedRule: RuleResolution;
}

export interface MajorityResult {
  adopted: boolean;
  threshold: number;
  votesFor: number;
  votesAgainst: number;
  abstentions: number;
  calculation: string;
  appliedRule: RuleResolution;
}

// ============================================================================
// Temporal Rule Resolution
// ============================================================================

/**
 * Resolve the effective rule at a point in time.
 */
export async function resolveEffectiveRule(
  ruleKey: string,
  atDate: Date = new Date()
): Promise<RuleResolution | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Find the rule that was effective at the given date
    const [rule] = await db
      .select()
      .from(governanceRules)
      .where(
        and(
          eq(governanceRules.ruleKey, ruleKey),
          lte(governanceRules.effectiveFrom, atDate),
          or(
            isNull(governanceRules.effectiveUntil),
            gt(governanceRules.effectiveUntil, atDate)
          ),
          eq(governanceRules.status, "active")
        )
      )
      .orderBy(desc(governanceRules.effectiveFrom))
      .limit(1);

    if (!rule) return null;

    // Get the source clause
    const [clause] = await db
      .select()
      .from(governanceClauses)
      .where(eq(governanceClauses.id, rule.clauseId))
      .limit(1);

    return {
      rule,
      parameters: rule.parameters as Record<string, unknown>,
      sourceClause: clause?.clauseId ?? "UNKNOWN",
      governanceVersion: clause ? "current" : "default",
    };
  } catch (error) {
    console.error("[Governance] Failed to resolve rule:", error);
    return null;
  }
}

/**
 * Get a governance parameter by key.
 */
export async function getParameter(
  key: string,
  governanceVersion?: string
): Promise<unknown> {
  const db = getDb();
  if (!db) return null;

  try {
    const conditions = [eq(governanceParameters.key, key)];
    
    if (governanceVersion) {
      conditions.push(eq(governanceParameters.governanceVersion, governanceVersion));
    }

    const [param] = await db
      .select()
      .from(governanceParameters)
      .where(and(...conditions))
      .orderBy(desc(governanceParameters.effectiveFrom))
      .limit(1);

    return param?.value ?? null;
  } catch (error) {
    console.error("[Governance] Failed to get parameter:", error);
    return null;
  }
}

// ============================================================================
// Eligibility Engine
// ============================================================================

/**
 * Evaluate eligibility for a position or role.
 */
export async function evaluateEligibility(
  subject: {
    userId: number;
    degree: string;
    membershipStartDate: Date;
    ngaAttendance: number;
    lcEbTerms: number;
    isActivityCoordinator: boolean;
    hasDisciplinaryAction: boolean;
    isCurrentEbMember: boolean;
  },
  position: string,
  governanceVersion?: string
): Promise<EligibilityResult> {
  const reasons: string[] = [];
  
  // Resolve the eligibility rule for this position
  const ruleKey = `eligibility.${position}`;
  const rule = await resolveEffectiveRule(ruleKey);
  
  if (!rule) {
    return {
      eligible: false,
      reasons: ["No eligibility rule found for this position"],
      appliedRule: { rule: null, parameters: {}, sourceClause: "UNKNOWN", governanceVersion: "default" },
    };
  }

  const params = rule.parameters;

  // Check degree eligibility
  const allowedDegrees = (params.allowedDegrees as string[]) ?? ["MBBS", "BDS"];
  if (!allowedDegrees.includes(subject.degree)) {
    reasons.push(`Degree ${subject.degree} is not eligible for ${position}. Allowed: ${allowedDegrees.join(", ")}`);
  }

  // Check membership duration
  const minMembershipMonths = (params.minMembershipMonths as number) ?? 0;
  const monthsSinceJoin = Math.floor(
    (Date.now() - new Date(subject.membershipStartDate).getTime()) / (30 * 24 * 60 * 60 * 1000)
  );
  if (monthsSinceJoin < minMembershipMonths) {
    reasons.push(`Must be a member for at least ${minMembershipMonths} months (current: ${monthsSinceJoin})`);
  }

  // Check NGA attendance
  const minNgaAttendance = (params.minNgaAttendance as number) ?? 0;
  if (subject.ngaAttendance < minNgaAttendance) {
    reasons.push(`Must have attended at least ${minNgaAttendance} NGA meetings (current: ${subject.ngaAttendance})`);
  }

  // Check LC EB/TO experience
  const minLcEbTerms = (params.minLcEbTerms as number) ?? 0;
  if (subject.lcEbTerms < minLcEbTerms) {
    reasons.push(`Must have served at least ${minLcEbTerms} term(s) in LC EB/TO (current: ${subject.lcEbTerms})`);
  }

  // Check activity coordinator requirement
  if (params.mustBeActivityCoordinator && !subject.isActivityCoordinator) {
    reasons.push("Must be an activity coordinator of at least one MSA-Pakistan activity");
  }

  // Check disciplinary action
  if (params.mustHaveNoDisciplinaryAction && subject.hasDisciplinaryAction) {
    reasons.push("Must not have had any disciplinary action taken against them");
  }

  // Check EB membership (for President)
  if (params.mustBeCurrentEbMember && !subject.isCurrentEbMember) {
    reasons.push("Must be part of the MSA-Pakistan EB");
  }

  // Check max terms
  const maxTerms = (params.maxTerms as number) ?? Infinity;
  if (subject.lcEbTerms >= maxTerms) {
    reasons.push(`Cannot exceed ${maxTerms} terms`);
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    appliedRule: rule,
  };
}

// ============================================================================
// Vote Entitlement Engine
// ============================================================================

/**
 * Calculate vote entitlement for an organization.
 */
export async function calculateVoteEntitlement(
  organization: {
    type: "permanent_lc" | "temporary_lc" | "candidate_lc" | "ci";
    delegateCount: number;
  },
  meetingType: "plenary" | "election",
  governanceVersion?: string
): Promise<VoteEntitlementResult> {
  const ruleKey = `voting.${organization.type}`;
  const rule = await resolveEffectiveRule(ruleKey);

  if (!rule) {
    return {
      plenaryVotes: 0,
      electionVotes: 0,
      appliedRule: { rule: null, parameters: {}, sourceClause: "UNKNOWN", governanceVersion: "default" },
    };
  }

  const params = rule.parameters;
  let plenaryVotes = (params.plenary_votes as number) ?? 0;
  let electionVotes = (params.election_votes as number) ?? 0;

  // Apply delegate count limit for election votes
  const minDelegatesForFullVotes = 10;
  if (organization.delegateCount < minDelegatesForFullVotes && electionVotes > 0) {
    electionVotes = organization.delegateCount;
  }

  return {
    plenaryVotes: meetingType === "plenary" ? plenaryVotes : 0,
    electionVotes: meetingType === "election" ? electionVotes : 0,
    appliedRule: rule,
  };
}

// ============================================================================
// Quorum Engine
// ============================================================================

/**
 * Evaluate quorum for a meeting.
 */
export async function evaluateQuorum(
  meetingType: "nga" | "sga" | "eb" | "presidents_session",
  electorate: {
    eligibleBodies: number;
    presentBodies: number;
  },
  governanceVersion?: string
): Promise<QuorumResult> {
  const ruleKey = `quorum.${meetingType}`;
  const rule = await resolveEffectiveRule(ruleKey);

  if (!rule) {
    return {
      quorumMet: false,
      required: 0,
      present: electorate.presentBodies,
      eligible: electorate.eligibleBodies,
      calculation: "No quorum rule found",
      appliedRule: { rule: null, parameters: {}, sourceClause: "UNKNOWN", governanceVersion: "default" },
    };
  }

  const params = rule.parameters;
  const numerator = (params.numerator as number) ?? 1;
  const denominator = (params.denominator as number) ?? 3;

  const required = Math.ceil((electorate.eligibleBodies * numerator) / denominator);
  const quorumMet = electorate.presentBodies >= required;

  const calculation = `${numerator}/${denominator} of ${electorate.eligibleBodies} = ${required} required, ${electorate.presentBodies} present`;

  return {
    quorumMet,
    required,
    present: electorate.presentBodies,
    eligible: electorate.eligibleBodies,
    calculation,
    appliedRule: rule,
  };
}

// ============================================================================
// Majority Engine
// ============================================================================

/**
 * Evaluate majority for a vote.
 */
export async function evaluateMajority(
  votes: {
    yes: number;
    no: number;
    abstain: number;
    invalid?: number;
  },
  majorityType: "simple" | "absolute" | "relative" | "two_thirds" | "consensus" | "unanimous" | "nemo_contra",
  governanceVersion?: string
): Promise<MajorityResult> {
  const ruleKey = `majority.${majorityType}`;
  const rule = await resolveEffectiveRule(ruleKey);

  if (!rule) {
    // Default implementations
    return evaluateMajorityDefault(votes, majorityType);
  }

  const params = rule.parameters;
  return evaluateMajorityWithParams(votes, majorityType, params, rule);
}

function evaluateMajorityDefault(
  votes: { yes: number; no: number; abstain: number; invalid?: number },
  majorityType: string
): MajorityResult {
  const { yes, no, abstain } = votes;
  let adopted = false;
  let threshold = 0;
  let calculation = "";

  switch (majorityType) {
    case "simple":
      adopted = yes > no;
      threshold = 50;
      calculation = `${yes} yes > ${no} no = ${adopted ? "ADOPTED" : "REJECTED"}`;
      break;
    case "absolute":
      adopted = yes > (yes + no + abstain) / 2;
      threshold = 50;
      calculation = `${yes} yes > ${(yes + no + abstain) / 2} (>50% of all votes) = ${adopted ? "ADOPTED" : "REJECTED"}`;
      break;
    case "relative":
      adopted = yes > no && yes > 0;
      threshold = 0;
      calculation = `${yes} yes > ${no} no = ${adopted ? "ADOPTED" : "REJECTED"}`;
      break;
    case "two_thirds":
      adopted = yes >= no * 2;
      threshold = 66.67;
      calculation = `${yes} yes >= ${no * 2} (2× ${no} no) = ${adopted ? "ADOPTED" : "REJECTED"}`;
      break;
    case "consensus":
      adopted = no === 0;
      threshold = 0;
      calculation = `${no} no objections = ${adopted ? "ADOPTED" : "REJECTED"}`;
      break;
    case "unanimous":
      adopted = no === 0 && abstain === 0;
      threshold = 100;
      calculation = `${no} no, ${abstain} abstain = ${adopted ? "ADOPTED" : "REJECTED"}`;
      break;
    case "nemo_contra":
      adopted = no === 0;
      threshold = 0;
      calculation = `No one against = ${adopted ? "ADOPTED" : "REJECTED"}`;
      break;
    default:
      adopted = yes > no;
      threshold = 50;
      calculation = `${yes} yes > ${no} no = ${adopted ? "ADOPTED" : "REJECTED"}`;
  }

  return {
    adopted,
    threshold,
    votesFor: yes,
    votesAgainst: no,
    abstentions: abstain,
    calculation,
    appliedRule: { rule: null, parameters: {}, sourceClause: "DEFAULT", governanceVersion: "default" },
  };
}

function evaluateMajorityWithParams(
  votes: { yes: number; no: number; abstain: number; invalid?: number },
  majorityType: string,
  params: Record<string, unknown>,
  rule: RuleResolution
): MajorityResult {
  // Use configurable parameters
  const countAbstentions = (params.countAbstentions as boolean) ?? false;
  const denominator = (params.denominator as number) ?? (majorityType === "two_thirds" ? 3 : 2);
  const numerator = (params.numerator as number) ?? (majorityType === "two_thirds" ? 2 : 1);

  const totalVotes = votes.yes + votes.no + (countAbstentions ? votes.abstain : 0);
  const threshold = (numerator / denominator) * 100;

  let adopted = false;
  let calculation = "";

  switch (majorityType) {
    case "simple":
      adopted = votes.yes > votes.no;
      calculation = `${votes.yes} yes > ${votes.no} no (abstentions ${countAbstentions ? "counted" : "excluded"})`;
      break;
    case "absolute":
      adopted = votes.yes > totalVotes / 2;
      calculation = `${votes.yes} yes > ${totalVotes / 2} (>50% of ${totalVotes} total)`;
      break;
    case "two_thirds":
      adopted = votes.yes >= (votes.no * numerator) / (denominator - numerator);
      calculation = `${votes.yes} yes >= ${(votes.no * numerator) / (denominator - numerator)} (${numerator}/${denominator} ratio)`;
      break;
    default:
      adopted = votes.yes > votes.no;
      calculation = `${votes.yes} yes > ${votes.no} no`;
  }

  return {
    adopted,
    threshold,
    votesFor: votes.yes,
    votesAgainst: votes.no,
    abstentions: votes.abstain,
    calculation,
    appliedRule: rule,
  };
}

// ============================================================================
// Decision Registry
// ============================================================================

/**
 * Record a governance decision.
 */
export async function recordDecision(input: {
  decisionId: string;
  type: string;
  title: string;
  description?: string;
  meetingId?: number;
  meetingType?: string;
  motionId?: number;
  amendmentId?: number;
  proposedByType?: string;
  proposedById?: number;
  voteResult?: {
    yes: number;
    no: number;
    abstain: number;
    invalid: number;
    totalEligible: number;
    quorumMet: boolean;
    threshold: number;
    method: string;
    adopted: boolean;
  };
  governanceVersion?: string;
  decidedAt: Date;
  effectiveAt?: Date;
  documents?: string[];
  metadata?: Record<string, unknown>;
}): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [result] = await db.insert(governanceDecisions).values({
      decisionId: input.decisionId,
      type: input.type,
      title: input.title,
      description: input.description,
      meetingId: input.meetingId,
      meetingType: input.meetingType,
      motionId: input.motionId,
      amendmentId: input.amendmentId,
      proposedByType: input.proposedByType,
      proposedById: input.proposedById,
      voteResult: input.voteResult,
      governanceVersion: input.governanceVersion,
      decidedAt: input.decidedAt,
      effectiveAt: input.effectiveAt,
      documents: input.documents,
      metadata: input.metadata,
    });

    const id = Number((result as any)[0].insertId);

    await logAuditEvent({
      action: "governance.decision_recorded",
      entityType: "governance_decision",
      entityId: id,
      after: { decisionId: input.decisionId, type: input.type, title: input.title },
    });

    return { id };
  } catch (error) {
    console.error("[Governance] Failed to record decision:", error);
    return null;
  }
}

// ============================================================================
// Rule Explanation Engine
// ============================================================================

/**
 * Explain why a rule applies (or doesn't) to a subject.
 */
export async function explainRule(
  ruleKey: string,
  subject?: Record<string, unknown>
): Promise<{
  rule: RuleResolution | null;
  explanation: string;
  sourceClause: string;
  effectiveDate: Date;
}> {
  const rule = await resolveEffectiveRule(ruleKey);

  if (!rule) {
    return {
      rule: null,
      explanation: `No rule found for "${ruleKey}"`,
      sourceClause: "UNKNOWN",
      effectiveDate: new Date(),
    };
  }

  const params = rule.parameters;
  const sourceClause = rule.sourceClause;

  // Generate explanation based on rule type
  let explanation = `Rule: ${rule.rule.name}\n`;
  explanation += `Source: ${sourceClause}\n`;
  explanation += `Parameters: ${JSON.stringify(params, null, 2)}\n`;

  if (subject) {
    explanation += `\nApplied to:\n`;
    for (const [key, value] of Object.entries(subject)) {
      explanation += `  ${key}: ${value}\n`;
    }
  }

  return {
    rule,
    explanation,
    sourceClause,
    effectiveDate: rule.rule.effectiveFrom ?? new Date(),
  };
}

// ============================================================================
// Configuration Seeding
// ============================================================================

/**
 * Seed default governance parameters from the current bylaws.
 */
export async function seedGovernanceParameters(): Promise<void> {
  const db = getDb();
  if (!db) return;

  const defaultParams = [
    // NGA parameters
    { key: "nga.date.window.start", value: "July 20", category: "nga", sourceClause: "C-6.3" },
    { key: "nga.date.window.end", value: "August 20", category: "nga", sourceClause: "C-6.3" },
    { key: "nga.invitation.notice_months", value: 2, category: "nga", sourceClause: "C-6.5" },
    { key: "nga.quorum.numerator", value: 1, category: "quorum", sourceClause: "B-8.1.8" },
    { key: "nga.quorum.denominator", value: 3, category: "quorum", sourceClause: "B-8.1.8" },
    { key: "nga.extraordinary.threshold", value: "1/3", category: "nga", sourceClause: "B-8.1.9" },

    // SGA parameters
    { key: "sga.quorum.numerator", value: 1, category: "quorum", sourceClause: "B-8.2.4" },
    { key: "sga.quorum.denominator", value: 3, category: "quorum", sourceClause: "B-8.2.4" },
    { key: "sga.notice.weeks", value: 1, category: "sga", sourceClause: "B-8.2.3" },

    // EB parameters
    { key: "eb.quorum.numerator", value: 2, category: "quorum", sourceClause: "B-11.1.15" },
    { key: "eb.quorum.denominator", value: 3, category: "quorum", sourceClause: "B-11.1.15" },
    { key: "eb.voting.method", value: "absolute", category: "voting", sourceClause: "B-11.1.17" },
    { key: "eb.meeting.frequency_months", value: 1, category: "eb", sourceClause: "B-11.1.12" },

    // Plenary parameters
    { key: "plenary.procedural.threshold", value: "2/3", category: "plenary", sourceClause: "B-8.4.10" },
    { key: "plenary.poo.warning_limit", value: 3, category: "plenary", sourceClause: "B-8.5.4" },
    { key: "plenary.poi.warning_limit", value: 3, category: "plenary", sourceClause: "B-8.6.4" },

    // Voting entitlement
    { key: "voting.permanent_lc.plenary_votes", value: 1, category: "voting", sourceClause: "B-8.7.1" },
    { key: "voting.permanent_lc.election_votes", value: 10, category: "voting", sourceClause: "B-8.7.1" },
    { key: "voting.temporary_lc.plenary_votes", value: 1, category: "voting", sourceClause: "B-8.7.1" },
    { key: "voting.temporary_lc.election_votes", value: 10, category: "voting", sourceClause: "B-8.7.1" },
    { key: "voting.candidate_lc.plenary_votes", value: 0, category: "voting", sourceClause: "B-8.7.2" },
    { key: "voting.candidate_lc.election_votes", value: 1, category: "voting", sourceClause: "B-8.7.2" },
    { key: "voting.ci.plenary_votes", value: 0, category: "voting", sourceClause: "B-8.7.2" },
    { key: "voting.ci.election_votes", value: 1, category: "voting", sourceClause: "B-8.7.2" },
    { key: "voting.min_delegates_for_full_votes", value: 10, category: "voting", sourceClause: "B-8.7.4" },
    { key: "voting.debt_threshold_pkr", value: 2000, category: "voting", sourceClause: "B-8.7.6" },

    // Amendment parameters
    { key: "amendment.bcp.threshold", value: "2/3", category: "amendment", sourceClause: "B-17.2.6" },
    { key: "amendment.bcp.deadline_weeks", value: 3, category: "amendment", sourceClause: "B-17.2.2" },

    // Membership parameters
    { key: "membership.fee_pkr", value: 1000, category: "membership", sourceClause: "B-6.15" },
    { key: "membership.fee.max_increase_pct", value: 15, category: "membership", sourceClause: "B-6.13" },
    { key: "membership.mbbs_ratio", value: 60, category: "membership", sourceClause: "B-6.3" },

    // Term parameters
    { key: "term.duration_months", value: 12, category: "term", sourceClause: "C-7.2" },
    { key: "term.max_extension_months", value: 2, category: "term", sourceClause: "C-7.3" },
    { key: "term.max_eb_terms", value: 3, category: "term", sourceClause: "B-11.1.5" },
    { key: "term.supco_max_extension_months", value: 3, category: "term", sourceClause: "B-9.3.8" },

    // LC parameters
    { key: "lc.temporary.max_years", value: 3, category: "lc", sourceClause: "B-7.2.3ii" },
    { key: "lc.inactivity.removal_months", value: 1, category: "lc", sourceClause: "B-7.6.12" },
    { key: "lc.warning.days", value: 7, category: "lc", sourceClause: "B-7.6.13" },

    // Financial parameters
    { key: "finance.deduction.permanent_lc_pkr", value: 10000, category: "finance", sourceClause: "B-15.1.12" },
    { key: "finance.deduction.candidate_lc_pkr", value: 8000, category: "finance", sourceClause: "B-15.1.13" },
    { key: "finance.deduction.ci_pkr", value: 6000, category: "finance", sourceClause: "B-15.1.14" },
    { key: "finance.transaction.vpf_limit_pkr", value: 5000, category: "finance", sourceClause: "B-15.4.1" },
    { key: "finance.transaction.president_limit_pkr", value: 15000, category: "finance", sourceClause: "B-15.4.2" },
    { key: "finance.transaction.eb_approval_pkr", value: 15000, category: "finance", sourceClause: "B-15.4.3" },

    // Dissolution
    { key: "dissolution.threshold", value: "2/3", category: "dissolution", sourceClause: "B-19.1" },
    { key: "dissolution.notice_months", value: 3, category: "dissolution", sourceClause: "B-19.2" },

    // Plenary team
    { key: "plenary.team.chair", value: 1, category: "plenary", sourceClause: "B-8.3.1" },
    { key: "plenary.team.vice_chair", value: 1, category: "plenary", sourceClause: "B-8.3.1" },
    { key: "plenary.team.secretary", value: 1, category: "plenary", sourceClause: "B-8.3.1" },
    { key: "plenary.team.assistant_secretary", value: 2, category: "plenary", sourceClause: "B-8.3.1" },
    { key: "plenary.team.returning_officer", value: 4, category: "plenary", sourceClause: "B-8.3.1" },

    // SC
    { key: "sc.new.min_permanent_lcs", value: 6, category: "sc", sourceClause: "B-10.2.3" },
    { key: "sc.new.threshold", value: "2/3", category: "sc", sourceClause: "B-10.2.3" },

    // SupCo
    { key: "supco.size.min", value: 2, category: "supco", sourceClause: "C-8.2" },
    { key: "supco.size.max", value: 3, category: "supco", sourceClause: "C-8.2" },
  ];

  let seeded = 0;
  for (const param of defaultParams) {
    const existing = await db
      .select()
      .from(governanceParameters)
      .where(eq(governanceParameters.key, param.key))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(governanceParameters).values({
        key: param.key,
        value: param.value,
        category: param.category,
        sourceClause: param.sourceClause,
        governanceVersion: "2025-26",
        effectiveFrom: new Date("2025-09-06"),
      });
      seeded++;
    }
  }

  if (seeded > 0) {
    console.log(`[Governance] Seeded ${seeded} governance parameters.`);
  }
}
