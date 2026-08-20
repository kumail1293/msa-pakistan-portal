/**
 * NGA/SGA Schema Extension
 * Adds National General Assembly, Special General Assembly,
 * Credential Committee, and Voting Rights tables.
 *
 * These are the meeting governance engines that sit on top of
 * the governance rules engine.
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
// NATIONAL GENERAL ASSEMBLY (NGA)
// ============================================================================

export const ngaMeetings = mysqlTable("nga_meetings", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  
  // Basic info
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  edition: varchar("edition", { length: 50 }), // "2nd NGA", "3rd NGA"
  
  // Status lifecycle
  status: mysqlEnum("status", [
    "planning", "organizing_committee", "call_for_participation",
    "registration", "credentialing", "preparation", "opening",
    "plenary", "committees", "elections", "reports",
    "bylaw_changes", "closing", "certification", "archive"
  ]).default("planning").notNull(),
  
  // Mode
  mode: mysqlEnum("mode", ["in_person", "online", "hybrid"]).default("in_person").notNull(),
  
  // Timing
  scheduledStart: timestamp("scheduledStart").notNull(),
  scheduledEnd: timestamp("scheduledEnd").notNull(),
  actualStart: timestamp("actualStart"),
  actualEnd: timestamp("actualEnd"),
  
  // Location
  venue: varchar("venue", { length: 500 }),
  city: varchar("city", { length: 100 }),
  onlineUrl: varchar("onlineUrl", { length: 500 }),
  
  // Quorum (from governance rules)
  quorumRequired: int("quorumRequired"), // calculated from rules
  quorumMet: boolean("quorumMet").default(false),
  
  // Organizing Committee
  organizingCommitteeId: int("organizingCommitteeId"),
  
  // Plenary Team
  plenaryTeamId: int("plenaryTeamId"),
  
  // Governance version used for this meeting
  governanceVersion: varchar("governanceVersion", { length: 50 }),
  
  // Financial
  participationFee: int("participationFee"), // in PKR
  budgetApproved: boolean("budgetApproved").default(false),
  
  // Metadata
  createdById: int("createdById"),
  metadata: json("metadata"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  statusIdx: index("nga_status_idx").on(table.status),
  scheduledIdx: index("nga_scheduled_idx").on(table.scheduledStart),
}));

export type NgaMeeting = typeof ngaMeetings.$inferSelect;
export type InsertNgaMeeting = typeof ngaMeetings.$inferInsert;

// ============================================================================
// NGA DELEGATIONS
// ============================================================================

export const ngaDelegations = mysqlTable("nga_delegations", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull(),
  
  // Organization
  organizationId: int("organizationId").notNull(),
  organizationType: varchar("organizationType", { length: 50 }).notNull(), // "permanent_lc", "temporary_lc", "candidate_lc", "ci"
  organizationName: varchar("organizationName", { length: 255 }).notNull(),
  
  // Head of Delegation
  headOfDelegationId: int("headOfDelegationId"),
  
  // Delegate count
  delegateCount: int("delegateCount").default(0),
  maxDelegates: int("maxDelegates").default(10),
  
  // Voting rights (calculated from governance rules)
  plenaryVotes: int("plenaryVotes").default(0),
  electionVotes: int("electionVotes").default(0),
  
  // Status
  status: mysqlEnum("status", [
    "registered", "credentialed", "active", "suspended", "withdrawn"
  ]).default("registered").notNull(),
  
  // Financial
  hasOutstandingDebt: boolean("hasOutstandingDebt").default(false),
  debtAmount: int("debtAmount").default(0),
  feePaid: boolean("feePaid").default(false),
  
  // Credential
  credentialFormSubmitted: boolean("credentialFormSubmitted").default(false),
  credentialFormSubmittedAt: timestamp("credentialFormSubmittedAt"),
  credentialStatus: mysqlEnum("credentialStatus", [
    "pending", "submitted", "approved", "rejected", "overridden"
  ]).default("pending"),
  
  // Metadata
  metadata: json("metadata"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  meetingIdx: index("nd_meeting_idx").on(table.meetingId),
  orgIdx: index("nd_org_idx").on(table.organizationId),
  statusIdx: index("nd_status_idx").on(table.status),
}));

export type NgaDelegation = typeof ngaDelegations.$inferSelect;
export type InsertNgaDelegation = typeof ngaDelegations.$inferInsert;

// ============================================================================
// NGA DELEGATES
// ============================================================================

export const ngaDelegates = mysqlTable("nga_delegates", {
  id: int("id").autoincrement().primaryKey(),
  delegationId: int("delegationId").notNull(),
  meetingId: int("meetingId").notNull(),
  
  // Member
  userId: int("userId").notNull(),
  
  // Role in delegation
  role: mysqlEnum("role", [
    "head", "delegate", "observer", "staff", "faculty"
  ]).default("delegate").notNull(),
  
  // Voting
  isVoter: boolean("isVoter").default(false),
  votingCardIssued: boolean("votingCardIssued").default(false),
  votingCardReturned: boolean("votingCardReturned").default(false),
  
  // Registration
  registeredAt: timestamp("registeredAt").defaultNow().notNull(),
  checkedIn: boolean("checkedIn").default(false),
  checkedInAt: timestamp("checkedInAt"),
  
  // Metadata
  metadata: json("metadata"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  delegationIdx: index("ndelegation_idx").on(table.delegationId),
  meetingIdx: index("ndelegate_meeting_idx").on(table.meetingId),
  userIdx: index("ndelegate_user_idx").on(table.userId),
}));

export type NgaDelegate = typeof ngaDelegates.$inferSelect;
export type InsertNgaDelegate = typeof ngaDelegates.$inferInsert;

// ============================================================================
// NGA AGENDA
// ============================================================================

export const ngaAgenda = mysqlTable("nga_agenda", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull(),
  
  // Content
  order: int("order").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", [
    "opening", "plenary", "standing_committee", "workshop",
    "election", "bylaw_changes", "reports", "closing", "other"
  ]).notNull(),
  
  // Locking (B-17.2.3, B-17.2.8: bylaw changes agenda cannot be reopened)
  isLocked: boolean("isLocked").default(false),
  lockedBy: int("lockedBy"),
  lockedAt: timestamp("lockedAt"),
  
  // Time
  scheduledStart: timestamp("scheduledStart"),
  scheduledEnd: timestamp("scheduledEnd"),
  timeAllotted: int("timeAllotted"), // seconds
  
  // Status
  status: mysqlEnum("status", [
    "proposed", "approved", "in_progress", "completed", "skipped"
  ]).default("proposed"),
  
  // Metadata
  metadata: json("metadata"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  meetingIdx: index("nga_agenda_meeting_idx").on(table.meetingId),
  orderIdx: index("nga_agenda_order_idx").on(table.meetingId, table.order),
}));

export type NgaAgendaItem = typeof ngaAgenda.$inferSelect;
export type InsertNgaAgendaItem = typeof ngaAgenda.$inferInsert;

// ============================================================================
// CONSTITUTION CREDENTIAL COMMITTEE (CCC)
// ============================================================================

export const cccMembers = mysqlTable("ccc_members", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull(),
  userId: int("userId").notNull(),
  
  // Role
  role: mysqlEnum("role", ["chair", "member", "observer"]).default("member"),
  
  // Appointment
  appointedAt: timestamp("appointedAt").defaultNow().notNull(),
  appointedBy: varchar("appointedBy", { length: 255 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  meetingIdx: index("ccc_meeting_idx").on(table.meetingId),
  userIdx: index("ccc_user_idx").on(table.userId),
}));

export type CccMember = typeof cccMembers.$inferSelect;
export type InsertCccMember = typeof cccMembers.$inferInsert;

export const cccReviews = mysqlTable("ccc_reviews", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull(),
  delegationId: int("delegationId").notNull(),
  
  // Review
  status: mysqlEnum("status", [
    "pending", "under_review", "approved", "rejected", "conditional", "overridden"
  ]).default("pending").notNull(),
  
  // Checks
  membershipValid: boolean("membershipValid"),
  financialClear: boolean("financialClear"),
  documentsComplete: boolean("documentsComplete"),
  eligibilityVerified: boolean("eligibilityVerified"),
  
  // Notes
  reviewerNotes: text("reviewerNotes"),
  rejectionReason: text("rejectionReason"),
  
  // Timing
  reviewedAt: timestamp("reviewedAt"),
  reviewedBy: int("reviewedBy"),
  
  // Report
  preliminaryReport: text("preliminaryReport"),
  finalReport: text("finalReport"),
  reportAdopted: boolean("reportAdopted").default(false),
  reportAdoptedAt: timestamp("reportAdoptedAt"),
  
  // Override (B-8.4.11q: procedural motion to overrule CCC)
  overridden: boolean("overridden").default(false),
  overrideMotionId: int("overrideMotionId"),
  overrideAt: timestamp("overrideAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  meetingIdx: index("cccr_meeting_idx").on(table.meetingId),
  delegationIdx: index("cccr_delegation_idx").on(table.delegationId),
  statusIdx: index("cccr_status_idx").on(table.status),
}));

export type CccReview = typeof cccReviews.$inferSelect;
export type InsertCccReview = typeof cccReviews.$inferInsert;

// ============================================================================
// FINANCIAL COMMITTEE
// ============================================================================

export const financialCommittee = mysqlTable("financial_committee", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull(),
  userId: int("userId").notNull(),
  
  role: mysqlEnum("role", ["chair", "member"]).default("member"),
  
  appointedAt: timestamp("appointedAt").defaultNow().notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  meetingIdx: index("fincomm_meeting_idx").on(table.meetingId),
}));

export type FinancialCommitteeMember = typeof financialCommittee.$inferSelect;
export type InsertFinancialCommitteeMember = typeof financialCommittee.$inferInsert;

// ============================================================================
// NGA ROLL CALL & VOTING CREDENTIALS
// ============================================================================

export const ngaRollCall = mysqlTable("nga_roll_call", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull(),
  plenarySessionId: int("plenarySessionId"),
  
  // Roll call data
  delegationId: int("delegationId").notNull(),
  organizationName: varchar("organizationName", { length: 255 }).notNull(),
  
  // Status
  present: boolean("present").default(false),
  arrivedAt: timestamp("arrivedAt"),
  departedAt: timestamp("departedAt"),
  
  // Voting credentials
  votingCardIssued: boolean("votingCardIssued").default(false),
  votingCardIssuedAt: timestamp("votingCardIssuedAt"),
  votingCardReturned: boolean("votingCardReturned").default(false),
  votingCardReturnedAt: timestamp("votingCardReturnedAt"),
  
  // Voting rights
  plenaryVotes: int("plenaryVotes").default(0),
  electionVotes: int("electionVotes").default(0),
  
  // Roll call result
  calledAt: timestamp("calledAt"),
  responded: boolean("responded").default(false),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  meetingIdx: index("rc_meeting_idx").on(table.meetingId),
  delegationIdx: index("rc_delegation_idx").on(table.delegationId),
}));

export type NgaRollCall = typeof ngaRollCall.$inferSelect;
export type InsertNgaRollCall = typeof ngaRollCall.$inferInsert;

// ============================================================================
// NGA DECISIONS & MINUTES
// ============================================================================

export const ngaDecisions = mysqlTable("nga_decisions", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull(),
  
  // Decision
  decisionId: varchar("decisionId", { length: 100 }).notNull().unique(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  
  // Related
  motionId: int("motionId"),
  agendaItemId: int("agendaItemId"),
  
  // Vote
  voteResult: json("voteResult").$type<{
    yes: number;
    no: number;
    abstain: number;
    invalid: number;
    totalEligible: number;
    quorumMet: boolean;
    threshold: number;
    method: string;
    adopted: boolean;
  }>(),
  
  // Timing
  decidedAt: timestamp("decidedAt").notNull(),
  effectiveAt: timestamp("effectiveAt"),
  
  // Documents
  documents: json("documents").$type<string[]>(),
  
  // Audit
  auditHash: varchar("auditHash", { length: 256 }),
  
  metadata: json("metadata"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  meetingIdx: index("ngad_meeting_idx").on(table.meetingId),
  decisionIdIdx: index("ngad_decision_id_idx").on(table.decisionId),
}));

export type NgaDecision = typeof ngaDecisions.$inferSelect;
export type InsertNgaDecision = typeof ngaDecisions.$inferInsert;

// ============================================================================
// NGA MINUTES
// ============================================================================

export const ngaMinutes = mysqlTable("nga_minutes", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull(),
  
  // Version
  version: int("version").default(1).notNull(),
  status: mysqlEnum("status", [
    "draft", "reviewed", "adopted", "published"
  ]).default("draft").notNull(),
  
  // Content
  content: text("content").notNull(),
  summary: text("summary"),
  
  // Attendees
  attendees: json("attendees").$type<{
    delegations: string[];
    observers: string[];
    officials: string[];
    totalPresent: number;
  }>(),
  
  // Quorum
  quorumRecord: json("quorumRecord").$type<{
    eligibleBodies: number;
    presentBodies: number;
    quorumMet: boolean;
    calculation: string;
  }>(),
  
  // Decisions
  decisions: json("decisions").$type<string[]>(), // decision IDs
  
  // Approval
  approvedAt: timestamp("approvedAt"),
  approvedBy: int("approvedBy"),
  
  // Recording
  recordedBy: int("recordedBy"),
  recordedAt: timestamp("recordedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  meetingIdx: index("ngam_meeting_idx").on(table.meetingId),
  statusIdx: index("ngam_status_idx").on(table.status),
}));

export type NgaMinutes = typeof ngaMinutes.$inferSelect;
export type InsertNgaMinutes = typeof ngaMinutes.$inferInsert;

// ============================================================================
// SGA (SPECIAL GENERAL ASSEMBLY)
// ============================================================================

export const sgaMeetings = mysqlTable("sga_meetings", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  
  // Basic info
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  reason: text("reason"), // Why SGA is needed
  
  // Status
  status: mysqlEnum("status", [
    "proposed", "approved", "scheduled", "in_progress",
    "completed", "cancelled"
  ]).default("proposed").notNull(),
  
  // Approval chain (B-8.2.1: EBTO + SupCo + 2/3 extraordinary voting)
  proposedBy: varchar("proposedBy", { length: 255 }),
  ebtoApproved: boolean("ebtoApproved").default(false),
  ebtoApprovedAt: timestamp("ebtoApprovedAt"),
  supcoApproved: boolean("supcoApproved").default(false),
  supcoApprovedAt: timestamp("supcoApprovedAt"),
  lcVotingApproved: boolean("lcVotingApproved").default(false),
  lcVotingApprovedAt: timestamp("lcVotingApprovedAt"),
  
  // Mode (B-8.2.2: in person or online)
  mode: mysqlEnum("mode", ["in_person", "online"]).default("in_person").notNull(),
  
  // Timing
  scheduledStart: timestamp("scheduledStart").notNull(),
  scheduledEnd: timestamp("scheduledEnd").notNull(),
  actualStart: timestamp("actualStart"),
  actualEnd: timestamp("actualEnd"),
  
  // Notice (B-8.2.3: at least 1 week)
  noticeSentAt: timestamp("noticeSentAt"),
  
  // Quorum (B-8.2.4: 1/3 Permanent + Temporary LCs)
  quorumRequired: int("quorumRequired"),
  quorumMet: boolean("quorumMet").default(false),
  
  // Governance version
  governanceVersion: varchar("governanceVersion", { length: 50 }),
  
  // Metadata
  createdById: int("createdById"),
  metadata: json("metadata"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  statusIdx: index("sga_status_idx").on(table.status),
  scheduledIdx: index("sga_scheduled_idx").on(table.scheduledStart),
}));

export type SgaMeeting = typeof sgaMeetings.$inferSelect;
export type InsertSgaMeeting = typeof sgaMeetings.$inferInsert;

// ============================================================================
// VOTING RIGHTS CALCULATION
// ============================================================================

export const votingRightsCalculations = mysqlTable("voting_rights_calculations", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull(),
  meetingType: varchar("meetingType", { length: 50 }).notNull(), // "nga", "sga"
  
  // Organization
  delegationId: int("delegationId").notNull(),
  organizationType: varchar("organizationType", { length: 50 }).notNull(),
  
  // Calculation
  plenaryVotes: int("plenaryVotes").default(0),
  electionVotes: int("electionVotes").default(0),
  
  // Rule applied
  ruleKey: varchar("ruleKey", { length: 200 }),
  ruleVersion: varchar("ruleVersion", { length: 50 }),
  
  // Eligibility
  eligible: boolean("eligible").default(true),
  eligibilityReason: text("eligibilityReason"),
  
  // Financial condition
  financialClear: boolean("financialClear").default(true),
  debtAmount: int("debtAmount").default(0),
  debtThreshold: int("debtThreshold").default(2000),
  
  // Credential condition
  credentialApproved: boolean("credentialApproved").default(false),
  
  // Calculation explanation
  calculation: text("calculation"),
  
  // Metadata
  calculatedAt: timestamp("calculatedAt").defaultNow().notNull(),
  governanceVersion: varchar("governanceVersion", { length: 50 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  meetingIdx: index("vrc_meeting_idx").on(table.meetingId),
  delegationIdx: index("vrc_delegation_idx").on(table.delegationId),
}));

export type VotingRightsCalculation = typeof votingRightsCalculations.$inferSelect;
export type InsertVotingRightsCalculation = typeof votingRightsCalculations.$inferInsert;
