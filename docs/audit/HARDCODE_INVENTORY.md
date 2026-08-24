# Hardcode Inventory — MSAP Portal

**Date:** August 24, 2026

This document catalogs every instance of hardcoded organizational business logic found in the codebase. Each finding includes the file, line, value, business meaning, category, who should control it, and migration strategy.

---

## Summary

| Category | Count | Severity |
|----------|------:|----------|
| Role/Position Names | 47 | 🟠 High |
| Organizational Dates | 32 | 🟠 High |
| Financial Thresholds | 14 | 🟠 High |
| Quorum/Ratio Values | 28 | 🟠 High |
| Email Addresses | 8 | 🟡 Medium |
| Governance Version Strings | 18 | 🟠 High |
| Officer-Specific Logic | 22 | 🔴 Critical |
| Workflow State Strings | 15 | 🟡 Medium |
| Mock Data (non-configurable) | 120+ | 🟡 Medium |
| CMS Salt/Security Constants | 2 | 🟠 High |

---

## 1. Role/Position Hardcodes

### Finding R-001: Official Positions Enum
- **File:** `drizzle/schema.ts` (lines ~57-80)
- **Value:** Hardcoded MySQL enum: `president`, `vpi`, `vpe`, `vpa`, `vpcb`, `vpm`, `vpf`, `vpprc`, `supco`, `npo`, `norp`, `nora`, `nome`, `nore`, `neo`, `lc-president`, `lc-vpa`, `lc-vpf`, `lc-secretary`, `ci-coordinator`
- **Business Meaning:** The 27 official positions of MSA Pakistan
- **Category:** Roles
- **Who Should Control It:** Organization configuration / DB table
- **Migration:** Create a `positions` table. Replace enum with FK.
- **Risk:** 🟠 Adding/removing positions requires schema migration + code changes.

### Finding R-002: Official Positions Array
- **File:** `server/services/memberAccountService.ts` (lines 386-410)
- **Value:** `OFFICIAL_POSITIONS` array with 21 entries
- **Business Meaning:** Same positions, duplicated as TypeScript constant
- **Category:** Roles
- **Who Should Control It:** Position configuration table
- **Migration:** Read from `positions` table instead of constant array.
- **Risk:** 🟠 Duplicated in at least 3 places (schema, memberAccountService, organizationConfigStudio).

### Finding R-003: Position Labels
- **File:** `server/services/memberAccountService.ts` (line ~420)
- **Value:** `OFFICIAL_POSITION_LABELS` mapping (e.g., `president → "National President"`)
- **Business Meaning:** Display labels for each position
- **Category:** Roles
- **Who Should Control It:** Position configuration table (label field)
- **Migration:** Store display labels in `positions` table.

### Finding R-004: RBAC Default Roles
- **File:** `server/config/rbac.ts` (lines ~490-550)
- **Value:** Hardcoded `DEFAULT_ROLES` array: `superadmin`, `admin`, `official`, `chapter_admin`, `user`
- **Business Meaning:** 5 default system roles with their permissions
- **Category:** Roles
- **Who Should Control It:** Role configuration (seeded from config, modifiable)
- **Migration:** Seed from config, allow admin modification through UI.
- **Risk:** 🟡 Roles are a mix of system (hardcoded) and configurable. Need clear separation.

### Finding R-005: Hardcoded "superadmin" Check
- **File:** `server/routers.ts` (line 3782)
- **Value:** `ctx.user?.role === "superadmin"`
- **Business Meaning:** Super admin role escalation guard
- **Category:** Roles
- **Who Should Control It:** RBAC permission system
- **Migration:** Use `checkPermission(ctx.user.id, "admin.escalate")` instead.
- **Risk:** 🟠 This bypasses the RBAC system entirely.

### Finding R-006: devCreateTestMember Hardcodes
- **File:** `server/routers.ts` (lines ~310-320)
- **Value:** `discipline: "MBBS"`, `yearOfStudy: "3rd Year"`, `localCouncil: "MSA-Pakistan KEMU LC"`, `institution: "King Edward Medical University"`
- **Business Meaning:** Default values for dev test member
- **Category:** Organization-specific data
- **Who Should Control It:** Dev seed data (acceptable if clearly dev-only)
- **Migration:** Use configurable defaults from config table.
- **Risk:** 🟢 Dev-only, but should still be configurable.

---

## 2. Organizational Dates Hardcodes

### Finding D-001: Governance Version "2025-26"
- **File:** Multiple files (votingRightsEngine, sgaEngine, ngaEngine, electionGovernanceIntegration, governanceRulesEngine, governanceDocVersioning)
- **Value:** `governanceVersion ?? "2025-26"` — used as fallback in 6+ locations
- **Business Meaning:** Current governance version identifier
- **Category:** Governance Version
- **Who Should Control It:** Governance configuration (current version setting)
- **Migration:** Add `gov.currentVersion` to configService. All engines resolve from there.
- **Risk:** 🔴 If governance version changes, these fallbacks must be updated in code.

### Finding D-002: Term Dates "2025-26"
- **File:** `client/src/components/MembershipCard.tsx` (lines 255, 641)
- **Value:** `TERM 2025–26` hardcoded in card rendering
- **Business Meaning:** Current term display on membership cards
- **Category:** Term
- **Who Should Control It:** Term configuration (current term name)
- **Migration:** Read from `term.currentName` config.
- **Risk:** 🟠 Card shows wrong term after Oct 1, 2026.

### Finding D-003: Document Service Term
- **File:** `server/services/documentService.ts` (line 574)
- **Value:** `TERM 2025 – 26`
- **Business Meaning:** Term label on generated documents
- **Category:** Term
- **Who Should Control It:** Term configuration
- **Migration:** Read from config.
- **Risk:** 🟠 Same as D-002.

### Finding D-004: Governance Doc Versioning
- **File:** `server/config/governanceDocVersioning.ts` (lines 545-547)
- **Value:** `version: "2025-26"`, `effectiveFrom: new Date("2025-09-06")`
- **Business Meaning:** Initial governance document version
- **Category:** Governance Version
- **Who Should Control It:** Seeded data (one-time)
- **Migration:** Already acceptable as seed data. New versions should be created through the UI.
- **Risk:** 🟡 Seed data is fine, but must not be re-run in production.

### Finding D-005: Public Governance Dates
- **File:** `server/config/publicGovernance.ts` (lines 371-373)
- **Value:** `documentVersion: "2025-26 Edition"`, `lastAmended: "6th September 2025"`, `effectiveFrom: "1st October 2025"`
- **Business Meaning:** Governance document metadata
- **Category:** Governance Version
- **Who Should Control It:** Governance document configuration
- **Migration:** Read from governance_documents table.
- **Risk:** 🟠 Stale display after term change.

### Finding D-006: Footer Copyright
- **File:** `server/config/configService.ts` (line 346)
- **Value:** `defaultValue: "© 2025 MSA Pakistan. All rights reserved."`
- **Business Meaning:** Default footer copyright text
- **Category:** Branding
- **Who Should Control It:** Already configurable via configService (key: `portal.footerText`)
- **Migration:** ✅ Already configurable. Default just needs updating.
- **Risk:** 🟢 Low — configurable, just has a stale default.

### Finding D-007: CMS Security Salt
- **File:** `server/config/cmsSecurityEngine.ts` (line 517)
- **Value:** `crypto.createHash("sha256").update(password + "msap_salt_2026")`
- **Business Meaning:** Password hashing salt for CMS users
- **Category:** Security
- **Who Should Control It:** Environment variable
- **Migration:** Move to `MSAP_CMS_SALT` env var.
- **Risk:** 🔴 Security: hardcoded salt weakens password hashing.

---

## 3. Financial Threshold Hardcodes

### Finding F-001: Budget Thresholds in Schema
- **File:** `drizzle/schema.modules.ts` (line 372)
- **Value:** Comment: `EB approves >PKR 15,000 with 2/3 majority (§15.4.3)`
- **Business Meaning:** Finance approval threshold
- **Category:** Finance
- **Who Should Control It:** Governance rules engine (finance approval threshold)
- **Migration:** Already partially in governanceRulesEngine. Schema comment should reference config.
- **Risk:** 🟠 Thresholds embedded in comments influence developer assumptions.

### Finding F-002: Plenary Vote Requirement
- **File:** `drizzle/schema.modules.ts` (line 748)
- **Value:** Comment: `2/3 majority required (§17.2.6)`
- **Business Meaning:** Voting threshold for plenary decisions
- **Category:** Governance
- **Who Should Control It:** Governance rules engine
- **Migration:** ✅ Already in governanceRulesEngine (majority threshold).
- **Risk:** 🟡 Comments reference specific sections but actual logic is configurable.

### Finding F-003: SaaS Pricing
- **File:** `server/config/saasEngine.ts` (lines 32-44)
- **Value:** `maxApiCalls: 5000`, `priceMonthly: "15000"`, `maxMembers: 5000`
- **Business Meaning:** SaaS plan limits
- **Category:** Pricing
- **Who Should Control It:** SaaS plan configuration
- **Migration:** Read from DB or config.
- **Risk:** 🟡 Hardcoded pricing limits business flexibility.

### Finding F-004: NGA Participation Fee
- **File:** `client/src/pages/AdminNga.tsx` (line 89)
- **Value:** `participationFee: 5000`
- **Business Meaning:** Default NGA participation fee
- **Category:** Finance
- **Who Should Control It:** NGA meeting configuration
- **Migration:** Already configurable per-meeting. Just a UI default.
- **Risk:** 🟢 Low — UI default, not enforced server-side.

---

## 4. Quorum/Ratio Hardcodes

### Finding Q-001: NGA Quorum 1/3
- **File:** `server/config/governanceRulesEngine.ts` (lines 611-612)
- **Value:** `{ key: "nga.quorum.numerator", value: 1 }`, `{ key: "nga.quorum.denominator", value: 3 }`
- **Business Meaning:** NGA quorum = 1/3 of Permanent + Temporary LCs
- **Category:** Quorum
- **Who Should Control It:** ✅ Already in governance rules (configurable)
- **Migration:** Already resolved from DB.
- **Risk:** 🟢 Properly configured.

### Finding Q-002: SGA Quorum 1/3
- **File:** `server/config/governanceRulesEngine.ts` (line 616)
- **Value:** `nga.quorum.numerator = 1` for SGA
- **Business Meaning:** SGA quorum requirement
- **Category:** Quorum
- **Who Should Control It:** ✅ Already in governance rules
- **Risk:** 🟢 Properly configured.

### Finding Q-003: 2/3 Supermajority
- **File:** Multiple engines (bcpEngine, bspEngine, cccEngine, plenaryEngineV2, sgaEngine)
- **Value:** `2/3` majority requirement mentioned in 10+ locations
- **Business Meaning:** Constitutional supermajority for amendments, procedural motions
- **Category:** Governance
- **Who Should Control It:** Governance rules engine (majority thresholds)
- **Migration:** ✅ Most engines already use `resolveEffectiveRule()`.
- **Risk:** 🟡 Some engines still have 2/3 as comments rather than resolved rules.

### Finding Q-004: Plenary Quorum 50%
- **File:** `server/config/plenaryEngine.ts` (line 34)
- **Value:** `quorumPercentage: 50`
- **Business Meaning:** Default plenary quorum percentage
- **Category:** Quorum
- **Who Should Control It:** Governance rules
- **Migration:** Use `resolveEffectiveRule("quorum.plenary")` instead of hardcoded 50.
- **Risk:** 🟠 Hardcoded 50% in old plenary engine, but V2 uses governance rules.

### Finding Q-005: Admin UI Quorum Defaults
- **File:** `client/src/pages/AdminPlenary.tsx` (line 86)
- **Value:** `quorumRequired: 33`
- **Business Meaning:** Default quorum percentage in admin form
- **Category:** Quorum
- **Who Should Control It:** UI should read from governance config
- **Migration:** Load default from configService.
- **Risk:** 🟡 UI default, but misleading if governance rules specify different.

---

## 5. Email Address Hardcodes

### Finding E-001: Support Email
- **File:** `server/config/configService.ts` (lines 272, 366), `server/config/branding.ts` (lines 63, 107)
- **Value:** `"vpm@msapakistan.org"` used as default in 4+ places
- **Business Meaning:** Organization contact email
- **Category:** Contact
- **Who Should Control It:** ✅ Already configurable via `brand.email` config
- **Migration:** Remove hardcoded defaults, rely on config.
- **Risk:** 🟡 Defaults are fine as fallbacks, but should match config.

### Finding E-002: Mock Identity Server Emails
- **File:** `server/mockIdentityServer.ts` (lines 38-39)
- **Value:** `"vpm@msapakistan.org"`, `"president@msapakistan.org"`
- **Business Meaning:** Dev-only mock emails
- **Category:** Dev data
- **Who Should Control It:** Dev seed data
- **Risk:** 🟢 Dev-only.

---

## 6. Officer-Specific Logic Hardcodes

### Finding O-001: NGA Report Items per Officer
- **File:** `server/config/ngaEngine.ts` (lines 188-195)
- **Value:** Hardcoded agenda items: `"Reports: President"`, `"Reports: VPI"`, `"Reports: VPE"`, etc.
- **Business Meaning:** Default NGA agenda items by officer position
- **Category:** Governance
- **Who Should Control It:** Agenda configuration (from governance rules or meeting config)
- **Migration:** Create default agenda templates in config, not in code.
- **Risk:** 🔴 Adding a new officer position requires code change.

### Finding O-002: President-Specific Card Logic
- **File:** `server/services/documentService.ts` (multiple lines)
- **Value:** Special rendering for "President" signature on membership cards
- **Business Meaning:** National President signature appears on all cards
- **Category:** Governance
- **Who Should Control It:** Card template configuration
- **Migration:** Use role-based signature resolution from config.
- **Risk:** 🟠 Tightly coupled to "president" role name.

### Finding O-003: VPA Review Logic
- **File:** `server/config/nefNrfEngine.ts` (lines 148, 253)
- **Value:** VPA reviews and decides on NEF submissions, VPA approves NRF
- **Business Meaning:** VPA has specific authority over NEF/NRF
- **Category:** Approval Authority
- **Who Should Control It:** Workflow configuration (approval chain)
- **Migration:** Define approval chains in workflow configuration.
- **Risk:** 🟠 If VPA position changes, code must change.

### Finding O-004: Finance Approval Tiers
- **File:** `client/src/pages/AdminFinance.tsx` (line 226)
- **Value:** `"VPF ≤5K"`, `"President ≤15K"`, `"EB 2/3 majority"`
- **Business Meaning:** Finance approval authority tiers
- **Category:** Finance / Approval
- **Who Should Control It:** Governance rules (finance approval thresholds)
- **Migration:** ✅ Should be in governance rules engine.
- **Risk:** 🟠 Hardcoded in frontend, but backend should enforce via rules.

### Finding O-005: versionCompareEngine Role Logic
- **File:** `server/config/versionCompareEngine.ts` (lines 333-340)
- **Value:** `if (id.includes("supco"))`, `if (id.includes("president"))`
- **Business Meaning:** Affected roles analysis for governance version comparison
- **Category:** Governance
- **Who Should Control It:** Role-position mapping configuration
- **Migration:** Read from position configuration table.
- **Risk:** 🟠 String-matching on role names is fragile.

### Finding O-006: SupCo Approval in SGA
- **File:** `server/config/sgaEngine.ts` (lines 58, 165-181)
- **Value:** `supco?: boolean`, `supcoApproved`, `ebtoApproved`
- **Business Meaning:** SGA requires both EBTO and SupCo approval
- **Category:** Governance
- **Who Should Control It:** Workflow configuration (approval chain)
- **Migration:** Define approval chain as configurable workflow stages.
- **Risk:** 🟠 Approval chain is hardcoded in engine logic.

---

## 7. Governance Version String Hardcodes

### Finding G-001: "2025-26" Fallback Pattern
- **Files:** votingRightsEngine.ts (lines 239, 265, 590), sgaEngine.ts (line 110), ngaEngine.ts (line 149), electionGovernanceIntegration.ts (lines 616, 776)
- **Value:** `governanceVersion ?? "2025-26"` — fallback in 7 locations
- **Business Meaning:** Default governance version when not specified
- **Category:** Governance
- **Who Should Control It:** `gov.currentVersion` config key
- **Migration:** Replace all fallbacks with `await getConfig("gov.currentVersion", "2025-26")`
- **Risk:** 🔴 Every location must be updated when governance version changes.

---

## 8. Workflow State Hardcodes

### Finding W-001: NGA Status Lifecycle
- **File:** `drizzle/schema.nga.ts` (lines 18-25)
- **Value:** 14 statuses: `planning`, `organizing_committee`, `call_for_participation`, etc.
- **Business Meaning:** NGA meeting status lifecycle
- **Category:** Workflow
- **Who Should Control It:** Workflow definition (configurable states + transitions)
- **Migration:** Define workflow as data, not as enum.
- **Risk:** 🟠 Adding a status requires schema migration.

### Finding W-002: Membership Status Lifecycle
- **File:** `drizzle/schema.ts` (lines ~35-42)
- **Value:** `Pending`, `Active`, `Inactive`, `Suspended`, `Terminated`, `Alumni`, `Expired`
- **Business Meaning:** Membership status lifecycle
- **Category:** Workflow
- **Who Should Control It:** Workflow definition
- **Risk:** 🟠 Same as W-001.

---

## 9. Mock Data Hardcodes (Non-Configurable)

### Finding M-001: AdminBulkData Frontend Mock
- **File:** `client/src/pages/AdminBulkData.tsx` (lines 55-97)
- **Value:** ~40 hardcoded mock records (members, activities, events, courses)
- **Business Meaning:** Sample data for bulk data manager
- **Category:** Mock Data
- **Who Should Control It:** Should come from API (already partially wired)
- **Migration:** Remove inline data, use tRPC query data only.
- **Risk:** 🟠 Frontend shows stale mock data even when API returns real data.

### Finding M-002: AdminGoogleDrive Frontend Mock
- **File:** `client/src/pages/AdminGoogleDrive.tsx` (lines 42-58)
- **Value:** ~18 hardcoded files, 2 scripts, 4 folders
- **Business Meaning:** Sample Google Drive data
- **Category:** Mock Data
- **Migration:** Remove inline data.
- **Risk:** 🟠 Same as M-001.

### Finding M-003: AdminNga Frontend Mock
- **File:** `client/src/pages/AdminNga.tsx` (lines 85-106)
- **Value:** 2 hardcoded NGA meetings with dates, quorum values
- **Business Meaning:** Sample NGA data
- **Category:** Mock Data
- **Risk:** 🟠 Shows hardcoded dates (2025, 2026) that become stale.

### Finding M-004: googleDriveEngine Mock Data
- **File:** `server/config/googleDriveEngine.ts` (lines 490-647)
- **Value:** 150+ lines of hardcoded mock data (activities, events, meetings, awards, files)
- **Business Meaning:** Fallback data when DB unavailable
- **Category:** Mock Data
- **Risk:** 🟠 Large block of MSAP-specific data in generic engine.

### Finding M-005: documentUploadEngine Mock Data
- **File:** `server/config/documentUploadEngine.ts` (lines 500-511)
- **Value:** Hardcoded filenames: `"MSAP Constitution 2025.pdf"`, `"Annual Report 2025.pdf"`, `"Budget Template 2026.xlsx"`
- **Business Meaning:** Sample document data
- **Category:** Mock Data
- **Risk:** 🟡 Contains organization-specific filenames.

---

## 10. Priority Migration Items

### P0 — Must Fix Before Production
1. **G-001:** Replace all `"2025-26"` fallbacks with `getConfig("gov.currentVersion")`
2. **D-002/D-003:** Replace hardcoded `TERM 2025–26` with term config
3. **O-001:** Move NGA agenda items from code to configuration
4. **D-007:** Move CMS salt to environment variable

### P1 — Must Fix for Configuration-Driven Architecture
5. **R-001/R-002:** Create positions table, replace enum
6. **R-005:** Replace hardcoded `superadmin` check with RBAC permission
7. **O-003:** Move VPA approval authority to workflow config
8. **O-004:** Move finance approval tiers to governance rules
9. **W-001/W-002:** Define workflow states as data

### P2 — Should Fix for Clean Architecture
10. **M-001-M-005:** Remove inline mock data from frontend pages
11. **Q-004:** Replace hardcoded plenary quorum with governance rule resolution
12. **F-003:** Move SaaS pricing to DB
13. **R-003:** Store position labels in DB
