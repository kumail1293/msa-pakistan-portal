# Final Migration Audit — PART 1

## Executive Summary

The MSAP Portal has made substantial architectural progress. The core engines
(config, governance, workflow, RBAC, audit) are well-structured and
configuration-driven. However, several critical gaps remain before
production certification.

---

## 1. Remaining Organizational Hardcoding

### Status: RESOLVED in this pass

| Pattern | Location | Action |
|---------|----------|--------|
| `organizationId: 1` | Multiple files | Created `organizationContextService.ts` — single entry point |
| Hardcoded term dates | `configService.ts` defaults | Config-driven via `gov.termStartDate`, `gov.termEndDate` |
| `brand.presidentName: "Kumail Danial"` | `configService.ts` | Config key — admin can change via UI |
| `brand.email: "vpm@msapakistan.org"` | `configService.ts` | Config key — admin can change via UI |

### Remaining (Low Risk — Test Fixtures Only)
- `mockDataSeeder.ts` contains mock LC names — acceptable for dev seeding
- Test files contain hardcoded IDs — acceptable as test fixtures

---

## 2. Remaining Term Hardcoding

### Status: RESOLVED

- `gov.currentVersion`, `gov.currentTerm`, `gov.termStartDate`, `gov.termEndDate` are all config keys
- `termService.ts` resolves from config, not source code
- All engines use `getCurrentGovernanceVersion()` — no hardcoded "2025-26" in business logic

---

## 3. Remaining Monetary Hardcoding

### Status: RESOLVED

- `finance.vpfThreshold: "5000"` — config key with default
- `finance.presidentThreshold: "15000"` — config key with default
- `finance.ebSupermajorityThreshold: "15000"` — config key with default
- All engines resolve thresholds via `getConfigNumber()`

---

## 4. Hardcoded IDs

### Status: RESOLVED in this pass

- Created `organizationContextService.ts` with `resolveOrganizationContext(id)`
- Created `resolveLCContext(id)`, `resolveLCByCode(code)`, `resolveUserContext(id)`
- `validateOrgContext()` validates org context before operations
- `testWithDifferentOrg(id)` proves non-1 IDs work

---

## 5. Hardcoded LC/CI Lists

### Status: IDENTIFIED — Migration Needed

| Location | Issue |
|----------|-------|
| `AdminBulkData.tsx` (lines 55-77) | 8 hardcoded LC objects |
| `googleDriveEngine.ts` (lines 473-480) | Same 8 LC objects |
| `mockDataSeeder.ts` | Mock LC data for dev |

**Action:** Replace with `listLCs()` API calls. Documented in LEGACY_CLEANUP.md.

---

## 6. Hardcoded Approval Chains

### Status: RESOLVED

- `workflowEngine.ts` resolves approvers via `resolveApprovers(entityType, stage)`
- Config keys: `workflow.approver.{entity}.{stage}`
- `governanceRulesEngine.ts` resolves all rules from config

---

## 7. Hardcoded Workflow Transitions

### Status: RESOLVED

- `workflowEngine.ts` defines `isValidTransition()` as single source of truth
- `lcLifecycleEngine.ts` defines LC-specific transitions (intentional — different domain)
- CI gate test ensures no other files define `VALID_TRANSITIONS`

---

## 8. Spreadsheet Dependencies

### Status: IDENTIFIED — Audit Complete

6 Google Sheets dependencies documented in `spreadsheetDependencyAudit.ts`:
- Membership Master (REPLACE)
- NEF Activity Tracker (REPLACE)
- LC Mapping (REPLACE)
- Approval Status Matrix (REPLACE)
- Events Calendar (SYNC)
- Financial Ledger (REPLACE)

---

## 9. Duplicate Sources of Truth

### Status: IDENTIFIED

| Duplicate | Action |
|-----------|--------|
| `workflowEngineV2.ts` | Merge into `workflowEngine.ts` |
| `plenaryEngineV2.ts` | Merge into `plenaryEngine.ts` |
| Role definitions in `access.ts` + `memberAccountService.ts` | Consolidate to `capabilityResolver.ts` |

---

## 10. Fake/Partial E2E Tests

### Status: IMPROVED

- 19 new E2E tests in `realProductionE2E.test.ts` prove lifecycle without spreadsheets
- 43 new security/migration tests in `productionMigration.test.ts`
- Total: 1204 tests passing

---

## 11. Legacy Paths

### Status: IDENTIFIED

- `PublicLanding.tsx` — unused (moved to WordPress)
- `MANUAL_PLAN.md`, `PLAN.md` — superseded by `PLAN_NEW.md`
- Temp files: `server.log`, `pnpm-lock.yaml.2981801175`, `test-*`, `vitest.config.ts.timestamp-*`

---

## 12. File/Upload Architecture

### Status: NEW — Built in this pass

### Universal Asset Ingestion System
- `assetIngestionService.ts` — core ingestion engine
- `storageProvider.ts` — storage abstraction (local + memory + future cloud)
- `ssrfProtection.ts` — URL validation, DNS check, IP blocking

### Supported Formats
PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, JPEG, PNG, GIF, WebP, BMP, TIFF, CSV, TXT, Markdown, ZIP

### Security Controls
- MIME allowlist (not blocklist)
- Magic-byte validation (triple-check: MIME + extension + bytes)
- Filename sanitization (path traversal, null bytes, invalid chars)
- SSRF protection (localhost, private IPs, metadata endpoints, non-HTTPS)
- File size limits (configurable)
- SVG/executable/HTML blocking
- Organization isolation on all assets

---

## 13. Security Risks

### Status: ADDRESSED

| Risk | Mitigation |
|------|-----------|
| SSRF via URL fetching | `ssrfProtection.ts` blocks private IPs, metadata, non-HTTPS |
| Path traversal | `sanitizeFileName()` removes `../`, null bytes |
| MIME spoofing | Triple validation: allowlist + extension + magic bytes |
| SVG XSS | Blocked by default in uploads |
| Cross-org file access | `canAccess()` checks org ID before any file operation |
| Predictable file URLs | Storage keys use UUID + timestamp, not sequential IDs |

---

## 14. Production Blockers

| Blocker | Status |
|---------|--------|
| Hardcoded org ID | ✅ Resolved — organizationContextService |
| Hardcoded terms | ✅ Resolved — config-driven |
| Hardcoded thresholds | ✅ Resolved — config-driven |
| No SSRF protection | ✅ Resolved — ssrfProtection.ts |
| No file versioning | ✅ Resolved — assetIngestionService |
| No storage abstraction | ✅ Resolved — storageProvider.ts |
| LC lists hardcoded | ⚠️ Needs migration (AdminBulkData, googleDriveEngine) |
| Duplicate engines (V2) | ⚠️ Needs consolidation |
| Legacy temp files | ⚠️ Needs cleanup |

---

## 15. Test Coverage Summary

```
Total Tests: 1204
Total Files: 34

New in this session:
- productionMigration.test.ts:     43 tests (SSRF, storage, MIME, org context)
- Real Production E2E:             19 tests (membership, NEF, LC, appointment)
- LC Lifecycle:                    15 tests (status transitions)
- Document/Notification:           34 tests (templates, channels)
- Spreadsheet Audit:               19 tests (dependency registry)
```
