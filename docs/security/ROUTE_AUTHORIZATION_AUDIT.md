# Route Authorization Audit

**Date:** 2026-08-25  
**Auditor:** Buffy (automated)  
**Scope:** All tRPC routes in `server/routers.ts`

## Classification Legend

| Level | Description |
|-------|-------------|
| **SAFE PUBLIC** | Information intended for anonymous users (health, branding, public governance) |
| **AUTHENTICATED** | Requires login — member-level access |
| **ADMIN** | Requires admin role — manages users, content, configuration |
| **SUPER ADMIN** | Requires super admin — manages officials, system-wide settings |
| **FIXED** | Was incorrectly classified, now corrected |

## Route Audit

### Authentication Routes

| Route | Level | Justification |
|-------|-------|---------------|
| `auth.me` | PUBLIC (SAFE) | Returns current session or null — needed for login state |
| `auth.logout` | PUBLIC (SAFE) | Clears cookie — safe to call even if not logged in |
| `auth.oAuthLoginUrl` | PUBLIC (SAFE) | Returns OAuth URL for login redirect |
| `auth.devCreateTestMember` | PUBLIC (DEV-ONLY) | Guarded by `ENV.isProduction` check |
| `auth.devCreateTestAdmin` | PUBLIC (DEV-ONLY) | Guarded by `ENV.isProduction` check |
| `auth.devCreateSuperAdmin` | PUBLIC (DEV-ONLY) | Guarded by `ENV.isProduction` check |

### Voting Routes

| Route | Level | Justification |
|-------|-------|---------------|
| `voting.getActiveSessions` | PUBLIC (SAFE) | Lists active voting sessions — public info for voters |
| `voting.list` | AUTHENTICATED | Member voting dashboard with personal vote history |

### CMS Routes (§Admin)

| Route | Level | Justification | Status |
|-------|-------|---------------|--------|
| `cms.permissions` | **ADMIN** | Exposes user permission details | **FIXED** — was PUBLIC |
| `cms.audit` | **ADMIN** | Exposes audit log metadata | **FIXED** — was PUBLIC |
| `cms.securityStats` | **ADMIN** | Exposes session counts, locked accounts, blocked IPs | **FIXED** — was PUBLIC |
| `cms.securityHeaders` | PUBLIC (SAFE) | Security headers are meant to be visible to clients | SAFE |

### Config Routes

| Route | Level | Justification | Status |
|-------|-------|---------------|--------|
| `config.getAll` | PUBLIC (BRANDED) | Branding theme only — **now defaults to "branding" category** | **FIXED** — was returning ALL configs |

### Notification Routes

| Route | Level | Justification |
|-------|-------|---------------|
| `myNotifications.list` | AUTHENTICATED | Personal notification inbox |
| `myNotifications.unreadCount` | AUTHENTICATED | Personal unread count |
| `myNotifications.markRead` | AUTHENTICATED | Personal notification management |
| `myNotifications.preferences` | AUTHENTICATED | Personal notification settings |
| `myNotifications.updatePreferences` | AUTHENTICATED | Personal notification settings |

### Admin Notification Routes

| Route | Level | Justification |
|-------|-------|---------------|
| `admin.notifications.list` | ADMIN (officialModule) | Admin notification management |
| `admin.notifications.templates` | ADMIN (officialModule) | Template management |
| `admin.notifications.send` | ADMIN (officialModule) | Sending notifications |
| `admin.notifications.seedTemplates` | SUPER ADMIN | Seeding default templates |

### Governance Routes

| Route | Level | Justification |
|-------|-------|---------------|
| `governance.overview` | PUBLIC (SAFE) | Public governance transparency |
| `governance.sections` | PUBLIC (SAFE) | Public governance documents |
| `governance.section` | PUBLIC (SAFE) | Public governance documents |
| `governance.search` | PUBLIC (SAFE) | Public governance search |
| `governance.documents` | PUBLIC (SAFE) | Public governance documents |
| `governance.positions` | PUBLIC (SAFE) | Public organizational positions |
| `governance.stats` | PUBLIC (SAFE) | Public governance statistics |

### Local Council Routes

| Route | Level | Justification |
|-------|-------|---------------|
| `lc.list` | ADMIN (officialModule) | LC management |
| `lc.stats` | ADMIN (officialModule) | LC statistics |

### Membership Workflow Routes

| Route | Level | Justification |
|-------|-------|---------------|
| `membership.submitApplication` | AUTHENTICATED | Member submits application |
| `membership.approve` | ADMIN (officialModule) | Admin approves membership |
| `membership.reject` | ADMIN (officialModule) | Admin rejects membership |
| `membership.pending` | ADMIN (officialModule) | View pending applications |
| `membership.stats` | ADMIN (officialModule) | Membership statistics |

### NEF Workflow Routes

| Route | Level | Justification |
|-------|-------|---------------|
| `nef.submitWorkflow` | AUTHENTICATED | Submit NEF activity |
| `nef.reviewVpa` | ADMIN (officialModule) | VPA review |
| `nef.reviewVpf` | ADMIN (officialModule) | VPF review |
| `nef.approvePresident` | ADMIN (officialModule) | President approval |

### NGA Routes

| Route | Level | Justification |
|-------|-------|---------------|
| `nga.isActive` | PUBLIC (SAFE) | Public NGA status |

### Search Routes

| Route | Level | Justification |
|-------|-------|---------------|
| `search.global` | PUBLIC (SAFE) | Public search functionality |

### Health Routes

| Route | Level | Justification |
|-------|-------|---------------|
| `health.health` | PUBLIC (SAFE) | Health check endpoint |
| `health.overview` | PUBLIC (SAFE) | System overview |
| `health.sections` | PUBLIC (SAFE) | Section status |
| `health.section` | PUBLIC (SAFE) | Individual section status |
| `health.search` | PUBLIC (SAFE) | Health search |
| `health.documents` | PUBLIC (SAFE) | Health documents |
| `health.positions` | PUBLIC (SAFE) | Health positions |
| `health.stats` | PUBLIC (SAFE) | Health statistics |

### i18n Routes

| Route | Level | Justification |
|-------|-------|---------------|
| `i18n.translations` | PUBLIC (SAFE) | Localization strings |
| `i18n.locales` | PUBLIC (SAFE) | Available locales |

### Accessibility Routes

| Route | Level | Justification |
|-------|-------|---------------|
| `accessibility.criteria` | PUBLIC (SAFE) | Accessibility criteria |
| `accessibility.keyboardRules` | PUBLIC (SAFE) | Keyboard rules |
| `accessibility.ariaRoles` | PUBLIC (SAFE) | ARIA roles |
| `accessibility.contrast` | PUBLIC (SAFE) | Color contrast checker |

### SaaS Routes

| Route | Level | Justification |
|-------|-------|---------------|
| `saas.plans` | PUBLIC (SAFE) | Public pricing plans |

### Form Routes

| Route | Level | Justification |
|-------|-------|---------------|
| `forms.get` | AUTHENTICATED | Form viewing |
| `forms.submit` | AUTHENTICATED | Form submission |

## Summary

| Classification | Count | Notes |
|----------------|-------|-------|
| SAFE PUBLIC | ~30 | Health, governance, branding, i18n, accessibility |
| AUTHENTICATED | ~15 | Member operations, notifications, forms |
| ADMIN | ~20 | CMS, LC, membership, NEF, workflow management |
| SUPER ADMIN | ~5 | Officials, template seeding, system config |
| FIXED | **4** | `cms.audit`, `cms.securityStats`, `cms.permissions`, `config.getAll` |

## Security Fixes Applied

1. **`cms.audit`**: Changed from `publicProcedure` → `adminProcedure`  
   - Exposes audit log metadata (who did what, when)
   
2. **`cms.securityStats`**: Changed from `publicProcedure` → `adminProcedure`  
   - Exposes session counts, locked accounts, blocked IPs, rate-limit state

3. **`cms.permissions`**: Changed from `publicProcedure` → `adminProcedure`  
   - Exposes effective permissions for any user ID

4. **`config.getAll`**: Changed default category to `"branding"`  
   - Previously returned ALL configuration values (including secrets)
   - Now only returns branding-related configs
