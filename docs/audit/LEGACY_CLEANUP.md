# Legacy Cleanup Plan — Phase 24

## Status: MIGRATION IN PROGRESS

This document tracks legacy code and systems that can be removed once the
database-driven workflow engine fully replaces Google Sheets workflow control.

---

## Can Be Removed (After Full Migration)

### 1. Hardcoded LC List in BulkData

**File:** `client/src/pages/AdminBulkData.tsx` (lines 55-77)
**What:** 8 hardcoded LC objects with names, codes, presidents
**Replacement:** Query `local_councils` table via API
**Status:** MIGRATING — `lcLifecycleEngine` now manages LCs programmatically

### 2. Hardcoded LC List in Google Drive Engine

**File:** `server/config/googleDriveEngine.ts` (lines 473-480)
**What:** Same 8 hardcoded LC objects for mock data
**Replacement:** Use `listLCs()` from `lcLifecycleEngine`
**Status:** MIGRATING

### 3. Hardcoded LC Options in BulkData Columns

**File:** `client/src/pages/AdminBulkData.tsx` (line 119)
**What:** `options: ["KEMU LC", "AKU LC", ...]` hardcoded
**Replacement:** Fetch LC list from API and populate dynamically
**Status:** MIGRATING

### 4. Hardcoded LC Options in Google Drive Sheets

**File:** `server/config/googleDriveEngine.ts` (line 697)
**What:** Same hardcoded LC options for Google Sheets column
**Replacement:** Dynamic from `listLCs()`
**Status:** MIGRATING

### 5. Duplicate Role Definitions

**Files:** `client/src/_core/access.ts`, `server/services/memberAccountService.ts`
**What:** Same role arrays and maps defined in both frontend and backend
**Replacement:** Single source of truth in `shared/const.ts` or `capabilityResolver.ts`
**Status:** IDENTIFIED

### 6. Mock Data Seeder — Production Guard

**File:** `server/config/mockDataSeeder.ts`
**What:** Seeder that could run in production
**Action:** Add hard `NODE_ENV=production` guard
**Status:** IDENTIFIED

### 7. Hardcoded Email Addresses

**File:** `server/services/emailService.ts` (lines 540, 577)
**What:** References to specific LC president/VPM emails
**Replacement:** Resolve from `local_councils.presidentId` + `users.email`
**Status:** IDENTIFIED

### 8. Old CMS Content with Hardcoded References

**File:** `server/config/publicGovernance.ts`
**What:** Governance content with "Local Council" hardcoded in prose
**Action:** Keep as-is (content is organizational, not code logic)
**Status:** KEEP — these are governance documents, not business logic

---

## Should Keep (No Change Needed)

### 1. MembershipCard Component
**Why:** Renders card from data, not from hardcoded logic. The `localCouncil` field is passed as data.

### 2. OfficialHome / OfficialLogin
**Why:** Position-specific UI routing is legitimate UX, not business logic.

### 3. Capability Resolver
**Why:** Maps positions to capabilities — this IS the configuration layer.

### 4. Governance Engine Seed
**Why:** Seeds governance parameters from config — already migrated to use `getCurrentGovernanceVersion()`.

---

## Migration Checklist

- [ ] Replace hardcoded LC list in AdminBulkData with API call
- [ ] Replace hardcoded LC list in GoogleDriveEngine with `listLCs()`
- [ ] Replace hardcoded LC column options with dynamic fetch
- [ ] Consolidate duplicate role definitions
- [ ] Add production guard to mock data seeder
- [ ] Replace hardcoded email references in emailService
- [ ] Verify all "2025-26" references are resolved from config
- [ ] Remove any remaining `VALID_TRANSITIONS` definitions outside workflowEngine
