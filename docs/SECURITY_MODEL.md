# Security Model

## Authentication

### Methods
1. **Password-based** — scrypt with OWASP parameters
2. **OAuth/SSO** — External identity providers (future)
3. **MFA** — Multi-factor authentication (future)

### Session Management
- JWT tokens in httpOnly cookies
- Session epoch for revocation
- Automatic expiry
- Secure flag in production

### Password Policy
- Minimum 8 characters
- Require uppercase, lowercase, number
- Password history (prevent reuse)
- Account lockout after failed attempts

---

## Authorization

### RBAC (Role-Based Access Control)
- Roles scoped to organizations
- Hierarchical role resolution
- Permission-based access control
- Cached permission lookups (5-minute TTL)

### Role Hierarchy
```
superadmin (100)
  └── admin (80)
        └── official (60)
              └── chapter_admin (40)
                    └── user (10)
```

### Permission Categories
- membership — Member management
- chapter — Chapter administration
- activity — Activity management
- event — Event management
- governance — Governance processes
- election — Election management
- finance — Financial operations
- document — Document management
- admin — System administration
- project — Project management
- training — Training/courses
- communication — Notifications/announcements

### ABAC (Attribute-Based Access Control)
Future enhancement for complex access rules:
- Resource attributes (entity type, owner, status)
- User attributes (role, membership status, position)
- Environment attributes (time, IP, device)

---

## Audit Trail

### What Gets Logged
- All CRUD operations on sensitive data
- Authentication events (login, logout, failed attempts)
- Authorization decisions (permission checks)
- Workflow transitions
- Configuration changes
- Data exports

### Audit Event Structure
```typescript
interface AuditEvent {
  id: number;
  userId?: number;
  actorEmail?: string;
  actorName?: string;
  action: string;
  category?: string;
  entityType?: string;
  entityId?: number;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  scopeType?: string;
  scopeId?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
```

### Tamper-Evidence
- Append-only design
- No updates or deletes allowed
- Correlation IDs for request tracing
- Checksums (future enhancement)

---

## Data Protection

### Sensitive Data
- Passwords: Hashed with scrypt (never stored in plain text)
- CNIC: Encrypted at rest (future)
- Session tokens: httpOnly cookies (not accessible via JavaScript)
- Ballots: Encrypted with election-specific keys

### Input Validation
- Zod schemas for all inputs
- SQL injection prevention (Drizzle ORM parameterized queries)
- XSS prevention (HTML escaping)
- SSRF guards (private IP blocking)

### File Upload Security
- Magic-byte validation
- File type restrictions
- Size limits
- Separate storage from web root

---

## CSRF Protection

- SameSite=Lax cookies
- Same-origin CORS policy
- Origin header validation

---

## Rate Limiting

- Per-IP sliding window
- Configurable limits per endpoint
- Brute-force protection on login

---

## Environment Security

### Secrets Management
- Environment variables for secrets
- No secrets in code or git
- Separate configs per environment

### Production Hardening
- HTTPS enforced
- Security headers (HSTS, CSP, X-Frame-Options)
- Error messages sanitized (no stack traces to client)
- Logging sanitized (no passwords/tokens)
