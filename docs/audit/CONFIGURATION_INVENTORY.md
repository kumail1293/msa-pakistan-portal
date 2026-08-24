# Configuration Inventory — MSAP Portal

**Date:** August 24, 2026

---

## Current Configuration Systems

### 1. configService.ts (Primary)
- **Table:** `configuration` (key-value with category)
- **Cache:** 5-minute TTL in-memory
- **Entries:** 23 default definitions (branding, portal, email, membership, uploads, features)
- **API:** `getConfig()`, `setConfig()`, `getAllConfigs()`
- **Status:** ✅ Good foundation, but too few entries

### 2. featureFlags.ts
- **Table:** `feature_flags`
- **Cache:** 2-minute TTL
- **API:** `isFeatureEnabled()`, `getAllFeatureFlags()`
- **Status:** ✅ Good, properly scoped by environment/role/org

### 3. rbac.ts
- **Tables:** `permissions`, `roles`, `role_permissions`, `user_roles`
- **Cache:** 5-minute TTL per user
- **API:** `checkPermission()`, `assignRole()`, `getUserPermissions()`
- **Status:** ✅ Good, but permissions are static (seeded, not admin-modifiable)

### 4. governanceRulesEngine.ts
- **Tables:** `governance_documents`, `governance_clauses`, `governance_rules`, `governance_parameters`
- **API:** `resolveEffectiveRule()`, `getParameter()`, `evaluateQuorum()`, `evaluateMajority()`
- **Status:** ✅ Excellent design, but only partially wired

### 5. organizationConfigStudio.ts
- **Storage:** In-memory array of 85+ config definitions
- **API:** `getConfigStudio()`, `updateConfigValue()`, `simulateConfigChange()`
- **Status:** 🟠 Not connected to configService.ts or database

### 6. branding.ts
- **Storage:** Reads from configService.ts (`brand.*` keys)
- **API:** `getBranding()`, `getEmailBranding()`, `getOrgName()`
- **Status:** ✅ Good, properly config-driven

---

## Configuration Keys in configService.ts

### Branding (10 keys)
| Key | Default | Configurable |
|-----|---------|-------------|
| `brand.name` | "MSA Pakistan" | ✅ |
| `brand.email` | "vpm@msapakistan.org" | ✅ |
| `brand.fullName` | "Medical Students' Association of Pakistan" | ✅ |
| `brand.shortName` | "MSAP" | ✅ |
| `brand.color.primary` | "#1B355E" | ✅ |
| `brand.color.secondary` | "#2E7D32" | ✅ |
| `brand.color.accent` | "#FFC107" | ✅ |
| `brand.logoUrl` | "" | ✅ |
| `brand.faviconUrl` | "" | ✅ |
| `brand.website` | "https://msapakistan.org" | ✅ |
| `brand.presidentName` | "Kumail Danial" | ✅ |
| `brand.presidentTitle` | "National President" | ✅ |

### Portal (2 keys)
| Key | Default | Configurable |
|-----|---------|-------------|
| `portal.name` | "MSAP Member Portal" | ✅ |
| `portal.footerText` | "© 2025 MSA Pakistan..." | ✅ |

### Email (5 keys)
| Key | Default | Configurable |
|-----|---------|-------------|
| `email.senderName` | "MSA Pakistan" | ✅ |
| `email.senderEmail` | "no-reply@msapakistan.org" | ✅ |
| `email.supportEmail` | "vpm@msapakistan.org" | ✅ |
| `email.headerBgColor` | "#1B355E" | ✅ |
| `email.footerText` | HTML footer | ✅ |

### Membership (2 keys)
| Key | Default | Configurable |
|-----|---------|-------------|
| `membership.prefix` | "MSAP" | ✅ |
| `membership.serialPrefix` | "MSAP" | ✅ |

### Uploads (1 key)
| Key | Default | Configurable |
|-----|---------|-------------|
| `upload.maxSizeBytes` | "5000000" | ✅ |

### Features (3 keys)
| Key | Default | Configurable |
|-----|---------|-------------|
| `feature.maintenanceMode` | "false" | ✅ |
| `feature.recruitmentEnabled` | "true" | ✅ |
| `feature.votingEnabled` | "true" | ✅ |
| `feature.opportunitiesEnabled` | "true" | ✅ |

---

## Missing Configuration Keys (Required by PLAN_NEW)

### Governance
| Key | Purpose | Priority |
|-----|---------|----------|
| `gov.currentVersion` | Current governance version | 🔴 P0 |
| `gov.currentTerm` | Current term identifier | 🔴 P0 |
| `gov.termStartDate` | Current term start | 🔴 P0 |
| `gov.termEndDate` | Current term end | 🔴 P0 |
| `gov.quorum.numerator` | Quorum fraction numerator | 🟠 P1 |
| `gov.quorum.denominator` | Quorum fraction denominator | 🟠 P1 |
| `gov.majority普通` | Simple majority threshold | 🟠 P1 |
| `gov.majority.super` | Supermajority threshold | 🟠 P1 |

### Finance
| Key | Purpose | Priority |
|-----|---------|----------|
| `finance.vpfThreshold` | VPF approval threshold | 🟠 P1 |
| `finance.presidentThreshold` | President approval threshold | 🟠 P1 |
| `finance.fiscalYear` | Current fiscal year | 🟡 P2 |

### Workflow
| Key | Purpose | Priority |
|-----|---------|----------|
| `workflow.defaultAssignee` | Default workflow assignee | 🟡 P2 |
| `workflow.escalationDays` | Days before escalation | 🟡 P2 |
| `workflow.deadlineDefault` | Default deadline duration | 🟡 P2 |

### Notification
| Key | Purpose | Priority |
|-----|---------|----------|
| `notification.defaultChannel` | Default notification channel | 🟡 P2 |
| `notification.escalationEnabled` | Enable escalation | 🟡 P2 |

### Organization
| Key | Purpose | Priority |
|-----|---------|----------|
| `org.positionCount` | Number of defined positions | 🟡 P2 |
| `org.lcTypes` | Allowed LC types | 🟡 P2 |

---

## Configuration Health Issues

1. **organizationConfigStudio is disconnected** — 85+ config definitions exist but are NOT wired to configService.ts or the database
2. **No term configuration** — Term dates are hardcoded, not configurable
3. **No governance version configuration** — Version strings are hardcoded fallbacks
4. **No approval authority configuration** — Finance thresholds are hardcoded in engines
5. **No deadline configuration** — All deadlines are hardcoded in engines
6. **RBAC permissions are static** — Seeded on startup, not admin-modifiable through UI
7. **Feature flags exist but are not wired** — `isFeatureEnabled()` is rarely called in engines
