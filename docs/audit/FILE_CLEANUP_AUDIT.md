# File Cleanup Audit

## 1. Temp / Artifact Files (SAFE TO DELETE)

| File | Size | Reason |
|------|------|--------|
| `server.log` | 19 bytes | Runtime log artifact |
| `pnpm-lock.yaml.2981801175` | 301 KB | Backup lockfile — not needed |
| `vitest.config.ts.timestamp-*` | 2.7 KB | Vitest temp file |
| `browser-test.mjs` | 1.2 KB | Ad-hoc test script |
| `test-pages.mjs` | 4.0 KB | Ad-hoc test script |
| `test-screenshots.mjs` | 2.7 KB | Ad-hoc test script |
| `test-screenshots.sh` | 1.1 KB | Ad-hoc test script |
| `MANUAL_PLAN.md` | 49 KB | Superseded by PLAN_NEW.md |
| `PLAN.md` | 5.3 KB | Superseded by PLAN_NEW.md |
| `screenshots/` | empty dir | No screenshots present |
| `clean/` | npx cache | npm cache artifacts, not project files |

**Total removable: ~367 KB + 2 empty/cache dirs**

## 2. Duplicate / Redundant Files

| File | Status |
|------|--------|
| `MANUAL_PLAN.md` | Superseded by `PLAN_NEW.md` (1301 lines) |
| `PLAN.md` | Superseded by `PLAN_NEW.md` |
| `pnpm-lock.yaml.2981801175` | Backup of pnpm-lock.yaml |

## 3. Server Engines — NOT Referenced by routers.ts

These 15 engines exist but are NOT imported by `routers.ts`:

| Engine | Status | Notes |
|--------|--------|-------|
| `bcpEngine.ts` | Used by governanceRulesEngine | Keep |
| `bspEngine.ts` | Used by governanceRulesEngine | Keep |
| `cccEngine.ts` | Used by ngaEngine | Keep |
| `documentTemplateEngine.ts` | NEW — Phase 21 | Keep |
| `formPipelineEngine.ts` | Used by workflowEngine | Keep |
| `formsBuilderEngine.ts` | Used by formsEngine | Keep |
| `governanceRulesEngine.ts` | Core engine — used everywhere | Keep |
| `iogEngine.ts` | Independent governance engine | Keep |
| `lcLifecycleEngine.ts` | NEW — Phase 20 | Keep |
| `membershipTerminationEngine.ts` | Used by memberLifecycleEngine | Keep |
| `policyConflictEngine.ts` | Governance conflict detection | Keep |
| `proxyVotingEngine.ts` | NGA proxy voting | Keep |
| `sgaEngine.ts` | SGA lifecycle | Keep |
| `versionCompareEngine.ts` | Governance versioning utility | Keep |
| `votingRightsEngine.ts` | NGA voting calculations | Keep |

**Verdict: All 15 are indirectly used — NONE should be deleted.**

## 4. Client Pages — Unused

| Page | Status |
|------|--------|
| `PublicLanding.tsx` | **UNUSED** — comment says "moved to WordPress" |

**Only 1 page is truly unused.**

## 5. Duplicate Server Engines (Potential Consolidation)

| Pattern | Files | Action |
|---------|-------|--------|
| Workflow engines | `workflowEngine.ts` + `workflowEngineV2.ts` | Consider merging V2 into V1 |
| Forms engines | `formsEngine.ts` + `formsBuilderEngine.ts` + `formPipelineEngine.ts` | 3 engines — review overlap |
| Plenary engines | `plenaryEngine.ts` + `plenaryEngineV2.ts` | Consider merging V2 into V1 |
| CMS engines | `cmsEngine.ts` + `cmsSecurityEngine.ts` | Separate concerns — keep both |
| Privacy engines | `privacyConsentEngine.ts` + separate in routers | Review overlap |

## 6. Files NOT in .gitignore

| File | Should be gitignored? |
|------|----------------------|
| `server.log` | Yes |
| `vitest.config.ts.timestamp-*` | Yes |
| `screenshots/` | Yes |
| `clean/` | Yes |
| `dist/` | Already in .gitignore |

## Summary — Safe to Delete NOW

```
server.log
pnpm-lock.yaml.2981801175
vitest.config.ts.timestamp-1787564271587-e13ff24c8e35b8.mjs
browser-test.mjs
test-pages.mjs
test-screenshots.mjs
test-screenshots.sh
MANUAL_PLAN.md
PLAN.md
screenshots/
clean/
```

## Summary — Consider Consolidation

```
workflowEngineV2.ts → merge into workflowEngine.ts
plenaryEngineV2.ts → merge into plenaryEngine.ts
PublicLanding.tsx → delete (moved to WordPress)
```
