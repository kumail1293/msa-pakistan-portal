/**
 * Activities, Events, Documents, and Finance Schema Extension
 *
 * Implements:
 * - §61-70: Activities Module (planning, approval, execution, reporting, evaluation)
 * - §54-58: Document Management (storage, versioning, approval, retention)
 * - §78-82: Event Management (conferences, assemblies, check-in, certificates)
 * - §120-126: Finance Module (budgets, expenses, procurement, controls)
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
// ACTIVITIES MODULE (§61-70)
// ============================================================================

export const activities = mysqlTable("activities", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).notNull(), // workshop, seminar, community_service, campaign, training, conference, custom
  category: varchar("category", { length: 50 }), // nef, nrf, regular, special

  // Status lifecycle: draft → submitted (NEF) → under_review → approved → preparation → registration_open → in_progress → reporting (NRF) → evaluation → completed
  status: mysqlEnum("status", [
    "draft", "submitted", "under_review", "approved", "rejected",
    "preparation", "registration_open", "registration_closed", "in_progress",
    "reporting", "evaluation", "completed", "cancelled"
  ]).default("draft").notNull(),

  // Activity Levels per bylaws §16.6-16.9
  // local = 1 LC or ≤2 LC collaboration
  // national = EBTO member involved, ≥3 LCs, or national team proposal
  // regional = 2 NMOs in same region
  // international = organizations in different regions
  activityLevel: mysqlEnum("activityLevel", ["local", "national", "regional", "international"]).default("local"),

  // Standing Committee per bylaws §10.2
  standingCommittee: varchar("standingCommittee", { length: 50 }), // SCOPH, SCORA, SCOME, SCORP, SCOPE, SCORE, or null

  // Activity Coordinators — max 3 per bylaws §16.5
  coordinators: json("coordinators").$type<number[]>(), // array of user IDs

  // Timing
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  registrationDeadline: timestamp("registrationDeadline"),
  reportingDeadline: timestamp("reportingDeadline"),

  // Location
  venue: varchar("venue", { length: 500 }),
  city: varchar("city", { length: 100 }),
  mode: mysqlEnum("mode", ["in_person", "online", "hybrid"]).default("in_person"),

  // Budget — per bylaws §16.14, budget approval requires VPA + VPF + President
  budget: int("budget"), // PKR
  actualCost: int("actualCost"),
  budgetApprovedBy: int("budgetApprovedBy"), // VPF user ID
  budgetApprovedAt: timestamp("budgetApprovedAt"),
  fundingSource: varchar("fundingSource", { length: 100 }),

  // Capacity
  maxParticipants: int("maxParticipants"),
  currentParticipants: int("currentParticipants").default(0),
  waitlistEnabled: boolean("waitlistEnabled").default(false),

  // People
  organizedBy: int("organizedBy"), // user ID (local VPA who filled NEF)
  approvedBy: int("approvedBy"), // VPA who approved
  coordinatorId: int("coordinatorId"),

  // NEF tracking (§16.1-16.3)
  nefSubmittedAt: timestamp("nefSubmittedAt"), // when NEF was submitted
  nefSubmittedBy: int("nefSubmittedBy"), // local VPA who submitted
  nefApprovedAt: timestamp("nefApprovedAt"), // when VPA approved
  nefDecision: varchar("nefDecision", { length: 50 }), // accepted, rejected, revision_needed
  nefDecisionNotes: text("nefDecisionNotes"),
  nefDecisionAt: timestamp("nefDecisionAt"),
  // VPA must decide within 14 days per §11.5.15

  // NRF tracking (§16.11-16.13)
  nrfSubmittedAt: timestamp("nrfSubmittedAt"), // when NRF was submitted
  nrfSubmittedBy: int("nrfSubmittedBy"), // local VPA who submitted
  nrfApprovedAt: timestamp("nrfApprovedAt"), // when VPA approved NRF
  certificateIssued: boolean("certificateIssued").default(false), // §16.10 — only after NRF approved
  certificateIssuedAt: timestamp("certificateIssuedAt"),

  // Scoring
  impactScore: decimal("impactScore", { precision: 5, scale: 2 }),
  performanceScore: decimal("performanceScore", { precision: 5, scale: 2 }),

  // Metadata
  governanceVersion: varchar("governanceVersion", { length: 50 }),
  metadata: json("metadata"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("act_org_idx").on(table.organizationId),
  statusIdx: index("act_status_idx").on(table.status),
  typeIdx: index("act_type_idx").on(table.type),
  startIdx: index("act_start_idx").on(table.startDate),
}));

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = typeof activities.$inferInsert;

// Activity Participants
export const activityParticipants = mysqlTable("activity_participants", {
  id: int("id").autoincrement().primaryKey(),
  activityId: int("activityId").notNull(),
  userId: int("userId").notNull(),
  role: varchar("role", { length: 50 }).default("participant"), // participant, organizer, speaker, volunteer, observer
  status: mysqlEnum("status", ["registered", "confirmed", "attended", "no_show", "cancelled"]).default("registered"),
  checkedIn: boolean("checkedIn").default(false),
  checkedInAt: timestamp("checkedInAt"),
  certificateIssued: boolean("certificateIssued").default(false),
  evaluationSubmitted: boolean("evaluationSubmitted").default(false),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  activityIdx: index("ap_activity_idx").on(table.activityId),
  userIdx: index("ap_user_idx").on(table.userId),
}));

// Activity Approvals
export const activityApprovals = mysqlTable("activity_approvals", {
  id: int("id").autoincrement().primaryKey(),
  activityId: int("activityId").notNull(),
  stepNumber: int("stepNumber").notNull(),
  approverRole: varchar("approverRole", { length: 100 }),
  approverUserId: int("approverUserId"),
  decision: varchar("decision", { length: 50 }), // pending | approved | rejected | needs_revision
  decidedAt: timestamp("decidedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Activity Reports
export const activityReports = mysqlTable("activity_reports", {
  id: int("id").autoincrement().primaryKey(),
  activityId: int("activityId").notNull(),
  reportType: varchar("reportType", { length: 50 }).notNull(), // progress, final, financial, impact
  content: json("content"), // structured report data
  submittedBy: int("submittedBy"),
  submittedAt: timestamp("submittedAt"),
  status: mysqlEnum("status", ["draft", "submitted", "approved"]).default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================================================
// DOCUMENT MANAGEMENT (§54-58)
// ============================================================================

export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).notNull(), // policy, procedure, template, form, certificate, report, notice, minutes, resolution
  category: varchar("category", { length: 100 }),
  status: mysqlEnum("status", ["draft", "under_review", "approved", "published", "superseded", "archived"]).default("draft").notNull(),
  visibility: mysqlEnum("visibility", ["public", "members_only", "leadership_only", "private"]).default("members_only"),
  content: text("content"), // document body
  fileUrl: varchar("fileUrl", { length: 500 }),
  fileSize: int("fileSize"),
  mimeType: varchar("mimeType", { length: 100 }),
  version: int("version").default(1).notNull(),
  versionLabel: varchar("versionLabel", { length: 50 }), // "1.0", "2.1", etc.
  supersedesDocumentId: int("supersedesDocumentId"),
  parentFolderId: int("parentFolderId"),
  effectiveFrom: timestamp("effectiveFrom"),
  effectiveUntil: timestamp("effectiveUntil"),
  retentionDays: int("retentionDays"),
  tags: json("tags").$type<string[]>(),
  permissions: json("permissions").$type<{ view?: string[]; edit?: string[]; approve?: string[] }>(),
  createdBy: int("createdBy"),
  approvedBy: int("approvedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("doc_org_idx").on(table.organizationId),
  typeIdx: index("doc_type_idx").on(table.type),
  statusIdx: index("doc_status_idx").on(table.status),
  visIdx: index("doc_vis_idx").on(table.visibility),
}));

export type Document = typeof documents.$inferSelect;

// Document Versions
export const documentVersions = mysqlTable("document_versions", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  versionNumber: int("versionNumber").notNull(),
  content: text("content"),
  fileUrl: varchar("fileUrl", { length: 500 }),
  changeDescription: text("changeDescription"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  docIdx: index("dv_doc_idx").on(table.documentId),
  uniqueVersion: uniqueIndex("dv_unique_version").on(table.documentId, table.versionNumber),
}));

// ============================================================================
// EVENT MANAGEMENT (§78-82)
// ============================================================================

export const events = mysqlTable("events", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["conference", "nga", "sga", "oga", "presidents_session", "assembly", "meeting", "workshop", "webinar", "training", "social", "campaign", "custom"]).default("conference"),
  status: mysqlEnum("status", ["draft", "published", "registration_open", "registration_closed", "in_progress", "completed", "cancelled"]).default("draft"),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  registrationDeadline: timestamp("registrationDeadline"),
  venue: varchar("venue", { length: 500 }),
  city: varchar("city", { length: 100 }),
  onlineUrl: varchar("onlineUrl", { length: 500 }),
  mode: mysqlEnum("mode", ["in_person", "online", "hybrid"]).default("in_person"),
  // §8.1.13: Mode shift to online requires SupCo approval + 2/3 LC majority
  modeChangeApproved: boolean("modeChangeApproved").default(false),
  maxCapacity: int("maxCapacity"),
  currentRegistrations: int("currentRegistrations").default(0),
  fee: int("fee").default(0), // PKR
  certificateTemplateId: int("certificateTemplateId"),
  bannerUrl: varchar("bannerUrl", { length: 500 }),
  // §8.1.8: Quorum = 1/3 of Permanent+Temporary LCs
  quorumRequired: int("quorumRequired"), // calculated as 1/3 of Permanent+Temporary LCs
  quorumMet: boolean("quorumMet").default(false),
  // §8.1.4: NGA organized by Organizing Committee
  isNga: boolean("isNga").default(false),
  ngaoCId: int("ngaoCId"), // reference to NGA Organizing Committee
  // §8.1.12: NGA must be held in person (shift to online needs approval)
  scheduledBeforeAug20: boolean("scheduledBeforeAug20").default(false), // §6.3: Jul 20 - Aug 20 window
  metadata: json("metadata"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("evt_org_idx").on(table.organizationId),
  typeIdx: index("evt_type_idx").on(table.type),
  statusIdx: index("evt_status_idx").on(table.status),
  startIdx: index("evt_start_idx").on(table.startDate),
}));

export type Event = typeof events.$inferSelect;

// Event Sessions (tracks individual sessions within an event)
export const eventSessions = mysqlTable("event_sessions", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("eventId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime").notNull(),
  room: varchar("room", { length: 100 }),
  speakerName: varchar("speakerName", { length: 255 }),
  speakerUserId: int("speakerUserId"),
  maxCapacity: int("maxCapacity"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Event Registrations
export const eventRegistrations = mysqlTable("event_registrations", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("eventId").notNull(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "cancelled", "waitlisted"]).default("pending"),
  checkedIn: boolean("checkedIn").default(false),
  checkedInAt: timestamp("checkedInAt"),
  paymentStatus: varchar("paymentStatus", { length: 50 }),
  certificateIssued: boolean("certificateIssued").default(false),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  eventIdx: index("er_event_idx").on(table.eventId),
  userIdx: index("er_user_idx").on(table.userId),
  uniqueRegistration: uniqueIndex("er_unique").on(table.eventId, table.userId),
}));

// ============================================================================
// FINANCE MODULE (§120-126)
// ============================================================================

export const financeAccounts = mysqlTable("finance_accounts", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["income", "expense", "asset", "liability", "equity"]).notNull(),
  code: varchar("code", { length: 50 }),
  description: text("description"),
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0"),
  currency: varchar("currency", { length: 3 }).default("PKR"),
  status: mysqlEnum("status", ["active", "inactive", "archived"]).default("active"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FinanceAccount = typeof financeAccounts.$inferSelect;

// Budgets
export const financeBudgets = mysqlTable("finance_budgets", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  name: varchar("name", { length: 255 }).notNull(),
  fiscalYear: varchar("fiscalYear", { length: 20 }).notNull(), // "2025-2026"
  totalBudget: decimal("totalBudget", { precision: 15, scale: 2 }).notNull(),
  spent: decimal("spent", { precision: 15, scale: 2 }).default("0"),
  status: mysqlEnum("status", ["draft", "proposed", "approved", "active", "closed"]).default("draft"),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  supcoReviewed: boolean("supcoReviewed").default(false), // §15.2.2: draft submitted to SupCo 4 weeks before NGA
  supcoReviewAt: timestamp("supcoReviewAt"),
  ngaApproved: boolean("ngaApproved").default(false), // §15.2.4: final budget approved by NGA
  ngaApprovedAt: timestamp("ngaApprovedAt"),
  financialYearStart: timestamp("financialYearStart"), // §15.1.19: Oct 1
  financialYearEnd: timestamp("financialYearEnd"), // §15.1.19: Sep 30
  metadata: json("metadata"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Budget Line Items
export const budgetLineItems = mysqlTable("budget_line_items", {
  id: int("id").autoincrement().primaryKey(),
  budgetId: int("budgetId").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  description: varchar("description", { length: 255 }),
  allocated: decimal("allocated", { precision: 15, scale: 2 }).notNull(),
  spent: decimal("spent", { precision: 15, scale: 2 }).default("0"),
  accountId: int("accountId"),
  metadata: json("metadata"),
});

// Transactions
export const financeTransactions = mysqlTable("finance_transactions", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  type: mysqlEnum("type", ["income", "expense", "transfer", "reimbursement"]).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("PKR"),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  accountId: int("accountId"),
  budgetId: int("budgetId"),
  relatedEntityType: varchar("relatedEntityType", { length: 50 }), // activity, event, grant, etc.
  relatedEntityId: int("relatedEntityId"),
  status: mysqlEnum("status", ["draft", "pending_vpf", "pending_president", "pending_eb", "approved", "paid", "rejected", "reconciled"]).default("draft"),
  receiptUrl: varchar("receiptUrl", { length: 500 }),
  // §15.4: Transaction approval tiers
  // VPF approves ≤PKR 5,000 (§15.4.1)
  // President approves ≤PKR 15,000 (§15.4.2)
  // EB approves >PKR 15,000 with 2/3 majority (§15.4.3)
  approvalTier: varchar("approvalTier", { length: 50 }), // vpf, president, eb
  // §15.4.4: Dual signatories required (President + VPF)
  approvedBy: int("approvedBy"), // first signatory (VPF)
  approvedAt: timestamp("approvedAt"),
  secondSignatoryId: int("secondSignatoryId"), // second signatory (President)
  secondSignedAt: timestamp("secondSignedAt"),
  paidAt: timestamp("paidAt"),
  metadata: json("metadata"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("ft_org_idx").on(table.organizationId),
  typeIdx: index("ft_type_idx").on(table.type),
  statusIdx: index("ft_status_idx").on(table.status),
  budgetIdx: index("ft_budget_idx").on(table.budgetId),
}));

// Expenses / Claims
export const expenseClaims = mysqlTable("expense_claims", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  organizationId: int("organizationId"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  totalAmount: decimal("totalAmount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("PKR"),
  status: mysqlEnum("status", ["draft", "submitted", "under_review", "approved", "rejected", "paid"]).default("draft"),
  receiptUrls: json("receiptUrls").$type<string[]>(),
  category: varchar("category", { length: 100 }),
  relatedActivityId: int("relatedActivityId"),
  relatedEventId: int("relatedEventId"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  reviewNotes: text("reviewNotes"),
  paidAt: timestamp("paidAt"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("ec_user_idx").on(table.userId),
  statusIdx: index("ec_status_idx").on(table.status),
}));

// ============================================================================
// CHAPTER MANAGEMENT (§21-27)
// ============================================================================

export const chapters = mysqlTable("chapters", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  name: varchar("name", { length: 255 }).notNull(),
  shortName: varchar("shortName", { length: 50 }),
  institutionId: int("institutionId"),
  city: varchar("city", { length: 100 }),
  province: varchar("province", { length: 100 }),
  type: mysqlEnum("type", ["permanent", "temporary", "candidate", "coordinator_institute"]).default("candidate"),
  status: mysqlEnum("status", ["active", "suspended", "terminated", "pending_renewal"]).default("active"),
  recognitionDate: timestamp("recognitionDate"),
  renewalDate: timestamp("renewalDate"),
  memberCount: int("memberCount").default(0),
  financialStatus: varchar("financialStatus", { length: 50 }), // clear, outstanding, debt
  outstandingDebt: decimal("outstandingDebt", { precision: 10, scale: 2 }).default("0"),
  complianceScore: decimal("complianceScore", { precision: 5, scale: 2 }),
  lastReportDate: timestamp("lastReportDate"),
  metadata: json("metadata"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("ch_org_idx").on(table.organizationId),
  typeIdx: index("ch_type_idx").on(table.type),
  statusIdx: index("ch_status_idx").on(table.status),
}));

// Chapter Leadership
export const chapterLeadership = mysqlTable("chapter_leadership", {
  id: int("id").autoincrement().primaryKey(),
  chapterId: int("chapterId").notNull(),
  userId: int("userId").notNull(),
  position: varchar("position", { length: 100 }).notNull(), // president, vice_president, secretary, treasurer
  termStart: timestamp("termStart"),
  termEnd: timestamp("termEnd"),
  status: mysqlEnum("status", ["active", "former", "interim"]).default("active"),
  electedAt: timestamp("electedAt"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  chapterIdx: index("cl_chapter_idx").on(table.chapterId),
  userIdx: index("cl_user_idx").on(table.userId),
}));

// ============================================================================
// COMMUNICATION CENTER (§83-88)
// ============================================================================

export const announcements = mysqlTable("announcements", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  type: mysqlEnum("type", ["info", "urgent", "event", "policy", "general"]).default("general"),
  priority: mysqlEnum("priority", ["critical", "high", "medium", "low"]).default("medium"),
  targetAudience: json("targetAudience").$type<{
    roles?: string[];
    chapters?: string[];
    committees?: string[];
    allMembers?: boolean;
  }>(),
  publishAt: timestamp("publishAt"),
  expiresAt: timestamp("expiresAt"),
  status: mysqlEnum("status", ["draft", "scheduled", "published", "archived"]).default("draft"),
  readBy: json("readBy").$type<number[]>(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("ann_org_idx").on(table.organizationId),
  typeIdx: index("ann_type_idx").on(table.type),
  statusIdx: index("ann_status_idx").on(table.status),
}));

// Notification Templates
export const notificationTemplates = mysqlTable("notification_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  channel: mysqlEnum("channel", ["email", "sms", "push", "in_app"]).notNull(),
  subject: varchar("subject", { length: 500 }),
  body: text("body").notNull(),
  variables: json("variables").$type<string[]>(),
  status: mysqlEnum("status", ["active", "inactive"]).default("active"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Notification Log
export const notificationLog = mysqlTable("notification_log", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId"),
  recipientId: int("recipientId"),
  channel: mysqlEnum("channel", ["email", "sms", "push", "in_app"]).notNull(),
  subject: varchar("subject", { length: 500 }),
  body: text("body"),
  status: mysqlEnum("status", ["queued", "sent", "delivered", "failed", "bounced"]).default("queued"),
  sentAt: timestamp("sentAt"),
  deliveredAt: timestamp("deliveredAt"),
  error: text("error"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  recipientIdx: index("nl_recipient_idx").on(table.recipientId),
  statusIdx: index("nl_status_idx").on(table.status),
  channelIdx: index("nl_channel_idx").on(table.channel),
}));

// ============================================================================
// PROJECT/TASK MANAGEMENT (§75-77)
// ============================================================================

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["draft", "planning", "active", "on_hold", "completed", "cancelled"]).default("draft"),
  priority: mysqlEnum("priority", ["critical", "high", "medium", "low"]).default("medium"),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  budget: decimal("budget", { precision: 15, scale: 2 }),
  progress: int("progress").default(0), // 0-100
  ownerId: int("ownerId"),
  metadata: json("metadata"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("proj_org_idx").on(table.organizationId),
  statusIdx: index("proj_status_idx").on(table.status),
}));

// Tasks
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["todo", "in_progress", "review", "done", "cancelled"]).default("todo"),
  priority: mysqlEnum("priority", ["critical", "high", "medium", "low"]).default("medium"),
  assignedTo: int("assignedTo"),
  dueDate: timestamp("dueDate"),
  completedAt: timestamp("completedAt"),
  estimatedHours: int("estimatedHours"),
  actualHours: int("actualHours"),
  tags: json("tags").$type<string[]>(),
  metadata: json("metadata"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  projectIdx: index("task_proj_idx").on(table.projectId),
  assigneeIdx: index("task_assignee_idx").on(table.assignedTo),
  statusIdx: index("task_status_idx").on(table.status),
}));

// ============================================================================
// SEARCH INDEX (§59-60)
// ============================================================================

export const searchIndex = mysqlTable("search_index", {
  id: int("id").autoincrement().primaryKey(),
  entityType: varchar("entityType", { length: 50 }).notNull(), // member, chapter, activity, document, event, etc.
  entityId: int("entityId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: varchar("subtitle", { length: 255 }),
  content: text("content"), // searchable text
  tags: json("tags").$type<string[]>(),
  organizationId: int("organizationId"),
  visibility: varchar("visibility", { length: 50 }).default("members_only"),
  metadata: json("metadata"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  entityIdx: index("si_entity_idx").on(table.entityType, table.entityId),
  orgIdx: index("si_org_idx").on(table.organizationId),
  visIdx: index("si_vis_idx").on(table.visibility),
  fulltextIdx: index("si_fulltext_idx").on(table.title, table.content),
}));

// ============================================================================
// NEF/NRF MODULE (§71-74)
// National Executive Fund (NEF) and National Research Fund (NRF)
// ============================================================================

// NEF/NRF Cycles — defines a funding round with deadlines and categories
export const fundingCycles = mysqlTable("funding_cycles", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  name: varchar("name", { length: 255 }).notNull(),
  fundType: mysqlEnum("fund_type", ["nef", "nrf"]).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["draft", "open", "submission_closed", "under_review", "decided", "closed"]).default("draft").notNull(),
  submissionStart: timestamp("submissionStart").notNull(),
  submissionEnd: timestamp("submissionEnd").notNull(),
  reviewStart: timestamp("reviewStart"),
  reviewEnd: timestamp("reviewEnd"),
  totalBudget: decimal("totalBudget", { precision: 15, scale: 2 }),
  maxPerGrant: decimal("maxPerGrant", { precision: 15, scale: 2 }),
  categories: json("categories").$type<string[]>(),
  eligibilityCriteria: json("eligibilityCriteria"),
  scoringRubric: json("scoringRubric").$type<Array<{ criterion: string; weight: number; description: string }>>(),
  requiredDocuments: json("requiredDocuments").$type<string[]>(),
  metadata: json("metadata"),
  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("fc_org_idx").on(table.organizationId),
  fundTypeIdx: index("fc_fund_type_idx").on(table.fundType),
  statusIdx: index("fc_status_idx").on(table.status),
}));

export type FundingCycle = typeof fundingCycles.$inferSelect;

// Proposals — submitted by members/chapters for NEF or NRF funding
export const fundingProposals = mysqlTable("funding_proposals", {
  id: int("id").autoincrement().primaryKey(),
  cycleId: int("cycleId").notNull(),
  submittedById: int("submittedById").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 100 }),
  requestedAmount: decimal("requestedAmount", { precision: 15, scale: 2 }).notNull(),
  approvedAmount: decimal("approvedAmount", { precision: 15, scale: 2 }),
  status: mysqlEnum("status", [
    "draft", "submitted", "under_review", "scored", "shortlisted",
    "approved", "rejected", "funded", "in_progress", "reporting",
    "completed", "closed"
  ]).default("draft").notNull(),
  objectives: text("objectives"),
  methodology: text("methodology"),
  expectedOutcomes: text("expectedOutcomes"),
  timeline: text("timeline"),
  budget: json("budget").$type<Array<{ item: string; amount: number; justification: string }>>(),
  attachments: json("attachments").$type<string[]>(),
  scores: json("scores").$type<Array<{ reviewerId: number; criterion: string; score: number; comment: string }>>(),
  totalScore: decimal("totalScore", { precision: 5, scale: 2 }),
  chapterId: int("chapterId"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  cycleIdx: index("fp_cycle_idx").on(table.cycleId),
  submitterIdx: index("fp_submitter_idx").on(table.submittedById),
  statusIdx: index("fp_status_idx").on(table.status),
}));

export type FundingProposal = typeof fundingProposals.$inferSelect;

// Grant Disbursements — tracks funding milestones for approved proposals
export const grantDisbursements = mysqlTable("grant_disbursements", {
  id: int("id").autoincrement().primaryKey(),
  proposalId: int("proposalId").notNull(),
  milestone: varchar("milestone", { length: 255 }).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pending", "disbursed", "held", "returned"]).default("pending"),
  dueDate: timestamp("dueDate"),
  disbursedAt: timestamp("disbursedAt"),
  evidence: json("evidence").$type<string[]>(),
  notes: text("notes"),
  reviewedById: int("reviewedById"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  proposalIdx: index("gd_proposal_idx").on(table.proposalId),
  statusIdx: index("gd_status_idx").on(table.status),
}));

export type GrantDisbursement = typeof grantDisbursements.$inferSelect;

// ============================================================================
// BYLAWS ALIGNMENT TABLES
// ============================================================================

// Standing Committee Membership (§10.2)
export const standingCommitteeMembers = mysqlTable("sc_members", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  standingCommittee: varchar("standingCommittee", { length: 50 }).notNull(), // SCOPH, SCORA, SCOME, SCORP, SCOPE, SCORE
  role: varchar("role", { length: 50 }).default("member"), // member, national_officer (NPO/NORP/NORA/NOME/NORE/NEO)
  termStart: timestamp("termStart"),
  termEnd: timestamp("termEnd"),
  status: mysqlEnum("status", ["active", "former"]).default("active"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("scm_user_idx").on(table.userId),
  scIdx: index("scm_sc_idx").on(table.standingCommittee),
  uniqueMembership: uniqueIndex("scm_unique").on(table.userId, table.standingCommittee),
}));

// Event Delegates & Credentials (§8.1.14-8.1.16)
export const eventDelegates = mysqlTable("event_delegates", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("eventId").notNull(),
  userId: int("userId").notNull(),
  chapterId: int("chapterId"), // LC or CI this delegate represents
  role: varchar("role", { length: 50 }).default("delegate"), // delegate, observer, external, staff, official
  credentialFormSubmitted: boolean("credentialFormSubmitted").default(false),
  votingEligible: boolean("votingEligible").default(false), // Only Permanent+Temporary LCs (§6.4)
  lcType: varchar("lcType", { length: 50 }), // permanent, temporary, candidate, coordinator_institute
  checkedIn: boolean("checkedIn").default(false),
  checkedInAt: timestamp("checkedInAt"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  eventIdx: index("ed_event_idx").on(table.eventId),
  userIdx: index("ed_user_idx").on(table.userId),
  chapterIdx: index("ed_chapter_idx").on(table.chapterId),
}));

// Bylaw Change Proposals (§17.2)
export const bylawChangeProposals = mysqlTable("bylaw_change_proposals", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  proposedChanges: text("proposedChanges").notNull(), // the actual bylaw text changes
  submittedById: int("submittedById").notNull(),
  submittedByType: varchar("submittedByType", { length: 50 }).notNull(), // supco, ebto, two_permanent_lcs
  supportingChapterIds: json("supportingChapterIds").$type<number[]>(), // for LC submissions, need ≥2 Permanent LCs
  status: mysqlEnum("status", [
    "draft", "submitted", "under_review", "nga_pending",
    "adopted", "rejected"
  ]).default("draft").notNull(),
  targetNgaDate: timestamp("targetNgaDate"), // must be ≥3 weeks before NGA (§17.2.2)
  voteResult: varchar("voteResult", { length: 50 }), // 2/3 majority required (§17.2.6)
  adoptedAt: timestamp("adoptedAt"),
  effectiveFrom: timestamp("effectiveFrom"),
  metadata: json("metadata"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  statusIdx: index("bcp_status_idx").on(table.status),
  submitterIdx: index("bcp_submitter_idx").on(table.submittedById),
}));

// Publication Approvals (§14.2) — all publications must be approved by VPPRC
export const publicationApprovals = mysqlTable("publication_approvals", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId"),
  announcementId: int("announcementId"),
  title: varchar("title", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // publication, leaflet, pamphlet, booklet, newsletter, magazine
  submittedById: int("submittedById").notNull(),
  status: mysqlEnum("status", [
    "submitted", "under_review", "approved", "rejected"
  ]).default("submitted").notNull(),
  reviewedById: int("reviewedById"), // VPPRC
  reviewNotes: text("reviewNotes"),
  reviewedAt: timestamp("reviewedAt"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  statusIdx: index("pa_status_idx").on(table.status),
}));

// NGA Organizing Committee (§8.1.4-8.1.7)
export const ngaOrganizingCommittee = mysqlTable("nga_oc", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("eventId").notNull(), // the NGA event
  userId: int("userId").notNull(),
  role: varchar("role", { length: 100 }), // chair, logistics, finance, communications, etc.
  status: mysqlEnum("status", ["active", "former"]).default("active"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  eventIdx: index("oc_event_idx").on(table.eventId),
  userIdx: index("oc_user_idx").on(table.userId),
}));
