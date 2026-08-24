# MSAP Portal — Architecture

## Overview

The MSAP Portal is a **governance platform** for the Medical Students' Association of Pakistan. It manages membership, governance, elections, plenary sessions, finances, and organizational operations.

## Core Architectural Principle

> **Code defines capabilities. Configuration defines MSAP's current rules.**

A non-developer administrator should be able to change organizational rules, roles, approval authorities, deadlines, workflow behavior, terms, and forms **without modifying application source code**.

---

## System Architecture

```
                         MSAP PORTAL
                              |
                    +---------+---------+
                    |                   |
                 Frontend            API Layer
                 (React/Vite)       (tRPC)
                    |                   |
                    +---------+---------+
                              |
                       DOMAIN SERVICES
                              |
        +---------------------+---------------------+
        |                     |                     |
 Workflow Engine        Rules Engine       Permission Engine
        |                     |                     |
        +---------------------+---------------------+
                              |
                    CONFIGURATION LAYER
                              |
        +---------------------+---------------------+
        |                     |                     |
 Organization             Current Term       Governance Version
 Configuration
        |                     |                     |
        +---------------------+---------------------+
                              |
                           DATABASE
                              |
        +---------------------+---------------------+
        |                     |                     |
       Audit              Documents          Notifications
```

---

## Directory Structure

```
server/
  _core/              # Infrastructure (auth, trpc, logging, security)
  config/             # Domain engines and services
    capabilityResolver.ts    # Phase 5: Role → Capability mapping
    configHealthService.ts   # Phase 10: Health dashboard
    configService.ts         # Centralized config (83+ keys)
    formPipelineEngine.ts    # Phase 7: Form → Workflow pipeline
    governanceRulesEngine.ts # Configurable governance rules
    termService.ts           # Phase 2: Term resolution
    workflowEngine.ts        # Phase 6: Generic workflow runtime
    workflowMigration.ts     # Phase 8: Migration adapters
    ...
  services/           # Business services
  routers.ts          # tRPC API routes

client/
  src/
    components/       # Shared UI components
    pages/            # Page components (44+ admin, member pages)
    styles/           # CSS and branding

shared/
  const.ts            # Shared constants
  types.ts            # TypeScript types

drizzle/              # Database schemas (15 files)
docs/                 # Documentation
  audit/              # Phase 0+1 audit deliverables
```

---

## Key Systems

### 1. Configuration Service (`configService.ts`)

Centralized configuration with database storage and in-memory cache.

- **83+ configuration keys** across 9 categories
- Fallback chain: Database → Environment Variable → Default Value
- 5-minute TTL cache with invalidation

### 2. Term Service (`termService.ts`)

Resolves current term and governance version from configuration.

- `getCurrentTermName()` — resolves from `gov.currentTerm`
- `getCurrentGovernanceVersion()` — resolves from `gov.currentVersion`
- `isDateInCurrentTerm(date)` — checks if date is within term bounds
- No hardcoded year assumptions

### 3. Governance Rules Engine (`governanceRulesEngine.ts`)

Configurable, versioned rule resolution against the governance database.

- `resolveEffectiveRule(ruleKey)` — temporal rule resolution
- `evaluateEligibility(subject, position)` — configurable eligibility checks
- `evaluateQuorum(meetingType, electorate)` — configurable quorum
- `evaluateMajority(votes, majorityType)` — 7 majority types
- `recordDecision(input)` — governance decision registry

### 4. Generic Workflow Engine (`workflowEngine.ts`)

Reusable state machine for any business process.

- `createWorkflow(def)` — define workflow with stages
- `startWorkflow(id, entityType, entityId)` — begin instance
- `advanceWorkflow(instanceId, options)` — move to next stage
- `cancelWorkflow(instanceId, reason)` — cancel instance
- `isValidTransition(from, to)` — state machine guard
- `evaluateGuard(type, context)` — configurable guards
- `resolveApprovers(stage, entity)` — config-driven approvers

### 5. Capability Resolver (`capabilityResolver.ts`)

Maps MSA positions to capabilities for authorization.

- 27 MSA positions mapped to capabilities
- `hasCapability(userId, capability)` — RBAC permission check
- `AUTHORIZATION_MATRIX` — operation → required capabilities
- `capabilityProcedure(cap)` — tRPC middleware

### 6. Form Pipeline Engine (`formPipelineEngine.ts`)

Connects forms to workflows with approval chains.

```
FORM → SUBMISSION → VALIDATION → WORKFLOW → APPROVAL → DOCUMENT → NOTIFICATION → AUDIT
```

### 7. Configuration Health Service (`configHealthService.ts`)

System-level health dashboard.

- 7 health check categories
- 0-100 health score
- Per-domain breakdown
- Actionable fix suggestions

---

## Migration Adapters

Phase 8 created migration adapters that bridge existing workflows to the generic runtime:

| Adapter | Entity Type | Stages |
|---------|-------------|--------|
| `membershipWorkflow` | membership | 6 |
| `activityWorkflow` | activity | 5 |
| `nefWorkflow` | nef_nrf | 6 |
| `eventWorkflow` | event | 4 |
| `financeWorkflow` | finance_request | 5 |
| `credentialWorkflow` | credential | 4 |
| `bcpWorkflow` | bcp | 5 |

---

## Security

### Implemented Fixes

| Fix | Description |
|-----|-------------|
| XSS Prevention | HTML/CSS/URL sanitization for CMS content |
| CSV Injection | Formula prefix escaping (`= + - @` → `'=`) |
| API Key Hashing | SHA-256 at rest, rotation, revocation |
| PWA Caching | Sensitive endpoints blocked from service worker cache |
| Upload Security | SVG block, MIME validation, path traversal prevention |
| Security Headers | HSTS, CSP, COOP, CORP, Permissions-Policy |
| Audit Chain | SHA-256 chain hashing for tamper detection |
| State Machine | Terminal states enforced, illegal transitions rejected |
| Production Guards | Mock data seeder requires env flag |
| GitHub Actions | SHA-pinned versions, minimal permissions |

### Test Coverage

- 50+ security-specific tests
- XSS/HTML sanitization
- CSV injection prevention
- Service worker endpoint blocking
- API key irreversibility
- State machine invariants
- Audit chain integrity

---

## Test Strategy

### Test Distribution

| Category | Count |
|----------|-------|
| Unit tests | ~500 |
| Integration tests | ~100 |
| Security tests | ~50 |
| E2E workflow tests | ~50 |
| Configuration tests | ~80 |
| **Total** | **~780** |

### Test Categories

1. **Engine tests** — individual engine function tests
2. **Security tests** — sanitization, hashing, access control
3. **E2E workflow tests** — full lifecycle tests
4. **Configuration tests** — config-driven rule resolution
5. **Mutation tests** — config change → behavior change
6. **CI gate tests** — no-hardcoding regression checks
7. **State machine tests** — transition validation
8. **Database integrity tests** — FK constraints, audit chain

---

## Development Rules

1. **No new duplicate engines** — search before creating
2. **No organization-specific logic in generic engines** — use configuration
3. **Server is authoritative** — frontend config is never trusted
4. **Every workflow must be auditable** — actor, timestamp, before/after
5. **Preserve historical truth** — rule changes don't rewrite history
6. **Tests must prove behavior** — Given/When/Then format
7. **Configuration over code** — if it requires code change, it's a defect
