# Governance Model

## Overview

The Governance Engine is the most critical new subsystem. It consists of two completely separate engines:

1. **Elections Engine** — For democratic processes (president, board, committees)
2. **Plenary/Parliamentary Engine** — For institutional proceedings (WHO/UN/IFMSA-style)

These are **not** the same system and must be implemented independently.

---

## 1. Elections Engine

### Purpose
Handle all democratic processes: nominations, eligibility, campaigning, ballots, voting, counting, disputes, certification, and publication.

### Election Types
| Type | Description | Voting Method |
|------|-------------|---------------|
| Presidential | National president election | Plurality or Ranked Choice |
| Board | Executive board positions | Plurality or Majority |
| National Team | National team selection | Weighted or Plurality |
| Regional | Regional chapter positions | Plurality |
| Chapter | Local chapter positions | Plurality |
| Committee | Committee appointments | Consensus or Plurality |
| Referendum | Binary yes/no votes | Simple Majority |

### Election Lifecycle

```
┌─────────────┐
│   Draft     │ ← Administrator creates election
└──────┬──────┘
       │
┌──────▼──────┐
│  Published  │ ← Election details made public
└──────┬──────┘
       │
┌──────▼──────┐
│ Nominations │ ← Candidates submit nominations
│    Open     │   Eligibility checked automatically
└──────┬──────┘
       │
┌──────▼──────┐
│ Nominations │ ← Nomination period ends
│   Closed    │   Candidates verified
└──────┬──────┘
       │
┌──────▼──────┐
│  Campaign   │ ← Optional: campaigning period
│   Period    │   Rules enforced (no solicitation, etc.)
└──────┬──────┘
       │
┌──────▼──────┐
│   Voting    │ ← Ballots cast
│   Active    │   Anonymous by default
└──────┬──────┘
       │
┌──────▼──────┐
│  Counting   │ ← Votes tallied
│             │   Method applied (plurality, ranked, etc.)
└──────┬──────┘
       │
┌──────▼──────┐
│  Disputes   │ ← Optional: challenge period
│   Period    │   Recount requests
└──────┬──────┘
       │
┌──────▼──────┐
│ Certified   │ ← Results officially certified
│             │   Signed by election committee
└──────┬──────┘
       │
┌──────▼──────┐
│ Published   │ ← Results made public
│             │   Archive created
└─────────────┘
```

### Voting Methods (Configuration, Not Code)

```typescript
interface VotingMethod {
  type: "plurality" | "majority" | "ranked_choice" | "runoff" 
      | "weighted" | "secret_ballot" | "consensus" | "unanimity";
  
  // Plurality: Most votes wins
  // Majority: Must get >50% of votes
  // Ranked Choice: Instant runoff elimination
  // Runoff: Top two go to second round
  // Weighted: Votes weighted by role/hierarchy
  // Secret Ballot: Anonymous voting (always default)
  // Consensus: Must have no objections
  // Unanimity: All must agree
}
```

### Key Entities

#### Election
```typescript
interface Election {
  id: number;
  organizationId: number;
  type: "presidential" | "board" | "national_team" | "regional" | "chapter" | "committee" | "referendum";
  title: string;
  description: string;
  status: "draft" | "published" | "nominations_open" | "nominations_closed" 
        | "campaigning" | "voting_active" | "counting" | "disputes" 
        | "certified" | "published_results" | "archived";
  
  // Timing
  nominationsStart: Date;
  nominationsEnd: Date;
  campaignStart?: Date;
  campaignEnd?: Date;
  votingStart: Date;
  votingEnd: Date;
  disputeEnd?: Date;
  
  // Configuration
  votingMethod: VotingMethod;
  eligibilityCriteria: EligibilityCriteria;
  maxCandidates?: number;
  requireSecondRound: boolean;
  
  // Metadata
  createdById: number;
  electionCommitteeIds: number[];
  createdAt: Date;
  updatedAt: Date;
}
```

#### Candidate
```typescript
interface Candidate {
  id: number;
  electionId: number;
  userId: number;
  position?: string; // For multi-seat elections
  nominationData: Record<string, unknown>; // Custom nomination form data
  status: "nominated" | "verified" | "approved" | "withdrawn" | "disqualified";
  nominationDate: Date;
  verifiedAt?: Date;
  verifiedBy?: number;
}
```

#### Ballot
```typescript
interface Ballot {
  id: number;
  electionId: number;
  voterId: number; // Encrypted/anonymized in storage
  ballotData: Record<string, unknown>; // The actual vote
  method: string; // Which voting method was used
  castAt: Date;
  // Note: Ballot content is encrypted. Only the fact that someone voted is trackable.
}
```

#### ElectionResult
```typescript
interface ElectionResult {
  id: number;
  electionId: number;
  position?: string;
  totalVotes: number;
  totalEligible: number;
  turnout: number; // percentage
  results: Array<{
    candidateId: number;
    votes: number;
    percentage: number;
    rank: number;
    elected: boolean;
  }>;
  method: string;
  certifiedAt?: Date;
  certifiedBy?: number;
  publishedAt?: Date;
}
```

#### Dispute
```typescript
interface Dispute {
  id: number;
  electionId: number;
  filedBy: number;
  type: "recount" | "eligibility" | "process" | "result";
  description: string;
  evidence: string;
  status: "filed" | "under_review" | "resolved" | "dismissed";
  resolution?: string;
  resolvedAt?: Date;
  resolvedBy?: number;
}
```

---

## 2. Plenary/Parliamentary Engine

### Purpose
Handle institutional proceedings in the style of WHO, UN, IFMSA assemblies. This is a completely separate system from Elections.

### Plenary Lifecycle

```
┌─────────────┐
│   Agenda    │ ← Agenda items proposed
│  Proposed   │   Chair reviews
└──────┬──────┘
       │
┌──────▼──────┐
│  Session    │ ← Session scheduled
│  Scheduled  │   Officers appointed
└──────┬──────┘
       │
┌──────▼──────┐
│   Roll      │ ← Attendance taken
│   Call      │   Quorum checked
└──────┬──────┘
       │
┌──────▼──────┐
│   Agenda    │ ← Items taken up
│   Item      │   In order
└──────┬──────┘
       │
┌──────▼──────┐
│   Motion    │ ← Motion proposed
│  Proposed   │   Seconded
└──────┬──────┘
       │
┌──────▼──────┐
│   Speaker   │ ← Speakers called
│    List     │   Time limits enforced
└──────┬──────┘
       │
┌──────▼──────┐
│  Amendments │ ← Motion amended
│  (optional) │   If allowed by rules
└──────┬──────┘
       │
┌──────▼──────┐
│   Debate    │ ← Discussion
│             │   Points of order
└──────┬──────┘
       │
┌──────▼──────┐
│   Vote      │ ← Configurable method
│             │   Recorded
└──────┬──────┘
       │
┌──────▼──────┐
│  Resolution │ ← Decision recorded
│  Adopted    │   Published
└──────┬──────┘
       │
┌──────▼──────┐
│  Session    │ ← Next item or adjournment
│  Continues  │
└─────────────┘
```

### Parliamentary Rules (Configuration)

```typescript
interface ParliamentaryRules {
  // Quorum
  quorumPercentage: number; // e.g., 50 for simple majority quorum
  
  // Voting methods
  defaultVotingMethod: "simple_majority" | "absolute_majority" | "two_thirds" 
                     | "consensus" | "unanimity" | "weighted" 
                     | "roll_call" | "secret_ballot" | "electronic";
  
  // Speaker rules
  maxSpeakerTime: number; // seconds
  maxSpeakersPerSide: number;
  allowClosingStatements: boolean;
  
  // Amendment rules
  allowAmendments: boolean;
  amendmentRequiresSecond: boolean;
  amendmentDebateAllowed: boolean;
  
  // Procedural motions
  allowClosureOfDebate: boolean;
  allowSuspensionOfRules: boolean;
  allowAdjournment: boolean;
  
  // Points of order
  allowPointsOfOrder: boolean;
  chairRulingBinding: boolean;
  appealAllowed: boolean;
  
  // Decision thresholds
  adoptionThreshold: number; // percentage needed to adopt
  amendmentThreshold: number; // percentage needed to amend
}
```

### Key Entities

#### Plenary Session
```typescript
interface PlenarySession {
  id: number;
  organizationId: number;
  title: string;
  description: string;
  type: "regular" | "special" | "emergency" | "annual";
  status: "proposed" | "scheduled" | "in_progress" | "adjourned" | "completed";
  
  scheduledStart: Date;
  scheduledEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;
  
  chairId: number; // Presiding officer
  secretaryId: number; // Recording officer
  
  quorumRequired: number; // Percentage
  quorumMet: boolean;
  
  rules: ParliamentaryRules;
  agenda: AgendaItem[];
  
  createdAt: Date;
  updatedAt: Date;
}
```

#### Agenda Item
```typescript
interface AgendaItem {
  id: number;
  sessionId: number;
  order: number;
  title: string;
  description: string;
  type: "regular" | "urgent" | "procedural" | "election" | "report" | "financial";
  proposedById: number;
  status: "proposed" | "approved" | "tabled" | "discussed" | "decided" | "withdrawn";
  
  motions: Motion[];
  timeAllotted?: number; // seconds
}
```

#### Motion
```typescript
interface Motion {
  id: number;
  agendaItemId: number;
  sessionId: number;
  type: "main" | "amendment" | "procedural" | "point_of_order" | "closure" | "adjournment";
  
  text: string;
  proposedById: number;
  secondedById?: number;
  
  status: "proposed" | "seconded" | "under_debate" | "voting" | "adopted" | "rejected" | "withdrawn";
  
  // For amendments
  amendmentTo?: number; // Motion ID being amended
  amendmentPosition?: "before" | "after" | "replace";
  
  // Speaker list
  speakers: SpeakerEntry[];
  
  // Vote
  vote?: VoteRecord;
  
  proposedAt: Date;
  decidedAt?: Date;
}
```

#### Speaker Entry
```typescript
interface SpeakerEntry {
  userId: number;
  scheduledOrder: number;
  speakingFor: "pro" | "con" | "neutral";
  startTime?: Date;
  endTime?: Date;
  timeUsed: number; // seconds
  timeLimit: number;
}
```

#### Vote Record
```typescript
interface VoteRecord {
  method: string; // Configured voting method
  totalEligible: number;
  totalVoted: number;
  quorumMet: boolean;
  
  // For roll call
  votes: Array<{
    voterId: number;
    vote: "yes" | "no" | "abstain" | "absent";
    weight?: number; // For weighted voting
  }>;
  
  // Summary
  result: {
    yes: number;
    no: number;
    abstain: number;
    absent: number;
    adopted: boolean;
    requiredThreshold: number;
  };
}
```

#### Resolution
```typescript
interface Resolution {
  id: number;
  sessionId: number;
  motionId: number;
  number: string; // e.g., "RES-2025-001"
  title: string;
  text: string;
  status: "draft" | "adopted" | "rejected" | "published" | "implemented";
  adoptedAt?: Date;
  publishedAt?: Date;
  implementedAt?: Date;
  assignedTo?: number; // User responsible for implementation
}
```

---

## 3. Implementation Priority

### Must Have (Phase 1)
1. Election CRUD with lifecycle management
2. Candidate nomination with eligibility checking
3. Basic voting (plurality, secret ballot)
4. Result counting and certification
5. Plenary session management
6. Motion proposal and seconding
7. Basic voting (simple majority, roll call)
8. Resolution recording

### Should Have (Phase 2)
1. Ranked choice voting
2. Runoff elections
3. Weighted voting
4. Amendment handling
5. Speaker list management
6. Points of order
7. Quorum checking
8. Dispute filing

### Nice to Have (Phase 3)
1. Observer/monitor system
2. Recount automation
3. Electronic voting
4. Real-time plenary dashboard
5. Historical archive
6. Export to PDF/DOCX

---

## 4. Configuration-Driven Design

**Critical principle**: All rules must be configuration, not code.

Example: Changing from simple majority to two-thirds vote should be a database change, not a code deploy.

```sql
-- Example configuration entries for plenary rules
INSERT INTO configuration (key, value, category) VALUES
  ('plenary.quorumPercentage', '50', 'governance'),
  ('plenary.defaultVotingMethod', 'simple_majority', 'governance'),
  ('plenary.maxSpeakerTimeSeconds', '300', 'governance'),
  ('plenary.allowAmendments', 'true', 'governance'),
  ('plenary.adoptionThreshold', '50', 'governance');

-- Example configuration entries for election rules
INSERT INTO configuration (key, value, category) VALUES
  ('election.defaultVotingMethod', 'plurality', 'governance'),
  ('election.anonymousVoting', 'true', 'governance'),
  ('election.disputePeriodDays', '7', 'governance'),
  ('election.requireSecondRound', 'false', 'governance');
```
