# Governance Rules Engine — Architecture

## Core Principle

**DO NOT hardcode:**
```typescript
if (isPermanentLC) vote = 1
```

**BUILD:**
```typescript
voteEntitlementEngine.calculate({
    organization,
    meetingType,
    governanceVersion,
    participantContext
})
```

---

## Rule Versioning Model

### Governance Document
Every versioned document (Constitution, Bylaws, IOG, Policy) is a `GovernanceDocument`:

```typescript
interface GovernanceDocument {
  id: number;
  title: string;
  type: "constitution" | "bylaws" | "iog" | "policy" | "annex" | "regulation";
  version: string; // "2025-26", "2026-27"
  status: "draft" | "proposed" | "under_review" | "submitted" | "approved" | "effective" | "superseded" | "suspended" | "expired" | "rejected" | "archived";
  effectiveFrom: Date;
  effectiveUntil?: Date;
  approvedBy?: string;
  approvalMeeting?: string;
  approvalDecision?: string;
  sourceDocument?: string;
  integrityHash?: string;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Governance Clause
Every clause has a stable identifier and its own version history:

```typescript
interface GovernanceClause {
  id: number;
  documentId: number;
  clauseId: string; // "BYLAW-8.7.1", "CONSTITUTION-11.1"
  title: string;
  content: string;
  section: string;
  subsection?: string;
  clauseNumber?: string;
  version: number;
  status: "active" | "superseded" | "suspended" | "expired";
  effectiveFrom: Date;
  effectiveUntil?: Date;
  supersededByClauseId?: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
```

### Governance Rule
Each clause maps to one or more configurable rules:

```typescript
interface GovernanceRule {
  id: number;
  clauseId: number;
  ruleType: string; // "ELIGIBILITY_RULE", "VOTING_RULE", etc.
  ruleKey: string; // Unique key for programmatic access
  name: string;
  description: string;
  parameters: Record<string, unknown>; // Rule-specific parameters
  version: number;
  status: "active" | "superseded" | "suspended";
  effectiveFrom: Date;
  effectiveUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Temporal Rule Resolution

### How to resolve the effective rule at a point in time:

```typescript
async function resolveEffectiveRule(
  ruleKey: string,
  atDate: Date
): Promise<GovernanceRule | null> {
  // Find the rule that was effective at the given date
  const rule = await db
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
  
  return rule ?? null;
}
```

### Historical decisions always use the historical rule:

```typescript
// An NGA conducted under Bylaws 2025-26 must continue
// displaying the 2025-26 rules even after Bylaws 2026-27 are approved.

const historicalRule = await resolveEffectiveRule(
  "voting.entitlement.permanent_lc",
  new Date("2025-12-15") // Date of the historical NGA
);
```

---

## Configurable Governance Parameters

### All parameters from the bylaws that must be configurable:

| Parameter | Current Value | Rule Key | Source Clause |
|-----------|---------------|----------|---------------|
| NGA date window start | July 20 | `nga.date.window.start` | C-6.3 |
| NGA date window end | August 20 | `nga.date.window.end` | C-6.3 |
| NGA invitation notice | 2 months | `nga.invitation.notice_months` | C-6.5 |
| NGA quorum | 1/3 Permanent + Temporary LCs | `nga.quorum.numerator` | B-8.1.8 |
| NGA quorum denominator | 3 | `nga.quorum.denominator` | B-8.1.8 |
| Extraordinary NGA threshold | 1/3 LCs | `nga.extraordinary.threshold` | B-8.1.9 |
| SGA quorum | 1/3 Permanent + Temporary LCs | `sga.quorum.numerator` | B-8.2.4 |
| SGA notice period | 1 week | `sga.notice.weeks` | B-8.2.3 |
| EB quorum | 2/3 EB members | `eb.quorum.numerator` | B-11.1.15 |
| EB quorum denominator | 3 | `eb.quorum.denominator` | B-11.1.15 |
| EB decision method | absolute majority | `eb.voting.method` | B-11.1.17 |
| Procedural motion threshold | 2/3 | `plenary.procedural.threshold` | B-8.4.10 |
| BCP threshold | 2/3 | `amendment.bcp.threshold` | B-17.2.6 |
| BCP deadline | 3 weeks before NGA | `amendment.bcp.deadline_weeks` | B-17.2.2 |
| Financial debt threshold | PKR 2000 | `voting.debt_threshold_pkr` | B-8.7.6 |
| Membership fee | PKR 1000 | `membership.fee_pkr` | B-6.15 |
| Max fee increase/year | 15% | `membership.fee.max_increase_pct` | B-6.13 |
| Term duration | 1 year | `term.duration_months` | C-7.2 |
| Max term extension | 2 months | `term.max_extension_months` | C-7.3 |
| Max EB terms | 3 | `term.max_eb_terms` | B-11.1.5 |
| SupCo size min | 2 | `supco.size.min` | C-8.2 |
| SupCo size max | 3 | `supco.size.max` | C-8.2 |
| SupCo extension max | 3 months | `term.supco_max_extension_months` | B-9.3.8 |
| Plenary team: Chair | 1 | `plenary.team.chair` | B-8.3.1 |
| Plenary team: Vice Chair | 1 | `plenary.team.vice_chair` | B-8.3.1 |
| Plenary team: Secretary | 1 | `plenary.team.secretary` | B-8.3.1 |
| Plenary team: Asst Secretary | 2 | `plenary.team.assistant_secretary` | B-8.3.1 |
| Plenary team: Returning Officers | 4 | `plenary.team.returning_officer` | B-8.3.1 |
| POO warning limit | 3 | `plenary.poo.warning_limit` | B-8.5.4 |
| POI warning limit | 3 | `plenary.poi.warning_limit` | B-8.6.4 |
| Permanent LC plenary votes | 1 | `voting.permanent_lc.plenary_votes` | B-8.7.1 |
| Permanent LC election votes | 10 | `voting.permanent_lc.election_votes` | B-8.7.1 |
| Temporary LC plenary votes | 1 | `voting.temporary_lc.plenary_votes` | B-8.7.1 |
| Temporary LC election votes | 10 | `voting.temporary_lc.election_votes` | B-8.7.1 |
| Candidate LC plenary votes | 0 | `voting.candidate_lc.plenary_votes` | B-8.7.2 |
| Candidate LC election votes | 1 | `voting.candidate_lc.election_votes` | B-8.7.2 |
| CI plenary votes | 0 | `voting.ci.plenary_votes` | B-8.7.2 |
| CI election votes | 1 | `voting.ci.election_votes` | B-8.7.2 |
| Min delegates for full election votes | 10 | `voting.min_delegates_for_full_votes` | B-8.7.4 |
| Membership fee deduction Permanent LC | PKR 10000 | `finance.deduction.permanent_lc_pkr` | B-15.1.12 |
| Membership fee deduction Candidate LC | PKR 8000 | `finance.deduction.candidate_lc_pkr` | B-15.1.13 |
| Membership fee deduction CI | PKR 6000 | `finance.deduction.ci_pkr` | B-15.1.14 |
| EB meeting frequency | monthly | `eb.meeting.frequency_months` | B-11.1.12 |
| EBTO min meetings/year | 5 | `ebto.meeting.min_per_year` | B-11.1.13 |
| Financial year start | October 1 | `finance.year.start` | C-10.2 |
| Financial year end | September 30 | `finance.year.end` | C-10.2 |
| Honorary membership threshold | 2/3 EBTO | `membership.honorary.threshold` | B-6.25.3 |
| LC demotion: max 3 years temporary | 3 years | `lc.temporary.max_years` | B-7.2.3ii |
| LC inactivity removal | 1 month | `lc.inactivity.removal_months` | B-7.6.12 |
| LC warning before removal | 7 days | `lc.warning.days` | B-7.6.13 |
| EBTO extension max | 2 months | `term.ebto_max_extension_months` | C-7.3 |
| New SC proposal: min Permanent LCs | 6 | `sc.new.min_permanent_lcs` | B-10.2.3 |
| New SC threshold | 2/3 | `sc.new.threshold` | B-10.2.3 |
| Dissolution threshold | 2/3 | `dissolution.threshold` | B-19.1 |
| Dissolution notice | 3 months | `dissolution.notice_months` | B-19.2 |
| Transaction limit: EB approval | PKR 15000 | `finance.transaction.eb_approval_pkr` | B-15.4.3 |
| Transaction limit: President | PKR 15000 | `finance.transaction.president_limit_pkr` | B-15.4.2 |
| Transaction limit: VPF | PKR 5000 | `finance.transaction.vpf_limit_pkr` | B-15.4.1 |

---

## Rule Engine Services

### Eligibility Engine
```typescript
async function evaluateEligibility(
  subject: { userId: number; membershipStartDate: Date; degree: string; ngaAttendance: number; lcEbTerms: number },
  position: string,
  governanceVersion: string
): Promise<{
  eligible: boolean;
  reasons: string[];
  appliedRule: GovernanceRule;
}>
```

### Vote Entitlement Engine
```typescript
async function calculateVoteEntitlement(
  organization: { type: "permanent_lc" | "temporary_lc" | "candidate_lc" | "ci"; delegateCount: number },
  meetingType: "plenary" | "election",
  governanceVersion: string
): Promise<{
  plenaryVotes: number;
  electionVotes: number;
  appliedRule: GovernanceRule;
}>
```

### Quorum Engine
```typescript
async function evaluateQuorum(
  meetingType: "nga" | "sga" | "eb",
  electorate: { eligibleBodies: number; presentBodies: number },
  governanceVersion: string
): Promise<{
  quorumMet: boolean;
  required: number;
  present: number;
  eligible: number;
  calculation: string;
  appliedRule: GovernanceRule;
}>
```

### Majority Engine
```typescript
async function evaluateMajority(
  votes: { yes: number; no: number; abstain: number; invalid: number },
  majorityType: "simple" | "absolute" | "relative" | "two_thirds" | "consensus" | "unanimous",
  governanceVersion: string
): Promise<{
  adopted: boolean;
  threshold: number;
  calculation: string;
  appliedRule: GovernanceRule;
}>
```

---

## Implementation Priority

### Phase 1: Foundation
1. Governance document/clause/rule schema
2. Temporal rule resolution
3. Configuration seeding from current bylaws
4. Rule engine services (eligibility, voting, quorum, majority)

### Phase 2: Versioning
1. Amendment workflow
2. Suspension workflow
3. Version comparison
4. Impact analysis

### Phase 3: Meeting Engines
1. NGA engine
2. SGA engine
3. Plenary engine (motions, POO, POI, procedural)
4. Credential engine

### Phase 4: Integration
1. Election integration
2. Decision registry
3. Minutes engine
4. Audit system

### Phase 5: UI & Transparency
1. Admin governance builder
2. Public governance view
3. Rule simulator
4. Rule explanation engine
