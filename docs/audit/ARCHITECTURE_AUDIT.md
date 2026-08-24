# Architecture Audit — MSAP Portal

**Date:** August 24, 2026
**Commit:** HEAD of `main` (post-`bbbdc6e`)

---

## 1. Repository Structure

```
phase1inspect/
├── client/                    # React SPA (Vite + React 18 + Tailwind + shadcn/ui)
│   ├── src/
│   │   ├── pages/             # 78 page components
│   │   ├── components/        # 13 shared components + ui/ (shadcn)
│   │   ├── contexts/          # React contexts
│   │   ├── hooks/             # Custom hooks
│   │   ├── lib/               # Utility functions
│   │   └── styles/            # CSS (msap-brand.css)
│   └── public/sw.js           # Service worker (PWA)
├── server/                    # Express + tRPC API
│   ├── _core/                 # Auth, cookies, env, health, logger, RBAC, etc.
│   ├── config/                # 70 engine files (domain logic)
│   ├── services/              # memberAccountService, emailService, etc.
│   └── routers.ts             # 4301-line monolithic router file
├── shared/                    # Shared types and constants
│   └── _core/errors.ts
├── drizzle/                   # Database schema (MySQL + Drizzle ORM)
│   ├── schema.ts              # Core tables (users, voting, etc.)
│   ├── schema.enterprise.ts   # RBAC, organizations, workflows, forms
│   ├── schema.governance.ts   # Plenary, motions, elections
│   ├── schema.governance_rules.ts  # Versioned governance rules
│   ├── schema.nga.ts          # NGA/SGA meetings, delegations, voting rights
│   ├── schema.cms.ts          # CMS pages, posts, media, menus, themes
│   ├── schema.forms_builder.ts # Forms builder
│   ├── schema.credentials.ts  # Credentials, CCC
│   ├── schema.membership.ts   # Membership forms, lifecycle
│   ├── schema.notifications.ts # Notifications
│   ├── schema.platform.ts     # Organizations, elections, finance
│   ├── schema.proxy_oath_termination.ts # Proxy voting, oath, termination
│   ├── schema.modules.ts      # Activities, events, chapters, training
│   ├── schema.saas.ts         # Multi-tenant SaaS
│   └── schema.remaining.ts    # Import/export, departments, audit
└── .github/workflows/ci.yml   # CI/CD
```

## 2. Frontend Architecture

### 2.1 Framework & Tooling
- **React 18** with Vite 5 build system
- **Tailwind CSS** for utility-first styling
- **shadcn/ui** component library (Card, Button, Dialog, Input, etc.)
- **tRPC client** for type-safe API calls
- **React Router** for client-side routing

### 2.2 Page Count
- **44 admin pages** (Admin*.tsx)
- **16 member pages** (Member*.tsx)
- **8 public/shared pages** (Home, Login, Settings, etc.)
- **78 total page components**

### 2.3 Frontend Issues
| Issue | Severity | Details |
|-------|----------|---------|
| **Monolithic App.tsx** | 🟠 High | Single App.tsx contains all 78+ routes. Should be split into route modules. |
| **No code splitting** | 🟠 High | No React.lazy() or dynamic imports. Entire SPA loads upfront. |
| **No state management** | 🟡 Medium | No Redux/Zustand/Jotai. All state is local component state. |
| **Hardcoded mock data in pages** | 🔴 Critical | AdminBulkData, AdminGoogleDrive, AdminNga have inline hardcoded data arrays. |
| **No form library** | 🟡 Medium | Forms use raw useState + manual validation. Should use react-hook-form or similar. |
| **No error boundaries per section** | 🟡 Medium | Only one global ErrorBoundary component. |
| **No i18n on frontend** | 🟡 Medium | Backend has i18nEngine but frontend has no translations. |
| **Inconsistent loading states** | 🟡 Medium | Some pages use LoadingState, others have inline spinners. |

### 2.4 Shared Components
| Component | Purpose | Status |
|-----------|---------|--------|
| PageHeader | Consistent page headers | ✅ Used across pages |
| StatCard | Stat display cards | ✅ Used across pages |
| EmptyState | Empty state messaging | ✅ Used across pages |
| ErrorBoundary | React error boundary | ✅ Global only |
| MembershipCard | Card rendering (PDF/PNG) | ✅ Complex, well-implemented |
| MSAPLogo | Organization logo | ✅ |
| Skeleton | Loading skeleton | ✅ |
| OfficialLayout | Official portal layout | ✅ |
| MemberLayout | Member portal layout | ✅ |
| AdminHeader | Admin portal header | ✅ |

## 3. Backend Architecture

### 3.1 Framework & Tooling
- **Express.js** HTTP server
- **tRPC v10** for type-safe API layer
- **Drizzle ORM** for MySQL
- **Custom in-memory session store** (no Redis/DB sessions)
- **JWT + httpOnly cookies** for authentication
- **Zod** for input validation

### 3.2 Router Structure
The entire API is defined in a **single 4301-line file** (`server/routers.ts`).

**Top-level routers:**
| Router | Purpose | Procedures |
|--------|---------|------------|
| `auth` | Authentication (login, logout, OAuth, dev seeding) | 9 |
| `member` | Member profile, card | 5 |
| `membership` | Local councils | 1 |
| `card` | Card verification (QR) | 1 |
| `opportunity` | Opportunity listings | 3 |
| `voting` | Voting sessions | 4 |
| `cvMaker` | CV builder | 4 |
| `document` | Member documents | 4 |
| `directory` | Member directory | 3 |
| `membershipForm` | Membership application | 1 |
| `activities` | Member activities | 4 |
| `events` | Member events | 4 |
| `elections` | Member elections | 4 |
| `finance` | Member finance | 3 |
| `communications` | Announcements | 3 |
| `plenary` | Plenary sessions | 3 |
| `nefNrf` | NEF/NRF submissions | 7 |
| `chapters` | Chapters | 2 |
| `projects` | Projects | 3 |
| `training` | Courses | 2 |
| `meetings` | Meetings | 2 |
| `volunteers` | Volunteers | 1 |
| `recognition` | Awards | 1 |
| `myWorkflows` | Workflow tasks | 3 |
| `myForms` | Forms | 3 |
| `myNotifications` | Notifications | 5 |
| `admin` | **All admin routes** | ~150+ |
| `config` | Public config | 1 |
| `governance` | Public governance | 5 |
| `cms` | CMS pages/posts/media/menus/themes/plugins/forms/redirects/builder/widgets/postTypes | ~40 |
| `cmsAdmin` | CMS security | 4 |

### 3.3 Backend Issues
| Issue | Severity | Details |
|-------|----------|---------|
| **Monolithic router file** | 🔴 Critical | 4301 lines in one file. Must be split into domain routers. |
| **70 engine files** | 🟠 High | Many are thin wrappers around mock data. Real vs mock not always clear. |
| **Dynamic imports everywhere** | 🟡 Medium | Every engine is `await import("./config/XEngine")`. Adds complexity. |
| **No transaction boundaries** | 🟠 High | Most multi-step operations lack explicit DB transactions. |
| **In-memory session store** | 🟠 High | Sessions lost on restart. Fine for dev, not for production. |
| **CMS routes use `publicProcedure`** | 🔴 Critical | CMS create/update/delete routes are unprotected. Any anonymous user can modify CMS content. |
| **Mock data mixed with engine logic** | 🟠 High | Engines fall back to hardcoded arrays when DB unavailable. Hard to tell what's real. |
| **No request context propagation** | 🟡 Medium | Audit events manually extract IP/correlationId. Should be middleware. |

### 3.4 Engine Inventory (70 files in `server/config/`)

**Well-implemented engines (DB-backed, real logic):**
- `rbac.ts` — Full RBAC with DB persistence
- `configService.ts` — DB-backed configuration with caching
- `auditService.ts` — Chain-hashed audit logging
- `workflowEngine.ts` — State machine with transitions + guards
- `governanceRulesEngine.ts` — Temporal rule resolution
- `votingRightsEngine.ts` — Configurable voting matrix
- `electionsEngine.ts` — Election lifecycle
- `ngaEngine.ts` — NGA lifecycle (15-phase)
- `sgaEngine.ts` — SGA lifecycle
- `plenaryEngineV2.ts` — Plenary motions, POO/POI
- `bcpEngine.ts` — Bylaw Change Proposals
- `bspEngine.ts` — Bylaw Suspension Proposals
- `cccEngine.ts` — Credential Committee Council
- `membershipTerminationEngine.ts` — Termination with due process
- `oathSystem.ts` — Oath administration
- `formsEngine.ts` — Forms builder with submissions
- `notificationEngine.ts` — Multi-channel notifications
- `financeEngine.ts` — Budgets, expenses, approvals
- `activitiesEngine.ts` — Activities CRUD + registration
- `eventsEngine.ts` — Events CRUD + registration
- `documentsEngine.ts` — Document lifecycle
- `documentUploadEngine.ts` — File upload with validation
- `apiPlatformEngine.ts` — API key management (SHA-256 hashed)
- `impersonationEngine.ts` — Session impersonation
- `mfaEngine.ts` — MFA settings
- `privacyConsentEngine.ts` — Privacy/consent management
- `branding.ts` — Config-driven branding

**Thin/mock engines (no real DB logic, mostly static data):**
- `saasEngine.ts` — Multi-tenant (plans are in-memory)
- `enterpriseOpsEngine.ts` — Fake health metrics
- `analyticsEngine.ts` — Fake dashboard metrics
- `searchEngine.ts` — In-memory search
- `i18nEngine.ts` — Static translation maps
- `accessibilityEngine.ts` — Static WCAG criteria
- `importExportEngine.ts` — Stub implementations
- `savedFiltersEngine.ts` — In-memory filters
- `policyConflictEngine.ts` — Stub
- `versionCompareEngine.ts` — Stub
- `ruleSimulator.ts` — Partial implementation
- `memberLifecycleEngine.ts` — Partial
- `onboardingEngine` (inside memberLifecycleEngine) — Partial
- `committeeEngine` (inside meetingsEngine) — Partial
- `skillsEngine` (inside trainingEngine) — Partial

## 4. Database Architecture

### 4.1 Schema Files
| Schema File | Tables | Purpose |
|-------------|--------|---------|
| `schema.ts` | ~15 tables | Core users, sessions, voting, applications |
| `schema.enterprise.ts` | ~10 tables | RBAC, organizations, workflows, forms, activities, events |
| `schema.governance.ts` | ~8 tables | Plenary, motions, elections, proxies |
| `schema.governance_rules.ts` | ~7 tables | Versioned rules, clauses, parameters, decisions, amendments |
| `schema.nga.ts` | ~8 tables | NGA meetings, delegations, delegates, voting rights |
| `schema.cms.ts` | ~12 tables | Pages, posts, media, menus, themes, plugins, forms, redirects |
| `schema.forms_builder.ts` | ~5 tables | Form definitions, fields, submissions |
| `schema.credentials.ts` | ~4 tables | Credentials, CCC |
| `schema.membership.ts` | ~3 tables | Membership applications, lifecycle cases |
| `schema.notifications.ts` | ~2 tables | Notifications, preferences |
| `schema.platform.ts` | ~8 tables | Organizations, elections, finance |
| `schema.proxy_oath_termination.ts` | ~4 tables | Proxy voting, oath, termination |
| `schema.modules.ts` | ~10 tables | Activities, events, chapters, training, projects |
| `schema.saas.ts` | ~3 tables | SaaS plans, tenants |
| `schema.remaining.ts` | ~5 tables | Import/export, departments, audit |

### 4.2 Database Issues
| Issue | Severity | Details |
|-------|----------|---------|
| **No foreign key constraints enforced** | 🟠 High | Schema defines tables but FK relationships are not explicitly enforced in Drizzle schema. |
| **No migration strategy visible** | 🟡 Medium | Only 2 SQL migration files exist. Schema changes may not be tracked. |
| **JSON columns for structured data** | 🟡 Medium | Many tables use JSON columns for complex data. No DB-level validation. |
| **No soft-delete convention** | 🟡 Medium | Some tables use `deletedAt`, others don't. No consistent pattern. |
| **Mixed enum definitions** | 🟡 Medium | Some enums in schema, some as string constants in code. |

## 5. Shared Package

### 5.1 Contents
- `shared/const.ts` — 5 constants (cookie name, timeout, error messages)
- `shared/types.ts` — Re-exports from drizzle schema + errors
- `shared/_core/errors.ts` — Custom error classes

### 5.2 Issues
| Issue | Severity | Details |
|-------|----------|---------|
| **Minimal shared code** | 🟡 Medium | Shared package is almost empty. Domain types are not shared. |
| **No shared Zod schemas** | 🟠 High | Validation schemas are defined inline in routers. Should be shared with frontend. |
| **No shared workflow definitions** | 🟠 High | Workflow states/transitions are in engine code, not shared. |

## 6. Infrastructure

### 6.1 CI/CD
- GitHub Actions with pinned SHA versions
- Steps: typecheck → test → build → deploy
- Minimal permissions per job
- Deploy job restricted to `production` environment

### 6.2 Security
- CSP headers, X-Frame-Options, HSTS, Permissions-Policy
- SHA-256 API key hashing
- Chain-hashed audit logs
- HTML sanitization on CMS content
- CSV injection prevention
- File upload validation (magic bytes, MIME, path traversal)

### 6.3 PWA
- Service worker with network-first for API, cache-first for static
- Sensitive endpoints (members, docs, votes, finance, etc.) blocked from cache
- Offline fallback returns 503 for sensitive routes

## 7. Overall Assessment

| Area | Rating | Notes |
|------|--------|-------|
| **Frontend** | 🟡 | Working but monolithic, no code splitting, hardcoded data |
| **Backend** | 🟡 | Rich engines but monolithic router, mixed real/mock data |
| **Database** | 🟡 | Comprehensive schema but weak FK enforcement, no migrations |
| **Shared** | 🔴 | Almost empty, no shared schemas or types |
| **Security** | 🟢 | Good foundation (audit chain, sanitization, API hashing) |
| **Testing** | 🟡 | 546 tests but mostly unit tests, few integration tests |
| **CI/CD** | 🟢 | Pinned actions, minimal permissions |
| **Architecture** | 🟠 | Monolithic router (4301 lines), no domain separation |

### Critical Findings
1. **`routers.ts` is 4301 lines** — single file containing ALL API routes
2. **70 engine files** — many are thin mock-data wrappers
3. **CMS routes are unprotected** — anonymous users can modify CMS content
4. **No shared validation schemas** — frontend and backend define schemas independently
5. **Mock data mixed with real engine logic** — unclear what's production-ready
6. **No transaction boundaries** — multi-step operations can leave partial state
