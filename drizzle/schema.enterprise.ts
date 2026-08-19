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

// ============================================================================
// WORKFLOW ENGINE
// ============================================================================

export const workflows = mysqlTable("workflows", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  entityType: varchar("entityType", { length: 50 }).notNull(),
  version: int("version").default(1).notNull(),
  status: mysqlEnum("status", ["draft", "active", "archived"]).default("draft").notNull(),
  config: json("config"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Workflow = typeof workflows.$inferSelect;
export type InsertWorkflow = typeof workflows.$inferInsert;

export const workflowStages = mysqlTable(
  "workflow_stages",
  {
    id: int("id").autoincrement().primaryKey(),
    workflowId: int("workflowId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    type: mysqlEnum("type", [
      "start", "form", "review", "approval", "parallel_approval",
      "conditional", "score", "assignment", "notification", "timer",
      "escalation", "webhook", "integration", "generate_document",
      "generate_certificate", "payment", "end",
    ]).notNull(),
    order: int("order").notNull(),
    config: json("config"),
    nextStageId: int("nextStageId"),
    conditions: json("conditions"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    workflowIdx: index("ws_workflow_idx").on(table.workflowId),
    orderIdx: index("ws_order_idx").on(table.workflowId, table.order),
  })
);

export type WorkflowStage = typeof workflowStages.$inferSelect;
export type InsertWorkflowStage = typeof workflowStages.$inferInsert;

export const workflowInstances = mysqlTable(
  "workflow_instances",
  {
    id: int("id").autoincrement().primaryKey(),
    workflowId: int("workflowId").notNull(),
    entityType: varchar("entityType", { length: 50 }).notNull(),
    entityId: int("entityId").notNull(),
    currentStageId: int("currentStageId"),
    status: mysqlEnum("status", [
      "running", "completed", "rejected", "cancelled", "paused",
    ]).default("running").notNull(),
    startedBy: int("startedBy"),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    workflowIdx: index("wi_workflow_idx").on(table.workflowId),
    entityIdx: index("wi_entity_idx").on(table.entityType, table.entityId),
    statusIdx: index("wi_status_idx").on(table.status),
  })
);

export type WorkflowInstance = typeof workflowInstances.$inferSelect;
export type InsertWorkflowInstance = typeof workflowInstances.$inferInsert;

export const workflowTasks = mysqlTable(
  "workflow_tasks",
  {
    id: int("id").autoincrement().primaryKey(),
    instanceId: int("instanceId").notNull(),
    stageId: int("stageId").notNull(),
    assignedTo: int("assignedTo"),
    status: mysqlEnum("status", [
      "pending", "in_progress", "completed", "rejected", "escalated", "overdue",
    ]).default("pending").notNull(),
    dueAt: timestamp("dueAt"),
    completedAt: timestamp("completedAt"),
    notes: text("notes"),
    decision: varchar("decision", { length: 100 }),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    instanceIdx: index("wt_instance_idx").on(table.instanceId),
    assignedIdx: index("wt_assigned_idx").on(table.assignedTo),
    statusIdx: index("wt_status_idx").on(table.status),
  })
);

export type WorkflowTask = typeof workflowTasks.$inferSelect;
export type InsertWorkflowTask = typeof workflowTasks.$inferInsert;

// ============================================================================
// FORMS ENGINE
// ============================================================================

export const forms = mysqlTable("forms", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  version: int("version").default(1).notNull(),
  status: mysqlEnum("status", ["draft", "active", "archived"]).default("draft").notNull(),
  usageType: varchar("usageType", { length: 50 }),
  settings: json("settings"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Form = typeof forms.$inferSelect;
export type InsertForm = typeof forms.$inferInsert;

export const formFields = mysqlTable(
  "form_fields",
  {
    id: int("id").autoincrement().primaryKey(),
    formId: int("formId").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    label: varchar("label", { length: 255 }).notNull(),
    type: mysqlEnum("type", [
      "text", "textarea", "number", "email", "phone", "date",
      "select", "multi_select", "checkbox", "radio", "file",
      "image", "signature", "divider", "heading", "paragraph",
    ]).notNull(),
    required: boolean("required").default(false),
    placeholder: varchar("placeholder", { length: 255 }),
    helpText: text("helpText"),
    defaultValue: varchar("defaultValue", { length: 500 }),
    options: json("options"),
    validation: json("validation"),
    conditions: json("conditions"),
    order: int("order").notNull(),
    group: varchar("group", { length: 100 }),
    width: varchar("width", { length: 20 }).default("full"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    formIdx: index("ff_form_idx").on(table.formId),
    orderIdx: index("ff_order_idx").on(table.formId, table.order),
  })
);

export type FormField = typeof formFields.$inferSelect;
export type InsertFormField = typeof formFields.$inferInsert;

export const formSubmissions = mysqlTable(
  "form_submissions",
  {
    id: int("id").autoincrement().primaryKey(),
    formId: int("formId").notNull(),
    submittedBy: int("submittedBy"),
    entityType: varchar("entityType", { length: 50 }),
    entityId: int("entityId"),
    data: json("data").notNull(),
    status: mysqlEnum("status", [
      "submitted", "reviewed", "approved", "rejected",
    ]).default("submitted").notNull(),
    reviewedBy: int("reviewedBy"),
    reviewedAt: timestamp("reviewedAt"),
    reviewNotes: text("reviewNotes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    formIdx: index("fs_form_idx").on(table.formId),
    submittedIdx: index("fs_submitted_idx").on(table.submittedBy),
    entityIdx: index("fs_entity_idx").on(table.entityType, table.entityId),
    statusIdx: index("fs_status_idx").on(table.status),
  })
);

export type FormSubmission = typeof formSubmissions.$inferSelect;
export type InsertFormSubmission = typeof formSubmissions.$inferInsert;
