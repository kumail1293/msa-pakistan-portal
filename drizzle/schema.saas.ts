/**
 * SaaS Multi-Tenant Schema
 *
 * Enables other organizations to subscribe to and use the portal.
 * WordPress-like model: organizations sign up, configure, and go live.
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
// ORGANIZATIONS (tenants)
// ============================================================================

export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  domain: varchar("domain", { length: 255 }),
  logoUrl: varchar("logoUrl", { length: 500 }),
  faviconUrl: varchar("faviconUrl", { length: 500 }),
  primaryColor: varchar("primaryColor", { length: 20 }).default("#138A73"),
  secondaryColor: varchar("secondaryColor", { length: 20 }).default("#1B355E"),
  tagline: varchar("tagline", { length: 255 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 20 }),
  website: varchar("website", { length: 500 }),
  country: varchar("country", { length: 100 }),
  timezone: varchar("timezone", { length: 50 }).default("Asia/Karachi"),
  planId: int("planId"),
  status: mysqlEnum("status", ["trialing", "active", "past_due", "suspended", "cancelled", "deactivated"]).default("trialing"),
  trialEndsAt: timestamp("trialEndsAt"),
  subscriptionId: varchar("subscriptionId", { length: 255 }),
  settings: json("settings").$type<Record<string, any>>(),
  enabledModules: json("enabledModules").$type<string[]>().default(["members", "governance", "events", "documents"]),
  memberCount: int("memberCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  slugIdx: index("org_slug_idx").on(table.slug),
  statusIdx: index("org_status_idx").on(table.status),
}));

export type Organization = typeof organizations.$inferSelect;

// ============================================================================
// SUBSCRIPTION PLANS
// ============================================================================

export const subscriptionPlans = mysqlTable("subscription_plans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  description: text("description"),
  priceMonthly: decimal("priceMonthly", { precision: 10, scale: 2 }).notNull(),
  priceYearly: decimal("priceYearly", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 5 }).default("PKR"),
  maxMembers: int("maxMembers").default(100),
  maxStorage: int("maxStorage").default(1024), // MB
  maxApiCalls: int("maxApiCalls").default(10000),
  features: json("features").$type<string[]>(),
  modules: json("modules").$type<string[]>().default(["members", "governance"]),
  isPopular: boolean("isPopular").default(false),
  sortOrder: int("sortOrder").default(0),
  status: mysqlEnum("status", ["active", "inactive", "archived"]).default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  slugIdx: index("plan_slug_idx").on(table.slug),
}));

// ============================================================================
// BILLING / INVOICES
// ============================================================================

export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  invoiceNumber: varchar("invoiceNumber", { length: 50 }).notNull().unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 5 }).default("PKR"),
  status: mysqlEnum("status", ["draft", "sent", "paid", "overdue", "cancelled"]).default("draft"),
  description: varchar("description", { length: 255 }),
  periodStart: timestamp("periodStart"),
  periodEnd: timestamp("periodEnd"),
  paidAt: timestamp("paidAt"),
  dueDate: timestamp("dueDate"),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  paymentReference: varchar("paymentReference", { length: 255 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orgIdx: index("inv_org_idx").on(table.organizationId),
}));

// ============================================================================
// ONBOARDING WIZARD
// ============================================================================

export const onboardingSteps = mysqlTable("onboarding_steps", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  step: varchar("step", { length: 50 }).notNull(), // organization_info, branding, modules, invite_admins, configure_governance, launch
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "skipped"]).default("pending"),
  data: json("data").$type<Record<string, any>>(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orgIdx: index("os_org_idx").on(table.organizationId),
  uniqueStep: uniqueIndex("os_unique_step").on(table.organizationId, table.step),
}));

// ============================================================================
// ORGANIZATION ADMINS
// ============================================================================

export const organizationAdmins = mysqlTable("organization_admins", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "admin", "billing_admin", "technical_admin"]).default("admin"),
  status: mysqlEnum("status", ["active", "inactive", "pending"]).default("active"),
  invitedAt: timestamp("invitedAt").defaultNow().notNull(),
  acceptedAt: timestamp("acceptedAt"),
}, (table) => ({
  orgIdx: index("oa_org_idx").on(table.organizationId),
  userIdx: index("oa_user_idx").on(table.userId),
}));

// ============================================================================
// USAGE METRICS
// ============================================================================

export const usageMetrics = mysqlTable("usage_metrics", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  period: varchar("period", { length: 7 }).notNull(), // YYYY-MM
  activeMembers: int("activeMembers").default(0),
  totalMembers: int("totalMembers").default(0),
  storageUsed: int("storageUsed").default(0), // MB
  apiCalls: int("apiCalls").default(0),
  documentsCreated: int("documentsCreated").default(0),
  eventsCreated: int("eventsCreated").default(0),
  activitiesCreated: int("activitiesCreated").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orgPeriod: uniqueIndex("um_org_period").on(table.organizationId, table.period),
}));
