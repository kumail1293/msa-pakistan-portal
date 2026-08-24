# Workflow Inventory — MSAP Portal

**Date:** August 24, 2026

---

## Summary

| Workflow | Engine File | DB Tables | Config-Driven | E2E Tested | Status |
|----------|-------------|-----------|---------------|------------|--------|
| Membership Application | googleSheetsService + memberAccountService | membership_applications | ❌ No | ❌ No | ⚠️ Partial |
| Membership Lifecycle | memberAccountService | lifecycle_cases | ❌ No | ❌ No | ✅ Good |
| NGA Lifecycle | ngaEngine.ts | nga_meetings, nga_delegations, nga_delegates | 🟡 Partial | ❌ No | ✅ Good |
| SGA Lifecycle | sgaEngine.ts | sga_meetings | 🟡 Partial | ❌ No | ✅ Good |
| Election Lifecycle | electionsEngine.ts | elections, candidates, ballots | 🟡 Partial | ❌ No | ⚠️ Partial |
| Plenary Session | plenaryEngineV2.ts | plenary_sessions, plenary_motions | 🟡 Partial | ❌ No | ✅ Good |
| BCP (Bylaw Change) | bcpEngine.ts | bcp_proposals | 🟡 Partial | ❌ No | ✅ Good |
| BSP (Bylaw Suspension) | bspEngine.ts | bsp_proposals | 🟡 Partial | ❌ No | ✅ Good |
| Workflow Engine (Generic) | workflowEngine.ts | workflows, workflow_instances, workflow_stages | ✅ Yes | ❌ No | ⚠️ Partial |
| Forms Pipeline | formsEngine.ts | forms_builder_* | ✅ Yes | ❌ No | ⚠️ Partial |
| Finance Request | financeEngine.ts | finance_* | 🟡 Partial | ❌ No | ⚠️ Partial |
| Credential Verification | cccEngine.ts | credentials, ccc_* | 🟡 Partial | ❌ No | ✅ Good |
| Oath Administration | oathSystem.ts | oath_* | ✅ Yes | ❌ No | ✅ Good |
| Membership Termination | membershipTerminationEngine.ts | membership_terminations | 🟡 Partial | ❌ No | ✅ Good |
| Proxy Voting | proxyVotingEngine.ts | proxy_voting | 🟡 Partial | ❌ No | ⚠️ Partial |
| Voting Rights | votingRightsEngine.ts | voting_rights_calculations | ✅ Yes | ❌ No | ✅ Good |
| NEF Submission | nefNrfEngine.ts | nef_submissions | 🟡 Partial | ❌ No | ⚠️ Partial |
| NRF Report | nefNrfEngine.ts | nrf_reports | 🟡 Partial | ❌ No | ⚠️ Partial |
| Activity Management | activitiesEngine.ts | activities, activity_registrations | 🟡 Partial | ❌ No | ⚠️ Partial |
| Event Management | eventsEngine.ts | events, event_registrations | 🟡 Partial | ❌ No | ⚠️ Partial |
| Document Management | documentsEngine.ts | documents | 🟡 Partial | ❌ No | ⚠️ Partial |
| Document Upload | documentUploadEngine.ts | document_uploads | 🟡 Partial | ❌ No | ⚠️ Partial |
| Notification Delivery | notificationEngine.ts | notifications, notification_preferences | ✅ Yes | ❌ No | ⚠️ Partial |
| Meeting Management | meetingsEngine.ts | meetings, meeting_minutes | 🟡 Partial | ❌ No | ⚠️ Partial |
| Training/Courses | trainingEngine.ts | courses, enrollments | 🟡 Partial | ❌ No | ⚠️ Partial |

---

## Detailed Workflow Analysis

### 1. Membership Application Flow
**File:** `server/services/googleSheetsService.ts` → `server/services/memberAccountService.ts`
**Schema:** `schema.membership.ts`

```
Application Submitted → Synced to Google Sheets → Manual Review → 
Approved (creates account + membership ID) → Password Setup → Active Member
```

**Issues:**
- 🔴 Application review is via Google Sheets, not a proper workflow
- 🔴 No server-side workflow state machine
- 🔴 No audit trail for application decisions
- 🔴 No notification on approval/rejection
- 🟠 No document issuance (certificate) on approval
- 🟠 No workflow engine integration

### 2. Membership Lifecycle
**File:** `server/services/memberAccountService.ts`
**Schema:** `schema.membership.ts`

```
Open Case → Review → Approve/Reject → Apply/Record → Audit
```

**Statuses:** `pending`, `approved`, `rejected`, `cancelled`
**Actions:** `suspend`, `terminate`, `reinstate`

**Issues:**
- 🟡 Uses the `lifecycle_cases` table but doesn't go through the generic workflow engine
- 🟡 Transitions are hardcoded in service code, not configurable
- 🟢 Has audit logging

### 3. NGA Lifecycle (15 phases)
**File:** `server/config/ngaEngine.ts`
**Schema:** `schema.nga.ts`

```
Planning → Organizing Committee → Call for Participation → 
Registration → Credentialing → Preparation → Opening → 
Plenary → Committees → Elections → Reports → 
Bylaw Changes → Closing → Certification → Archive
```

**Issues:**
- 🟠 Status transitions are hardcoded in the engine
- 🟠 Delegation registration and credential verification are tightly coupled
- 🟡 Does not use the generic workflow engine
- 🟢 Quorum evaluation is configurable via governance rules
- 🟢 Voting rights are calculated from governance rules

### 4. Generic Workflow Engine
**File:** `server/config/workflowEngine.ts`
**Schema:** `schema.enterprise.ts`

```
Create Workflow → Define Stages → Start Instance → 
Advance (with guards) → Complete/Cancel → Audit
```

**Statuses:** `draft`, `active`, `completed`, `cancelled`
**Instance statuses:** `pending`, `running`, `completed`, `cancelled`

**Issues:**
- 🟠 Only 1-2 workflows actually use this engine
- 🟠 Guards are basic (no complex rule evaluation)
- 🟡 No integration with governance rules
- 🟡 No escalation mechanism
- 🟡 No deadline handling

### 5. Forms Pipeline
**File:** `server/config/formsEngine.ts`
**Schema:** `schema.forms_builder.ts`

```
Create Form → Add Fields → Activate → 
Submit → Review → Approve/Reject → Audit
```

**Issues:**
- 🟠 Forms are not connected to workflows (no automatic workflow trigger on submission)
- 🟠 No document generation from form submissions
- 🟡 Submissions lack version tracking
- 🟢 Has field validation and submission counts

---

## Workflow Configuration Gaps

### Transitions Not Configurable
| Workflow | Current State | Required |
|----------|--------------|----------|
| NGA | Hardcoded 14-phase lifecycle | Configurable phases + transitions |
| SGA | Hardcoded approval chain | Configurable approval chain |
| Membership | Google Sheets review | Workflow engine integration |
| Election | Partial (no credential check integration) | Full lifecycle |
| Finance | Tiered approval in code | Configurable approval thresholds |
| BCP/BSP | Hardcoded 2/3 majority | Configurable majority thresholds |

### Guards Not Configurable
| Workflow | Current Guard | Required |
|----------|--------------|----------|
| NGA Plenary | Hardcoded quorum check | Governance rule resolution |
| Election | Basic eligibility check | Configurable eligibility rules |
| Finance | Hardcoded thresholds | Governance rule resolution |
| Termination | Hardcoded due process steps | Configurable process |

### Actions Not Configurable
| Workflow | Current Action | Required |
|----------|--------------|----------|
| Membership approval | Direct DB update | Workflow trigger + notification + document |
| NGA credential | Direct DB update | Workflow trigger + notification |
| Finance approval | Direct DB update | Workflow trigger + notification + ledger |

---

## Priority Migration Order (per PLAN_NEW Phase 8)

1. **Membership** — Currently the most broken. Google Sheets review must become a workflow.
2. **Appointments** — No appointment engine exists. Need to build.
3. **NEF/NRF** — Partially implemented but no workflow triggers.
4. **Activities** — CRUD exists but no approval workflow.
5. **Events** — CRUD exists but no budget/approval workflow.
6. **Finance** — Tiered approval exists but hardcoded.
7. **Credentials** — CCC engine exists but not connected to workflow.
8. **NGA** — Needs migration to generic workflow runtime.
9. **SGA** — Same as NGA.
10. **Elections** — Needs credential verification integration.
11. **Plenary** — V2 engine exists but needs workflow integration.
12. **BCP/BSP** — Engines exist but need workflow integration.
