/**
 * Membership Lifecycle, Privacy, Institutions, and API Platform Schema
 *
 * Implements:
 * - §7: Academic/Institution Directory
 * - §9: Membership Lifecycle
 * - §12: Member Onboarding
 * - §19: Privacy Controls
 * - §20: Consent Management
 * - §60: Saved Filters/Custom Views
 * - §135: API Platform
 * - §137: External Integrations
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
  index,
} from "drizzle-orm/mysql-core";

// ============================================================================
// ACADEMIC / INSTITUTION DIRECTORY (§7)
// ============================================================================

export const institutions = mysqlTable("institutions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  shortCode: varchar("shortCode", { length: 20 }).unique(),
  type: mysqlEnum("type", ["medical_college", "university", "college", "nursing_school", "allied_health", "other"]).default("medical_college"),
  city: varchar("city", { length: 100 }),
  province: varchar("province", { length: 100 }),
  country: varchar("country", { length: 100 }).default("Pakistan"),
  website: varchar("website", { length: 500 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 20 }),
  address: text("address"),
  logoUrl: varchar("logoUrl", { length: 500 }),
  status: mysqlEnum("status", ["active", "inactive", "pending_recognition"]).default("active"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  nameIdx: index("inst_name_idx").on(table.name),
  cityIdx: index("inst_city_idx").on(table.city),
}));

export type Institution = typeof institutions.$inferSelect;

// ============================================================================
// MEMBERSHIP LIFECYCLE (§9)
// ============================================================================

export const membershipApplications = mysqlTable("membership_applications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  institutionId: int("institutionId"),
  localCouncilId: int("localCouncilId"),
  status: mysqlEnum("status", [
    "draft", "submitted", "under_review", "documents_pending",
    "verified", "approved", "activated", "rejected", "withdrawn", "expired"
  ]).default("draft"),
  applicantName: varchar("applicantName", { length: 255 }),
  applicantEmail: varchar("applicantEmail", { length: 320 }),
  degree: varchar("degree", { length: 100 }),
  graduationYear: int("graduationYear"),
  discipline: varchar("discipline", { length: 100 }),
  studentId: varchar("studentId", { length: 50 }),
  documents: json("documents").$type<Array<{ type: string; url: string; name: string }>>(),
  reviewNotes: text("reviewNotes"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  decisionAt: timestamp("decisionAt"),
  rejectionReason: text("rejectionReason"),
  membershipType: varchar("membershipType", { length: 50 }), // ordinary, associate, honorary, alumni
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("ma_user_idx").on(table.userId),
  statusIdx: index("ma_status_idx").on(table.status),
}));

export type MembershipApplication = typeof membershipApplications.$inferSelect;

// ============================================================================
// MEMBER ONBOARDING (§12)
// ============================================================================

export const onboardingTasks = mysqlTable("onboarding_tasks", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }), // orientation, training, acknowledgment, document, profile
  required: boolean("required").default(true),
  order: int("order").default(0),
  membershipType: varchar("membershipType", { length: 50 }),
  status: mysqlEnum("status", ["active", "inactive"]).default("active"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const memberOnboardingProgress = mysqlTable("member_onboarding_progress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  taskId: int("taskId").notNull(),
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "skipped"]).default("pending"),
  completedAt: timestamp("completedAt"),
  notes: text("notes"),
  verifiedBy: int("verifiedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("mop_user_idx").on(table.userId),
}));

// ============================================================================
// PRIVACY CONTROLS (§19)
// ============================================================================

export const privacySettings = mysqlTable("privacy_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  profileVisibility: mysqlEnum("profileVisibility", ["public", "members_only", "leadership_only", "private"]).default("members_only"),
  showEmail: boolean("showEmail").default(false),
  showPhone: boolean("showPhone").default(false),
  showInstitution: boolean("showInstitution").default(true),
  showChapter: boolean("showChapter").default(true),
  showActivityHistory: boolean("showActivityHistory").default(true),
  showSkills: boolean("showSkills").default(true),
  allowDirectorySearch: boolean("allowDirectorySearch").default(true),
  allowContactFromMembers: boolean("allowContactFromMembers").default(true),
  allowContactFromLeadership: boolean("allowContactFromLeadership").default(true),
  showInPublicVerification: boolean("showInPublicVerification").default(true),
  dataRetentionConsent: boolean("dataRetentionConsent").default(true),
  marketingConsent: boolean("marketingConsent").default(false),
  analyticsConsent: boolean("analyticsConsent").default(false),
  customSettings: json("customSettings"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("ps_user_idx").on(table.userId),
}));

// ============================================================================
// CONSENT MANAGEMENT (§20)
// ============================================================================

export const consentRecords = mysqlTable("consent_records", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  consentType: varchar("consentType", { length: 100 }).notNull(), // data_processing, marketing, analytics, cookies, third_party_sharing, photography
  granted: boolean("granted").notNull(),
  version: varchar("version", { length: 20 }), // policy version at time of consent
  policyUrl: varchar("policyUrl", { length: 500 }),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: varchar("userAgent", { length: 500 }),
  revokedAt: timestamp("revokedAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("cr_user_idx").on(table.userId),
  typeIdx: index("cr_type_idx").on(table.consentType),
}));

// ============================================================================
// SAVED FILTERS / CUSTOM VIEWS (§60)
// ============================================================================

export const savedFilters = mysqlTable("saved_filters", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 50 }).notNull(), // members, activities, events, finances, governance
  filters: json("filters").$type<Record<string, any>>().notNull(),
  columns: json("columns").$type<string[]>(),
  sortBy: varchar("sortBy", { length: 100 }),
  sortOrder: mysqlEnum("sortOrder", ["asc", "desc"]).default("asc"),
  isDefault: boolean("isDefault").default(false),
  isShared: boolean("isShared").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("sf_user_idx").on(table.userId),
}));

// ============================================================================
// API PLATFORM (§135)
// ============================================================================

export const apiKeys = mysqlTable("api_keys", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  keyHash: varchar("keyHash", { length: 255 }).notNull().unique(),
  keyPrefix: varchar("keyPrefix", { length: 20 }).notNull(), // first 8 chars for display
  userId: int("userId").notNull(),
  permissions: json("permissions").$type<string[]>(),
  rateLimit: int("rateLimit").default(1000), // requests per hour
  status: mysqlEnum("status", ["active", "revoked", "expired"]).default("active"),
  expiresAt: timestamp("expiresAt"),
  lastUsedAt: timestamp("lastUsedAt"),
  usageCount: int("usageCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("ak_user_idx").on(table.userId),
}));

export const apiUsageLogs = mysqlTable("api_usage_logs", {
  id: int("id").autoincrement().primaryKey(),
  apiKeyId: int("apiKeyId").notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  path: varchar("path", { length: 500 }).notNull(),
  statusCode: int("statusCode"),
  responseTime: int("responseTime"), // ms
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  keyIdx: index("aul_key_idx").on(table.apiKeyId),
}));

// ============================================================================
// EXTERNAL INTEGRATIONS (§137)
// ============================================================================

export const integrations = mysqlTable("integrations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // email, sms, payment, storage, analytics, auth
  provider: varchar("provider", { length: 100 }),
  status: mysqlEnum("status", ["active", "inactive", "error", "pending_config"]).default("pending_config"),
  config: json("config").$type<Record<string, any>>(),
  credentials: json("credentials").$type<Record<string, any>>(),
  webhookUrl: varchar("webhookUrl", { length: 500 }),
  lastSyncAt: timestamp("lastSyncAt"),
  errorLog: text("errorLog"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  typeIdx: index("int_type_idx").on(table.type),
}));
