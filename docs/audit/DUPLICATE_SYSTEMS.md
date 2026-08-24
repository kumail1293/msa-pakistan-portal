# Duplicate Systems Inventory — MSAP Portal

**Date:** August 24, 2026

---

## Summary

| Duplicate Pattern | Files Involved | Impact | Priority |
|-------------------|---------------|--------|----------|
| Multiple workflow state machines | 12 engines | 🔴 Critical | P0 |
| Multiple form builders | 3 systems | 🔴 Critical | P0 |
| Multiple permission checks | 3 systems | 🟠 High | P1 |
| Multiple configuration systems | 4 systems | 🟠 High | P1 |
| Multiple notification systems | 3 systems | 🟡 Medium | P2 |
| Multiple audit systems | 2 systems | 🟡 Medium | P2 |
| Multiple CMS systems | 2 systems | 🟡 Medium | P2 |

---

## 1. Multiple Workflow State Machines 🔴

### 1a. Generic Workflow Engine
- **File:** `server/config/workflowEngine.ts`
- **Tables:** `workflows`, `workflow_instances`, `workflow_stages`, `workflow_audit_events`
- **API:** `createWorkflow()`, `startWorkflowInstance()`, `advanceWorkflow()`, `cancelWorkflow()`
- **Used by:** Almost nothing. Routes exist but no module uses it as its workflow runtime.

### 1b. Per-Module State Machines
Each module has its own hardcoded state machine:

| Module | File | States |
|--------|------|--------|
| NGA | ngaEngine.ts | 14 phases (planning → archive) |
| SGA | sgaEngine.ts | planning → certified |
| Plenary | plenaryEngineV2.ts | draft → archived |
| BCP | bcpEngine.ts | draft → decided |
| BSP | bspEngine.ts | draft → decided |
| CCC | cccEngine.ts | submitted → decided |
| Membership | memberAccountService.ts | pending → approved/rejected |
| Lifecycle | memberAccountService.ts | pending → approved/rejected/cancelled |
| Termination | membershipTerminationEngine.ts | initiated → executed |
| Election | electionsEngine.ts | draft → certified |
| Finance | financeEngine.ts | submitted → approved/rejected/paid |
| Activity | activitiesEngine.ts | draft → active → completed |
| Event | eventsEngine.ts | draft → upcoming → completed |
| Document | documentsEngine.ts | draft → published → archived |

### Impact
- 🔴 Adding a new workflow requires creating a new engine file
- 🔴 No shared transition validation
- 🔴 No shared audit trail
- 🔴 No shared notification triggers
- 🔴 No shared deadline/escalation mechanism

---

## 2. Multiple Form Builders 🔴

### 2a. Forms Builder Engine
- **File:** `server/config/formsBuilderEngine.ts`
- **Tables:** `forms_builder_definitions`, `forms_builder_fields`, `forms_builder_submissions`
- **API:** CRUD for forms, fields, submissions
- **Status:** Well-implemented but not connected to workflows

### 2b. CMS Forms
- **File:** `server/config/cmsEngine.ts`
- **Tables:** `cms_forms`, `cms_form_submissions`
- **API:** `createForm()`, `submitForm()`, `getFormSubmissions()`
- **Status:** Separate form system inside CMS

### 2c. Application Platform Forms
- **File:** `server/config/applicationPlatformEngine.ts`
- **Tables:** Part of enterprise schema
- **Status:** Third form system, barely implemented

### Impact
- 🔴 Three independent form systems with no shared schemas
- 🔴 Form submissions don't trigger workflows
- 🔴 No shared validation or submission tracking

---

## 3. Multiple Permission Systems 🟠

### 3a. RBAC (Database-backed)
- **File:** `server/config/rbac.ts`
- **Tables:** `permissions`, `roles`, `role_permissions`, `user_roles`
- **API:** `checkPermission()`, `getUserPermissions()`
- **Status:** Full implementation, properly cached

### 3b. Module Access (In-memory)
- **File:** `server/services/memberAccountService.ts`
- **Mechanism:** `moduleAccess: string[]` on user record
- **API:** `isModuleAccessGranted()`, `setOfficialModuleAccess()`
- **Status:** Separate permission system for official portal modules

### 3c. Frontend Route Guards
- **File:** `client/src/_core/access.ts`
- **Mechanism:** `canAccessModule()`, `getModulesForRole()`
- **Status:** Third permission system, frontend-only

### Impact
- 🟠 Three independent permission systems
- 🟠 RBAC permissions are not used for module access
- 🟠 Frontend route guards don't match backend permissions

---

## 4. Multiple Configuration Systems 🟠

### 4a. configService.ts (Database-backed)
- **Table:** `configuration`
- **Keys:** 23 default definitions
- **Status:** Primary, but limited scope

### 4b. organizationConfigStudio.ts (In-memory)
- **Keys:** 85+ configuration definitions
- **Status:** NOT connected to database or configService

### 4c. governanceRulesEngine.ts (Database-backed)
- **Tables:** `governance_rules`, `governance_parameters`
- **Status:** Separate rule configuration, not unified with configService

### 4d. featureFlags.ts (Database-backed)
- **Table:** `feature_flags`
- **Status:** Separate feature configuration

### Impact
- 🟠 Configuration is scattered across 4 systems
- 🟠 No single admin interface to manage all configuration
- 🟠 organizationConfigStudio definitions are disconnected from reality

---

## 5. Multiple Notification Systems 🟡

### 5a. notificationEngine.ts
- **Table:** `notifications`, `notification_preferences`
- **API:** `sendNotification()`, `getNotifications()`, `markAsRead()`
- **Status:** In-memory fallback, DB-backed when available

### 5b. emailService.ts
- **Mechanism:** Direct email sending via SMTP
- **Status:** Separate from notification engine

### 5c. Frontend Notification Polling
- **File:** `client/src/pages/MemberDashboard.tsx`
- **Mechanism:** Direct tRPC calls to `myNotifications.*`
- **Status:** No real-time updates (no WebSocket/SSE)

---

## 6. Multiple Audit Systems 🟡

### 6a. auditService.ts (Primary)
- **API:** `logAuditEvent()`, `logAuditForUser()`, `verifyAuditChain()`
- **Features:** Chain hashing, correlation IDs
- **Status:** Good implementation

### 6b. cmsSecurityEngine.ts (CMS Audit)
- **API:** `getAuditLog()`
- **Status:** Separate audit log for CMS operations

### Impact
- 🟡 Two separate audit systems that don't share data
- 🟡 CMS audit events are not part of the chain hash

---

## 7. Multiple CMS Systems 🟡

### 7a. CMS Engine
- **File:** `server/config/cmsEngine.ts`
- **Tables:** `cms_pages`, `cms_posts`, `cms_media`, `cms_menus`, `cms_themes`, `cms_plugins`
- **Status:** Full WordPress-like CMS

### 7b. Page Builder Engine
- **File:** `server/config/pageBuilderEngine.ts`
- **Status:** Elementor-like page builder, separate from CMS

### Impact
- 🟡 Two content management systems with overlapping functionality
- 🟡 Pages created in page builder may not sync with CMS pages

---

## 8. Consolidation Recommendations

### Priority 1: Workflow Engines
**Action:** Migrate all per-module state machines to use `workflowEngine.ts` as the runtime.
**Phase:** PLAN_NEW Phase 6

### Priority 2: Form Builders
**Action:** Keep `formsBuilderEngine.ts` as the single form system. Remove CMS forms and application platform forms.
**Phase:** PLAN_NEW Phase 7

### Priority 3: Permission Systems
**Action:** Unify RBAC + module access + frontend guards into a single permission resolution system.
**Phase:** PLAN_NEW Phase 5

### Priority 4: Configuration Systems
**Action:** Merge organizationConfigStudio into configService.ts. Wire governance rules to configService.
**Phase:** PLAN_NEW Phase 2

### Priority 5: Audit Systems
**Action:** Route CMS audit events through auditService.ts chain hash.
**Phase:** PLAN_NEW Phase 6

### Priority 6: Notification Systems
**Action:** Integrate emailService into notificationEngine as a channel.
**Phase:** PLAN_NEW Phase 7
