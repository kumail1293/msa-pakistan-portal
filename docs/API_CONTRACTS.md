# API Contracts

## Overview

- **Framework**: tRPC
- **Validation**: Zod schemas
- **Authentication**: JWT cookies
- **Authorization**: RBAC middleware

---

## Router Structure

### Core Routers
```
appRouter
├── auth           — Login, logout, session
├── user           — User profile, settings
├── admin          — Admin operations
├── config         — Configuration management
├── rbac           — Role/permission management
├── audit          — Audit log queries
├── workflow       — Workflow engine
├── forms          — Forms engine
├── membership     — Member management
├── elections      — Election engine
├── plenary        — Plenary engine
├── activities     — Activity management
├── finance        — Financial operations
├── documents      — Document management
├── notifications  — Notification system
└── integrations   — External integrations
```

---

## Common Patterns

### List Endpoints
```typescript
// Input
{
  limit?: number;      // Default: 50
  offset?: number;     // Default: 0
  status?: string;     // Filter by status
  search?: string;     // Full-text search
  sortBy?: string;     // Sort field
  sortOrder?: "asc" | "desc";
}

// Output
{
  items: T[];
  total: number;
  hasMore: boolean;
}
```

### Detail Endpoints
```typescript
// Input
{ id: number }

// Output
T | null
```

### Create Endpoints
```typescript
// Input (validated with Zod)
{
  name: string;
  description?: string;
  // ... type-specific fields
}

// Output
{ id: number; success: boolean }
```

### Update Endpoints
```typescript
// Input
{
  id: number;
  // ... fields to update
}

// Output
{ success: boolean }
```

### Delete Endpoints
```typescript
// Input
{ id: number; reason?: string }

// Output
{ success: boolean }
```

---

## Workflow API

### Create Workflow
```typescript
workflow.create({
  name: string,
  description?: string,
  entityType: string,
  stages: Array<{
    name: string,
    type: string,
    config?: Record<string, unknown>,
  }>,
  transitions: Array<{
    fromStageName: string,
    outcome: string,
    toStageName: string | null,
    conditions?: Record<string, unknown>,
  }>,
})
```

### Start Workflow
```typescript
workflow.start({
  workflowId: number,
  entityType: string,
  entityId: number,
  metadata?: Record<string, unknown>,
})
```

### Advance Workflow
```typescript
workflow.advance({
  instanceId: number,
  decision: string,
  notes?: string,
  decisionData?: Record<string, unknown>,
})
```

### Get My Tasks
```typescript
workflow.getMyTasks({
  status?: string,
  limit?: number,
})
```

---

## Forms API

### Create Form
```typescript
forms.create({
  name: string,
  description?: string,
  usageType?: string,
})
```

### Add Field
```typescript
forms.addField({
  formId: number,
  name: string,
  label: string,
  type: string,
  required?: boolean,
  options?: Array<{ label: string; value: string }>,
  validation?: Record<string, unknown>,
  conditions?: Record<string, unknown>,
})
```

### Submit Form
```typescript
forms.submit({
  formId: number,
  data: Record<string, unknown>,
  entityType?: string,
  entityId?: number,
})
```

---

## Elections API

### Create Election
```typescript
elections.create({
  title: string,
  description: string,
  type: "presidential" | "board" | "national_team" | "regional" | "chapter" | "committee",
  votingMethod: VotingMethod,
  nominationsStart: Date,
  nominationsEnd: Date,
  votingStart: Date,
  votingEnd: Date,
  eligibilityCriteria: EligibilityCriteria,
})
```

### Nominate Candidate
```typescript
elections.nominate({
  electionId: number,
  userId: number,
  position?: string,
  nominationData?: Record<string, unknown>,
})
```

### Cast Ballot
```typescript
elections.castBallot({
  electionId: number,
  ballotData: Record<string, unknown>,
})
```

---

## Plenary API

### Create Session
```typescript
plenary.createSession({
  title: string,
  description: string,
  type: "regular" | "special" | "emergency" | "annual",
  scheduledStart: Date,
  scheduledEnd: Date,
  chairId: number,
  secretaryId: number,
  rules?: Partial<ParliamentaryRules>,
})
```

### Propose Motion
```typescript
plenary.proposeMotion({
  sessionId: number,
  agendaItemId: number,
  type: "main" | "amendment" | "procedural",
  text: string,
})
```

### Cast Vote
```typescript
plenary.castVote({
  sessionId: number,
  motionId: number,
  vote: "yes" | "no" | "abstain",
})
```

---

## Error Handling

### Standard Error Response
```typescript
{
  success: false,
  error: {
    code: string,        // "NOT_FOUND", "FORBIDDEN", "VALIDATION_ERROR"
    message: string,     // Human-readable message
    details?: unknown,   // Additional context
  }
}
```

### Common Error Codes
- `UNAUTHORIZED` — Not logged in
- `FORBIDDEN` — Insufficient permissions
- `NOT_FOUND` — Entity doesn't exist
- `VALIDATION_ERROR` — Invalid input
- `CONFLICT` — Duplicate/already exists
- `RATE_LIMITED` — Too many requests

---

## Pagination

### Cursor-Based (Preferred)
```typescript
// Input
{
  cursor?: number;  // Last item ID
  limit?: number;   // Default: 50
}

// Output
{
  items: T[];
  nextCursor?: number;
  hasMore: boolean;
}
```

### Offset-Based (Legacy)
```typescript
// Input
{
  offset?: number;  // Default: 0
  limit?: number;   // Default: 50
}

// Output
{
  items: T[];
  total: number;
  hasMore: boolean;
}
```
