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

/**
 * MSAP Member Portal - Clean Schema
 * Medical Students' Association of Pakistan Member Management System
 */

// ============ CORE USERS & MEMBERS ============

export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    email: varchar("email", { length: 320 }).notNull(),
    name: text("name"),
    cnic: varchar("cnic", { length: 15 }).unique(),
    phone: varchar("phone", { length: 20 }),
    institution: varchar("institution", { length: 255 }),
    degree: varchar("degree", { length: 100 }),
    graduationYear: int("graduationYear"),
    localCouncilId: int("localCouncilId"),
    // ============ MEMBER PROFILE FIELDS (mirrored from the workflow) ============
    discipline: varchar("discipline", { length: 100 }),
    yearOfStudy: varchar("yearOfStudy", { length: 100 }),
    localCouncil: varchar("localCouncil", { length: 255 }),
    membershipStatus: mysqlEnum("membershipStatus", [
      "Pending",
      "Active",
      "Inactive",
      "Suspended",
      "Terminated",
      "Alumni",
      "Expired",
    ]).default("Pending"),
    membershipId: varchar("membershipId", { length: 50 }).unique(),
    membershipStartDate: timestamp("membershipStartDate"),
    membershipEndDate: timestamp("membershipEndDate"),
    profilePhotoUrl: varchar("profilePhotoUrl", { length: 500 }),
    bio: text("bio"),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: mysqlEnum("role", ["user", "admin", "superadmin", "official"]).default("user"),
    // ============ OFFICIAL PORTAL FIELDS (provisioned by the super admin) ============
    officialPosition: mysqlEnum("officialPosition", [
      "supco",
      "national-president",
      "vice-president",
      "lc-president",
    ]),
    domain: varchar("domain", { length: 100 }),
    // Modules the super admin has opened for this official (empty for members).
    moduleAccess: json("moduleAccess").$type<string[]>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn"),
// ============ MEMBER ACCOUNT FIELDS ============
    // Password-based authentication for members
    passwordHash: varchar("passwordHash", { length: 255 }),
    passwordSetupRequired: boolean("passwordSetupRequired").default(true),
    // One-time password setup token (hashed for security)
    setupTokenHash: varchar("setupTokenHash", { length: 255 }),
    setupTokenExpiresAt: timestamp("setupTokenExpiresAt"),
    setupTokenUsedAt: timestamp("setupTokenUsedAt"),
    // Account status
    active: boolean("active").default(true),
    // Session revocation epoch: every login/setup mints a session carrying the
    // current value; logout, password changes, password resets and account
    // disabling bump it, which invalidates every previously issued session.
    sessionEpoch: int("sessionEpoch").default(0).notNull(),
  },
  (table) => ({
    emailIdx: index("email_idx").on(table.email),
    cnicIdx: index("cnic_idx").on(table.cnic),
    membershipIdIdx: index("membership_id_idx").on(table.membershipId),
    setupTokenIdx: index("setup_token_idx").on(table.setupTokenHash),
  })
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============ LOCAL COUNCILS ============

export const localCouncils = mysqlTable("local_councils", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  shortCode: varchar("shortCode", { length: 10 }).notNull().unique(),
  city: varchar("city", { length: 100 }),
  university: varchar("university", { length: 255 }),
  presidentId: int("presidentId"),
  status: mysqlEnum("status", [
    "Coordinator Institute",
    "Candidate LC",
    "Temporary LC",
    "Permanent LC",
  ]).default("Candidate LC"),
  logoUrl: varchar("logoUrl", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type LocalCouncil = typeof localCouncils.$inferSelect;
export type InsertLocalCouncil = typeof localCouncils.$inferInsert;

// ============ POSITIONS ============

export const positions = mysqlTable("positions", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  level: mysqlEnum("level", ["National", "LC"]).notNull(),
  category: varchar("category", { length: 100 }),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type Position = typeof positions.$inferSelect;
export type InsertPosition = typeof positions.$inferInsert;

// ============ MEMBER POSITIONS ============

export const memberPositions = mysqlTable(
  "member_positions",
  {
    id: int("id").autoincrement().primaryKey(),
    memberId: int("memberId").notNull(),
    positionId: int("positionId").notNull(),
    localCouncilId: int("localCouncilId"),
    startDate: timestamp("startDate").notNull(),
    endDate: timestamp("endDate"),
    isCurrentPosition: boolean("isCurrentPosition").default(true),
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    memberIdx: index("member_idx").on(table.memberId),
  })
);

export type MemberPosition = typeof memberPositions.$inferSelect;
export type InsertMemberPosition = typeof memberPositions.$inferInsert;

// ============ OPPORTUNITIES ============

export const opportunities = mysqlTable(
  "opportunities",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    type: varchar("type", { length: 50 }),
    startDate: timestamp("startDate"),
    endDate: timestamp("endDate"),
    applicationDeadline: timestamp("applicationDeadline"),
    localCouncilId: int("localCouncilId"),
    createdById: int("createdById").notNull(),
    status: mysqlEnum("status", ["Open", "Closed", "Completed"]).default("Open"),
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    lcIdx: index("lc_idx").on(table.localCouncilId),
  })
);

export type Opportunity = typeof opportunities.$inferSelect;
export type InsertOpportunity = typeof opportunities.$inferInsert;

// ============ OPPORTUNITY APPLICATIONS ============

export const opportunityApplications = mysqlTable(
  "opportunity_applications",
  {
    id: int("id").autoincrement().primaryKey(),
    opportunityId: int("opportunityId").notNull(),
    memberId: int("memberId").notNull(),
    applicationText: text("applicationText"),
    status: mysqlEnum("status", [
      "Submitted",
      "Under Review",
      "Accepted",
      "Rejected",
    ]).default("Submitted"),
    appliedAt: timestamp("appliedAt").defaultNow(),
  },
  (table) => ({
    opportunityIdx: index("opportunity_idx").on(table.opportunityId),
  })
);

export type OpportunityApplication = typeof opportunityApplications.$inferSelect;
export type InsertOpportunityApplication =
  typeof opportunityApplications.$inferInsert;

// ============ VOTING ============

export const votingSessions = mysqlTable(
  "voting_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    startDate: timestamp("startDate").notNull(),
    endDate: timestamp("endDate").notNull(),
    createdById: int("createdById").notNull(),
    status: mysqlEnum("status", ["Pending", "Active", "Closed"]).default("Pending"),
    results: json("results"),
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    createdByIdx: index("createdBy_idx").on(table.createdById),
  })
);

export type VotingSession = typeof votingSessions.$inferSelect;
export type InsertVotingSession = typeof votingSessions.$inferInsert;

export const votes = mysqlTable(
  "votes",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionId: int("sessionId").notNull(),
    voterId: int("voterId").notNull(),
    voteOption: varchar("voteOption", { length: 255 }).notNull(),
    votedAt: timestamp("votedAt").defaultNow(),
  },
  (table) => ({
    sessionIdx: index("session_idx").on(table.sessionId),
  })
);

export type Vote = typeof votes.$inferSelect;
export type InsertVote = typeof votes.$inferInsert;

// ============ DOCUMENTS ============

export const documents = mysqlTable(
  "documents",
  {
    id: int("id").autoincrement().primaryKey(),
    memberId: int("memberId").notNull(),
    type: mysqlEnum("type", [
      "Membership Letter",
      "Membership Card",
      "Certificate",
      "CV",
      "Appointment Letter",
      "Other",
    ]).notNull(),
    documentUrl: varchar("documentUrl", { length: 500 }).notNull(),
    documentKey: varchar("documentKey", { length: 255 }).notNull(),
    fileName: varchar("fileName", { length: 255 }),
    generatedAt: timestamp("generatedAt").defaultNow(),
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    memberIdx: index("member_idx").on(table.memberId),
  })
);

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// ============ CV ENTRIES ============

export const cvEntries = mysqlTable(
  "cv_entries",
  {
    id: int("id").autoincrement().primaryKey(),
    memberId: int("memberId").notNull(),
    type: mysqlEnum("type", [
      "Education",
      "Position",
      "Skill",
      "Activity",
      "Achievement",
    ]).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    organization: varchar("organization", { length: 255 }),
    startDate: timestamp("startDate"),
    endDate: timestamp("endDate"),
    isCurrent: boolean("isCurrent").default(false),
    order: int("order").default(0),
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    memberIdx: index("member_idx").on(table.memberId),
  })
);

export type CvEntry = typeof cvEntries.$inferSelect;
export type InsertCvEntry = typeof cvEntries.$inferInsert;

// ============ CONFIGURATION ============

export const configuration = mysqlTable("configuration", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  category: varchar("category", { length: 50 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type Configuration = typeof configuration.$inferSelect;
export type InsertConfiguration = typeof configuration.$inferInsert;

// ============ AUDIT LOG ============

export const auditLog = mysqlTable(
  "audit_log",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId"),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entityType", { length: 50 }),
    entityId: int("entityId"),
    changes: json("changes"),
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    userIdx: index("user_idx").on(table.userId),
  })
);

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

// ============ EMAIL QUEUE ============

export const emailQueue = mysqlTable(
  "email_queue",
  {
    id: int("id").autoincrement().primaryKey(),
    recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    emailType: varchar("emailType", { length: 50 }),
    htmlBody: text("htmlBody"),
    status: mysqlEnum("status", [
      "Pending",
      "Sent",
      "Permanent Failure",
    ]).default("Pending"),
    retryCount: int("retryCount").default(0),
    maxRetries: int("maxRetries").default(3),
    lastAttemptAt: timestamp("lastAttemptAt"),
    sentAt: timestamp("sentAt"),
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (table) => ({
    statusIdx: index("status_idx").on(table.status),
  })
);

export type EmailQueue = typeof emailQueue.$inferSelect;
export type InsertEmailQueue = typeof emailQueue.$inferInsert;

// ============ MEMBERSHIP LIFECYCLE (workflow-based, audited) ============
//
// Suspension / termination are NEVER a direct status flip or delete: each one
// is a case that records reason + evidence + requester, goes through review,
// and only an approved decision applies the change. Every event is appended to
// the case timeline (the audit trail) and the member is notified by email.
// Reinstate reverses a suspension/termination through the same workflow.

export type LifecycleEvidenceItem = {
  label: string;
  dataUrl: string;
};

export type LifecycleTimelineEvent = {
  at: Date;
  byName: string;
  byEmail: string;
  action: string;
  detail?: string | null;
};

export const lifecycleCases = mysqlTable(
  "lifecycle_cases",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    membershipId: varchar("membershipId", { length: 50 }),
    memberName: varchar("memberName", { length: 255 }),
    action: mysqlEnum("action", ["suspend", "terminate", "reinstate"]).notNull(),
    reason: varchar("reason", { length: 120 }).notNull(),
    description: text("description"),
    status: mysqlEnum("status", [
      "pending",
      "approved",
      "rejected",
      "cancelled",
    ])
      .default("pending")
      .notNull(),
    evidence: json("evidence").$type<LifecycleEvidenceItem[]>(),
    requestedByName: varchar("requestedByName", { length: 150 }),
    requestedByEmail: varchar("requestedByEmail", { length: 320 }),
    requestedAt: timestamp("requestedAt").defaultNow().notNull(),
    decidedByName: varchar("decidedByName", { length: 150 }),
    decidedByEmail: varchar("decidedByEmail", { length: 320 }),
    decidedAt: timestamp("decidedAt"),
    decisionNotes: text("decisionNotes"),
    effectiveDate: timestamp("effectiveDate"),
    notificationQueued: boolean("notificationQueued").default(false),
    timeline: json("timeline").$type<LifecycleTimelineEvent[]>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdx: index("lc_user_idx").on(table.userId),
    statusIdx: index("lc_status_idx").on(table.status),
  })
);

export type LifecycleCase = typeof lifecycleCases.$inferSelect;
export type InsertLifecycleCase = typeof lifecycleCases.$inferInsert;

// ============ GOVERNANCE VERSIONING (config-driven rules) ============

export const governanceVersions = mysqlTable(
  "governance_versions",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    version: varchar("version", { length: 40 }).notNull(),
    status: mysqlEnum("status", [
      "draft",
      "submitted",
      "reviewed",
      "presented",
      "voted",
      "approved",
      "rejected",
      "effective",
      "superseded",
    ])
      .default("draft")
      .notNull(),
    supersedesVersionId: int("supersedesVersionId"),
    effectiveFrom: timestamp("effectiveFrom"),
    effectiveTo: timestamp("effectiveTo"),
    sourceDocument: varchar("sourceDocument", { length: 500 }),
    approvalDate: timestamp("approvalDate"),
    approvedBy: varchar("approvedBy", { length: 150 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    versionIdx: index("gov_version_idx").on(table.version),
    effectiveIdx: index("gov_effective_idx").on(table.effectiveFrom),
  })
);

export type GovernanceVersion = typeof governanceVersions.$inferSelect;
export type InsertGovernanceVersion = typeof governanceVersions.$inferInsert;

export const policyParameters = mysqlTable(
  "policy_parameters",
  {
    id: int("id").autoincrement().primaryKey(),
    governanceVersionId: int("governanceVersionId").notNull(),
    key: varchar("key", { length: 100 }).notNull(),
    value: json("value").notNull(),
    datatype: mysqlEnum("datatype", ["string", "number", "boolean", "json"])
      .default("string")
      .notNull(),
    sourceClause: varchar("sourceClause", { length: 255 }),
    description: text("description"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    versionKeyIdx: index("gov_param_version_key_idx").on(
      table.governanceVersionId,
      table.key
    ),
  })
);

export type PolicyParameter = typeof policyParameters.$inferSelect;
export type InsertPolicyParameter = typeof policyParameters.$inferInsert;

// ============ MEMBER CARDS (issuance + holder-signature workflow) ============

export const memberCards = mysqlTable(
  "member_cards",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().unique(),
    version: int("version").default(0).notNull(),
    holderSignature: json("holderSignature")
      .$type<{
        dataUrl: string | null;
        status: string;
        submittedAt: Date | null;
        reviewedAt: Date | null;
      }>()
      .default({
        dataUrl: null,
        status: "none",
        submittedAt: null,
        reviewedAt: null,
      }),
    identitySnapshot: json("identitySnapshot")
      .$type<{
        memberName: string;
        institution: string;
        discipline: string;
        yearOfStudy: string;
        localCouncil: string;
        graduationYear: number | null;
        photoUrl: string;
      }>(),
    reissueRequested: boolean("reissueRequested").default(false),
    reissueRequestedAt: timestamp("reissueRequestedAt"),
    issuedAt: timestamp("issuedAt"),
    expiresAt: timestamp("expiresAt"),
    verificationToken: varchar("verificationToken", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdx: index("mc_user_idx").on(table.userId),
  })
);

export type MemberCardRow = typeof memberCards.$inferSelect;
export type InsertMemberCardRow = typeof memberCards.$inferInsert;

// ============ MEMBERSHIP APPLICATIONS (local, offline-capable) ============
//
// When MSAP_APPS_SCRIPT_URL is not configured, membership form submissions
// are stored locally in this table instead of being forwarded to the Google
// Apps Script. Admins review and approve/reject applications through the
// portal. Approved applications create the member account automatically.

export const membershipApplications = mysqlTable(
  "membership_applications",
  {
    id: int("id").autoincrement().primaryKey(),
    // Identity
    email: varchar("email", { length: 320 }).notNull(),
    fullName: varchar("fullName", { length: 150 }).notNull(),
    personalEmail: varchar("personalEmail", { length: 320 }),
    contactNumber: varchar("contactNumber", { length: 25 }).notNull(),
    age: int("age").notNull(),
    dateOfBirth: varchar("dateOfBirth", { length: 30 }).notNull(),
    cnic: varchar("cnic", { length: 20 }).notNull(),
    gender: varchar("gender", { length: 30 }).notNull(),
    cityOfResidence: varchar("cityOfResidence", { length: 100 }).notNull(),
    address: varchar("address", { length: 500 }).notNull(),
    reasonForJoining: varchar("reasonForJoining", { length: 2000 }).notNull(),
    // Academic
    courseLevel: varchar("courseLevel", { length: 50 }).notNull(),
    courseOfStudy: varchar("courseOfStudy", { length: 200 }).notNull(),
    otherCourse: varchar("otherCourse", { length: 255 }),
    yearOfStudy: varchar("yearOfStudy", { length: 100 }).notNull(),
    institute: varchar("institute", { length: 255 }).notNull(),
    otherInstitute: varchar("otherInstitute", { length: 255 }),
    collegeRollNumber: varchar("collegeRollNumber", { length: 100 }).notNull(),
    // Source & payment
    discoverySources: json("discoverySources").$type<string[]>(),
    otherDiscoverySource: varchar("otherDiscoverySource", { length: 255 }),
    paymentAccountName: varchar("paymentAccountName", { length: 255 }).notNull(),
    graduationDate: varchar("graduationDate", { length: 30 }),
    conflictOfInterest: varchar("conflictOfInterest", { length: 2000 }).default("No"),
    conflictOrganization: varchar("conflictOrganization", { length: 255 }),
    conflictRole: varchar("conflictRole", { length: 255 }),
    // File uploads (data URLs stored for review; uploaded to storage on approval)
    profilePhotoUrl: varchar("profilePhotoUrl", { length: 500 }),
    feeReceiptUrl: varchar("feeReceiptUrl", { length: 500 }),
    cnicCopyUrl: varchar("cnicCopyUrl", { length: 500 }),
    // Acknowledgements
    termsAccepted: boolean("termsAccepted").default(false),
    undertakingAccepted: boolean("undertakingAccepted").default(false),
    introductionAcknowledged: boolean("introductionAcknowledged").default(false),
    incompleteAcknowledgement: boolean("incompleteAcknowledgement").default(false),
    // Workflow
    status: mysqlEnum("status", [
      "pending",
      "approved",
      "rejected",
    ]).default("pending").notNull(),
    membershipId: varchar("membershipId", { length: 50 }),
    reviewedBy: varchar("reviewedBy", { length: 150 }),
    reviewedAt: timestamp("reviewedAt"),
    reviewNotes: text("reviewNotes"),
    // Metadata
    submittedAt: timestamp("submittedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    emailIdx: index("app_email_idx").on(table.email),
    cnicIdx: index("app_cnic_idx").on(table.cnic),
    statusIdx: index("app_status_idx").on(table.status),
  })
);

export type MembershipApplication = typeof membershipApplications.$inferSelect;
export type InsertMembershipApplication = typeof membershipApplications.$inferInsert;
