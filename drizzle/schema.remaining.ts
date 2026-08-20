/**
 * Remaining Modules Schema
 *
 * Implements:
 * - §33: Impersonation with Audit
 * - §35: MFA (TOTP, recovery codes)
 * - §116: Conflict and Disciplinary Management
 * - §117: Safeguarding
 * - §118: Feedback and Complaints
 * - §119: Helpdesk/Ticketing
 * - §125: Inventory and Assets
 * - §126: Travel Management
 * - §140: Internationalization
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
// MFA (§35)
// ============================================================================

export const mfaSettings = mysqlTable("mfa_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  totpEnabled: boolean("totpEnabled").default(false),
  totpSecret: varchar("totpSecret", { length: 255 }),
  totpVerifiedAt: timestamp("totpVerifiedAt"),
  recoveryCodes: json("recoveryCodes").$type<string[]>(),
  recoveryCodesUsed: json("recoveryCodesUsed").$type<string[]>(),
  backupEmail: varchar("backupEmail", { length: 320 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("mfa_user_idx").on(table.userId),
}));

export type MfaSettings = typeof mfaSettings.$inferSelect;

// MFA Verification Log
export const mfaVerifications = mysqlTable("mfa_verifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  method: varchar("method", { length: 50 }).notNull(), // totp, recovery_code, backup_email
  success: boolean("success").notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: varchar("userAgent", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("mfa_ver_user_idx").on(table.userId),
}));

// ============================================================================
// IMPERSONATION (§33)
// ============================================================================

export const impersonationSessions = mysqlTable("impersonation_sessions", {
  id: int("id").autoincrement().primaryKey(),
  administratorId: int("administratorId").notNull(),
  targetUserId: int("targetUserId").notNull(),
  reason: text("reason").notNull(),
  status: mysqlEnum("status", ["active", "ended"]).default("active"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: varchar("userAgent", { length: 500 }),
  actionsPerformed: json("actionsPerformed").$type<Array<{
    action: string;
    entityType: string;
    entityId?: number;
    timestamp: string;
  }>>(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  adminIdx: index("imp_admin_idx").on(table.administratorId),
  targetIdx: index("imp_target_idx").on(table.targetUserId),
  statusIdx: index("imp_status_idx").on(table.status),
}));

export type ImpersonationSession = typeof impersonationSessions.$inferSelect;

// ============================================================================
// CONFLICT & DISCIPLINARY (§116)
// ============================================================================

export const disciplinaryCases = mysqlTable("disciplinary_cases", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  caseNumber: varchar("caseNumber", { length: 50 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["complaint", "incident", "violation", "misconduct", "conflict_of_interest"]).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("medium"),
  status: mysqlEnum("status", ["open", "under_investigation", "hearing_scheduled", "hearing_completed", "decision_pending", "resolved", "appealed", "closed"]).default("open"),

  // Complainant
  complainantId: int("complainantId"),
  complainantName: varchar("complainantName", { length: 255 }),
  complainantEmail: varchar("complainantEmail", { length: 320 }),

  // Respondent (person accused)
  respondentId: int("respondentId"),
  respondentName: varchar("respondentName", { length: 255 }),

  // Investigation
  investigatorId: int("investigatorId"),
  investigationNotes: text("investigationNotes"),
  investigationStartedAt: timestamp("investigationStartedAt"),
  investigationCompletedAt: timestamp("investigationCompletedAt"),

  // Hearing
  hearingDate: timestamp("hearingDate"),
  hearingPanel: json("hearingPanel").$type<number[]>(),
  hearingNotes: text("hearingNotes"),

  // Decision
  decision: varchar("decision", { length: 255 }),
  decisionNotes: text("decisionNotes"),
  sanctions: json("sanctions").$type<Array<{
    type: string; // warning, suspension, expulsion, reprimand, community_service
    duration?: string;
    description: string;
  }>>(),
  decidedBy: int("decidedBy"),
  decidedAt: timestamp("decidedAt"),

  // Appeal
  appealDeadline: timestamp("appealDeadline"),
  appealStatus: varchar("appealStatus", { length: 50 }),

  // Evidence
  evidence: json("evidence").$type<Array<{
    label: string;
    url: string;
    uploadedBy: number;
    uploadedAt: string;
  }>>(),

  confidentialityLevel: varchar("confidentialityLevel", { length: 50 }).default("confidential"),
  metadata: json("metadata"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("dc_org_idx").on(table.organizationId),
  statusIdx: index("dc_status_idx").on(table.status),
  respondentIdx: index("dc_respondent_idx").on(table.respondentId),
}));

export type DisciplinaryCase = typeof disciplinaryCases.$inferSelect;

// ============================================================================
// SAFEGUARDING (§117)
// ============================================================================

export const safeguardingIncidents = mysqlTable("safeguarding_incidents", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  incidentNumber: varchar("incidentNumber", { length: 50 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", [
    "child_protection", "vulnerable_adult", "abuse", "harassment",
    "bullying", "discrimination", "safeguarding_concern", "other"
  ]).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("medium"),
  status: mysqlEnum("status", ["reported", "acknowledged", "investigating", "escalated", "resolved", "closed"]).default("reported"),

  // Reporter
  reporterId: int("reporterId"),
  reporterName: varchar("reporterName", { length: 255 }),
  reporterRole: varchar("reporterRole", { length: 100 }),
  isAnonymous: boolean("isAnonymous").default(false),

  // Affected person
  affectedPersonId: int("affectedPersonId"),
  affectedPersonName: varchar("affectedPersonName", { length: 255 }),

  // Designated officer
  designatedOfficerId: int("designatedOfficerId"),
  assignedAt: timestamp("assignedAt"),

  // Investigation
  investigationNotes: text("investigationNotes"),
  externalReported: boolean("externalReported").default(false),
  externalAgency: varchar("externalAgency", { length: 255 }),
  externalReportDate: timestamp("externalReportDate"),

  // Resolution
  resolution: text("resolution"),
  actionsTaken: json("actionsTaken").$type<Array<{
    action: string;
    responsiblePerson: number;
    deadline: string;
    completed: boolean;
    completedAt?: string;
  }>>(),

  // Restrictions
  accessRestrictions: json("accessRestrictions").$type<{
    roles: string[];
    specificUsers: number[];
  }>(),

  metadata: json("metadata"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("si_org_idx").on(table.organizationId),
  statusIdx: index("si_status_idx").on(table.status),
  categoryIdx: index("si_category_idx").on(table.category),
}));

export type SafeguardingIncident = typeof safeguardingIncidents.$inferSelect;

// ============================================================================
// FEEDBACK & COMPLAINTS (§118)
// ============================================================================

export const feedbackItems = mysqlTable("feedback_items", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  type: mysqlEnum("type", ["feedback", "complaint", "suggestion", "service_request", "compliment"]).notNull(),
  category: varchar("category", { length: 100 }),
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description").notNull(),
  status: mysqlEnum("status", ["submitted", "acknowledged", "in_progress", "resolved", "closed", "escalated"]).default("submitted"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium"),

  // Submitter
  submitterId: int("submitterId"),
  isAnonymous: boolean("isAnonymous").default(false),

  // Assignment
  assignedTo: int("assignedTo"),
  assignedAt: timestamp("assignedAt"),

  // Response
  response: text("response"),
  respondedBy: int("respondedBy"),
  respondedAt: timestamp("respondedAt"),

  // Satisfaction
  satisfactionRating: int("satisfactionRating"), // 1-5
  satisfactionComment: text("satisfactionComment"),

  // Escalation
  escalatedTo: int("escalatedTo"),
  escalationReason: text("escalationReason"),

  attachments: json("attachments").$type<Array<{ label: string; url: string }>>(),
  tags: json("tags").$type<string[]>(),
  metadata: json("metadata"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("fb_org_idx").on(table.organizationId),
  typeIdx: index("fb_type_idx").on(table.type),
  statusIdx: index("fb_status_idx").on(table.status),
  priorityIdx: index("fb_priority_idx").on(table.priority),
}));

export type FeedbackItem = typeof feedbackItems.$inferSelect;

// ============================================================================
// HELPDESK / TICKETING (§119)
// ============================================================================

export const tickets = mysqlTable("tickets", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  ticketNumber: varchar("ticketNumber", { length: 50 }).notNull().unique(),
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium"),
  status: mysqlEnum("status", ["open", "in_progress", "waiting_customer", "waiting_internal", "resolved", "closed"]).default("open"),

  // Requester
  requesterId: int("requesterId"),

  // Assignment
  assignedTo: int("assignedTo"),
  assignedGroup: varchar("assignedGroup", { length: 100 }),

  // SLA
  slaResponseDeadline: timestamp("slaResponseDeadline"),
  slaResolutionDeadline: timestamp("slaResolutionDeadline"),
  firstResponseAt: timestamp("firstResponseAt"),
  resolvedAt: timestamp("resolvedAt"),

  // Resolution
  resolution: text("resolution"),
  rootCause: varchar("rootCause", { length: 255 }),

  // Satisfaction
  satisfactionRating: int("satisfactionRating"), // 1-5

  // Related
  relatedEntityType: varchar("relatedEntityType", { length: 50 }),
  relatedEntityId: int("relatedEntityId"),
  parentTicketId: int("parentTicketId"),

  tags: json("tags").$type<string[]>(),
  metadata: json("metadata"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("tk_org_idx").on(table.organizationId),
  statusIdx: index("tk_status_idx").on(table.status),
  priorityIdx: index("tk_priority_idx").on(table.priority),
  assigneeIdx: index("tk_assignee_idx").on(table.assignedTo),
}));

export type Ticket = typeof tickets.$inferSelect;

// Ticket Comments
export const ticketComments = mysqlTable("ticket_comments", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticketId").notNull(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  isInternal: boolean("isInternal").default(false), // internal notes not visible to customer
  attachments: json("attachments").$type<Array<{ label: string; url: string }>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  ticketIdx: index("tc_ticket_idx").on(table.ticketId),
}));

// ============================================================================
// INVENTORY & ASSETS (§125)
// ============================================================================

export const inventoryItems = mysqlTable("inventory_items", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  type: mysqlEnum("type", ["equipment", "badge", "device", "event_asset", "furniture", "vehicle", "other"]).default("equipment"),
  status: mysqlEnum("status", ["available", "in_use", "maintenance", "lost", "disposed", "reserved"]).default("available"),
  condition: mysqlEnum("condition", ["new", "good", "fair", "poor", "damaged"]).default("new"),

  // Identification
  serialNumber: varchar("serialNumber", { length: 100 }),
  assetTag: varchar("assetTag", { length: 50 }),
  barcode: varchar("barcode", { length: 100 }),

  // Financial
  purchasePrice: decimal("purchasePrice", { precision: 10, scale: 2 }),
  currentValue: decimal("currentValue", { precision: 10, scale: 2 }),
  purchaseDate: timestamp("purchaseDate"),
  warrantyExpiry: timestamp("warrantyExpiry"),

  // Location
  location: varchar("location", { length: 255 }),
  building: varchar("building", { length: 100 }),
  room: varchar("room", { length: 50 }),

  // Assignment
  assignedTo: int("assignedTo"),
  assignedToName: varchar("assignedToName", { length: 255 }),
  assignedAt: timestamp("assignedAt"),
  expectedReturnDate: timestamp("expectedReturnDate"),

  // Maintenance
  lastMaintenanceDate: timestamp("lastMaintenanceDate"),
  nextMaintenanceDate: timestamp("nextMaintenanceDate"),
  maintenanceNotes: text("maintenanceNotes"),

  metadata: json("metadata"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("inv_org_idx").on(table.organizationId),
  statusIdx: index("inv_status_idx").on(table.status),
  categoryIdx: index("inv_category_idx").on(table.category),
}));

export type InventoryItem = typeof inventoryItems.$inferSelect;

// Inventory Transactions
export const inventoryTransactions = mysqlTable("inventory_transactions", {
  id: int("id").autoincrement().primaryKey(),
  itemId: int("itemId").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // checkout, return, transfer, dispose, maintenance, adjustment
  fromUserId: int("fromUserId"),
  toUserId: int("toUserId"),
  fromLocation: varchar("fromLocation", { length: 255 }),
  toLocation: varchar("toLocation", { length: 255 }),
  notes: text("notes"),
  performedBy: int("performedBy"),
  performedAt: timestamp("performedAt").defaultNow().notNull(),
}, (table) => ({
  itemIdx: index("it_item_idx").on(table.itemId),
}));

// ============================================================================
// TRAVEL MANAGEMENT (§126)
// ============================================================================

export const travelRequests = mysqlTable("travel_requests", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  requesterId: int("requesterId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  purpose: text("purpose"),
  status: mysqlEnum("status", ["draft", "submitted", "approved", "booking", "in_progress", "completed", "reimbursed", "rejected", "cancelled"]).default("draft"),

  // Trip details
  destination: varchar("destination", { length: 255 }),
  departureDate: timestamp("departureDate"),
  returnDate: timestamp("returnDate"),
  travelMode: varchar("travelMode", { length: 50 }), // flight, train, bus, car, other
  accommodationRequired: boolean("accommodationRequired").default(false),

  // Financial
  estimatedCost: decimal("estimatedCost", { precision: 10, scale: 2 }),
  approvedBudget: decimal("approvedBudget", { precision: 10, scale: 2 }),
  actualCost: decimal("actualCost", { precision: 10, scale: 2 }),
  advanceAmount: decimal("advanceAmount", { precision: 10, scale: 2 }),

  // Approval
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  approvalNotes: text("approvalNotes"),

  // Related event/activity
  relatedEventType: varchar("relatedEventType", { length: 50 }),
  relatedEventId: int("relatedEventId"),

  // Documents
  itinerary: json("itinerary").$type<Array<{
    date: string;
    activity: string;
    location: string;
  }>>(),
  documents: json("documents").$type<Array<{ label: string; url: string }>>(),

  // Reimbursement
  reimbursementStatus: varchar("reimbursementStatus", { length: 50 }),
  reimbursementAmount: decimal("reimbursementAmount", { precision: 10, scale: 2 }),
  reimbursementDate: timestamp("reimbursementDate"),
  receiptUrls: json("receiptUrls").$type<string[]>(),

  metadata: json("metadata"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("tr_org_idx").on(table.organizationId),
  requesterIdx: index("tr_requester_idx").on(table.requesterId),
  statusIdx: index("tr_status_idx").on(table.status),
}));

export type TravelRequest = typeof travelRequests.$inferSelect;

// ============================================================================
// I18N (§140)
// ============================================================================

export const translations = mysqlTable("translations", {
  id: int("id").autoincrement().primaryKey(),
  locale: varchar("locale", { length: 10 }).notNull(), // en, ur, ar
  namespace: varchar("namespace", { length: 100 }).notNull(), // common, governance, membership, etc.
  key: varchar("key", { length: 255 }).notNull(),
  value: text("value").notNull(),
  context: text("context"), // translator notes
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  uniqueTranslation: uniqueIndex("tr_unique").on(table.locale, table.namespace, table.key),
  localeIdx: index("tr_locale_idx").on(table.locale),
  namespaceIdx: index("tr_namespace_idx").on(table.namespace),
}));

export type Translation = typeof translations.$inferSelect;
