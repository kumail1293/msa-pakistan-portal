# MSAP Portal — PLAN_NEW

## 1. Purpose

This document replaces feature-first development with a **configuration-first, workflow-first architecture**.

The immediate objective is not to add more modules. It is to make the existing platform genuinely configurable, eliminate organizational business logic from source code, consolidate duplicated engines, and prove real end-to-end workflows.

### Core principle

> **Code defines capabilities. Configuration defines MSAP's current rules.**

A non-developer administrator should be able to change organizational rules, roles, approval authorities, deadlines, workflow behavior, terms, and forms without changing application source code.

---

# 2. Current Audit Diagnosis

The portal has made strong progress in:

- Security hardening
- Authentication and role hierarchy
- Audit logging and audit-chain integrity
- Workflow transition guards
- Governance infrastructure
- Forms Builder
- Organization configuration
- UI consistency
- Test coverage

However, the current architecture still has a critical problem:

> **The platform contains configurable infrastructure, but operational workflows and business rules still contain hardcoded assumptions.**

Passing unit/security tests is not sufficient. The platform must prove that real organizational workflows can execute and change through configuration.

## Current priorities

| Area | Status | Priority |
|---|---|---:|
| Security | Strong foundation | Low |
| Authentication / roles | Strong foundation | Low |
| Audit chain | Strong foundation | Low |
| UI consistency | Improving | Low |
| Governance architecture | Ambitious / needs consolidation | High |
| Configuration | Incomplete | Critical |
| Workflow execution | Not sufficiently proven | Critical |
| Hardcoded business logic | Still present | Critical |
| E2E workflows | Insufficient | Critical |
| Data-driven organization model | Needs strengthening | Critical |

---

# 3. Development Freeze

Until the hardcoding and workflow audit is complete:

- Do not add major new governance modules.
- Do not create additional workflow engines.
- Do not create organization-specific UI logic.
- Do not duplicate rule/permission systems.
- Do not add features merely to increase module count.
- Do not patch individual workflow failures without identifying their architectural cause.

Allowed work:

- Audit
- Refactoring
- Configuration infrastructure
- Workflow runtime
- Rule resolution
- Data-model improvements
- Migration
- Testing
- Security/integrity fixes

---

# 4. Definition of "Configurable"

A feature is considered **truly configurable** only if an authorized administrator can modify its organizational behavior without modifying application source code.

Examples:

- Approval authority
- Role assignment
- Approval threshold
- Quorum
- Voting rule
- Eligibility rule
- Deadline
- Term dates
- Workflow transition
- Required document
- Form field
- Notification recipient
- Governance rule
- Organization setting

If changing one of these requires editing TypeScript/React/server source code, it is a **hardcoding defect**.

---

# 5. Target Architecture

```text
                         MSAP PORTAL
                              |
                    +---------+---------+
                    |                   |
                 Frontend            API Layer
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

## Architectural separation

### Workflow Definition

What a workflow is.

### Configuration

How MSAP currently wants the workflow to behave.

### Workflow Instance

One real organizational process/event.

### Execution State

Where that specific instance currently is.

These four concepts must not be mixed.

---

# 6. Phase 0 — Repository and Architecture Audit

## Objective

Create a complete inventory before changing architecture.

### Tasks

- [ ] Audit frontend architecture.
- [ ] Audit backend architecture.
- [ ] Audit database schema.
- [ ] Audit shared package.
- [ ] Audit governance modules.
- [ ] Audit workflow implementations.
- [ ] Audit rule engines.
- [ ] Audit permission systems.
- [ ] Audit configuration systems.
- [ ] Audit forms systems.
- [ ] Audit notification systems.
- [ ] Audit document systems.
- [ ] Audit audit-log systems.
- [ ] Identify duplicate functionality.
- [ ] Identify dead/unused functionality.
- [ ] Identify partially implemented engines.
- [ ] Identify modules bypassing generic services.

### Required deliverables

```text
docs/audit/
  ARCHITECTURE_AUDIT.md
  HARDCODE_INVENTORY.md
  WORKFLOW_INVENTORY.md
  RULE_INVENTORY.md
  CONFIGURATION_INVENTORY.md
  DUPLICATE_SYSTEMS.md
  MIGRATION_MAP.md
```

---

# 7. Phase 1 — Hardcode Census

Search the entire repository for organizational assumptions.

## Search categories

### Roles

```text
president
vpi
vpe
vpa
vpcb
vpm
vpf
vpprc
supco
npo
norp
nora
nome
nore
neo
lc-president
lc-vpa
lc-vpf
lc-secretary
ci-coordinator
```

### Organizational dates

```text
2025
2026
2025/26
October 1
September 30
```

### Financial assumptions

```text
5000
15000
2/3
budget
quorum
approval threshold
```

### Workflow states

```text
pending
approved
rejected
completed
cancelled
running
submitted
review
```

### Other assumptions

Search for:

- Officer IDs
- Organization IDs
- LC IDs
- Static approver IDs
- Hardcoded notification recipients
- Hardcoded email addresses
- Hardcoded deadlines
- Hardcoded voting weights
- Hardcoded quorum
- Hardcoded eligibility
- Hardcoded document requirements
- Hardcoded term logic
- Hardcoded module permissions
- Hardcoded workflow transitions
- Hardcoded governance phases

## Hardcode inventory format

Each finding must record:

```text
ID
File
Line
Current hardcoded value
Business meaning
Category
Who should control it
Target configuration location
Migration strategy
Risk
```

---

# 8. Phase 2 — Central Configuration Architecture

Create one authoritative configuration system.

Do not create separate unrelated configuration tables/services for every module.

## Required hierarchy

```text
Organization
    ↓
Term
    ↓
Governance Version
    ↓
Rule
    ↓
Workflow Definition
    ↓
Workflow Instance
    ↓
Workflow State
```

## Configuration requirements

Configuration must support:

- Versioning
- Effective dates
- Historical resolution
- Draft state
- Published state
- Validation
- Audit history
- Rollback
- Permission control
- Dependency checking

---

# 9. Phase 3 — Term and Governance Resolution

Nothing organizational should depend on hardcoded current-year assumptions.

Create a centralized term service.

Example:

```text
Current Term
Previous Term
Upcoming Term
```

All historical records must resolve against the rules that were effective at the time.

Example:

```text
2025/26
Term Start: 2025-10-01
Term End: 2026-09-30
Governance Version: v1.x
```

No application module should independently implement term-date logic.

---

# 10. Phase 4 — Rules Engine

Create one authoritative rule-resolution mechanism.

## Rule types should cover

- Eligibility
- Approval
- Voting
- Quorum
- Election
- Finance
- Deadline
- Credential
- Membership
- Term
- Document requirement
- Notification
- Governance procedure

## Rule resolution

The application should ask:

```text
resolveRule("FINANCE_APPROVAL_THRESHOLD")
```

It must not contain:

```text
if amount > 15000
```

Business rules must be data-driven.

---

# 11. Phase 5 — Capability-Based Authorization

Move from:

```text
Role → Page
```

toward:

```text
Role → Capability → Policy
```

Example:

```text
VPF
  ↓
finance.request.review
finance.budget.approve
finance.payment.verify
```

Workflow logic should resolve the capability/authority dynamically.

It must not depend on:

- Specific user IDs
- Specific officer names
- Current-term officer assignments
- Frontend route assumptions

---

# 12. Phase 6 — Generic Workflow Runtime

Create one reusable workflow runtime.

## Required model

```text
Workflow Definition
       ↓
States
       ↓
Transitions
       ↓
Guards
       ↓
Actions
       ↓
Approvals
       ↓
Notifications
       ↓
Audit Events
```

## Requirements

- Generic state machine
- Valid transition validation
- Guards
- Actions
- Approval resolution
- Escalation
- Deadlines
- Cancellation
- Reopening where permitted
- Audit events
- Notifications
- Transaction safety
- Concurrency protection
- Historical workflow visibility

No individual business module should reinvent these mechanics.

---

# 13. Phase 7 — Forms → Workflow → Approval → Document

The Forms Builder must become a platform primitive.

Required pipeline:

```text
FORM
 ↓
SUBMISSION
 ↓
VALIDATION
 ↓
WORKFLOW
 ↓
APPROVAL
 ↓
DOCUMENT
 ↓
NOTIFICATION
 ↓
AUDIT
```

The same pipeline must support:

- Membership
- Appointment
- NEF
- NRF
- Activities
- Events
- Finance requests
- Certificates
- Credentials
- Election nominations
- BCP
- BSP
- Awards

Creating a new form must not require creating a new workflow implementation unless the process genuinely requires a new technical capability.

---

# 14. Phase 8 — Migration of Existing Workflows

Migrate existing functionality incrementally.

## Priority order

### 1. Membership

```text
Application
→ Validation
→ Verification
→ Approval
→ Membership
→ Certificate
→ Notification
→ Audit
```

### 2. Appointments

```text
Proposal
→ Eligibility
→ Approval
→ Appointment Letter
→ Term Assignment
→ Notification
→ Audit
```

### 3. NEF / NRF

```text
Submission
→ VPA Review
→ Financial Review
→ Approval
→ Execution
→ Report
→ Closure
```

### 4. Activities

```text
Submission
→ Review
→ Approval
→ Execution
→ Report
→ Closure
```

### 5. Events

```text
Proposal
→ Review
→ Budget
→ Approval
→ Execution
→ Report
→ Closure
```

### 6. Finance

```text
Request
→ Budget Validation
→ Authority Resolution
→ Approval
→ Payment
→ Receipt
→ Ledger
→ Audit
```

### 7. Credentials

```text
Submission
→ Validation
→ Approval
→ Override if authorized
→ Issuance
→ Audit
```

### 8. NGA

Use the generic workflow runtime for the existing 15-phase lifecycle.

### 9. SGA

Use the same runtime with configuration-driven EBTO/SupCo approval chains.

### 10. Elections

```text
Election
→ Nomination
→ Eligibility Snapshot
→ Credential Verification
→ Ballot
→ Voting
→ Counting
→ Result
→ Certification
```

### 11. Plenary

Use the same workflow/state infrastructure for:

- Motions
- Points of Order
- Points of Information
- Speaker management
- Voting
- Closure

### 12. BCP / BSP

Use the same amendment/suspension workflow infrastructure.

---

# 15. Phase 9 — Configuration Studio

The administration interface must expose configuration safely.

## Required areas

### Organization

- Organization name
- Branding
- Contact information
- Default settings

### Terms

- Term name
- Start date
- End date
- Status

### Governance

- Governance version
- Rules
- Effective dates
- Amendments

### Roles

- Positions
- Capabilities
- Assignments
- Term association

### Workflows

- Definitions
- States
- Transitions
- Guards
- Approvers
- Deadlines

### Forms

- Fields
- Validation
- Required documents
- Workflow mapping

### Notifications

- Templates
- Channels
- Recipients
- Escalations

---

# 16. Phase 10 — Configuration Health Dashboard

Create a system-level health dashboard.

Example:

```text
Configuration Health

Governance Version       v1.4
Current Term             2025/26

Rules                    124
Configured               121
Missing                    3

Workflow Definitions      18
Valid                     17
Broken                     1

Hardcoded Rules Detected   7

Expired Rules              0
Orphaned Roles             2
Missing Approvers          1

Production Readiness:
NOT READY
```

## Health checks

- Missing configuration
- Invalid configuration
- Conflicting rules
- Expired rules
- Orphaned roles
- Missing approvers
- Broken workflow transitions
- Unused rules
- Duplicate rules
- Hardcoded business logic
- Invalid term configuration
- Missing notification templates
- Missing document templates

---

# 17. Phase 11 — Real End-to-End Testing

Unit tests are necessary but insufficient.

Create E2E tests representing real MSAP operations.

## Mandatory scenarios

- [ ] Member registration
- [ ] Membership approval
- [ ] Appointment issuance
- [ ] NEF submission and approval
- [ ] NRF submission and approval
- [ ] Activity approval
- [ ] Event approval
- [ ] Finance request
- [ ] Credential verification
- [ ] NGA lifecycle
- [ ] SGA lifecycle
- [ ] Election lifecycle
- [ ] Plenary motion lifecycle
- [ ] BCP lifecycle
- [ ] BSP lifecycle
- [ ] Document issuance
- [ ] Notification delivery
- [ ] Audit-chain verification

Every scenario must test:

```text
User
→ Permission
→ Form
→ Validation
→ Workflow
→ Approval
→ Database
→ Notification
→ Document
→ Audit
```

---

# 18. Phase 12 — Configuration Mutation Tests

This is the definitive test of configurability.

For every major workflow:

1. Change the rule/configuration.
2. Do not change source code.
3. Execute the workflow.
4. Confirm behavior changed correctly.
5. Confirm old historical records remain correct.

Examples:

```text
Change approval authority
Change finance threshold
Change deadline
Change required document
Change quorum
Change eligibility rule
Change role assignment
Change term
Change workflow transition
```

If a source-code change is required, mark the dependency as a defect.

---

# 19. Phase 13 — No-Hardcoding CI Gate

Create architectural checks that prevent regression.

## CI should flag

- Business rules inside React components
- Organization-specific workflow logic in frontend
- Monetary thresholds in source
- Term dates in source
- Officer IDs in source
- Hardcoded approver IDs
- Workflow transitions outside workflow engine
- Notification recipients hardcoded
- Organization-specific governance logic in generic engines
- Duplicate permission logic
- Duplicate workflow state machines

## CI should permit

- Technical constants
- Security constants
- Platform limits
- UI constants
- Infrastructure configuration

---

# 20. Phase 14 — Database Integrity

Review transaction boundaries and relationships.

Audit:

- Foreign keys
- Unique constraints
- Cascades
- Soft deletion
- Versioning
- Historical records
- Concurrent approvals
- Race conditions
- Duplicate submissions
- Idempotency
- Workflow instance integrity
- Audit-event integrity

No workflow transition should leave partially committed state.

---

# 21. Phase 15 — Security Revalidation

Keep the recent security hardening.

Re-test:

- Authentication
- Authorization
- API key hashing
- Key rotation
- Expired-key revocation
- Sensitive PWA caching
- XSS
- URL injection
- CSS injection
- CSV injection
- SVG upload restrictions
- MIME validation
- Path traversal
- SSRF
- Rate limiting
- Audit-chain integrity
- Production seed protection
- GitHub Actions permissions

Security changes must not be removed merely to simplify refactoring.

---

# 22. Phase 16 — Documentation

Create/update:

```text
docs/
  ARCHITECTURE.md
  CONFIGURATION_ARCHITECTURE.md
  WORKFLOW_ENGINE.md
  RULE_ENGINE.md
  PERMISSION_MODEL.md
  TERM_MODEL.md
  FORMS_PIPELINE.md
  GOVERNANCE_MODEL.md
  MIGRATION_GUIDE.md
  ADMIN_CONFIGURATION_GUIDE.md
  E2E_TESTING.md
  HARDCODE_POLICY.md
```

Every major engine must document:

- Purpose
- Inputs
- Outputs
- Database entities
- APIs
- Configuration
- Extension mechanism
- Security model
- Audit model
- Test strategy

---

# 23. Definition of Done

A module is **NOT DONE** merely because:

- It compiles.
- UI works.
- Unit tests pass.
- API returns data.
- A workflow can be executed once.

A module is DONE when:

- [ ] Business rules are configuration-driven.
- [ ] Roles are dynamically resolved.
- [ ] Workflow uses the generic runtime.
- [ ] Configuration is versioned.
- [ ] Historical behavior is preserved.
- [ ] Audit events are generated.
- [ ] Notifications work.
- [ ] Documents work where required.
- [ ] Authorization is enforced server-side.
- [ ] E2E tests pass.
- [ ] Configuration mutation tests pass.
- [ ] No prohibited hardcoding remains.
- [ ] Documentation exists.
- [ ] Configuration health reports the module as healthy.

---

# 24. Development Rules for AI/Codebuff

All future implementation work must follow these rules.

## Rule 1 — Do not patch symptoms

Before fixing a workflow bug, identify whether the issue is:

- Configuration
- Data model
- Rule resolution
- Permission resolution
- Workflow runtime
- UI
- API
- Transaction integrity

Fix the architectural layer, not only the symptom.

## Rule 2 — No new duplicate engines

Before creating a service/engine, search the repository for existing functionality.

If an equivalent engine exists:

- Extend it, or
- Consolidate it.

Do not create a second implementation.

## Rule 3 — No organization-specific logic in generic engines

Generic engines must not contain:

```text
MSAP-specific officer IDs
MSAP-specific term IDs
MSAP-specific thresholds
MSAP-specific dates
```

These belong to configuration/data.

## Rule 4 — Server is authoritative

Frontend configuration must never be trusted for:

- Permissions
- Approval authority
- Eligibility
- Financial limits
- Voting rights
- Workflow transitions

The server resolves authoritative rules.

## Rule 5 — Every workflow must be auditable

Every state transition should have:

- Actor
- Timestamp
- Previous state
- New state
- Reason/context
- Rule/configuration version
- Audit event

## Rule 6 — Preserve historical truth

A rule changing today must not rewrite what was legally/organizationally valid yesterday.

Historical records must resolve against the correct governance version.

## Rule 7 — Tests must prove behavior

Prefer:

```text
Given configuration X
When workflow Y is executed
Then result Z occurs
```

over tests that merely inspect implementation details.

---

# 25. Recommended Repository Structure

Target structure:

```text
server/
  core/
    configuration/
    terms/
    governance/
    rules/
    permissions/
    workflows/
    audit/
    notifications/
    documents/

  modules/
    membership/
    appointments/
    activities/
    events/
    finance/
    credentials/
    elections/
    nga/
    sga/
    plenary/
    amendments/

client/
  core/
    configuration/
    workflows/
    forms/
    permissions/

  modules/
    ...

shared/
  domain/
  schemas/
  types/
  workflow/
  rules/

docs/
  architecture/
  audit/
  governance/
  workflows/
```

The exact structure may differ if the current codebase has a better established convention. Do not reorganize directories solely for appearance.

---

# 26. Migration Strategy

Do not rewrite the entire application.

Use:

```text
Audit
→ Abstract
→ Introduce generic layer
→ Migrate one workflow
→ Test
→ Migrate next workflow
→ Remove old implementation
```

Each migration must leave the application operational.

## Migration rule

No legacy workflow should be deleted until:

1. New implementation exists.
2. E2E tests pass.
3. Configuration mutation tests pass.
4. Historical behavior is verified.
5. Production data migration is tested.
6. Audit continuity is confirmed.

---

# 27. Release Gates

## Gate A — Architecture Audit

Required:

- Hardcode inventory complete
- Workflow inventory complete
- Duplicate systems identified
- Migration plan approved

## Gate B — Configuration Foundation

Required:

- Configuration service
- Term service
- Governance versioning
- Rule resolver
- Capability resolver

## Gate C — Workflow Runtime

Required:

- Generic workflow engine
- Guards
- Actions
- Approvals
- Audit
- Notifications
- Transaction safety

## Gate D — First Production Workflow

Membership must work end-to-end without hardcoded business rules.

## Gate E — Core Operations

Membership + appointments + NEF/NRF + activities + finance operational.

## Gate F — Governance

NGA + SGA + elections + plenary operational.

## Gate G — Production Readiness

All configuration health checks pass and prohibited hardcoding is zero or explicitly waived.

---

# 28. Success Metric

The ultimate success metric is not:

```text
Tests: 600+
Modules: 30+
Features: 100+
```

The key metric is:

> **How many organizational changes can an authorized administrator make without a developer changing source code?**

Target:

```text
Organizational rule changes requiring code changes: 0
```

for all business rules that are intended to be configurable.

---

# 29. Final Target State

The finished MSAP Portal should behave as a **governance platform**, not a collection of hardcoded MSAP workflows.

The architecture should allow:

```text
New Term
     ↓
New Governance Version
     ↓
Configure Rules
     ↓
Configure Roles
     ↓
Configure Workflows
     ↓
Configure Forms
     ↓
Configure Approvals
     ↓
Run Organization
```

without rewriting the application.

The platform should be able to evolve because **MSAP's rules evolve**, not because developers repeatedly rewrite the application.

---

# 30. Immediate Next Action

Do **not** start implementation immediately.

First execute:

```text
PHASE 0 — REPOSITORY AND ARCHITECTURE AUDIT
PHASE 1 — HARDCODE CENSUS
```

Then produce:

```text
ARCHITECTURE_AUDIT.md
HARDCODE_INVENTORY.md
WORKFLOW_INVENTORY.md
RULE_INVENTORY.md
CONFIGURATION_INVENTORY.md
DUPLICATE_SYSTEMS.md
MIGRATION_MAP.md
```

Only after these are complete should implementation begin.

## Non-negotiable principle

> **Stop adding features until the platform can demonstrate that its existing workflows are genuinely configuration-driven.**
