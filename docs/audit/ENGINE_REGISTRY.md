# Engine Registry

**Date:** 2026-08-25  
**Scope:** All `server/config/*Engine.ts` and `server/config/*Service.ts` files

## Legend

| Action | Description |
|--------|-------------|
| **KEEP** | Actively used, well-scoped, no consolidation needed |
| **CONSOLIDATE** | Has overlapping responsibility — merge into canonical engine |
| **RENAME** | Name is misleading — rename for clarity |
| **DEPRECATE** | No longer needed, keep for backward compatibility |
| **DELETE** | Unused, no references, safe to remove |

## Canonical Engines (Core Infrastructure)

| Engine | Responsibility | Imports | Canonical? | Action |
|--------|---------------|---------|------------|--------|
| `workflowEngine.ts` | Generic workflow orchestration (state machines, tasks, stages) | 60 | ✅ YES | KEEP |
| `formsEngine.ts` | Form definition, rendering, submission, validation + V2 builder (enhanced fields, templates, versioning, advanced validation — merged from formsBuilderEngine.ts) | 24+ | ✅ YES | KEEP |
| `governanceRulesEngine.ts` | Configurable governance rule evaluation, versioned parameters | 33 | ✅ YES | KEEP |
| `notificationEngine.ts` | Multi-channel notification delivery (email, SMS, push, in-app) | 14 | ✅ YES | KEEP |
| `configService.ts` | Centralized configuration key-value store | (service) | ✅ YES | KEEP |
| `termService.ts` | Centralized term/governance version resolution | (service) | ✅ YES | KEEP |
| `auditService.ts` | Audit event logging for all operations | (service) | ✅ YES | KEEP |
| `electionCrypto.ts` | Election ballot encryption (AES-256-GCM) and voter hashing (HMAC) | (new) | ✅ YES | KEEP |

## Business Domain Engines

| Engine | Responsibility | Imports | Canonical? | Action |
|--------|---------------|---------|------------|--------|
| `cmsEngine.ts` | Content management, page building, section management | 47 | ✅ YES | KEEP |
| `activitiesEngine.ts` | Activity tracking, NEF activities, event reporting | 15 | ✅ YES | KEEP |
| `electionsEngine.ts` | Election lifecycle: nominations, ballots, voting, counting, disputes | 10 | ✅ YES | KEEP |
| `financeEngine.ts` | Budget tracking, NEF/NRF expenditure, financial reports | 15 | ✅ YES | KEEP |
| `eventsEngine.ts` | Event management, calendars, scheduling | 15 | ✅ YES | KEEP |
| `nefNrfEngine.ts` | NEF (Named Entity Fund) and NRF workflows | 16 | ✅ YES | KEEP |
| `ngaEngine.ts` | National General Assembly management | 12 | ✅ YES | KEEP |
| `plenaryEngine.ts` | Plenary session management, motions, POO/POI, speaker queue | 10 | ✅ YES | KEEP |
| `disciplinaryEngine.ts` | Disciplinary cases, evidence, decisions | 13 | ✅ YES | KEEP |
| `documentsEngine.ts` | Document management, templates, generation | 11 | ✅ YES | KEEP |
| `chaptersEngine.ts` | Chapter/LC organization, hierarchy | 9 | ✅ YES | KEEP |
| `lcLifecycleEngine.ts` | LC lifecycle: candidate → temporary → permanent → suspended → archived | 6 | ✅ YES | KEEP |
| `communicationsEngine.ts` | Communications engine (unclear scope) | 12 | ⚠️ REVIEW | CONSOLIDATE into notificationEngine or documentsEngine |
| `formsEngine.ts` | Also contains Builder V2 (merged from formsBuilderEngine.ts, Phase 7-9) | 24 | ✅ YES | KEEP (consolidated) |
| `documentsEngine.ts` | Also contains document templates (merged from documentTemplateEngine.ts, Phase 7-9) | 11 | ✅ YES | KEEP (consolidated) |
| `projectsEngine.ts` | Project tracking and management | 10 | ✅ YES | KEEP |
| `meetingsEngine.ts` | Meeting scheduling and management | 6 | ✅ YES | KEEP |
| `minutesEngine.ts` | Meeting minutes recording and approval | 3 | ✅ YES | KEEP |
| `trainingEngine.ts` | Training programs and tracking | 9 | ✅ YES | KEEP |
| `volunteerEngine.ts` | Volunteer management and tracking | 4 | ✅ YES | KEEP |
| `recognitionEngine.ts` | Awards, recognition, achievement tracking | 4 | ✅ YES | KEEP |

## Platform / Infrastructure Engines

| Engine | Responsibility | Imports | Canonical? | Action |
|--------|---------------|---------|------------|--------|
| `formsBuilderEngine.ts` | Form builder UI data (field types, layout) | 1 | ⚠️ OVERLAP | CONSOLIDATE into formsEngine |
| `formPipelineEngine.ts` | Form → workflow → approval → document pipeline | 18 | ✅ YES | KEEP |
| `searchEngine.ts` | Full-text search across entities | 1 | ✅ YES | KEEP |
| `i18nEngine.ts` | Internationalization and localization | 6 | ✅ YES | KEEP |
| `analyticsEngine.ts` | Analytics data aggregation and reporting | 3 | ✅ YES | KEEP |
| `importExportEngine.ts` | Data import/export operations | 7 | ✅ YES | KEEP |
| `googleDriveEngine.ts` | Google Drive integration (mock) | 11 | ⚠️ MOCK | KEEP (mock), replace with storageProvider |
| `documentUploadEngine.ts` | File upload handling and validation | 4 | ✅ YES | KEEP |
| `documentTemplateEngine.ts` | Template rendering for documents | 1 | ⚠️ OVERLAP | CONSOLIDATE into documentsEngine |
| `assetIngestionService.ts` | Content ingestion from various sources | (service) | ✅ YES | KEEP |
| `organizationContextService.ts` | Organization context resolution | (service) | ✅ YES | KEEP |

## Auth / Security Engines

| Engine | Responsibility | Imports | Canonical? | Action |
|--------|---------------|---------|------------|--------|
| `cmsSecurityEngine.ts` | CMS authorization, permissions, audit logging | 6 | ✅ YES | KEEP |
| `mfaEngine.ts` | Multi-factor authentication | 4 | ✅ YES | KEEP |
| `impersonationEngine.ts` | Admin impersonation for support | 5 | ✅ YES | KEEP |
| `privacyConsentEngine.ts` | Privacy consent tracking | 2 | ✅ YES | KEEP |

## Specialized Engines

| Engine | Responsibility | Imports | Canonical? | Action |
|--------|---------------|---------|------------|--------|
| `accessibilityEngine.ts` | Accessibility compliance checking | 9 | ✅ YES | KEEP |
| `pageBuilderEngine.ts` | Dynamic page building (CMS sub-feature) | 3 | ⚠️ OVERLAP | CONSOLIDATE into cmsEngine |
| `memberLifecycleEngine` + `membershipTerminationEngine` | — Merged into `membershipWorkflowService.ts` (Phase 7-9); exports `memberLifecycleEngine`, `onboardingEngine`, `membershipTerminationEngine` preserved | — | ✅ YES | DONE |
| `saasEngine.ts` | SaaS platform features | 6 | ✅ YES | KEEP |
| `institutionEngine.ts` | Institution management | 6 | ✅ YES | KEEP |
| `savedFiltersEngine.ts` | Saved filter presets | 2 | ✅ YES | KEEP |
| `versionCompareEngine.ts` | Document version comparison | 1 | ✅ YES | KEEP |
| `apiPlatformEngine.ts` | API key management, rate limiting | 6 | ✅ YES | KEEP |
| `applicationPlatformEngine.ts` | Application platform features | 3 | ✅ YES | KEEP |
| `enterpriseOpsEngine.ts` | Enterprise operations | 7 | ✅ YES | KEEP |
| `memberLifecycleEngine.ts` | Member lifecycle management | 4 | ⚠️ OVERLAP | CONSOLIDATE into membershipWorkflowService |
| `membershipTerminationEngine.ts` | Membership termination workflows | 4 | ⚠️ OVERLAP | CONSOLIDATE into membershipWorkflowService |

## LOW-IMPORT / POTENTIALLY UNUSED ENGINES

| Engine | Responsibility | Imports | Canonical? | Action |
|--------|---------------|---------|------------|--------|
| `cccEngine.ts` | Unknown — no imports found | 0 | ❌ UNUSED | DELETE |
| `iogEngine.ts` | Unknown — no imports found | 0 | ❌ UNUSED | DELETE |
| `policyConflictEngine.ts` | Policy conflict detection | 0 | ❌ UNUSED | DELETE |
| `proxyVotingEngine.ts` | Proxy voting delegation | 0 | ❌ UNUSED | DELETE |
| `votingRightsEngine.ts` | Voting rights calculation | 0 | ❌ UNUSED | DELETE |
| `bcpEngine.ts` | Unknown — minimal imports | 1 | ⚠️ REVIEW | DEPRECATE |
| `bspEngine.ts` | Unknown — minimal imports | 1 | ⚠️ REVIEW | DEPRECATE |
| `sgaEngine.ts` | SGA features — minimal imports | 1 | ⚠️ REVIEW | DEPRECATE |

## Services

| Service | Responsibility | Canonical? | Action |
|---------|---------------|------------|--------|
| `configService.ts` | Centralized config key-value store | ✅ YES | KEEP |
| `termService.ts` | Term/governance version resolution | ✅ YES | KEEP |
| `auditService.ts` | Audit event logging | ✅ YES | KEEP |
| `configHealthService.ts` | Configuration health checks | ✅ YES | KEEP |
| `membershipWorkflowService.ts` | Membership workflow operations | ✅ YES | KEEP |
| `nefWorkflowService.ts` | NEF workflow operations | ✅ YES | KEEP |
| `organizationContextService.ts` | Organization context resolution | ✅ YES | KEEP |
| `documentService.ts` | Document generation and rendering | ✅ YES | KEEP |
| `emailService.ts` | Email sending via SMTP | ✅ YES | KEEP |
| `memberAccountService.ts` | Member account management | ✅ YES | KEEP |
| `memberAuthService.ts` | Member authentication | ✅ YES | KEEP |
| `googleSheetsService.ts` | Google Sheets integration (mock) | ⚠️ MOCK | DEPRECATE (spreadsheet independence) |

## Consolidation Recommendations

### 1. Forms: formsEngine + formsBuilderEngine → formsEngine ✅ DONE (Phase 7-9)
- `formsBuilderEngine.ts` content merged into `formsEngine.ts` as the "Builder V2" section
- Original file deleted; zero external importers existed

### 2. Documents: documentsEngine + documentTemplateEngine → documentsEngine ✅ DONE (Phase 7-9)
- `documentTemplateEngine.ts` content merged into `documentsEngine.ts`
- Original file deleted; 2 test importers updated

### 3. Membership: memberLifecycleEngine + membershipTerminationEngine → membershipWorkflowService ✅ DONE (Phase 7-9)
- Both engines merged into `membershipWorkflowService.ts`; all exports preserved
- Note: schema.membership's `membershipApplications` aliased as `memberApplicationRecords` (distinct table object from schema.ts's)
- Both should merge into `membershipWorkflowService.ts`

### 4. CMS: pageBuilderEngine → cmsEngine
- `pageBuilderEngine.ts` is a CMS sub-feature
- Merge into `cmsEngine` as page building sub-module

### 5. Communications: communicationsEngine → notificationEngine
- Review scope overlap between communications and notifications
- Consolidate if responsibilities overlap

## Cleanup: Engines to Delete

| Engine | Reason |
|--------|--------|
| `cccEngine.ts` | Zero imports, unknown purpose |
| `iogEngine.ts` | Zero imports, unknown purpose |
| `policyConflictEngine.ts` | Zero imports |
| `proxyVotingEngine.ts` | Zero imports |
| `votingRightsEngine.ts` | Zero imports |

## Summary

| Metric | Count |
|--------|-------|
| Total engines | 57 |
| Total services | 12 |
| Active (KEEP) | 44 |
| Consolidate | 6 |
| Delete (unused) | 5 |
| Deprecate | 4 |
| Mock (replace with real) | 2 |
