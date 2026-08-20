# Database Architecture

## Overview

- **ORM**: Drizzle ORM
- **Database**: MySQL
- **Migrations**: Drizzle Kit

---

## Schema Organization

### File Structure
```
drizzle/
  schema.ts              # Core user/member tables
  schema.enterprise.ts   # RBAC, organizations, workflows, forms, governance
  schema.governance.ts   # Elections, plenary, activities, finance (NEW)
  schema.notifications.ts # Notification templates, queue, preferences (NEW)
  relations.ts           # Table relationships
  migrations/            # Generated migration files
  meta/                  # Migration metadata
```

---

## Naming Conventions

### Tables
- snake_case plural: `users`, `workflow_stages`, `audit_events`
- Junction tables: `role_permissions`, `user_roles`

### Columns
- snake_case: `created_at`, `user_id`, `membership_status`
- Foreign keys: `entity_type` + `entity_id` for polymorphic relations
- Boolean flags: `is_active`, `is_default`, `is_system`

### Indexes
- Format: `table_abbreviation_column_idx`
- Examples: `ur_user_idx`, `ae_action_idx`, `wi_status_idx`
- Composite indexes for common query patterns

---

## Core Tables

### users
Primary user table with authentication and profile data.

### local_councils
MSAP-specific organizational units (chapters).

### positions
Available positions within the organization.

### member_positions
User-position assignments with date ranges.

### configuration
Centralized key-value configuration store.

### audit_log
Basic audit trail (legacy).

### audit_events
Enhanced audit trail with full context.

---

## Enterprise Tables

### RBAC
- `permissions` — Available permissions
- `roles` — Role definitions
- `role_permissions` — Role-permission mappings
- `user_roles` — User-role assignments

### Organizations
- `organizations` — Organizational units
- `organizational_units` — Subdivisions
- `institutions` — Educational institutions

### Feature Flags
- `feature_flags` — Toggle features per environment/role

### Workflows
- `workflow_definitions` — Workflow templates (v2)
- `workflow_stages` — Stage definitions
- `workflow_transitions` — Transition rules (v2)
- `workflow_instances` — Running workflow instances
- `workflow_tasks` — Tasks for humans/machines
- `workflow_audit_events` — Complete workflow history (v2)

### Forms
- `forms` — Form definitions
- `form_fields` — Field definitions
- `form_submissions` — Submitted data

---

## Governance Tables (NEW)

### Elections
- `elections` — Election definitions
- `candidates` — Nominated candidates
- `ballots` — Encrypted votes
- `election_results` — Certified results
- `election_disputes` — Filed disputes

### Plenary
- `plenary_sessions` — Session definitions
- `agenda_items` — Agenda items
- `motions` — Proposed motions
- `amendments` — Motion amendments
- `speaker_lists` — Speaker management
- `votes` — Vote records
- `resolutions` — Adopted resolutions

---

## Notification Tables (NEW)

### Notifications
- `notification_templates` — Email/push templates
- `notification_queue` — Pending notifications
- `notification_preferences` — User notification settings

---

## JSON Columns

### When to Use
- Flexible metadata that varies per entity
- Configuration objects
- Audit snapshots (before/after)
- Complex nested data

### When NOT to Use
- Data that needs to be queried/filtered
- Data that needs constraints
- Large binary data

### Examples
```typescript
// Good use of JSON
metadata: json("metadata").$type<Record<string, unknown>>();
config: json("config").$type<WorkflowConfig>();
changes: json("changes").$type<{ before: unknown; after: unknown }>();

// Bad use (should be separate table)
tags: json("tags").$type<string[]>(); // Use a junction table instead
```

---

## Migration Strategy

### Development
1. Modify schema files
2. Run `pnpm db:push` to sync
3. Test locally

### Production
1. Generate migration: `pnpm db:generate`
2. Review migration SQL
3. Apply migration: `pnpm db:migrate`
4. Verify deployment

### Rollback
- Migrations should be reversible
- Keep rollback SQL ready
- Test rollback in staging

---

## Performance

### Indexing Strategy
- Index all foreign keys
- Index frequently queried columns
- Composite indexes for common query patterns
- Partial indexes for filtered queries (if supported)

### Query Optimization
- Use Drizzle's query builder (not raw SQL)
- Avoid N+1 queries (use joins)
- Paginate large result sets
- Use SELECT specific columns (not SELECT *)

### Connection Pooling
- MySQL2 connection pool
- Configurable pool size
- Connection reuse

---

## Data Integrity

### Foreign Keys
- All references should have foreign keys
- CASCADE or SET NULL on delete (depending on business rules)

### Constraints
- UNIQUE constraints for natural keys
- NOT NULL for required fields
- DEFAULT values for optional fields
- ENUM types for fixed value sets

### Soft Deletes
- Use `status` column instead of DELETE
- Keep audit trail
- Allow recovery
