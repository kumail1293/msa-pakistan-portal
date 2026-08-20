/**
 * Proxy Voting, Oath, and Membership Termination Schema
 * 
 * - Proxy Voting (B-8.7.14): Delegation of voting rights
 * - Oath System (B-8.7.16): Oath recording and verification
 * - Membership Termination (B-6.23): Due process workflow
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
// PROXY VOTING (B-8.7.14)
// ============================================================================

export const proxyVotingAuthorizations = mysqlTable("proxy_voting_authorizations", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull(),
  
  // Proxy granter
  granterId: int("granterId").notNull(),
  granterName: varchar("granterName", { length: 255 }).notNull(),
  granterDelegationId: int("granterDelegationId"),
  
  // Proxy recipient
  recipientId: int("recipientId").notNull(),
  recipientName: varchar("recipientName", { length: 255 }).notNull(),
  recipientDelegationId: int("recipientDelegationId"),
  
  // Scope
  scope: mysqlEnum("scope", [
    "bylaw_changes_only",   // B-8.7.14: limited to bylaw changes
    "full",                 // Full plenary voting
    "election_only",        // Election voting only
  ]).default("bylaw_changes_only").notNull(),
  
  // B-8.7.14: Max 2 proxies per delegation
  proxyNumber: int("proxyNumber").notNull(), // 1 or 2
  
  // Status
  status: mysqlEnum("status", [
    "active", "revoked", "expired", "used"
  ]).default("active").notNull(),
  
  // Validity
  validFrom: timestamp("validFrom").notNull(),
  validUntil: timestamp("validUntil").notNull(),
  
  // Documentation
  writtenAuthorization: text("writtenAuthorization"), // Written proxy form
  authorizationHash: varchar("authorizationHash", { length: 256 }),
  
  // Usage tracking
  usedAt: timestamp("usedAt"),
  usedForMotionId: int("usedForMotionId"),
  
  // Revocation
  revokedAt: timestamp("revokedAt"),
  revokedReason: text("revokedReason"),
  
  // Metadata
  metadata: json("metadata"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  meetingIdx: index("pva_meeting_idx").on(table.meetingId),
  granterIdx: index("pva_granter_idx").on(table.granterId),
  recipientIdx: index("pva_recipient_idx").on(table.recipientId),
  statusIdx: index("pva_status_idx").on(table.status),
}));

export type ProxyVotingAuthorization = typeof proxyVotingAuthorizations.$inferSelect;
export type InsertProxyVotingAuthorization = typeof proxyVotingAuthorizations.$inferInsert;

// ============================================================================
// OATH SYSTEM (B-8.7.16)
// ============================================================================

export const oathDefinitions = mysqlTable("oath_definitions", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  
  // Oath content
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  language: varchar("language", { length: 50 }).default("en"),
  
  // Who takes this oath
  applicableTo: mysqlEnum("applicableTo", [
    "president", "board", "officials", "delegates",
    "observers", "staff", "custom"
  ]).notNull(),
  
  // Versioning
  version: varchar("version", { length: 50 }).notNull(),
  effectiveFrom: timestamp("effectiveFrom").notNull(),
  effectiveUntil: timestamp("effectiveUntil"),
  status: mysqlEnum("status", [
    "draft", "active", "superseded", "archived"
  ]).default("draft").notNull(),
  
  // Metadata
  metadata: json("metadata"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("od_org_idx").on(table.organizationId),
  statusIdx: index("od_status_idx").on(table.status),
}));

export type OathDefinition = typeof oathDefinitions.$inferSelect;
export type InsertOathDefinition = typeof oathDefinitions.$inferInsert;

export const oathRecords = mysqlTable("oath_records", {
  id: int("id").autoincrement().primaryKey(),
  
  // Who
  userId: int("userId").notNull(),
  oathDefinitionId: int("oathDefinitionId").notNull(),
  
  // Meeting context
  meetingId: int("meetingId"),
  meetingType: varchar("meetingType", { length: 50 }), // "nga", "sga", "local"
  
  // Oath administration
  administeredAt: timestamp("administeredAt").notNull(),
  administeredBy: int("administeredBy"), // Chair/admin who administered
  witnesses: json("witnesses").$type<number[]>(), // Witness user IDs
  
  // How
  method: mysqlEnum("method", [
    "verbal", "written", "electronic", "digital_signature"
  ]).notNull(),
  
  // Document
  writtenCopyPath: varchar("writtenCopyPath", { length: 500 }),
  signatureData: text("signatureData"), // Base64 signature image
  digitalSignatureHash: varchar("digitalSignatureHash", { length: 256 }),
  
  // Status
  status: mysqlEnum("status", [
    "pending", "administered", "verified", "revoked", "expired"
  ]).default("pending").notNull(),
  
  // Validity
  validFrom: timestamp("validFrom").notNull(),
  validUntil: timestamp("validUntil"),
  
  // Revocation
  revokedAt: timestamp("revokedAt"),
  revokedReason: text("revokedReason"),
  revokedBy: int("revokedBy"),
  
  // Audit
  auditHash: varchar("auditHash", { length: 256 }),
  metadata: json("metadata"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("or_user_idx").on(table.userId),
  oathIdx: index("or_oath_idx").on(table.oathDefinitionId),
  meetingIdx: index("or_meeting_idx").on(table.meetingId),
  statusIdx: index("or_status_idx").on(table.status),
}));

export type OathRecord = typeof oathRecords.$inferSelect;
export type InsertOathRecord = typeof oathRecords.$inferInsert;

// ============================================================================
// MEMBERSHIP TERMINATION (B-6.23)
// ============================================================================

export const membershipTerminations = mysqlTable("membership_terminations", {
  id: int("id").autoincrement().primaryKey(),
  
  // Subject
  userId: int("userId").notNull(),
  organizationId: int("organizationId"),
  
  // Process type
  type: mysqlEnum("type", [
    "voluntary_resignation",      // B-6.23.1: voluntary
    "conduct_based",              // B-6.23.2: based on conduct
    "non_payment",               // B-6.23.3: failure to pay dues
    "inactivity",                // B-6.23.4: prolonged absence
    "disciplinary",              // B-6.23.5: disciplinary action
  ]).notNull(),
  
  // Status
  status: mysqlEnum("status", [
    "initiated",
    "show_cause_issued",
    "show_cause_response_pending",
    "show_cause_response_received",
    "judging_panel_assigned",
    "judging_panel_hearing",
    "judging_panel_decision",
    "appeal_pending",
    "appeal_hearing",
    "appeal_decision",
    "finalized",
    "reversed",
  ]).default("initiated").notNull(),
  
  // Initiation
  initiatedAt: timestamp("initiatedAt").defaultNow().notNull(),
  initiatedBy: int("initiatedBy"),
  initiationReason: text("initiationReason").notNull(),
  initiationEvidence: json("initiationEvidence").$type<string[]>(),
  
  // Show Cause (B-6.23.2)
  showCauseIssuedAt: timestamp("showCauseIssuedAt"),
  showCauseDeadline: timestamp("showCauseDeadline"),
  showCauseResponse: text("showCauseResponse"),
  showCauseResponseAt: timestamp("showCauseResponseAt"),
  
  // Judging Panel (B-6.23.2)
  judgingPanelMemberIds: json("judgingPanelMemberIds").$type<number[]>(),
  judgingPanelDecisionAt: timestamp("judgingPanelDecisionAt"),
  judgingPanelDecision: mysqlEnum("judgingPanelDecision", [
    "terminate", "warn", "suspend", "dismiss"
  ]),
  judgingPanelReason: text("judgingPanelReason"),
  
  // Appeal (B-6.23.3)
  appealEligible: boolean("appealEligible").default(true),
  appealDeadline: timestamp("appealDeadline"),
  appealFiledAt: timestamp("appealFiledAt"),
  appealGrounds: text("appealGrounds"),
  appealPanelMemberIds: json("appealPanelMemberIds").$type<number[]>(),
  appealDecisionAt: timestamp("appealDecisionAt"),
  appealDecision: mysqlEnum("appealDecision", [
    "upheld", "reversed", "modified"
  ]),
  appealReason: text("appealReason"),
  
  // Final result
  finalizedAt: timestamp("finalizedAt"),
  effectiveDate: timestamp("effectiveDate"),
  
  // Reversal
  reversedAt: timestamp("reversedAt"),
  reversedBy: int("reversedBy"),
  reversalReason: text("reversalReason"),
  
  // Notification
  memberNotifiedAt: timestamp("memberNotifiedAt"),
  organizationNotifiedAt: timestamp("organizationNotifiedAt"),
  
  // Audit
  auditHash: varchar("auditHash", { length: 256 }),
  metadata: json("metadata"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("mt_user_idx").on(table.userId),
  orgIdx: index("mt_org_idx").on(table.organizationId),
  statusIdx: index("mt_status_idx").on(table.status),
  typeIdx: index("mt_type_idx").on(table.type),
}));

export type MembershipTermination = typeof membershipTerminations.$inferSelect;
export type InsertMembershipTermination = typeof membershipTerminations.$inferInsert;
