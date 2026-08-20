# Elections Engine

## Overview

The Elections Engine handles all democratic processes within the organization. It is completely separate from the Plenary Engine.

---

## Supported Voting Methods

### 1. Plurality (First Past the Post)
- Candidate with most votes wins
- Simple and fast
- Used for: Most chapter/regional elections

### 2. Majority
- Candidate must receive >50% of votes
- If no majority, trigger runoff
- Used for: Presidential elections (first round)

### 3. Ranked Choice (Instant Runoff)
- Voters rank candidates in order of preference
- If no majority, lowest candidate eliminated
- Votes redistributed to next preference
- Continue until majority reached
- Used for: Board elections, complex positions

### 4. Runoff
- Top two candidates from first round
- Second round of voting
- Used for: When majority is required but no candidate achieves it

### 5. Weighted Voting
- Votes weighted by role/hierarchy
- E.g., President = 3 votes, Board = 2 votes, Member = 1 vote
- Used for: Committee decisions, weighted representation

### 6. Secret Ballot (Default)
- Voter identity is encrypted
- Only fact that someone voted is recorded
- Used for: All elections by default

### 7. Consensus
- Must have no objections
- If any objection, motion fails
- Used for: Small committee decisions

### 8. Unanimity
- All eligible voters must agree
- Used for: Constitutional amendments

---

## Election Types & Configuration

### Presidential Election
```json
{
  "type": "presidential",
  "votingMethod": "plurality",
  "eligibility": {
    "minMembershipMonths": 12,
    "membershipStatus": ["Active"],
    "minAge": 18
  },
  "nominations": {
    "requireEndorsement": true,
    "minEndorsements": 5,
    "requireStatement": true,
    "maxCandidates": 5
  },
  "voting": {
    "anonymous": true,
    "durationDays": 7,
    "requireSecondRound": true
  },
  "results": {
    "disputePeriodDays": 7,
    "requireCertification": true,
    "publishResults": true
  }
}
```

### Board Election
```json
{
  "type": "board",
  "votingMethod": "ranked_choice",
  "eligibility": {
    "minMembershipMonths": 6,
    "membershipStatus": ["Active"]
  },
  "nominations": {
    "positions": ["Vice President", "Secretary", "Treasurer"],
    "maxCandidatesPerPosition": 10
  },
  "voting": {
    "anonymous": true,
    "durationDays": 14,
    "allowWriteIns": false
  }
}
```

### Committee Election
```json
{
  "type": "committee",
  "votingMethod": "plurality",
  "eligibility": {
    "committeeMembership": true
  },
  "voting": {
    "anonymous": true,
    "durationDays": 3,
    "quorumPercentage": 50
  }
}
```

---

## API Endpoints

### Election Management
```
POST   /api/elections                    - Create election
GET    /api/elections                    - List elections
GET    /api/elections/:id                - Get election details
PUT    /api/elections/:id                - Update election
DELETE /api/elections/:id                - Delete election (draft only)
POST   /api/elections/:id/publish        - Publish election
POST   /api/elections/:id/close-nominations - Close nominations
POST   /api/elections/:id/start-voting   - Start voting period
POST   /api/elections/:id/end-voting     - End voting period
POST   /api/elections/:id/certify        - Certify results
POST   /api/elections/:id/publish-results - Publish results
```

### Candidate Management
```
POST   /api/elections/:id/candidates     - Nominate candidate
GET    /api/elections/:id/candidates     - List candidates
PUT    /api/elections/:id/candidates/:cid - Update nomination
DELETE /api/elections/:id/candidates/:cid - Withdraw nomination
POST   /api/elections/:id/candidates/:cid/verify - Verify candidate
POST   /api/elections/:id/candidates/:cid/approve - Approve candidate
POST   /api/elections/:id/candidates/:cid/disqualify - Disqualify candidate
```

### Voting
```
POST   /api/elections/:id/ballots        - Cast ballot
GET    /api/elections/:id/ballots/my     - Get my ballot (if allowed)
GET    /api/elections/:id/voter-status   - Check if I've voted
GET    /api/elections/:id/turnout        - Get turnout stats (during voting)
```

### Results
```
GET    /api/elections/:id/results        - Get results (after counting)
GET    /api/elections/:id/results/certified - Get certified results
POST   /api/elections/:id/disputes       - File dispute
GET    /api/elections/:id/disputes       - List disputes
PUT    /api/elections/:id/disputes/:did  - Resolve dispute
```

### Observers (Future)
```
POST   /api/elections/:id/observers      - Register observer
GET    /api/elections/:id/observers      - List observers
GET    /api/elections/:id/audit-trail    - Get full audit trail
```

---

## Eligibility Checking

### Automatic Eligibility
When a user tries to nominate themselves or vote:

1. Check membership status
2. Check membership duration
3. Check any custom criteria (age, position, etc.)
4. Return eligibility result with reason if ineligible

```typescript
interface EligibilityResult {
  eligible: boolean;
  reasons: string[]; // Why ineligible (if applicable)
  criteria: {
    membershipStatus: boolean;
    membershipDuration: boolean;
    ageRequirement: boolean;
    customCriteria: boolean;
  };
}
```

### Custom Eligibility Rules
Configured per election type:

```json
{
  "eligibility": {
    "rules": [
      {
        "type": "membership_status",
        "allowed": ["Active"],
        "message": "Must be an Active member"
      },
      {
        "type": "membership_duration_months",
        "min": 12,
        "message": "Must have been a member for at least 12 months"
      },
      {
        "type": "field_value",
        "field": "yearOfStudy",
        "operator": "gte",
        "value": "3rd Year",
        "message": "Must be at least 3rd year"
      },
      {
        "type": "custom_function",
        "functionName": "checkNoOutstandingDues",
        "message": "Must have no outstanding dues"
      }
    ]
  }
}
```

---

## Ballot Encryption

### Design
- Ballot content is encrypted with election-specific key
- Voter identity is separated from ballot content
- Only fact that someone voted is stored in plain text
- Decryption requires election committee consensus

### Implementation
```typescript
interface EncryptedBallot {
  id: number;
  electionId: number;
  voterHash: string; // SHA-256 of voterId + election salt
  encryptedBallot: string; // AES-256 encrypted ballot data
  iv: string; // Initialization vector
  createdAt: Date;
}
```

---

## Result Counting

### Plurality Counting
```typescript
function countPlurality(ballots: Ballot[]): Result[] {
  const counts = new Map<number, number>();
  
  for (const ballot of ballots) {
    const candidateId = ballot.data.candidateId;
    counts.set(candidateId, (counts.get(candidateId) ?? 0) + 1);
  }
  
  return Array.from(counts.entries())
    .map(([candidateId, votes]) => ({
      candidateId,
      votes,
      percentage: (votes / ballots.length) * 100,
      elected: false, // Set after sorting
    }))
    .sort((a, b) => b.votes - a.votes)
    .map((result, index) => ({
      ...result,
      rank: index + 1,
      elected: index === 0,
    }));
}
```

### Ranked Choice Counting
```typescript
function countRankedChoice(ballots: Ballot[], seats: number = 1): Result[] {
  let remainingCandidates = getCandidateIds(ballots);
  let round = 1;
  
  while (remainingCandidates.length > seats) {
    // Count first preferences
    const counts = countFirstPreferences(ballots, remainingCandidates);
    
    // Check for majority
    const totalValid = ballots.length;
    for (const [candidateId, votes] of counts) {
      if (votes > totalValid / 2) {
        // Elected!
        remainingCandidates = remainingCandidates.filter(id => id !== candidateId);
        break;
      }
    }
    
    // If no majority, eliminate lowest
    if (remainingCandidates.length > seats) {
      const lowest = findLowest(counts, remainingCandidates);
      remainingCandidates = remainingCandidates.filter(id => id !== lowest);
      
      // Redistribute votes
      ballots = redistributeVotes(ballots, lowest);
    }
    
    round++;
  }
  
  // Remaining candidates are elected
  return remainingCandidates.map((candidateId, index) => ({
    candidateId,
    votes: 0, // Final round count
    percentage: 0,
    elected: true,
    rank: index + 1,
  }));
}
```

---

## Dispute Handling

### Dispute Types
1. **Recount** — Request a recount of votes
2. **Eligibility** — Challenge a candidate's eligibility
3. **Process** — Challenge the election process itself
4. **Result** — Challenge the certified results

### Dispute Process
```
File Dispute → Under Review → Investigation → Resolution → Close
                                    ↓
                              Recount (if applicable)
                                    ↓
                              Updated Results
```

### Dispute Resolution
- Election committee reviews all evidence
- May order recount, investigation, or hearing
- Decision is final (unless appealed to higher body)
- All actions are audit-logged
