/**
 * Remaining Platform Schema - Volunteer, Skills, Training, Recognition,
 * Application Platform, Meetings/Committees, Import/Export
 *
 * Implements:
 * - §127: Volunteer Management
 * - §128: Skills and Talent
 * - §129: Training/LMS
 * - §130: Recognition System
 * - §49-53: Application Platform
 * - §113-115: Meeting/Board/Committee Management
 * - §138: Import/Export
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
} from "drizzle-orm/mysql-core";

// ============================================================================
// VOLUNTEER MANAGEMENT (§127)
// ============================================================================

export const volunteerOpportunities = mysqlTable("volunteer_opportunities", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).notNull(), // event_support, community_service, admin, mentorship, other
  skills: json("skills").$type<string[]>(),
  commitmentHours: int("commitmentHours"),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  maxVolunteers: int("maxVolunteers"),
  currentVolunteers: int("currentVolunteers").default(0),
  status: mysqlEnum("status", ["open", "filled", "closed", "cancelled"]).default("open"),
  metadata: json("metadata"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("vo_org_idx").on(table.organizationId),
}));

export const volunteerSignups = mysqlTable("volunteer_signups", {
  id: int("id").autoincrement().primaryKey(),
  opportunityId: int("opportunityId").notNull(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "completed", "cancelled"]).default("pending"),
  hoursLogged: decimal("hoursLogged", { precision: 6, scale: 2 }).default("0"),
  supervisorId: int("supervisorId"),
  feedback: text("feedback"),
  rating: int("rating"), // 1-5
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  oppIdx: index("vs_opp_idx").on(table.opportunityId),
  userIdx: index("vs_user_idx").on(table.userId),
}));

// ============================================================================
// SKILLS AND TALENT (§128)
// ============================================================================

export const memberSkills = mysqlTable("member_skills", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  skillName: varchar("skillName", { length: 100 }).notNull(),
  category: varchar("category", { length: 50 }), // technical, leadership, communication, medical, administrative, other
  proficiency: mysqlEnum("proficiency", ["beginner", "intermediate", "advanced", "expert"]).default("intermediate"),
  verified: boolean("verified").default(false),
  verifiedBy: int("verifiedBy"),
  endorsements: int("endorsements").default(0),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("ms_user_idx").on(table.userId),
}));

// ============================================================================
// TRAINING/LMS (§129)
// ============================================================================

export const trainingCourses = mysqlTable("training_courses", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }), // orientation, leadership, governance, medical, safety, compliance
  type: mysqlEnum("type", ["self_paced", "instructor_led", "hybrid", "workshop"]).default("self_paced"),
  duration: int("duration"), // in minutes
  maxEnrollments: int("maxEnrollments"),
  currentEnrollments: int("currentEnrollments").default(0),
  passingScore: int("passingScore").default(70), // percentage
  certificateTemplate: varchar("certificateTemplate", { length: 255 }),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft"),
  metadata: json("metadata"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("tc_org_idx").on(table.organizationId),
}));

export const trainingEnrollments = mysqlTable("training_enrollments", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["enrolled", "in_progress", "completed", "dropped"]).default("enrolled"),
  progress: int("progress").default(0), // 0-100
  score: int("score"),
  passed: boolean("passed"),
  certificateIssued: boolean("certificateIssued").default(false),
  enrolledAt: timestamp("enrolledAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (table) => ({
  courseIdx: index("te_course_idx").on(table.courseId),
  userIdx: index("te_user_idx").on(table.userId),
}));

// ============================================================================
// RECOGNITION SYSTEM (§130)
// ============================================================================

export const awards = mysqlTable("awards", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", ["excellence", "service", "leadership", "innovation", "humanitarian", "academic", "other"]).default("excellence"),
  criteria: text("criteria"),
  frequency: varchar("frequency", { length: 50 }), // annual, quarterly, one_time
  nominationOpen: boolean("nominationOpen").default(false),
  nominationDeadline: timestamp("nominationDeadline"),
  status: mysqlEnum("status", ["active", "inactive", "archived"]).default("active"),
  metadata: json("metadata"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orgIdx: index("aw_org_idx").on(table.organizationId),
}));

export const awardNominations = mysqlTable("award_nominations", {
  id: int("id").autoincrement().primaryKey(),
  awardId: int("awardId").notNull(),
  nomineeId: int("nomineeId").notNull(),
  nominatorId: int("nominatorId").notNull(),
  justification: text("justification").notNull(),
  status: mysqlEnum("status", ["submitted", "under_review", "shortlisted", "awarded", "rejected"]).default("submitted"),
  decisionNotes: text("decisionNotes"),
  decidedBy: int("decidedBy"),
  decidedAt: timestamp("decidedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  awardIdx: index("an_award_idx").on(table.awardId),
  nomineeIdx: index("an_nominee_idx").on(table.nomineeId),
}));

// ============================================================================
// APPLICATION PLATFORM (§49-53)
// ============================================================================

export const applicationDefinitions = mysqlTable("application_definitions", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).notNull(), // membership, leadership, event, project, custom
  formSchema: json("formSchema").$type<Record<string, any>>(),
  workflowId: int("workflowId"),
  status: mysqlEnum("status", ["draft", "active", "inactive", "archived"]).default("draft"),
  metadata: json("metadata"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("ad_org_idx").on(table.organizationId),
}));

export const applicationSubmissions = mysqlTable("application_submissions", {
  id: int("id").autoincrement().primaryKey(),
  definitionId: int("definitionId").notNull(),
  applicantId: int("applicantId").notNull(),
  status: mysqlEnum("status", ["submitted", "under_review", "approved", "rejected", "withdrawn", "expired"]).default("submitted"),
  formData: json("formData"),
  reviewNotes: text("reviewNotes"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  decisionAt: timestamp("decisionAt"),
  organizationId: int("organizationId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  defIdx: index("as_def_idx").on(table.definitionId),
  applicantIdx: index("as_applicant_idx").on(table.applicantId),
  statusIdx: index("as_status_idx").on(table.status),
}));

// ============================================================================
// MEETING/BOARD/COMMITTEE MANAGEMENT (§113-115)
// ============================================================================

export const meetings = mysqlTable("meetings", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  title: varchar("title", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["board", "committee", "task_force", "general", "special", "working_group"]).default("board"),
  status: mysqlEnum("status", ["scheduled", "in_progress", "completed", "cancelled", "postponed"]).default("scheduled"),
  scheduledDate: timestamp("scheduledDate"),
  endDate: timestamp("endDate"),
  venue: varchar("venue", { length: 255 }),
  onlineUrl: varchar("onlineUrl", { length: 500 }),
  mode: mysqlEnum("mode", ["in_person", "online", "hybrid"]).default("in_person"),
  quorum: int("quorum"),
  agenda: json("agenda").$type<Array<{
    id: string;
    title: string;
    description?: string;
    presenter?: string;
    status: string;
    motionId?: number;
  }>>(),
  minutes: text("minutes"),
  decisions: json("decisions").$type<Array<{
    id: string;
    text: string;
    motionId?: number;
    voteResult?: string;
  }>>(),
  attendees: json("attendees").$type<number[]>(),
  metadata: json("metadata"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("mtg_org_idx").on(table.organizationId),
  statusIdx: index("mtg_status_idx").on(table.status),
}));

export const committeeMemberships = mysqlTable("committee_memberships", {
  id: int("id").autoincrement().primaryKey(),
  committeeId: int("committeeId").notNull(),
  userId: int("userId").notNull(),
  role: varchar("role", { length: 100 }), // chair, vice_chair, secretary, member, observer
  status: mysqlEnum("status", ["active", "inactive", "resigned", "removed"]).default("active"),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  committeeIdx: index("cm_committee_idx").on(table.committeeId),
  userIdx: index("cm_user_idx").on(table.userId),
}));

// ============================================================================
// IMPORT/EXPORT (§138)
// ============================================================================

export const importJobs = mysqlTable("import_jobs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  type: varchar("type", { length: 50 }).notNull(), // members, chapters, activities, events, finance, custom
  format: mysqlEnum("format", ["csv", "xlsx", "json", "xml"]).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed", "cancelled"]).default("pending"),
  fileName: varchar("fileName", { length: 255 }),
  totalRows: int("totalRows").default(0),
  processedRows: int("processedRows").default(0),
  successRows: int("successRows").default(0),
  errorRows: int("errorRows").default(0),
  errors: json("errors").$type<Array<{ row: number; message: string }>>(),
  mapping: json("mapping"),
  result: json("result"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (table) => ({
  orgIdx: index("ij_org_idx").on(table.organizationId),
  statusIdx: index("ij_status_idx").on(table.status),
}));

export const exportJobs = mysqlTable("export_jobs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  type: varchar("type", { length: 50 }).notNull(),
  format: mysqlEnum("format", ["csv", "xlsx", "json", "pdf"]).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending"),
  filters: json("filters"),
  fileUrl: varchar("fileUrl", { length: 500 }),
  fileSize: int("fileSize"),
  recordCount: int("recordCount").default(0),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (table) => ({
  orgIdx: index("ej_org_idx").on(table.organizationId),
}));
