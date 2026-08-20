# Master Architecture — Organizational Operating System

## Vision

This platform is a **configurable organizational operating system**. MSAP (Medical Students' Association of Pakistan) is its first implementation. Every module is designed to be reused by any NGO/NPO/potential international organization with zero code changes — only configuration.

---

## Architectural Layers

```
┌──────────────────────────────────────────────────┐
│                  DOMAIN MODULES                   │
│  Membership · Elections · Plenary · Activities    │
│  Finance · HR · Projects · Documents · Awards     │
│  Communications · Knowledge Base · Inventory      │
└──────────────────────┬───────────────────────────┘
                       │ depends on
┌──────────────────────▼───────────────────────────┐
│                  ENGINES                          │
│  Workflow Engine · Forms Engine · Rules Engine     │
│  Elections Engine · Plenary Engine · Search Engine │
│  Notification Engine · Document Engine · Analytics │
└──────────────────────┬───────────────────────────┘
                       │ depends on
┌──────────────────────▼───────────────────────────┐
│                PLATFORM CORE                      │
│  Identity/IAM · Organizations · RBAC/ABAC         │
│  Configuration · Audit/Compliance · Notifications  │
│  Documents · Files/Media · Integrations/API       │
└──────────────────────────────────────────────────┘
```

---

## Platform Core Services

| Service | Responsibility | Key Tables |
|---------|---------------|------------|
| **Identity/IAM** | Authentication, sessions, SSO, MFA | `users`, `user_sessions` |
| **Organizations** | Multi-org hierarchy, chapters, committees | `organizations`, `organizational_units`, `institutions` |
| **RBAC/ABAC** | Permissions, roles, scoped access control | `permissions`, `roles`, `role_permissions`, `user_roles` |
| **Configuration** | Centralized settings, runtime config | `configuration` |
| **Audit/Compliance** | Append-only audit trail, tamper-evident logs | `audit_events` |
| **Notifications** | Email, push, in-app, templates, preferences | `notification_templates`, `notification_queue`, `notification_preferences` |
| **Documents** | File storage, document generation, versioning | `documents`, `document_templates` |
| **Files/Media** | Upload handling, storage abstraction, CDN | `file_uploads` |
| **Integrations** | Webhooks, API keys, third-party connectors | `integrations`, `webhooks`, `api_keys` |

---

## Engine Layer

### Workflow Engine (v2)
- Versioned workflow definitions with triggers
- Stages with configurable types (approval, parallel, conditional, timer, escalation, webhook, integration, payment, document generation)
- **Transition graph** (not linear): each stage can branch to multiple next stages based on outcome
- SLA tracking, escalation policies
- Configurable permissions per stage
- Notification hooks at every transition
- Integration/webhook hooks

### Forms Engine (v2)
- Dynamic form builder with rich field types
- Conditional logic, validation rules, file uploads, signatures
- **Form → Workflow → Approval → Document → Notification → Audit** pipeline
- Versioned forms, draft/published lifecycle
- Submission review and approval workflow

### Rules Engine
- Configurable business rules as data (not code)
- Decision tables, condition builders
- Used by Elections, Plenary, and all governance modules

---

## Domain Modules

Each domain module is built on top of the engines:

| Module | Primary Engine | Description |
|--------|---------------|-------------|
| **Membership** | Workflow + Forms | Applications, approvals, card issuance, lifecycle |
| **Elections** | Elections Engine + Workflow | Nominations, ballots, voting, certification |
| **Plenary** | Plenary Engine | Sessions, motions, debate, voting, resolutions |
| **Activities/NEF/NRF** | Workflow + Forms | Proposals, approvals, execution, reporting |
| **Finance** | Workflow + Rules | Budgets, expenses, approvals, reporting |
| **HR/Officials** | Workflow + Forms | Appointments, terms, transitions |
| **Projects** | Workflow | Project lifecycle, tasks, milestones |
| **Documents** | Document Engine | Templates, generation, storage, versioning |
| **Communications** | Notification Engine | Announcements, broadcasts, newsletters |
| **Awards/Certificates** | Document Engine + Workflow | Nominations, reviews, generation |

---

## Data Architecture

### Schema Organization
```
drizzle/
  schema.ts              # Core user/member tables
  schema.enterprise.ts   # RBAC, organizations, workflows, forms, governance
  schema.governance.ts   # Elections, plenary, activities, finance
  schema.notifications.ts # Notification templates, queue, preferences
  relations.ts           # Table relationships
```

### Multi-Tenancy Strategy
- Start single-tenant (MSAP), design for multi-tenant
- All org-specific values in `configuration` table
- `organizationId` foreign key on all domain tables
- Branding separated from business logic
- No hardcoded org-specific values in code

### Database Conventions
- Drizzle ORM for type-safe queries
- MySQL with connection pooling
- JSON columns for flexible metadata
- Indexes on all foreign keys and frequently queried columns
- Soft deletes where audit trail matters

---

## Security Model

### Authentication
- Password-based (scrypt with OWASP parameters)
- JWT tokens in httpOnly cookies
- Session epoch for revocation
- MFA support (future)

### Authorization
- RBAC with scoped roles (global, org, chapter, committee)
- Permission-based access control
- ABAC support (attribute-based conditions)
- Hierarchy-aware role resolution

### Audit
- Every business-critical action logged
- Before/after snapshots for data changes
- Correlation IDs for request tracing
- Append-only, tamper-evident design

---

## API Architecture

### Backend (tRPC)
- Type-safe API layer
- Input validation with Zod
- Middleware for auth, RBAC, audit
- Background job processing

### Frontend (React/Vite)
- Component-based architecture
- Shared types with backend
- Optimistic updates
- Responsive design with mobile support

---

## Deployment

### Environment
- Node.js + TypeScript
- MySQL database
- Vite for frontend build
- PM2 or Docker for production

### Configuration
- Environment variables for secrets
- Database for runtime configuration
- Feature flags for module enablement
- Branding via configuration service

---

## Implementation Phases

### Phase 1: Platform Core Enhancement ✅ (mostly done)
- [x] Configuration system with caching
- [x] Branding provider
- [x] RBAC foundation
- [x] Audit service
- [x] Feature flags
- [ ] Enhanced audit (correlation IDs, before/after snapshots everywhere)
- [ ] Notification engine
- [ ] Document management

### Phase 2: Engine Upgrades (current focus)
- [ ] Workflow Engine v2 (transitions, versioning, SLA, triggers)
- [ ] Forms Engine v2 (builder types, pipeline)
- [ ] Rules Engine foundation

### Phase 3: Governance Engines
- [ ] Elections Engine
- [ ] Plenary/Parliamentary Engine
- [ ] Activities/NEF/NRF Engine

### Phase 4: Domain Modules
- [ ] Membership (upgrade existing)
- [ ] Finance
- [ ] HR/Officials
- [ ] Projects
- [ ] Communications
- [ ] Awards/Certificates

### Phase 5: Production Readiness
- [ ] Monitoring & observability
- [ ] Performance optimization
- [ ] Security hardening
- [ ] Documentation
