import { and, eq, isNull, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  users,
  localCouncils,
  positions,
  memberPositions,
  opportunities,
  opportunityApplications,
  votingSessions,
  votes,
  documents,
  cvEntries,
  configuration,
  auditLog,
  emailQueue,
  lifecycleCases,
  memberCards,
  membershipApplications,
  MembershipApplication,
  InsertUser,
  User,
  LocalCouncil,
  InsertLocalCouncil,
  Position,
  InsertPosition,
  MemberPosition,
  InsertMemberPosition,
  Opportunity,
  InsertOpportunity,
  OpportunityApplication,
  InsertOpportunityApplication,
  VotingSession,
  InsertVotingSession,
  Vote,
  InsertVote,
  Document,
  InsertDocument,
  CvEntry,
  InsertCvEntry,
  Configuration,
  InsertConfiguration,
  AuditLog,
  InsertAuditLog,
  EmailQueue,
  InsertEmailQueue,
  MemberCardRow,
  InsertMemberCardRow,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import * as memberAccounts from "./services/memberAccountService";
import { childLogger } from "./_core/logger";

const log = childLogger("Database");

// ============================================================================
// Connection pool
// ============================================================================

let _pool: mysql.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Lazily create a MySQL2 connection pool. Returns null when DATABASE_URL is
 * not configured — callers fall back to the in-memory store.
 */
function getPool(): mysql.Pool | null {
  if (_pool) return _pool;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  try {
    _pool = mysql.createPool(url);
    log.info("MySQL2 connection pool created");
  } catch (error) {
    log.warn({ err: error }, "Failed to create connection pool");
    _pool = null;
  }
  return _pool;
}

export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  try {
    // Drizzle can connect directly from a URL string
    _db = drizzle(url);
    log.info("Drizzle connected");
  } catch (error) {
    log.warn({ err: error }, "Failed to create Drizzle instance");
    _db = null;
  }
  return _db;
}

/**
 * Returns the raw mysql2 pool for direct SQL operations (used by the
 * persistence layer for batch upserts).
 */
export function getPoolDirect(): mysql.Pool | null {
  return getPool();
}

export async function upsertUser(user: InsertUser): Promise<User> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  // Member accounts (and OAuth users) live in the member account store.
  return memberAccounts.upsertUser({
    openId: user.openId,
    email: user.email,
    name: user.name,
    loginMethod: user.loginMethod,
    lastSignedIn: user.lastSignedIn,
  });
}

export async function getUserByOpenId(openId: string): Promise<User | null> {
  // The member account store resolves OAuth sessions and member sessions
  // (openId format "member:<membershipId>") through one identity path.
  return memberAccounts.findUserByOpenId(openId) ?? null;
}

// ============ LOCAL COUNCILS ============

export async function getLocalCouncils() {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(localCouncils);
  } catch (error) {
    log.warn({ err: error }, "Failed to get local councils");
    return [];
  }
}

export async function getLocalCouncilById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const result = await db.select().from(localCouncils).where(eq(localCouncils.id, id)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    log.warn({ err: error }, "Failed to get local council");
    return undefined;
  }
}

// ============ POSITIONS ============

export async function getPositions() {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(positions);
  } catch (error) {
    log.warn({ err: error }, "Failed to get positions");
    return [];
  }
}

// ============ MEMBER POSITIONS ============

export async function getMemberPositions(userId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(memberPositions).where(eq(memberPositions.memberId, userId));
  } catch (error) {
    log.warn({ err: error }, "Failed to get member positions");
    return [];
  }
}

// ============ OPPORTUNITIES ============

export async function getOpportunities() {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(opportunities);
  } catch (error) {
    log.warn({ err: error }, "Failed to get opportunities");
    return [];
  }
}

export async function getOpportunityById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const result = await db.select().from(opportunities).where(eq(opportunities.id, id)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    log.warn({ err: error }, "Failed to get opportunity");
    return undefined;
  }
}

// ============ OPPORTUNITY APPLICATIONS ============

export async function getOpportunityApplications(opportunityId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(opportunityApplications)
      .where(eq(opportunityApplications.opportunityId, opportunityId));
  } catch (error) {
    log.warn({ err: error }, "Failed to get opportunity applications");
    return [];
  }
}

export async function getUserOpportunityApplications(userId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(opportunityApplications)
      .where(eq(opportunityApplications.memberId, userId));
  } catch (error) {
    log.warn({ err: error }, "Failed to get user opportunity applications");
    return [];
  }
}

/**
 * Record a member's application for an opportunity.
 * Returns the new row id, or null when the database is unavailable/failed.
 */
export async function createOpportunityApplication(
  opportunityId: number,
  memberId: number,
  applicationText: string
) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .insert(opportunityApplications)
      .values({ opportunityId, memberId, applicationText });
    return { id: Number(result[0].insertId) };
  } catch (error) {
    log.warn({ err: error }, "Failed to create opportunity application");
    return null;
  }
}

// ============ VOTING SESSIONS ============

export async function getVotingSessions() {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(votingSessions);
  } catch (error) {
    log.warn({ err: error }, "Failed to get voting sessions");
    return [];
  }
}

export async function getVotingSessionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const result = await db.select().from(votingSessions).where(eq(votingSessions.id, id)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    log.warn({ err: error }, "Failed to get voting session");
    return undefined;
  }
}

// ============ VOTES ============

/**
 * Aggregate the votes cast in a voting session into per-option totals.
 * Safe fallback for an unprovisioned database.
 */
export async function getVotingSessionResults(sessionId: number): Promise<{
  totals: Record<string, number>;
  totalVotes: number;
}> {
  const db = await getDb();
  if (!db) return { totals: {}, totalVotes: 0 };

  try {
    const rows = await db.select().from(votes).where(eq(votes.sessionId, sessionId));
    const totals: Record<string, number> = {};
    for (const row of rows) {
      totals[row.voteOption] = (totals[row.voteOption] ?? 0) + 1;
    }
    return { totals, totalVotes: rows.length };
  } catch (error) {
    log.warn({ err: error }, "Failed to get voting session results");
    return { totals: {}, totalVotes: 0 };
  }
}

/**
 * Record one member's vote for a voting session.
 * Returns `duplicate: true` when this member has already voted, so callers
 * can reject a second ballot without inserting it.
 */
export async function castVote(
  sessionId: number,
  voterId: number,
  voteOption: string
): Promise<{ success: boolean; duplicate: boolean }> {
  const db = await getDb();
  if (!db) return { success: false, duplicate: false };

  try {
    const existing = await db
      .select()
      .from(votes)
      .where(and(eq(votes.sessionId, sessionId), eq(votes.voterId, voterId)))
      .limit(1);
    if (existing.length > 0) {
      return { success: false, duplicate: true };
    }
    await db.insert(votes).values({
      sessionId,
      voterId,
      voteOption,
      votedAt: new Date(),
    });
    return { success: true, duplicate: false };
  } catch (error) {
    log.warn({ err: error }, "Failed to cast vote");
    return { success: false, duplicate: false };
  }
}

export async function getUserVote(sessionId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const result = await db
      .select()
      .from(votes)
      .where(and(eq(votes.sessionId, sessionId), eq(votes.voterId, userId)))
      .limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    log.warn({ err: error }, "Failed to get user vote");
    return undefined;
  }
}

// ============ DOCUMENTS ============

export async function getUserDocuments(userId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(documents).where(eq(documents.memberId, userId));
  } catch (error) {
    log.warn({ err: error }, "Failed to get user documents");
    return [];
  }
}

export async function getDocumentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const result = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    log.warn({ err: error }, "Failed to get document");
    return undefined;
  }
}

// ============ CV ENTRIES ============

export async function getUserCVEntries(userId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(cvEntries).where(eq(cvEntries.memberId, userId));
  } catch (error) {
    log.warn({ err: error }, "Failed to get user CV entries");
    return [];
  }
}

// ============ CONFIGURATION ============

export async function getConfiguration(key: string) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const result = await db.select().from(configuration).where(eq(configuration.key, key)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    log.warn({ err: error }, "Failed to get configuration");
    return undefined;
  }
}

export async function getAllConfiguration() {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(configuration);
  } catch (error) {
    log.warn({ err: error }, "Failed to get all configuration");
    return [];
  }
}

// ============ EMAIL QUEUE ============

export async function getPendingEmails() {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(emailQueue)
      .where(eq(emailQueue.status, "Pending"));
  } catch (error) {
    log.warn({ err: error }, "Failed to get pending emails");
    return [];
  }
}

// ============ AUDIT LOG ============

export async function logAuditEvent(
  userId: number,
  action: string,
  entityType: string,
  entityId: number,
  changes?: string
) {
  const db = await getDb();
  if (!db) return;

  try {
    await db.insert(auditLog).values({
      userId,
      action,
      entityType,
      entityId,
      changes,
      createdAt: new Date(),
    });
  } catch (error) {
    log.warn({ err: error }, "Failed to log audit event");
  }
}

export async function getAuditLogs(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(auditLog).limit(limit);
  } catch (error) {
    log.warn({ err: error }, "Failed to get audit logs");
    return [];
  }
}

// ============ MEMBERSHIP APPLICATIONS (local/offline) ============

/**
 * List membership applications with optional status filter and search.
 */
export async function listMembershipApplications(params: {
  status?: string;
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<MembershipApplication[]> {
  const pool = getPoolDirect();
  if (!pool) return [];

  try {
    const conn = await pool.getConnection();
    try {
      let whereClause = "WHERE 1=1";
      const args: any[] = [];

      if (params.status) {
        whereClause += " AND status = ?";
        args.push(params.status);
      }
      if (params.query) {
        whereClause += " AND (fullName LIKE ? OR email LIKE ? OR cnic LIKE ? OR membershipId LIKE ?)";
        const q = `%${params.query}%`;
        args.push(q, q, q, q);
      }

      const limit = params.limit || 50;
      const offset = params.offset || 0;

      const [rows] = await conn.query(
        `SELECT * FROM membership_applications ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        [...args, limit, offset]
      );
      return rows as MembershipApplication[];
    } finally {
      conn.release();
    }
  } catch (error) {
    log.warn({ err: error }, "Failed to list membership applications");
    return [];
  }
}

/**
 * Get a single membership application by ID.
 */
export async function getMembershipApplication(
  applicationId: number
): Promise<MembershipApplication | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const rows = await db
      .select()
      .from(membershipApplications)
      .where(eq(membershipApplications.id, applicationId))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    log.warn({ err: error }, "Failed to get membership application");
    return null;
  }
}

/**
 * Approve a membership application. Creates the member account, assigns
 * a membership ID, and returns the created user.
 */
export async function approveMembershipApplication(
  applicationId: number,
  membershipId: string,
  reviewedBy: string,
  notes?: string
): Promise<User | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Get the application
    const appRows = await db
      .select()
      .from(membershipApplications)
      .where(eq(membershipApplications.id, applicationId))
      .limit(1);
    const app = appRows[0];
    if (!app || app.status !== "pending") return null;

    // Check if membership ID is already taken
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.membershipId, membershipId))
      .limit(1);
    if (existingUser.length > 0) {
      throw new Error(`Membership ID ${membershipId} is already in use.`);
    }

    // Create the user account
    const user = memberAccounts.upsertUser({
      openId: `member:${membershipId}`,
      email: app.email.toLowerCase(),
      name: app.fullName,
      phone: app.contactNumber,
      institution: app.institute,
      degree: app.courseOfStudy,
      graduationYear: app.graduationDate ? parseInt(app.graduationDate) : undefined,
      discipline: app.courseOfStudy,
      yearOfStudy: app.yearOfStudy,
      localCouncil: undefined,
      membershipId: membershipId,
      membershipStatus: "Active",
      profilePhotoUrl: app.profilePhotoUrl || undefined,
      loginMethod: "member-password",
    });

    // Issue a password setup token
    const issued = memberAccounts.issueSetupToken(user.id);

    // Update the application status
    await db
      .update(membershipApplications)
      .set({
        status: "approved",
        membershipId: membershipId,
        reviewedBy: reviewedBy,
        reviewedAt: new Date(),
        reviewNotes: notes || null,
      })
      .where(eq(membershipApplications.id, applicationId));

    // Store the membership ID for the setup email
    if (issued) {
      // Queue the setup email (best-effort, async)
      const { queuePasswordSetupEmail } = await import("./services/emailService");
      void queuePasswordSetupEmail({
        memberName: user.name || "MSAP Member",
        membershipId: membershipId,
        recipientEmail: user.email,
        setupUrl: `${memberAccounts.getPortalBaseUrl()}/set-password?token=${issued.rawToken}`,
        expiresAt: issued.expiresAt,
      });
    }

    return user;
  } catch (error) {
    log.error({ err: error }, "Failed to approve membership application");
    throw error;
  }
}

/**
 * Reject a membership application.
 */
export async function rejectMembershipApplication(
  applicationId: number,
  reviewedBy: string,
  notes?: string
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const appRows = await db
      .select()
      .from(membershipApplications)
      .where(eq(membershipApplications.id, applicationId))
      .limit(1);
    const app = appRows[0];
    if (!app || app.status !== "pending") return false;

    await db
      .update(membershipApplications)
      .set({
        status: "rejected",
        reviewedBy: reviewedBy,
        reviewedAt: new Date(),
        reviewNotes: notes || null,
      })
      .where(eq(membershipApplications.id, applicationId));

    return true;
  } catch (error) {
    log.error({ err: error }, "Failed to reject membership application");
    return false;
  }
}
