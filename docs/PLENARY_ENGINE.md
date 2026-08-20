# Plenary/Parliamentary Engine

## Overview

The Plenary Engine handles institutional proceedings in the style of WHO, UN, IFMSA assemblies. It is completely separate from the Elections Engine.

---

## Parliamentary Procedures

### Standard Flow
1. **Roll Call** — Attendance taken, quorum checked
2. **Agenda** — Items taken up in order
3. **Motion** — Proposed and seconded
4. **Speaker List** — Speakers called in order
5. **Amendments** — If allowed and proposed
6. **Debate** — Discussion with points of order
7. **Vote** — Configurable method
8. **Resolution** — Decision recorded

---

## Session Types

### Regular Session
- Scheduled meetings
- Standard parliamentary rules
- Full agenda

### Special Session
- Called for specific purpose
- May have limited agenda
- Expedited procedures

### Emergency Session
- Urgent matters only
- Reduced quorum requirements
- Fast-track voting

### Annual Session
- Year-end review
- Budget approval
- Officer elections
- Constitutional amendments

---

## Configuration-Driven Rules

### Parliamentary Rules Object
```typescript
interface ParliamentaryRules {
  // Quorum
  quorumPercentage: number; // Default: 50
  
  // Voting methods (configurable per session)
  defaultVotingMethod: VotingMethod;
  allowedVotingMethods: VotingMethod[];
  
  // Speaker rules
  maxSpeakerTimeSeconds: number; // Default: 300 (5 min)
  maxSpeakersPerSide: number; // Default: 5
  allowClosingStatements: boolean; // Default: true
  closingStatementTimeSeconds: number; // Default: 300
  
  // Amendment rules
  allowAmendments: boolean; // Default: true
  amendmentRequiresSecond: boolean; // Default: true
  amendmentDebateAllowed: boolean; // Default: true
  maxAmendmentsPerMotion: number; // Default: 3
  
  // Procedural motions
  allowClosureOfDebate: boolean; // Default: true
  allowSuspensionOfRules: boolean; // Default: true
  allowAdjournment: boolean; // Default: true
  
  // Points of order
  allowPointsOfOrder: boolean; // Default: true
  chairRulingBinding: boolean; // Default: true
  appealAllowed: boolean; // Default: true
  
  // Decision thresholds
  adoptionThreshold: number; // Percentage needed (default: 50)
  amendmentThreshold: number; // Percentage needed (default: 50)
  
  // Time limits
  maxSessionDurationHours: number; // Default: 4
  maxDebateTimePerItemMinutes: number; // Default: 60
  
  // Record keeping
  requireRollCall: boolean; // Default: false
  publishMinutes: boolean; // Default: true
  minutesApprovalRequired: boolean; // Default: true
}
```

### Voting Methods
```typescript
type VotingMethod = 
  | "simple_majority"      // >50% of votes cast
  | "absolute_majority"    // >50% of all eligible voters
  | "two_thirds"           // ≥66.67% of votes cast
  | "consensus"            // No objections
  | "unanimity"            // All must agree
  | "weighted"             // Votes weighted by role
  | "roll_call"            // Individual votes recorded
  | "secret_ballot"        // Anonymous voting
  | "electronic";          // Electronic voting system
```

---

## Session Lifecycle

### States
```
proposed → scheduled → in_progress → adjourned → completed
                         ↓
                    suspended (temporary)
```

### Transitions
- **proposed → scheduled**: Chair approves agenda
- **scheduled → in_progress**: Session begins, roll call taken
- **in_progress → adjourned**: Session adjourned (may continue later)
- **in_progress → completed**: All agenda items dealt with
- **in_progress → suspended**: Temporary suspension
- **suspended → in_progress**: Session resumed

---

## Motion Lifecycle

### States
```
proposed → seconded → under_debate → voting → adopted/rejected
    ↓
withdrawn (at any point before voting)
```

### Motion Types
1. **Main Motion** — Proposes action
2. **Amendment** — Modifies a main motion
3. **Procedural** — Affects how business is conducted
4. **Point of Order** — Raises a rules violation
5. **Closure** — Ends debate on current motion
6. **Adjournment** — Ends the session

### Amendment Process
```
Main Motion (M)
  ├── Amendment 1 (A1) — Modifies M
  │     └── Sub-Amendment (SA1) — Modifies A1
  └── Amendment 2 (A2) — Modifies M
```

Voting order: SA1 → A1 → A2 → M (as amended)

---

## Speaker Management

### Speaker List
```typescript
interface SpeakerList {
  sessionId: number;
  motionId?: number; // null for general debate
  
  speakers: SpeakerEntry[];
  
  // Rules
  maxTimePerSpeaker: number;
  currentTimeIndex: number; // Who's next
  
  // State
  isOpen: boolean;
  closedAt?: Date;
}

interface SpeakerEntry {
  userId: number;
  scheduledOrder: number;
  speakingFor: "pro" | "con" | "neutral";
  
  // Timing
  startTime?: Date;
  endTime?: Date;
  timeUsed: number;
  timeLimit: number;
  
  // Status
  status: "scheduled" | "speaking" | "completed" | "skipped";
  
  // Points of order raised during speech
  pointsOfOrder: PointOfOrder[];
}
```

### Points of Order
```typescript
interface PointOfOrder {
  id: number;
  sessionId: number;
  raisedById: number;
  motionId?: number;
  
  type: "order" | "relevance" | "quorum" | "division" | "appeal";
  text: string;
  
  // Chair ruling
  rulingBy?: number;
  ruling?: "sustained" | "overruled";
  rulingText?: string;
  
  // Appeal (if allowed)
  appealed?: boolean;
  appealResult?: "upheld" | "reversed";
  
  raisedAt: Date;
  ruledAt?: Date;
}
```

---

## Quorum Management

### Quorum Calculation
```typescript
function calculateQuorum(
  totalEligibleVoters: number,
  quorumPercentage: number
): number {
  return Math.ceil((totalEligibleVoters * quorumPercentage) / 100);
}
```

### Quorum Check Points
1. **Session Start** — Must have quorum to begin
2. **Before Voting** — Must have quorum to vote
3. **During Session** — If quorum lost, session suspended

### Quorum Loss
```typescript
interface QuorumLoss {
  sessionId: number;
  detectedAt: Date;
  membersPresent: number;
  quorumRequired: number;
  
  // Action taken
  action: "suspension" | "adjournment";
  suspendedAt?: Date;
  resumedAt?: Date;
  
  // Notification
  notifiedMembers: number[];
}
```

---

## Resolution Management

### Resolution Structure
```typescript
interface Resolution {
  id: number;
  sessionId: number;
  motionId: number;
  
  number: string; // e.g., "RES-2025-001"
  title: string;
  text: string;
  
  // Adoption details
  adoptedAt?: Date;
  adoptedByVote: VoteRecord;
  
  // Implementation
  status: "draft" | "adopted" | "rejected" | "published" | "implemented";
  assignedTo?: number;
  implementationDeadline?: Date;
  implementationNotes?: string;
  
  // Publication
  publishedAt?: Date;
  publishedIn?: string; // Official gazette, website, etc.
  
  // Supersession
  supersedesResolutionId?: number;
  supersededByResolutionId?: number;
}
```

### Resolution Numbering
```typescript
function generateResolutionNumber(sessionId: number, sequence: number): string {
  const year = new Date().getFullYear();
  return `RES-${year}-${String(sequence).padStart(3, "0")}`;
}
```

---

## API Endpoints

### Session Management
```
POST   /api/plenary/sessions              - Create session
GET    /api/plenary/sessions              - List sessions
GET    /api/plenary/sessions/:id          - Get session details
PUT    /api/plenary/sessions/:id          - Update session
POST   /api/plenary/sessions/:id/start    - Start session
POST   /api/plenary/sessions/:id/adjourn  - Adjourn session
POST   /api/plenary/sessions/:id/resume   - Resume session
POST   /api/plenary/sessions/:id/complete - Complete session
```

### Agenda Management
```
POST   /api/plenary/sessions/:id/agenda           - Add agenda item
GET    /api/plenary/sessions/:id/agenda            - List agenda items
PUT    /api/plenary/sessions/:id/agenda/:aid       - Update agenda item
DELETE /api/plenary/sessions/:id/agenda/:aid       - Remove agenda item
PUT    /api/plenary/sessions/:id/agenda/reorder    - Reorder agenda items
```

### Motion Management
```
POST   /api/plenary/sessions/:id/motions          - Propose motion
GET    /api/plenary/sessions/:id/motions          - List motions
GET    /api/plenary/sessions/:id/motions/:mid      - Get motion details
POST   /api/plenary/sessions/:id/motions/:mid/second - Second motion
POST   /api/plenary/sessions/:id/motions/:mid/amend  - Amend motion
POST   /api/plenary/sessions/:id/motions/:mid/withdraw - Withdraw motion
POST   /api/plenary/sessions/:id/motions/:mid/debate  - Start debate
POST   /api/plenary/sessions/:id/motions/:mid/vote    - Start vote
```

### Speaker Management
```
POST   /api/plenary/sessions/:id/speakers         - Add to speaker list
GET    /api/plenary/sessions/:id/speakers          - Get speaker list
DELETE /api/plenary/sessions/:id/speakers/:uid      - Remove from speaker list
POST   /api/plenary/sessions/:id/speakers/reorder  - Reorder speakers
POST   /api/plenary/sessions/:id/speakers/:uid/start - Start speaking
POST   /api/plenary/sessions/:id/speakers/:uid/stop  - Stop speaking
```

### Voting
```
POST   /api/plenary/sessions/:id/votes            - Cast vote
GET    /api/plenary/sessions/:id/votes/:mid        - Get vote results
POST   /api/plenary/sessions/:id/votes/:mid/division - Request division
```

### Points of Order
```
POST   /api/plenary/sessions/:id/points           - Raise point of order
PUT    /api/plenary/sessions/:id/points/:pid/rule  - Chair ruling
POST   /api/plenary/sessions/:id/points/:pid/appeal - Appeal ruling
```

### Resolutions
```
GET    /api/plenary/sessions/:id/resolutions      - List resolutions
GET    /api/plenary/resolutions/:rid              - Get resolution
PUT    /api/plenary/resolutions/:rid              - Update resolution
POST   /api/plenary/resolutions/:rid/publish      - Publish resolution
POST   /api/plenary/resolutions/:rid/implement    - Mark implemented
```

---

## Real-Time Features

### Live Session Dashboard
- Current agenda item
- Speaker list with timers
- Motion status
- Quorum indicator
- Vote progress

### Notifications
- Session reminders
- Motion proposed/seconded
- Speaker called
- Vote results
- Resolution adopted

---

## Integration with Workflow Engine

### Session → Workflow
A plenary session can trigger workflows:
- Resolution adopted → Create implementation task
- Budget approved → Create finance workflow
- Officer elected → Update membership records

### Configuration
```json
{
  "integrations": {
    "workflow_triggers": {
      "on_resolution_adopted": {
        "enabled": true,
        "workflowName": "resolution_implementation"
      },
      "on_budget_approved": {
        "enabled": true,
        "workflowName": "budget_execution"
      }
    }
  }
}
```
