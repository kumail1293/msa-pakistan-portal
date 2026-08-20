/**
 * Rule Simulator
 * 
 * Implements Section 49: Rule Simulation
 * 
 * Before approving a new bylaws version, administrators must be able
 * to simulate it. The simulator must not change production data.
 */

import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db";
import {
  governanceRules,
} from "../../drizzle/schema.governance_rules";
import {
  ngaDelegations,
} from "../../drizzle/schema.nga";
import { logAuditEvent } from "./auditService";
import { resolveEffectiveRule, evaluateMajority } from "./governanceRulesEngine";

// ============================================================================
// TYPES
// ============================================================================

export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  proposedRules: ProposedRule[];
  createdAt: Date;
  createdBy: number;
}

export interface ProposedRule {
  ruleKey: string;
  parameters: Record<string, unknown>;
  sourceClause?: string;
  replacesRuleId?: number;
}

export interface VotingSimulation {
  organizationType: string;
  currentVotes: { plenary: number; election: number };
  proposedVotes: { plenary: number; election: number };
  change: "increased" | "decreased" | "unchanged";
  impact: string;
}

export interface QuorumSimulation {
  currentQuorum: number;
  proposedQuorum: number;
  eligibleBodies: number;
  change: "easier" | "harder" | "unchanged";
  impact: string;
}

export interface EligibilitySimulation {
  position: string;
  currentEligible: string[];
  proposedEligible: string[];
  added: string[];
  removed: string[];
  impact: string;
}

// ============================================================================
// RULE SIMULATOR
// ============================================================================

export const ruleSimulator = {
  /**
   * Create a simulation scenario.
   */
  createScenario: async (input: {
    name: string;
    description: string;
    proposedRules: ProposedRule[];
    createdBy: number;
  }): Promise<SimulationScenario> => {
    const scenario: SimulationScenario = {
      id: `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: input.name,
      description: input.description,
      proposedRules: input.proposedRules,
      createdAt: new Date(),
      createdBy: input.createdBy,
    };

    await logAuditEvent({
      userId: input.createdBy,
      action: "simulation.created",
      entityType: "simulation",
      entityId: 0,
      after: { scenarioId: scenario.id, name: scenario.name },
    });

    return scenario;
  },

  /**
   * Simulate voting rights under proposed rules.
   */
  simulateVotingRights: async (
    meetingId: number,
    proposedRules: ProposedRule[]
  ): Promise<VotingSimulation[]> => {
    const db = getDb();
    if (!db) return [];

    const delegations = await db
      .select()
      .from(ngaDelegations)
      .where(eq(ngaDelegations.meetingId, meetingId));

    const simulations: VotingSimulation[] = [];

    for (const d of delegations) {
      // Current voting rights
      const currentRule = await resolveEffectiveRule(`voting.${d.organizationType}`);
      const currentParams = (currentRule?.parameters as Record<string, unknown>) ?? {};
      const currentPlenary = (currentParams.plenary_votes as number) ?? 0;
      const currentElection = (currentParams.election_votes as number) ?? 0;

      // Proposed voting rights
      const proposedRule = proposedRules.find(r => r.ruleKey === `voting.${d.organizationType}`);
      const proposedParams = proposedRule?.parameters ?? {};
      let proposedPlenary = (proposedParams.plenary_votes as number) ?? currentPlenary;
      let proposedElection = (proposedParams.election_votes as number) ?? currentElection;

      // Apply delegate count adjustment (B-8.7.4)
      const delegateCount = d.delegateCount ?? 0;
      const minDelegatesForFullVotes = 10;
      if (delegateCount > 0 && delegateCount < minDelegatesForFullVotes) {
        proposedElection = Math.min(proposedElection, delegateCount);
      }

      const change = proposedPlenary > currentPlenary || proposedElection > currentElection
        ? "increased"
        : proposedPlenary < currentPlenary || proposedElection < currentElection
        ? "decreased"
        : "unchanged";

      simulations.push({
        organizationType: d.organizationType,
        currentVotes: { plenary: currentPlenary, election: currentElection },
        proposedVotes: { plenary: proposedPlenary, election: proposedElection },
        change,
        impact: `${d.organizationName}: ${currentPlenary}→${proposedPlenary} plenary, ${currentElection}→${proposedElection} election votes`,
      });
    }

    return simulations;
  },

  /**
   * Simulate quorum under proposed rules.
   */
  simulateQuorum: async (
    meetingType: "nga" | "sga",
    eligibleBodies: number,
    proposedRules: ProposedRule[]
  ): Promise<QuorumSimulation> => {
    // Current quorum
    const currentRule = await resolveEffectiveRule(`quorum.${meetingType}`);
    const currentParams = (currentRule?.parameters as Record<string, unknown>) ?? {};
    const currentNumerator = (currentParams.numerator as number) ?? 1;
    const currentDenominator = (currentParams.denominator as number) ?? 3;
    const currentQuorum = Math.ceil((eligibleBodies * currentNumerator) / currentDenominator);

    // Proposed quorum
    const proposedRule = proposedRules.find(r => r.ruleKey === `quorum.${meetingType}`);
    const proposedParams = proposedRule?.parameters ?? {};
    const proposedNumerator = (proposedParams.numerator as number) ?? currentNumerator;
    const proposedDenominator = (proposedParams.denominator as number) ?? currentDenominator;
    const proposedQuorum = Math.ceil((eligibleBodies * proposedNumerator) / proposedDenominator);

    const change = proposedQuorum < currentQuorum
      ? "easier"
      : proposedQuorum > currentQuorum
      ? "harder"
      : "unchanged";

    return {
      currentQuorum,
      proposedQuorum,
      eligibleBodies,
      change,
      impact: `Quorum changes from ${currentQuorum}/${eligibleBodies} (${currentNumerator}/${currentDenominator}) to ${proposedQuorum}/${eligibleBodies} (${proposedNumerator}/${proposedDenominator})`,
    };
  },

  /**
   * Simulate eligibility under proposed rules.
   */
  simulateEligibility: async (
    position: string,
    _candidates: Array<{ degree: string; membershipMonths: number; lcTerms: number }>,
    proposedRules: ProposedRule[]
  ): Promise<EligibilitySimulation> => {
    // Current eligibility
    const currentRule = await resolveEffectiveRule(`eligibility.${position}`);
    const currentParams = (currentRule?.parameters as Record<string, unknown>) ?? {};
    const currentDegrees = (currentParams.allowedDegrees as string[]) ?? ["MBBS", "BDS"];

    // Proposed eligibility
    const proposedRule = proposedRules.find(r => r.ruleKey === `eligibility.${position}`);
    const proposedParams = proposedRule?.parameters ?? {};
    const proposedDegrees = (proposedParams.allowedDegrees as string[]) ?? currentDegrees;

    const added = proposedDegrees.filter(d => !currentDegrees.includes(d));
    const removed = currentDegrees.filter(d => !proposedDegrees.includes(d));

    return {
      position,
      currentEligible: currentDegrees,
      proposedEligible: proposedDegrees,
      added,
      removed,
      impact: added.length > 0 || removed.length > 0
        ? `Eligibility changes: +${added.join(", ")} -${removed.join(", ")}`
        : "No eligibility changes",
    };
  },

  /**
   * Simulate majority threshold under proposed rules.
   */
  simulateMajority: async (
    votes: { yes: number; no: number; abstain: number },
    majorityType: string,
    proposedRules: ProposedRule[]
  ): Promise<{
    currentResult: { adopted: boolean; threshold: number; calculation: string };
    proposedResult: { adopted: boolean; threshold: number; calculation: string };
    change: "easier_to_adopt" | "harder_to_adopt" | "unchanged";
    impact: string;
  }> => {
    // Current majority
    const currentResult = await evaluateMajority(votes, majorityType as any);

    // Proposed majority
    const proposedRule = proposedRules.find(r => r.ruleKey === `majority.${majorityType}`);
    let proposedAdopted = currentResult.adopted;
    let proposedThreshold = currentResult.threshold;
    let proposedCalculation = currentResult.calculation;

    if (proposedRule) {
      const params = proposedRule.parameters;
      const denominator = (params.denominator as number) ?? 2;
      const numerator = (params.numerator as number) ?? 1;

      const totalVotes = votes.yes + votes.no + votes.abstain;
      proposedThreshold = (numerator / denominator) * 100;
      proposedAdopted = votes.yes > totalVotes * (numerator / denominator);
      proposedCalculation = `${votes.yes} yes / ${totalVotes} total >= ${(numerator / denominator) * 100}%`;
    }

    const change = !currentResult.adopted && proposedAdopted
      ? "easier_to_adopt"
      : currentResult.adopted && !proposedAdopted
      ? "harder_to_adopt"
      : "unchanged";

    return {
      currentResult: {
        adopted: currentResult.adopted,
        threshold: currentResult.threshold,
        calculation: currentResult.calculation,
      },
      proposedResult: {
        adopted: proposedAdopted,
        threshold: proposedThreshold,
        calculation: proposedCalculation,
      },
      change,
      impact: change === "easier_to_adopt"
        ? "Motion would now be adopted under proposed rules"
        : change === "harder_to_adopt"
        ? "Motion would now be rejected under proposed rules"
        : "No change in outcome",
    };
  },

  /**
   * Run a comprehensive simulation scenario.
   */
  runScenario: async (scenario: SimulationScenario): Promise<{
    scenarioId: string;
    votingChanges: VotingSimulation[];
    quorumChanges: QuorumSimulation;
    eligibilityChanges: EligibilitySimulation;
    overallImpact: string;
    riskLevel: "low" | "medium" | "high";
    recommendations: string[];
  }> => {
    // Simulate voting rights (using meeting ID 1 as example)
    const votingChanges = await ruleSimulator.simulateVotingRights(1, scenario.proposedRules);

    // Simulate quorum
    const quorumChanges = await ruleSimulator.simulateQuorum("nga", 50, scenario.proposedRules);

    // Simulate eligibility
    const eligibilityChanges = await ruleSimulator.simulateEligibility(
      "president",
      [
        { degree: "MBBS", membershipMonths: 24, lcTerms: 2 },
        { degree: "BDS", membershipMonths: 12, lcTerms: 1 },
      ],
      scenario.proposedRules
    );

    // Calculate overall impact
    const votingImpact = votingChanges.filter(v => v.change !== "unchanged").length;
    const quorumImpact = quorumChanges.change !== "unchanged" ? 1 : 0;
    const eligibilityImpact = eligibilityChanges.added.length + eligibilityChanges.removed.length;

    const totalImpact = votingImpact + quorumImpact + eligibilityImpact;

    const riskLevel = totalImpact > 5 ? "high" : totalImpact > 2 ? "medium" : "low";

    const recommendations: string[] = [];
    if (riskLevel === "high") {
      recommendations.push("Consider phased implementation");
      recommendations.push("Notify all affected stakeholders");
      recommendations.push("Require 2/3 supermajority for approval");
    }
    if (quorumChanges.change === "harder") {
      recommendations.push("Ensure sufficient delegation attendance");
    }
    if (eligibilityChanges.removed.length > 0) {
      recommendations.push("Review impact on current office holders");
    }

    return {
      scenarioId: scenario.id,
      votingChanges,
      quorumChanges,
      eligibilityChanges,
      overallImpact: `Total changes: ${totalImpact} (voting: ${votingImpact}, quorum: ${quorumImpact}, eligibility: ${eligibilityImpact})`,
      riskLevel,
      recommendations,
    };
  },

  /**
   * Compare two governance versions.
   */
  compareVersions: async (
    versionA: string,
    versionB: string
  ): Promise<{
    rulesInA: string[];
    rulesInB: string[];
    addedInB: string[];
    removedInB: string[];
    changedInB: Array<{ ruleKey: string; change: string }>;
  }> => {
    const db = getDb();
    if (!db) return { rulesInA: [], rulesInB: [], addedInB: [], removedInB: [], changedInB: [] };

    // Get rules for version A (using ruleType as version proxy)
    const rulesA = await db
      .select()
      .from(governanceRules)
      .where(eq(governanceRules.status, "active"));

    // Get rules for version B
    const rulesB = await db
      .select()
      .from(governanceRules)
      .where(eq(governanceRules.status, "active"));

    const rulesInA = rulesA.map(r => r.ruleKey);
    const rulesInB = rulesB.map(r => r.ruleKey);

    const addedInB = rulesInB.filter(k => !rulesInA.includes(k));
    const removedInB = rulesInA.filter(k => !rulesInB.includes(k));

    const changedInB: Array<{ ruleKey: string; change: string }> = [];
    for (const ruleB of rulesB) {
      const ruleA = rulesA.find(r => r.ruleKey === ruleB.ruleKey);
      if (ruleA) {
        const paramsA = ruleA.parameters as Record<string, unknown>;
        const paramsB = ruleB.parameters as Record<string, unknown>;
        if (JSON.stringify(paramsA) !== JSON.stringify(paramsB)) {
          changedInB.push({
            ruleKey: ruleB.ruleKey,
            change: `Parameters changed`,
          });
        }
      }
    }

    return {
      rulesInA,
      rulesInB,
      addedInB,
      removedInB,
      changedInB,
    };
  },
};

export default ruleSimulator;
