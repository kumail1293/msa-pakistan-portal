/**
 * Enterprise Schema Extension
 * Adds RBAC, organizations, feature flags, workflows, forms, activities,
 * events, governance, elections, finance, and communications tables.
 */

import {
  int,
  varchar,
  text,
  timestamp,
  boolean,
  mysqlEnum,
  mysqlTable,
  json,
  decimal,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// ============================================================================
// RBAC (Role-Based Access Control)
// ============================================================================

export const permissions = mysqlTable("permissions", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = typeof permissions.$inferInsert;

export const roles = mysqlTable("roles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  description: text("description"),
  scope: mysqlEnum("scope", ["global", "org", "chapter", "committee", "event", "project"]).default("org").notNull(),
  isSystem: boolean("isSystem").default(false),
  isDefault: boolean("isDefault").default(false),
  hierarchyLevel: int("hierarchyLevel").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Role = typeof roles.$inferSelect;
export type InsertRole = typeof roles.$inferInsert;

export const rolePermissions = mysqlTable(
  "role_permissions",
  {
    id: int("id").autoincrement().primaryKey(),
    roleId: int("roleId").notNull(),
    permissionId: int("permissionId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    roleIdx: index("rp_role_idx").on(table.roleId),
    permIdx: index("rp_perm_idx").on(table.permissionId),
    uniqueAssignment: uniqueIndex("rp_unique").on(table.roleId, table.permissionId),
  })
);

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = typeof rolePermissions.$inferInsert;

export const userRoles = mysqlTable(
  "user_roles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    roleId: int("roleId").notNull(),
    scopeType: varchar("scopeType", { length: 50 }),
    scopeId: int("scopeId"),
    startsAt: timestamp("startsAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt"),
    assignedBy: int("assignedBy"),
    assignedAt: timestamp("assignedAt").defaultNow().notNull(),
    active: boolean("active").default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdx: index("ur_user_idx").on(table.userId),
    roleIdx: index("ur_role_idx").on(table.roleId),
    scopeIdx: index("ur_scope_idx").on(table.scopeType, table.scopeId),
    activeIdx: index("ur_active_idx").on(table.active),
  })
);

export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = typeof userRoles.$inferInsert;

// ============================================================================
// ORGANIZATION MODEL
// ============================================================================

export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  shortName: varchar("shortName", { length: 50 }),
  type: mysqlEnum("type", ["national", "regional", "international", "chapter", "committee", "project", "task_force", "working_group"]).notNull(),
  parentId: int("parentId"),
  status: mysqlEnum("status", ["active", "inactive", "archived"]).default("active").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

export const organizationalUnits = mysqlTable(
  "organizational_units",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    parentId: int("parentId"),
    name: varchar("name", { length: 255 }).notNull(),
    shortCode: varchar("shortCode", { length: 20 }),
    type: mysqlEnum("type", ["chapter", "committee", "project", "task_force", "working_group", "delegation", "division", "department"]).notNull(),
    status: mysqlEnum("status", ["active", "inactive", "provisional", "suspended", "archived"]).default("active").notNull(),
    level: varchar("level", { length: 50 }),
    city: varchar("city", { length: 100 }),
    province: varchar("province", { length: 100 }),
    country: varchar("country", { length: 100 }).default("Pakistan"),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orgIdx: index("ou_org_idx").on(table.organizationId),
    parentIdx: index("ou_parent_idx").on(table.parentId),
    typeIdx: index("ou_type_idx").on(table.type),
    statusIdx: index("ou_status_idx").on(table.status),
  })
);

export type OrganizationalUnit = typeof organizationalUnits.$inferSelect;
export type InsertOrganizationalUnit = typeof organizationalUnits.$inferInsert;

export const institutions = mysqlTable("institutions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  shortName: varchar("shortName", { length: 100 }),
  type: mysqlEnum("type", ["medical_school", "university", "college", "hospital", "research_institute"]).notNull(),
  city: varchar("city", { length: 100 }),
  province: varchar("province", { length: 100 }),
  country: varchar("country", { length: 100 }).default("Pakistan"),
  website: varchar("website", { length: 500 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Institution = typeof institutions.$inferSelect;
export type InsertInstitution = typeof institutions.$inferInsert;

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export const featureFlags = mysqlTable(
  "feature_flags",
  {
    id: int("id").autoincrement().primaryKey(),
    key: varchar("key", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    enabled: boolean("enabled").default(false).notNull(),
    environment: varchar("environment", { length: 50 }),
    organizationId: int("organizationId"),
    allowedRoles: json("allowedRoles").$type<string[]>(),
    percentage: int("percentage").default(100),
    createdBy: int("createdBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    keyIdx: index("ff_key_idx").on(table.key),
    enabledIdx: index("ff_enabled_idx").on(table.enabled),
  })
);

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = typeof featureFlags.$inferInsert;

// ============================================================================
// ENHANCED AUDIT
// ============================================================================

export const auditEvents = mysqlTable(
  "audit_events",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId"),
    actorEmail: varchar("actorEmail", { length: 320 }),
    actorName: varchar("actorName", { length: 255 }),
    action: varchar("action", { length: 100 }).notNull(),
    category: varchar("category", { length: 50 }),
    entityType: varchar("entityType", { length: 50 }),
    entityId: int("entityId"),
    before: json("before"),
    after: json("after"),
    reason: text("reason"),
    ipAddress: varchar("ipAddress", { length: 45 }),
    userAgent: varchar("userAgent", { length: 500 }),
    correlationId: varchar("correlationId", { length: 64 }),
    scopeType: varchar("scopeType", { length: 50 }),
    scopeId: int("scopeId"),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("ae_user_idx").on(table.userId),
    actionIdx: index("ae_action_idx").on(table.action),
    entityIdx: index("ae_entity_idx").on(table.entityType, table.entityId),
    categoryIdx: index("ae_category_idx").on(table.category),
    correlationIdx: index("ae_correlation_idx").on(table.correlationId),
    createdIdx: index("ae_created_idx").on(table.createdAt),
  })
);

export type AuditEvent = typeof auditEvents.$inferSelect;
export type InsertAuditEvent = typeof auditEvents.$inferInsert;
