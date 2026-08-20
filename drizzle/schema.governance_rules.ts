/**
 * Governance Rules Engine Schema
 *
 * Provides versioned governance documents, clauses, and rules
 * with temporal resolution for historical decisions.
 *
 * Key principle: Every rule is versioned and traceable.
 * Historical decisions always use the rule version that was effective at that time.
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
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// ============================================================================
// GOVERNANCE DOCUMENTS
// ============================================================================

export const governanceDocuments = mysqlTable("governance_documents", {
  id: int("id").autoincrement().primaryKey(),
  
  // Identification
  title: varchar("title", { length: 255 }).notNull(),
  type: mysqlEnum("type", [
    "constitution", "bylaws", "iog", "policy", "annex", "regulation"
  ]).notNull(),
  version: varchar("version", { length: 50 }).notNull(),
  
  // Status lifecycle
  status: mysqlEnum("status", [
    "draft", "proposed", "under_review", "submitted", "approved",
    "effective", "superseded", "suspended", "expired", "rejected", "archived"
  ]).default("draft").notNull(),
  
  // Effective dates
  effectiveFrom: timestamp("effectiveFrom"),
  effectiveUntil: timestamp("effectiveUntil"),
  
  // Approval
  approvedBy: varchar("approvedBy", { length: 255 }),
  approvalMeeting: varchar("approvalMeeting", { length: 255 }),
  approvalDecision: varchar("approvalDecision", { length: 255 }),
  
  // Source
  sourceDocument: varchar("sourceDocument", { length: 500 }),
  integrityHash: varchar("integrityHash", { length: 256 }),
  
  // Metadata
  createdBy: int("createdBy"),
  metadata: json("metadata"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  typeIdx: index("gd_type_idx").on(table.type),
  statusIdx: index("gd_status_idx").on(table.status),
  versionIdx: index("gd_version_idx").on(table.version),
  effectiveIdx: index("gd_effective_idx").on(table.effectiveFrom, table.effectiveUntil),
  uniqueVersion: uniqueIndex("gd_unique_version").on(table.type, table.version),
}));

export type GovernanceDocument = typeof governanceDocuments.$inferSelect;
export type InsertGovernanceDocument = typeof governanceDocuments.$inferInsert;

// ============================================================================
// GOVERNANCE CLAUSES
// ============================================================================

export const governanceClauses = mysqlTable("governance_clauses", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  
  // Stable identifier (e.g., "BYLAW-8.7.1", "CONSTITUTION-11.1")
  clauseId: varchar("clauseId", { length: 100 }).notNull(),
  
  // Content
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(),
  
  // Structure
  section: varchar("section", { length: 50 }),
  subsection: varchar("subsection", { length: 50 }),
  clauseNumber: varchar("clauseNumber", { length: 50 }),
  
  // Versioning
  version: int("version").default(1).notNull(),
  status: mysqlEnum("status", [
    "active", "superseded", "suspended", "expired"
  ]).default("active").notNull(),
  
  // Effective dates
  effectiveFrom: timestamp("effectiveFrom"),
  effectiveUntil: timestamp("effectiveUntil"),
  
  // Supersession
  supersededByClauseId: int("supersededByClauseId"),
  
  // Source reference
  sourcePage: int("sourcePage"),
  
  // Metadata
  metadata: json("metadata"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  documentIdx: index("gc_document_idx").on(table.documentId),
  clauseIdIdx: index("gc_clause_id_idx").on(table.clauseId),
  statusIdx: index("gc_status_idx").on(table.status),
  effectiveIdx: index("gc_effective_idx").on(table.effectiveFrom, table.effectiveUntil),
  uniqueClauseVersion: uniqueIndex("gc_unique_clause_ver").on(table.clauseId, table.version),
}));

export type GovernanceClause = typeof governanceClauses.$inferSelect;
export type InsertGovernanceClause = typeof governanceClauses.$inferInsert;

// ============================================================================
// GOVERNANCE RULES
// ============================================================================

export const governanceRules = mysqlTable("governance_rules", {
  id: int("id").autoincrement().primaryKey(),
  clauseId: int("clauseId").notNull(),
  
  // Rule identification
  ruleType: varchar("ruleType", { length: 50 }).notNull(),
  ruleKey: varchar("ruleKey", { length: 200 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Rule parameters (the actual configurable values)
  parameters: json("parameters").$type<Record<string, unknown>>().notNull(),
  
  // Versioning
  version: int("version").default(1).notNull(),
  status: mysqlEnum("status", [
    "active", "superseded", "suspended"
  ]).default("active").notNull(),
  
  // Effective dates
  effectiveFrom: timestamp("effectiveFrom"),
  effectiveUntil: timestamp("effectiveUntil"),
  
  // Metadata
  metadata: json("metadata"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  clauseIdx: index("gr_clause_idx").on(table.clauseId),
  typeIdx: index("gr_type_idx").on(table.ruleType),
  keyIdx: index("gr_key_idx").on(table.ruleKey),
  statusIdx: index("gr_status_idx").on(table.status),
  effectiveIdx: index("gr_effective_idx").on(table.effectiveFrom, table.effectiveUntil),
  uniqueRuleVersion: uniqueIndex("gr_unique_rule_ver").on(table.ruleKey, table.version),
}));

export type GovernanceRule = typeof governanceRules.$inferSelect;
export type InsertGovernanceRule = typeof governanceRules.$inferInsert;

// ============================================================================
// GOVERNANCE AMENDMENTS
// ============================================================================

export const governanceAmendments = mysqlTable("governance_amendments", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  
  // Proposal
  proposalId: varchar("proposalId", { length: 100 }).notNull(),
  type: mysqlEnum("type", [
    "bylaw_change", "constitutional_amendment", "editorial", "suspension"
  ]).notNull(),
  
  // Proposer
  proposedByType: varchar("proposedByType", { length: 50 }), // "supco", "ebto", "lc"
  proposedById: int("proposedById"),
  proposerNames: text("proposerNames"),
  
  // Content
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  affectedClauses: json("affectedClauses").$type<string[]>(), // ["BYLAW-8.7.1", "BYLAW-8.7.2"]
  oldText: text("oldText"),
  proposedText: text("proposedText"),
  
  // Impact analysis
  legalImpact: text("legalImpact"),
  governanceImpact: text("governanceImpact"),
  operationalImpact: text("operationalImpact"),
  financialImpact: text("financialImpact"),
  implementationImpact: text("implementationImpact"),
  
  // Status
  status: mysqlEnum("status", [
    "draft", "submitted", "under_review", "agenda_placed",
    "debating", "voting", "adopted", "rejected", "effective",
    "superseded", "withdrawn"
  ]).default("draft").notNull(),
  
  // Timing
  submittedAt: timestamp("submittedAt"),
  deadline: timestamp("deadline"),
  votedAt: timestamp("votedAt"),
  effectiveAt: timestamp("effectiveAt"),
  
  // Vote result
  voteResult: json("voteResult").$type<{
    yes: number;
    no: number;
    abstain: number;
    required: number;
    method: string;
    adopted: boolean;
  }>(),
  
  // Metadata
  createdBy: int("createdBy"),
  metadata: json("metadata"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  documentIdx: index("ga_document_idx").on(table.documentId),
  proposalIdx: index("ga_proposal_idx").on(table.proposalId),
  typeIdx: index("ga_type_idx").on(table.type),
  statusIdx: index("ga_status_idx").on(table.status),
}));

export type GovernanceAmendment = typeof governanceAmendments.$inferSelect;
export type InsertGovernanceAmendment = typeof governanceAmendments.$inferInsert;

// ============================================================================
// GOVERNANCE SUSPENSIONS
// ============================================================================

export const governanceSuspensions = mysqlTable("governance_suspensions", {
  id: int("id").autoincrement().primaryKey(),
  
  // Suspended clause
  clauseId: int("clauseId").notNull(),
  clauseIdentifier: varchar("clauseIdentifier", { length: 100 }).notNull(),
  
  // Proposal
  proposalId: varchar("proposalId", { length: 100 }),
  proposedByType: varchar("proposedByType", { length: 50 }),
  proposedById: int("proposedById"),
  proposerNames: text("proposerNames"),
  
  // Justification
  reasonNotObserved: text("reasonNotObserved"),
  reasonSuspensionNeeded: text("reasonSuspensionNeeded"),
  expectedSolution: text("expectedSolution"),
  writtenJustification: text("writtenJustification"),
  
  // Status
  status: mysqlEnum("status", [
    "proposed", "voting", "suspended", "resumed", "expired"
  ]).default("proposed").notNull(),
  
  // Timing
  suspendedAt: timestamp("suspendedAt"),
  expiresAt: timestamp("expiresAt"),
  resumedAt: timestamp("resumedAt"),
  
  // Vote
  voteResult: json("voteResult").$type<{
    yes: number;
    no: number;
    abstain: number;
    required: number;
    method: string;
    adopted: boolean;
  }>(),
  
  // Decision
  decisionId: varchar("decisionId", { length: 100 }),
  
  // Metadata
  metadata: json("metadata"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  clauseIdx: index("gs_clause_idx").on(table.clauseId),
  statusIdx: index("gs_status_idx").on(table.status),
  expiresIdx: index("gs_expires_idx").on(table.expiresAt),
}));

export type GovernanceSuspension = typeof governanceSuspensions.$inferSelect;
export type InsertGovernanceSuspension = typeof governanceSuspensions.$inferInsert;

// ============================================================================
// GOVERNANCE CONFIGURATION PARAMETERS
// ============================================================================

export const governanceParameters = mysqlTable("governance_parameters", {
  id: int("id").autoincrement().primaryKey(),
  
  // Key (e.g., "nga.quorum.numerator", "voting.permanent_lc.plenary_votes")
  key: varchar("key", { length: 200 }).notNull().unique(),
  
  // Value
  value: json("value").notNull(),
  dataType: varchar("dataType", { length: 20 }).default("number").notNull(),
  
  // Category
  category: varchar("category", { length: 50 }),
  description: text("description"),
  
  // Source clause
  sourceClause: varchar("sourceClause", { length: 100 }),
  
  // Versioning
  governanceVersion: varchar("governanceVersion", { length: 50 }).notNull(),
  effectiveFrom: timestamp("effectiveFrom"),
  effectiveUntil: timestamp("effectiveUntil"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  keyIdx: index("gp_key_idx").on(table.key),
  categoryIdx: index("gp_category_idx").on(table.category),
  versionIdx: index("gp_version_idx").on(table.governanceVersion),
  effectiveIdx: index("gp_effective_idx").on(table.effectiveFrom, table.effectiveUntil),
}));

export type GovernanceParameter = typeof governanceParameters.$inferSelect;
export type InsertGovernanceParameter = typeof governanceParameters.$inferInsert;

// ============================================================================
// GOVERNANCE DECISIONS
// ============================================================================

export const governanceDecisions = mysqlTable("governance_decisions", {
  id: int("id").autoincrement().primaryKey(),
  
  // Decision ID (e.g., "DEC-2026-NGA-001")
  decisionId: varchar("decisionId", { length: 100 }).notNull().unique(),
  
  // Type
  type: varchar("type", { length: 50 }).notNull(),
  
  // Meeting
  meetingId: int("meetingId"),
  meetingType: varchar("meetingType", { length: 50 }),
  
  // Content
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  
  // Related entities
  motionId: int("motionId"),
  amendmentId: int("amendmentId"),
  
  // Proposer
  proposedByType: varchar("proposedByType", { length: 50 }),
  proposedById: int("proposedById"),
  
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
  
  // Rule version
  governanceVersion: varchar("governanceVersion", { length: 50 }),
  
  // Timing
  decidedAt: timestamp("decidedAt").notNull(),
  effectiveAt: timestamp("effectiveAt"),
  expiresAt: timestamp("expiresAt"),
  
  // Documents
  documents: json("documents").$type<string[]>(),
  
  // Audit
  auditHash: varchar("auditHash", { length: 256 }),
  
  // Metadata
  metadata: json("metadata"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  decisionIdIdx: index("gdec_decision_id_idx").on(table.decisionId),
  typeIdx: index("gdec_type_idx").on(table.type),
  meetingIdx: index("gdec_meeting_idx").on(table.meetingId),
  decidedIdx: index("gdec_decided_idx").on(table.decidedAt),
}));

export type GovernanceDecision = typeof governanceDecisions.$inferSelect;
export type InsertGovernanceDecision = typeof governanceDecisions.$inferInsert;
