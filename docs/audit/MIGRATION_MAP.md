# Migration Map — MSAP Portal

**Date:** August 24, 2026

This document maps the current architecture to the target architecture and defines the migration path for each component.

---

## Current → Target Architecture

```
CURRENT                              TARGET
───────                              ──────
routers.ts (4301 lines)      →     server/routers/ (domain-split)
70 engine files (mixed)       →     server/core/ + server/modules/
configService (23 keys)       →     configService (200+ keys)
4 permission systems          →     1 unified RBAC
14 hardcoded state machines   →     1 generic workflow runtime
3 form builders               →     1 forms pipeline
2 audit systems               →     1 chain-hashed audit
2 CMS systems                 →     1 CMS + 1 page builder (integrated)
organizationConfigStudio      →     Merged into configService
```

---

## Phase-by-Phase Migration

### Phase 0: Audit ✅ (Complete)
- [x] Architecture audit
- [x] Hardcode inventory (120+ findings)
- [x] Workflow inventory (25 workflows)
- [x] Rule inventory (50 rules)
- [x] Configuration inventory
- [x] Duplicate systems inventory
- [x] Migration map

### Phase 1: Hardcode Census ✅ (Complete)
- [x] All hardcodes cataloged in HARDCODE_INVENTORY.md
- [x] Priority items identified

### Phase 2: Central Configuration Architecture

#### Current State
- `configService.ts` with 23 keys
- `organizationConfigStudio.ts` with 85+ disconnected definitions
- `governanceRulesEngine.ts` with separate rule tables
- `featureFlags.ts` with separate flag table

#### Target State
- Single `configService.ts` with 200+ keys across all categories
- All configuration accessible through admin UI
- Configuration versioning and audit

#### Migration Steps
1. **Extend configService.ts** with new categories:
   - `gov.*` — Governance settings (version, term, quorum, majority)
   - `finance.*` — Finance thresholds
   - `workflow.*` — Workflow defaults
   - `notification.*` — Notification settings
   - `position.*` — Position definitions

2. **Merge organizationConfigStudio** into configService:
   - Import all 85+ definitions as CONFIG_DEFINITIONS
   - Wire admin UI to configService API
   - Remove disconnected in-memory store

3. **Add configuration versioning**:
   - Add `effectiveFrom`, `effectiveUntil` to configuration table
   - Add `version` field
   - Add `changedBy`, `changedAt` audit fields

4. **Wire governance rules to config**:
   - `gov.currentVersion` reads from configService
   - All engines use `getConfig("gov.currentVersion")` instead of hardcoded fallback

#### Files to Modify
- `server/config/configService.ts` — Extend CONFIG_DEFINITIONS
- `server/config/organizationConfigStudio.ts` — Remove or redirect to configService
- `drizzle/schema.ts` — Add versioning fields to configuration table
- `server/routers.ts` — Add config versioning API

---

### Phase 3: Term and Governance Resolution

#### Current State
- Term dates hardcoded in comments and card rendering
- Governance version hardcoded as `"2025-26"` fallback in 7+ locations
- No centralized term service

#### Target State
- Centralized term service with current/previous/upcoming terms
- All historical records resolve against effective governance version
- Term changes configurable through admin UI

#### Migration Steps
1. **Create `terms` table**:
   ```sql
   terms: id, name, startDate, endDate, status, governanceVersion, metadata
   ```

2. **Create term resolution service**:
   ```typescript
   getCurrentTerm(): Term
   getTermAtDate(date: Date): Term
   getPreviousTerm(): Term
   getUpcomingTerm(): Term | null
   ```

3. **Replace all `"2025-26"` fallbacks**:
   - `votingRightsEngine.ts` → `await getConfig("gov.currentVersion")`
   - `sgaEngine.ts` → same
   - `ngaEngine.ts` → same
   - `electionGovernanceIntegration.ts` → same
   - `governanceRulesEngine.ts` → same
   - `governanceDocVersioning.ts` → same

4. **Replace hardcoded term display**:
   - `MembershipCard.tsx` → read from term config
   - `documentService.ts` → read from term config

5. **Add admin UI** for term management (create/edit/end terms)

#### Files to Create
- `server/config/termService.ts`

#### Files to Modify
- `drizzle/schema.ts` — Add terms table
- 7 files with `"2025-26"` fallbacks
- 2 files with hardcoded term display
- Admin UI for term management

---

### Phase 4: Rules Engine

#### Current State
- `governanceRulesEngine.ts` with temporal rule resolution
- Many rules still hardcoded in engines
- Rule resolution only partially wired

#### Target State
- All organizational rules resolved through governance rules engine
- Rules versioned and auditable
- Admin can change rules without code changes

#### Migration Steps
1. **Extend governance rules table** with all rule categories:
   - Approval authority rules (finance thresholds)
   - Deadline rules (NGA call, BCP submission)
   - Eligibility rules (voting, candidacy)
   - Document requirement rules

2. **Replace hardcoded rule checks**:
   - `financeEngine.ts` → `resolveEffectiveRule("finance.vpfThreshold")`
   - `bcpEngine.ts` → `resolveEffectiveRule("majority.constitutional")`
   - `bspEngine.ts` → `resolveEffectiveRule("majority.procedural")`
   - `cccEngine.ts` → `resolveEffectiveRule("majority.procedural")`
   - `plenaryEngineV2.ts` → `resolveEffectiveRule("majority.procedural")`
   - `ngaEngine.ts` → `resolveEffectiveRule("deadline.ngaCallForParticipation")`

3. **Add admin UI** for rule management (view/edit rules by category)

#### Files to Modify
- `server/config/governanceRulesEngine.ts` — Extend rule categories
- 6+ engine files with hardcoded rule checks
- Admin UI for rule management

---

### Phase 5: Capability-Based Authorization

#### Current State
- RBAC with 5 static roles
- Module access as string array
- Frontend route guards as third system

#### Target State
- Role → Capability → Policy
- Dynamic capability resolution
- Single permission check path

#### Migration Steps
1. **Extend RBAC with capabilities**:
   ```
   role → role_permissions → permission (with capability group)
   ```

2. **Wire module access to RBAC**:
   - `moduleAccess: string[]` → RBAC permissions
   - Remove separate module access check

3. **Unify frontend guards**:
   - Frontend reads permissions from API
   - Remove `client/src/_core/access.ts` hardcoded role checks

4. **Add admin UI** for role/permission management

#### Files to Modify
- `server/config/rbac.ts` — Add capability groups
- `server/services/memberAccountService.ts` — Remove moduleAccess
- `client/src/_core/access.ts` — Use API permissions
- Admin UI for role management

---

### Phase 6: Generic Workflow Runtime

#### Current State
- 14+ hardcoded state machines in individual engines
- Generic workflow engine exists but unused
- No shared guards, actions, or notifications

#### Target State
- Single workflow runtime used by all modules
- Configurable states, transitions, guards, actions
- Shared audit trail, notifications, deadlines

#### Migration Steps
1. **Extend workflowEngine.ts**:
   - Add guard evaluation (resolve from governance rules)
   - Add action execution (notification, document, audit)
   - Add deadline/escalation support
   - Add transaction safety

2. **Migrate NGA lifecycle** (first pilot):
   - Define NGA workflow as data in `workflows` table
   - Replace hardcoded transitions with workflow engine calls
   - Verify all 14 phases work

3. **Migrate other workflows** one by one:
   - SGA → Plenary → BCP → BSP → CCC
   - Membership → Termination → Oath
   - Activities → Events → Finance
   - Elections → Credentials

4. **Remove old state machine code** from individual engines

#### Files to Modify
- `server/config/workflowEngine.ts` — Major extension
- 14+ engine files — Remove hardcoded state machines

---

### Phase 7: Forms → Workflow → Approval → Document

#### Current State
- 3 independent form systems
- Forms not connected to workflows
- No document generation from forms

#### Target State
- Single forms pipeline
- Form submission triggers workflow
- Workflow completion generates documents

#### Migration Steps
1. **Consolidate form builders**:
   - Keep `formsBuilderEngine.ts` as single system
   - Remove CMS forms (or redirect to formsBuilder)
   - Remove application platform forms

2. **Connect forms to workflows**:
   - Form definition includes workflow mapping
   - Form submission creates workflow instance
   - Workflow completion triggers document generation

3. **Add document generation**:
   - Certificate generation from activity completion
   - Membership letter from application approval
   - Appointment letter from appointment workflow

#### Files to Modify
- `server/config/formsBuilderEngine.ts` — Add workflow integration
- `server/config/cmsEngine.ts` — Remove CMS forms
- `server/config/applicationPlatformEngine.ts` — Remove forms

---

## Dependency Graph

```
Phase 2 (Configuration)
    ↓
Phase 3 (Terms) ──→ Phase 4 (Rules)
    ↓                    ↓
Phase 5 (Authorization) ←─┘
    ↓
Phase 6 (Workflow Runtime)
    ↓
Phase 7 (Forms Pipeline)
```

**Critical path:** Phase 2 → Phase 3 → Phase 4 → Phase 6

---

## Risk Assessment

| Phase | Risk | Mitigation |
|-------|------|------------|
| Phase 2 | ConfigService extension may break existing keys | Add keys additively, never remove |
| Phase 3 | Term change may break historical records | Use temporal resolution, test historical queries |
| Phase 4 | Rule change may break existing workflows | Version rules, test rule changes |
| Phase 5 | Permission change may break access | Gradual migration, keep old checks during transition |
| Phase 6 | Workflow migration may break active processes | Migrate one workflow at a time, keep old engine as fallback |
| Phase 7 | Form consolidation may lose data | Export/import tools, dual-write during transition |

---

## Estimated Effort

| Phase | Effort | Dependencies |
|-------|--------|-------------|
| Phase 0-1 | ✅ Done | None |
| Phase 2 | 2-3 days | None |
| Phase 3 | 1-2 days | Phase 2 |
| Phase 4 | 2-3 days | Phase 2, 3 |
| Phase 5 | 2-3 days | Phase 2 |
| Phase 6 | 5-7 days | Phase 2, 3, 4, 5 |
| Phase 7 | 3-5 days | Phase 6 |
| **Total** | **15-23 days** | |
