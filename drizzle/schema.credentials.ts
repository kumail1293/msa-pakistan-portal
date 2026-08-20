/**
 * CCC Credential Submission Schema
 * 
 * Provides detailed credential tracking beyond the basic delegation fields:
 * - Credential form submissions with documents
 * - Individual delegate credentials
 * - Financial verification records
 * - Voting card issuance
 * - CCC appeal records
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
// CREDENTIAL FORM SUBMISSIONS
// ============================================================================

export const credentialSubmissions = mysqlTable("credential_submissions", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull(),
  delegationId: int("delegationId").notNull(),
  
  // Submitted by
  submittedById: int("submittedById").notNull(),
  
  // Form data
  formVersion: varchar("formVersion", { length: 50 }).default("1.0"),
  
  // Delegation details
  organizationName: varchar("organizationName", { length: 255 }).notNull(),
  organizationType: varchar("organizationType", { length: 50 }).notNull(),
  headOfDelegationName: varchar("headOfDelegationName", { length: 255 }),
  
  // Delegate list
  delegateCount: int("delegateCount").default(0),
  delegateList: json("delegateList").$type<Array<{
    userId: number;
    name: string;
    role: "head" | "delegate" | "observer" | "staff" | "faculty";
    membershipId?: string;
    isVoter: boolean;
  }>>(),
  
  // Financial declaration
  financialDeclaration: json("financialDeclaration").$type<{
    totalDuesPaid: number;
    outstandingAmount: number;
    lastPaymentDate?: string;
    paymentReceipts?: string[];
  }>(),
  
  // Documents attached
  documents: json("documents").$type<Array<{
    type: string; // "membership_list", "financial_report", "resolution", "other"
    filename: string;
    path: string;
    uploadedAt: string;
    verified: boolean;
  }>>(),
  
  // Status
  status: mysqlEnum("status", [
    "draft", "submitted", "under_review", "revision_requested",
    "resubmitted", "approved", "rejected", "overridden"
  ]).default("draft").notNull(),
  
  // Submission timing
  submittedAt: timestamp("submittedAt"),
  deadlineAt: timestamp("deadlineAt"), // B-8.1.15: before 2nd plenary
  
  // CCC review tracking
  reviewStartedAt: timestamp("reviewStartedAt"),
  reviewCompletedAt: timestamp("reviewCompletedAt"),
  
  // Notes
  submissionNotes: text("submissionNotes"),
  reviewerNotes: text("reviewerNotes"),
  
  // Metadata
  metadata: json("metadata"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  meetingIdx: index("cs_meeting_idx").on(table.meetingId),
  delegationIdx: index("cs_delegation_idx").on(table.delegationId),
  statusIdx: index("cs_status_idx").on(table.status),
}));

export type CredentialSubmission = typeof credentialSubmissions.$inferSelect;
export type InsertCredentialSubmission = typeof credentialSubmissions.$inferInsert;

// ============================================================================
// CCC VALIDATION CHECKLIST
// ============================================================================

export const cccValidationChecklist = mysqlTable("ccc_validation_checklist", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").notNull(),
  meetingId: int("meetingId").notNull(),
  
  // Membership checks
  membershipListValid: boolean("membershipListValid"),
  membershipListNotes: text("membershipListNotes"),
  
  memberCountVerified: boolean("memberCountVerified"),
  declaredCount: int("declaredCount"),
  verifiedCount: int("verifiedCount"),
  
  // Financial checks
  duesPaidCurrent: boolean("duesPaidCurrent"),
  debtAmount: int("debtAmount").default(0),
  debtThreshold: int("debtThreshold").default(2000), // configurable
  financialDocumentsValid: boolean("financialDocumentsValid"),
  
  // Document checks
  credentialFormComplete: boolean("credentialFormComplete"),
  delegateListComplete: boolean("delegateListComplete"),
  resolutionAttached: boolean("resolutionAttached"),
  allDocumentsVerified: boolean("allDocumentsVerified"),
  
  // Eligibility checks
  organizationEligible: boolean("organizationEligible"),
  organizationTypeValid: boolean("organizationTypeValid"),
  delegateEligibilityVerified: boolean("delegateEligibilityVerified"),
  
  // Overall
  overallStatus: mysqlEnum("overallStatus", [
    "pending", "checks_passed", "checks_failed", "conditional", "overridden"
  ]).default("pending").notNull(),
  
  // Completed by
  checkedById: int("checkedById"),
  checkedAt: timestamp("checkedAt"),
  
  // Appeal
  appealFiled: boolean("appealFiled").default(false),
  appealDeadline: timestamp("appealDeadline"),
  appealDecision: varchar("appealDecision", { length: 50 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  submissionIdx: index("cvc_submission_idx").on(table.submissionId),
  meetingIdx: index("cvc_meeting_idx").on(table.meetingId),
  statusIdx: index("cvc_status_idx").on(table.overallStatus),
}));

export type CccValidationChecklist = typeof cccValidationChecklist.$inferSelect;
export type InsertCccValidationChecklist = typeof cccValidationChecklist.$inferInsert;

// ============================================================================
// CCC REPORTS
// ============================================================================

export const cccReports = mysqlTable("ccc_reports", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull(),
  
  // Report type
  type: mysqlEnum("type", ["preliminary", "final", "supplemental"]).notNull(),
  version: int("version").default(1),
  
  // Content
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  
  // Summary statistics
  totalDelegations: int("totalDelegations").default(0),
  approvedDelegations: int("approvedDelegations").default(0),
  rejectedDelegations: int("rejectedDelegations").default(0),
  pendingDelegations: int("pendingDelegations").default(0),
  overriddenDelegations: int("overriddenDelegations").default(0),
  
  // Voting body counts
  totalPlenaryVotes: int("totalPlenaryVotes").default(0),
  totalElectionVotes: int("totalElectionVotes").default(0),
  
  // Status
  status: mysqlEnum("status", [
    "draft", "reviewed", "adopted", "published"
  ]).default("draft").notNull(),
  
  // Authorship
  authoredById: int("authoredById"),
  reviewedById: int("reviewedById"),
  
  // Adoption
  adoptedAt: timestamp("adoptedAt"),
  adoptedByMotionId: int("adoptedByMotionId"),
  
  // Publication
  publishedAt: timestamp("publishedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  meetingIdx: index("cccrpt_meeting_idx").on(table.meetingId),
  typeIdx: index("cccrpt_type_idx").on(table.type),
  statusIdx: index("cccrpt_status_idx").on(table.status),
}));

export type CccReport = typeof cccReports.$inferSelect;
export type InsertCccReport = typeof cccReports.$inferInsert;

// ============================================================================
// VOTING CARDS
// ============================================================================

export const votingCards = mysqlTable("voting_cards", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull(),
  delegationId: int("delegationId").notNull(),
  
  // Card details
  cardNumber: varchar("cardNumber", { length: 50 }).notNull(),
  cardType: mysqlEnum("cardType", ["plenary", "election", "both"]).default("both"),
  
  // Issuance
  issuedAt: timestamp("issuedAt"),
  issuedBy: int("issuedBy"),
  
  // Voting rights
  plenaryVotes: int("plenaryVotes").default(0),
  electionVotes: int("electionVotes").default(0),
  
  // Status
  status: mysqlEnum("status", [
    "pending", "issued", "active", "returned", "revoked"
  ]).default("pending").notNull(),
  
  // Return
  returnedAt: timestamp("returnedAt"),
  returnedTo: int("returnedTo"),
  
  // Revocation
  revokedAt: timestamp("revokedAt"),
  revokedReason: text("revokedReason"),
  
  // Device/session (for electronic voting)
  deviceId: varchar("deviceId", { length: 255 }),
  sessionId: varchar("sessionId", { length: 255 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  meetingIdx: index("vc_meeting_idx").on(table.meetingId),
  delegationIdx: index("vc_delegation_idx").on(table.delegationId),
  cardNumberIdx: index("vc_card_number_idx").on(table.cardNumber),
  statusIdx: index("vc_status_idx").on(table.status),
}));

export type VotingCard = typeof votingCards.$inferSelect;
export type InsertVotingCard = typeof votingCards.$inferInsert;

// ============================================================================
// CCCC APPEAL RECORDS
// ============================================================================

export const cccAppeals = mysqlTable("ccc_appeals", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull(),
  delegationId: int("delegationId").notNull(),
  submissionId: int("submissionId").notNull(),
  
  // Appeal
  filedById: int("filedById").notNull(),
  grounds: text("grounds").notNull(),
  
  // Status
  status: mysqlEnum("status", [
    "filed", "under_review", "upheld", "dismissed", "overridden"
  ]).default("filed").notNull(),
  
  // Deadline
  filedAt: timestamp("filedAt").defaultNow().notNull(),
  deadlineAt: timestamp("deadlineAt").notNull(),
  
  // Review
  reviewedById: int("reviewedById"),
  reviewedAt: timestamp("reviewedAt"),
  decision: text("decision"),
  
  // Override (B-8.4.11q: procedural motion to overrule CCC)
  overrideMotionId: int("overrideMotionId"),
  overriddenAt: timestamp("overriddenAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  meetingIdx: index("cca_meeting_idx").on(table.meetingId),
  delegationIdx: index("cca_delegation_idx").on(table.delegationId),
  statusIdx: index("cca_status_idx").on(table.status),
}));

export type CccAppeal = typeof cccAppeals.$inferSelect;
export type InsertCccAppeal = typeof cccAppeals.$inferInsert;
