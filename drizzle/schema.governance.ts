/**
 * Governance Schema Extension
 * Adds Elections Engine and Plenary/Parliamentary Engine tables.
 *
 * These are completely separate systems:
 * - Elections: Democratic processes (president, board, committees)
 * - Plenary: Institutional proceedings (WHO/UN/IFMSA-style)
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
// ELECTIONS ENGINE
// ============================================================================

export const elections = mysqlTable("elections", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  
  // Basic info
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", [
    "presidential", "board", "national_team", "regional",
    "chapter", "committee", "referendum",
    "supco", "nga_officer"
  ]).notNull(),
  
  // Status lifecycle
  status: mysqlEnum("status", [
    "draft", "published", "nominations_open", "nominations_closed",
    "campaigning", "voting_active", "counting", "disputes",
    "certified", "published_results", "archived"
  ]).default("draft").notNull(),
  
  // Timing
  nominationsStart: timestamp("nominationsStart"),
  nominationsEnd: timestamp("nominationsEnd"),
  campaignStart: timestamp("campaignStart"),
  campaignEnd: timestamp("campaignEnd"),
  votingStart: timestamp("votingStart").notNull(),
  votingEnd: timestamp("votingEnd").notNull(),
  disputeEnd: timestamp("disputeEnd"),
  
  // Voting configuration
  votingMethod: json("votingMethod").$type<{
    type: "plurality" | "majority" | "ranked_choice" | "runoff" 
        | "weighted" | "secret_ballot" | "consensus" | "unanimity";
    requireSecondRound?: boolean;
    weightedRoles?: Record<string, number>;
  }>().notNull(),
  
  // Eligibility
  eligibilityCriteria: json("eligibilityCriteria").$type<{
    minMembershipMonths?: number;
    membershipStatus?: string[];
    minAge?: number;
    customRules?: Array<{
      type: string;
      params: Record<string, unknown>;
      message: string;
    }>;
  }>(),
  
  // Nomination settings
  nominationConfig: json("nominationConfig").$type<{
    requireEndorsement?: boolean;
    minEndorsements?: number;
    requireStatement?: boolean;
    maxCandidates?: number;
    customFields?: Array<{
      name: string;
      label: string;
      type: string;
      required: boolean;
    }>;
  }>(),
  
  // Result settings
  resultConfig: json("resultConfig").$type<{
    disputePeriodDays?: number;
    requireCertification?: boolean;
    publishResults?: boolean;
    showTurnout?: boolean;
  }>(),
  
  // Metadata
  createdById: int("createdById"),
  electionCommitteeIds: json("electionCommitteeIds").$type<number[]>(),
  metadata: json("metadata"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("el_org_idx").on(table.organizationId),
  statusIdx: index("el_status_idx").on(table.status),
  typeIdx: index("el_type_idx").on(table.type),
  votingStartIdx: index("el_voting_start_idx").on(table.votingStart),
}));

export type Election = typeof elections.$inferSelect;
export type InsertElection = typeof elections.$inferInsert;

// ============================================================================
// CANDIDATES
// ============================================================================

export const candidates = mysqlTable("candidates", {
  id: int("id").autoincrement().primaryKey(),
  electionId: int("electionId").notNull(),
  userId: int("userId").notNull(),
  
  // Position (for multi-seat elections)
  position: varchar("position", { length: 255 }),
  
  // Nomination data
  nominationData: json("nominationData").$type<Record<string, unknown>>(),
  
  // Status
  status: mysqlEnum("status", [
    "nominated", "verified", "approved", "withdrawn", "disqualified"
  ]).default("nominated").notNull(),
  
  // Endorsements
  endorsements: json("endorsements").$type<Array<{
    userId: number;
    verifiedAt?: Date;
  }>>(),
  
  // Verification
  nominationDate: timestamp("nominationDate").defaultNow().notNull(),
  verifiedAt: timestamp("verifiedAt"),
  verifiedBy: int("verifiedBy"),
  disqualificationReason: text("disqualificationReason"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  electionIdx: index("cd_election_idx").on(table.electionId),
  userIdx: index("cd_user_idx").on(table.userId),
  statusIdx: index("cd_status_idx").on(table.status),
  uniqueNomination: uniqueIndex("cd_unique_nom").on(table.electionId, table.userId),
}));

export type Candidate = typeof candidates.$inferSelect;
export type InsertCandidate = typeof candidates.$inferInsert;

// ============================================================================
// BALLOTS (Encrypted)
// ============================================================================

export const ballots = mysqlTable("ballots", {
  id: int("id").autoincrement().primaryKey(),
  electionId: int("electionId").notNull(),
  
  // Voter identity (separated from ballot content)
  voterHash: varchar("voterHash", { length: 64 }).notNull(), // SHA-256 of voterId + election salt
  
  // Encrypted ballot content
  encryptedBallot: text("encryptedBallot").notNull(),
  iv: varchar("iv", { length: 32 }).notNull(), // Initialization vector
  
  // Metadata
  method: varchar("method", { length: 50 }).notNull(),
  castAt: timestamp("castAt").defaultNow().notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  electionIdx: index("bl_election_idx").on(table.electionId),
  voterHashIdx: index("bl_voter_hash_idx").on(table.voterHash),
  uniqueVote: uniqueIndex("bl_unique_vote").on(table.electionId, table.voterHash),
}));

export type Ballot = typeof ballots.$inferSelect;
export type InsertBallot = typeof ballots.$inferInsert;

// ============================================================================
// ELECTION RESULTS
// ============================================================================

export const electionResults = mysqlTable("election_results", {
  id: int("id").autoincrement().primaryKey(),
  electionId: int("electionId").notNull(),
  position: varchar("position", { length: 255 }),
  
  // Totals
  totalVotes: int("totalVotes").default(0).notNull(),
  totalEligible: int("totalEligible").default(0).notNull(),
  turnout: decimal("turnout", { precision: 5, scale: 2 }), // percentage
  
  // Results array
  results: json("results").$type<Array<{
    candidateId: number;
    votes: number;
    percentage: number;
    rank: number;
    elected: boolean;
  }>>().notNull(),
  
  // Method used
  method: varchar("method", { length: 50 }).notNull(),
  
  // Certification
  certifiedAt: timestamp("certifiedAt"),
  certifiedBy: int("certifiedBy"),
  publishedAt: timestamp("publishedAt"),
  
  // Round data (for ranked choice/runoff)
  rounds: json("rounds").$type<Array<{
    round: number;
    eliminated?: number;
    redistributed?: Array<{ from: number; to: number; count: number }>;
    counts: Record<number, number>;
  }>>(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  electionIdx: index("er_election_idx").on(table.electionId),
}));

export type ElectionResult = typeof electionResults.$inferSelect;
export type InsertElectionResult = typeof electionResults.$inferInsert;

// ============================================================================
// ELECTION DISPUTES
// ============================================================================

export const electionDisputes = mysqlTable("election_disputes", {
  id: int("id").autoincrement().primaryKey(),
  electionId: int("electionId").notNull(),
  filedBy: int("filedBy").notNull(),
  
  // Dispute details
  type: mysqlEnum("type", ["recount", "eligibility", "process", "result"]).notNull(),
  description: text("description").notNull(),
  evidence: text("evidence"),
  
  // Status
  status: mysqlEnum("status", [
    "filed", "under_review", "resolved", "dismissed"
  ]).default("filed").notNull(),
  
  // Resolution
  resolution: text("resolution"),
  resolvedAt: timestamp("resolvedAt"),
  resolvedBy: int("resolvedBy"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  electionIdx: index("ed_election_idx").on(table.electionId),
  statusIdx: index("ed_status_idx").on(table.status),
}));

export type ElectionDispute = typeof electionDisputes.$inferSelect;
export type InsertElectionDispute = typeof electionDisputes.$inferInsert;

// ============================================================================
// PLENARY/PARLIAMENTARY ENGINE
// ============================================================================

export const plenarySessions = mysqlTable("plenary_sessions", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  
  // Basic info
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["regular", "special", "emergency", "annual"]).notNull(),
  
  // Status
  status: mysqlEnum("status", [
    "proposed", "scheduled", "in_progress", "suspended", "adjourned", "completed"
  ]).default("proposed").notNull(),
  
  // Timing
  scheduledStart: timestamp("scheduledStart").notNull(),
  scheduledEnd: timestamp("scheduledEnd").notNull(),
  actualStart: timestamp("actualStart"),
  actualEnd: timestamp("actualEnd"),
  
  // Officers
  chairId: int("chairId").notNull(),
  secretaryId: int("secretaryId").notNull(),
  
  // Quorum
  quorumRequired: int("quorumRequired").default(50), // percentage
  quorumMet: boolean("quorumMet").default(false),
  membersPresent: int("membersPresent").default(0),
  totalEligibleVoters: int("totalEligibleVoters").default(0),
  
  // Parliamentary rules (configuration-driven)
  rules: json("rules").$type<{
    quorumPercentage: number;
    defaultVotingMethod: string;
    allowedVotingMethods: string[];
    maxSpeakerTimeSeconds: number;
    maxSpeakersPerSide: number;
    allowClosingStatements: boolean;
    allowAmendments: boolean;
    amendmentRequiresSecond: boolean;
    allowClosureOfDebate: boolean;
    allowSuspensionOfRules: boolean;
    allowAdjournment: boolean;
    allowPointsOfOrder: boolean;
    chairRulingBinding: boolean;
    appealAllowed: boolean;
    adoptionThreshold: number;
    amendmentThreshold: number;
    maxSessionDurationHours: number;
    maxDebateTimePerItemMinutes: number;
    requireRollCall: boolean;
    publishMinutes: boolean;
  }>().notNull(),
  
  // Metadata
  createdById: int("createdById"),
  metadata: json("metadata"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("ps_org_idx").on(table.organizationId),
  statusIdx: index("ps_status_idx").on(table.status),
  scheduledIdx: index("ps_scheduled_idx").on(table.scheduledStart),
}));

export type PlenarySession = typeof plenarySessions.$inferSelect;
export type InsertPlenarySession = typeof plenarySessions.$inferInsert;

// ============================================================================
// AGENDA ITEMS
// ============================================================================

export const agendaItems = mysqlTable("agenda_items", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  
  // Content
  order: int("order").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", [
    "regular", "urgent", "procedural", "election", "report", "financial"
  ]).default("regular").notNull(),
  
  // Ownership
  proposedById: int("proposedById").notNull(),
  
  // Status
  status: mysqlEnum("status", [
    "proposed", "approved", "tabled", "discussed", "decided", "withdrawn"
  ]).default("proposed").notNull(),
  
  // Time
  timeAllotted: int("timeAllotted"), // seconds
  timeUsed: int("timeUsed").default(0), // seconds
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  sessionIdx: index("ai_session_idx").on(table.sessionId),
  orderIdx: index("ai_order_idx").on(table.sessionId, table.order),
}));

export type AgendaItem = typeof agendaItems.$inferSelect;
export type InsertAgendaItem = typeof agendaItems.$inferInsert;

// ============================================================================
// MOTIONS
// ============================================================================

export const motions = mysqlTable("motions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  agendaItemId: int("agendaItemId"),
  
  // Content
  type: mysqlEnum("type", [
    "main", "amendment", "procedural", "point_of_order", "closure", "adjournment"
  ]).notNull(),
  text: text("text").notNull(),
  
  // Ownership
  proposedById: int("proposedById").notNull(),
  secondedById: int("secondedById"),
  
  // Status
  status: mysqlEnum("status", [
    "proposed", "seconded", "under_debate", "voting", 
    "adopted", "rejected", "withdrawn"
  ]).default("proposed").notNull(),
  
  // For amendments
  amendmentTo: int("amendmentTo"), // Motion ID being amended
  amendmentPosition: mysqlEnum("amendmentPosition", ["before", "after", "replace"]),
  
  // Timing
  proposedAt: timestamp("proposedAt").defaultNow().notNull(),
  secondedAt: timestamp("secondedAt"),
  debateStartedAt: timestamp("debateStartedAt"),
  decidedAt: timestamp("decidedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  sessionIdx: index("mt_session_idx").on(table.sessionId),
  agendaIdx: index("mt_agenda_idx").on(table.agendaItemId),
  statusIdx: index("mt_status_idx").on(table.status),
  amendmentToIdx: index("mt_amendment_to_idx").on(table.amendmentTo),
}));

export type Motion = typeof motions.$inferSelect;
export type InsertMotion = typeof motions.$inferInsert;

// ============================================================================
// SPEAKER LISTS
// ============================================================================

export const speakerLists = mysqlTable("speaker_lists", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  motionId: int("motionId"), // null for general debate
  
  // State
  isOpen: boolean("isOpen").default(true),
  closedAt: timestamp("closedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  sessionIdx: index("sl_session_idx").on(table.sessionId),
  motionIdx: index("sl_motion_idx").on(table.motionId),
}));

export type SpeakerList = typeof speakerLists.$inferSelect;
export type InsertSpeakerList = typeof speakerLists.$inferInsert;

export const speakerEntries = mysqlTable("speaker_entries", {
  id: int("id").autoincrement().primaryKey(),
  listId: int("listId").notNull(),
  
  userId: int("userId").notNull(),
  scheduledOrder: int("scheduledOrder").notNull(),
  speakingFor: mysqlEnum("speakingFor", ["pro", "con", "neutral"]).default("neutral"),
  
  // Timing
  startTime: timestamp("startTime"),
  endTime: timestamp("endTime"),
  timeUsed: int("timeUsed").default(0), // seconds
  timeLimit: int("timeLimit").default(300), // seconds
  
  // Status
  status: mysqlEnum("status", ["scheduled", "speaking", "completed", "skipped"]).default("scheduled"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  listIdx: index("se_list_idx").on(table.listId),
  userIdx: index("se_user_idx").on(table.userId),
}));

export type SpeakerEntry = typeof speakerEntries.$inferSelect;
export type InsertSpeakerEntry = typeof speakerEntries.$inferInsert;

// ============================================================================
// PLENARY VOTES
// ============================================================================

export const plenaryVotes = mysqlTable("plenary_votes", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  motionId: int("motionId").notNull(),
  
  // Vote method
  method: varchar("method", { length: 50 }).notNull(),
  
  // Totals
  totalEligible: int("totalEligible").notNull(),
  totalVoted: int("totalVoted").notNull(),
  quorumMet: boolean("quorumMet").notNull(),
  
  // Individual votes (for roll call)
  votes: json("votes").$type<Array<{
    voterId: number;
    vote: "yes" | "no" | "abstain" | "absent";
    weight?: number;
  }>>(),
  
  // Summary
  result: json("result").$type<{
    yes: number;
    no: number;
    abstain: number;
    absent: number;
    adopted: boolean;
    requiredThreshold: number;
  }>().notNull(),
  
  // Voting period
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  sessionIdx: index("pv_session_idx").on(table.sessionId),
  motionIdx: index("pv_motion_idx").on(table.motionId),
}));

export type PlenaryVote = typeof plenaryVotes.$inferSelect;
export type InsertPlenaryVote = typeof plenaryVotes.$inferInsert;

// ============================================================================
// RESOLUTIONS
// ============================================================================

export const resolutions = mysqlTable("resolutions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  motionId: int("motionId").notNull(),
  
  // Identification
  number: varchar("number", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  text: text("text").notNull(),
  
  // Status
  status: mysqlEnum("status", [
    "draft", "adopted", "rejected", "published", "implemented"
  ]).default("draft").notNull(),
  
  // Adoption
  adoptedAt: timestamp("adoptedAt"),
  
  // Implementation
  assignedTo: int("assignedTo"),
  implementationDeadline: timestamp("implementationDeadline"),
  implementationNotes: text("implementationNotes"),
  implementedAt: timestamp("implementedAt"),
  
  // Publication
  publishedAt: timestamp("publishedAt"),
  publishedIn: varchar("publishedIn", { length: 255 }),
  
  // Supersession
  supersedesResolutionId: int("supersedesResolutionId"),
  supersededByResolutionId: int("supersededByResolutionId"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  sessionIdx: index("res_session_idx").on(table.sessionId),
  motionIdx: index("res_motion_idx").on(table.motionId),
  numberIdx: index("res_number_idx").on(table.number),
  statusIdx: index("res_status_idx").on(table.status),
}));

export type Resolution = typeof resolutions.$inferSelect;
export type InsertResolution = typeof resolutions.$inferInsert;

// ============================================================================
// POINTS OF ORDER
// ============================================================================

export const pointsOfOrder = mysqlTable("points_of_order", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  raisedById: int("raisedById").notNull(),
  motionId: int("motionId"),
  
  // Content
  type: mysqlEnum("type", ["order", "relevance", "quorum", "division", "appeal"]).notNull(),
  text: text("text").notNull(),
  
  // Chair ruling
  rulingBy: int("rulingBy"),
  ruling: mysqlEnum("ruling", ["sustained", "overruled"]),
  rulingText: text("rulingText"),
  
  // Appeal
  appealed: boolean("appealed").default(false),
  appealResult: mysqlEnum("appealResult", ["upheld", "reversed"]),
  
  // Timing
  raisedAt: timestamp("raisedAt").defaultNow().notNull(),
  ruledAt: timestamp("ruledAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  sessionIdx: index("po_session_idx").on(table.sessionId),
}));

export type PointOfOrder = typeof pointsOfOrder.$inferSelect;
export type InsertPointOfOrder = typeof pointsOfOrder.$inferInsert;
