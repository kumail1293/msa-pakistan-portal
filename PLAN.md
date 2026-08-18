# MSAP Portal — Enterprise Upgrade Plan

## Current State Assessment

### ✅ What Works Well
| Area | Status |
|------|--------|
| Password Hashing | scrypt with OWASP parameters |
| Session Security | JWT with httpOnly cookies, session epoch revocation |
| CSRF Protection | SameSite=Lax, same-origin CORS |
| SSRF Guards | Private IP blocking, size limits on remote fetches |
| Rate Limiting | Per-IP sliding window |
| Input Validation | Zod schemas, magic-byte upload validation |
| SQL Injection | Drizzle ORM parameterized queries |
| Email Security | HTML escaping, safe link validation |
| Error Handling | Generic client messages, detailed server logs |

### 🔴 Critical Issues to Fix

1. **In-Memory Storage** — All member data lost on restart (no DATABASE_URL configured)
2. **Hardcoded Organization** — "MSA Pakistan" / "vpm@msapakistan.org" in 119+ places
3. **No Audit Trail** — `audit_log` table exists but never written to
4. **No Configurable Settings** — `configuration` table exists but unused
5. **Hardcoded Colors** — Brand colors in CSS and PDF generation code
6. **Hardcoded Email Templates** — Embedded as string literals
7. **No RBAC** — Roles are MySQL enum, not configurable

### 🟡 High Priority
- No centralized config service
- No feature flags
- No structured logging
- No multi-tenancy support
- No monitoring/health checks

---

## Enterprise Upgrade Plan

### Phase 1: Data Persistence (CRITICAL)
**Goal:** Never lose data again

- [ ] Configure `DATABASE_URL` in `.env`
- [ ] Fix `memberAccountService.ts` to use Drizzle/MySQL instead of in-memory Maps
- [ ] Run `pnpm db:push` to sync schema
- [ ] Add MySQL2 connection pooling
- [ ] Implement automated database backups
- [ ] Add point-in-time recovery

### Phase 2: Configuration System
**Goal:** All settings admin-manageable

- [ ] Extend `configuration` table with categories, types, defaults
- [ ] Create `server/config/configService.ts` with caching
- [ ] Build admin config UI (`/admin/config`)
- [ ] Add config validation and type safety
- [ ] Migrate env vars to DB where appropriate

### Phase 3: Branding & Theming
**Goal:** One codebase, many organizations

- [ ] Create `branding` config: org name, logo, colors, contact
- [ ] Extract all hardcoded strings to config
- [ ] Build dynamic theme system (CSS variables from config)
- [ ] Create logo upload endpoint
- [ ] Make email templates config-driven
- [ ] Make PDF generation config-driven

### Phase 4: Enterprise Features
**Goal:** Production-ready management

- [ ] Implement audit logging (call `logAuditEvent()` everywhere)
- [ ] Add RBAC system (permissions table, role hierarchy)
- [ ] Create feature flags (enable/disable modules per tenant)
- [ ] Add email template editor (customizable in DB)
- [ ] Build notification preferences

### Phase 5: Operations
**Goal:** Observable and maintainable

- [ ] Structured logging (Winston/Pino with JSON output)
- [ ] Error tracking (Sentry or similar)
- [ ] Health checks (`/health` endpoint)
- [ ] Performance metrics (Prometheus)
- [ ] Uptime monitoring

---

## Environment Variables Needed

```env
# Database
DATABASE_URL=mysql://user:pass@host:3306/dbname

# Branding (Phase 2)
BRAND_NAME=MSA Pakistan
BRAND_EMAIL=vpm@msapakistan.org
BRAND_LOGO_URL=

# Portal
PORTAL_BASE_URL=https://yourdomain.com

# SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_NAME=MSA Pakistan
FROM_EMAIL=noreply@msapakistan.org

# Security
JWT_SECRET=<your-secret>
```

---

## Architecture Decisions

### 1. Single-Tenant vs Multi-Tenant
**Decision:** Start single-tenant, design for multi-tenant

- Configuration stored in DB (easy to add `tenant_id` later)
- Branding separated from business logic
- No hardcoded org-specific values

### 2. Config Service Pattern
```typescript
// server/config/configService.ts
export async function getConfig(key: string, defaultValue?: string): Promise<string> {
  const cached = configCache.get(key);
  if (cached) return cached;
  
  const dbValue = await db.getConfiguration(key);
  const value = dbValue?.value ?? defaultValue ?? "";
  configCache.set(key, value);
  return value;
}
```

### 3. Branding Provider Pattern
```typescript
// server/config/branding.ts
export async function getBranding() {
  return {
    orgName: await getConfig("brand.name", "MSA Pakistan"),
    orgEmail: await getConfig("brand.email", "contact@example.com"),
    primaryColor: await getConfig("brand.color.primary", "#1B355E"),
    // ... etc
  };
}
```

---

## Timeline Estimate

| Phase | Duration | Priority |
|-------|----------|----------|
| Phase 1: Data Persistence | 1-2 days | CRITICAL |
| Phase 2: Configuration | 2-3 days | HIGH |
| Phase 3: Branding | 3-4 days | HIGH |
| Phase 4: Enterprise Features | 5-7 days | MEDIUM |
| Phase 5: Operations | 2-3 days | MEDIUM |

**Total: ~13-19 days for full enterprise readiness**

---

## Success Criteria

- [ ] Zero data loss (persistent database)
- [ ] All org-specific values configurable via admin UI
- [ ] Branding customizable without code changes
- [ ] Audit trail for all critical actions
- [ ] Structured logging with error tracking
- [ ] Health monitoring and alerts
- [ ] Can deploy for any NGO/NPO with minimal configuration
