/**
 * MySQL persistence for the member account store.
 *
 * Replaces the JSON-file snapshot with MySQL-backed load/save so issued cards,
 * member accounts and lifecycle cases survive server restarts without relying
 * on a fragile JSON blob.
 *
 * Usage:
 *   - `loadStoreFromDb()` replaces `restoreStoreFromDisk()` at boot
 *   - `saveStoreToDb()` replaces `flushStore()` on every mutation
 *
 * Both functions are best-effort: a missing or misconfigured database simply
 * means the in-memory store is used without persistence (same as the legacy
 * JSON-file fallback).
 */

import { eq, inArray, and } from "drizzle-orm";
import {
  users,
  documents,
  cvEntries,
  lifecycleCases,
  memberCards,
  configuration,
  type User,
  type Document,
  type CvEntry,
  type LifecycleCase,
  type LifecycleEvidenceItem,
  type LifecycleTimelineEvent,
  type MemberCardRow,
} from "../../drizzle/schema";
import { getPoolDirect } from "../db";
import type { MemberStoreSnapshot } from "./memberAccountService";
import { childLogger } from "../_core/logger";

const log = childLogger("MemberStoreDb");

// ============================================================================
// Helpers
// ============================================================================

/** Safely convert a value to a Date (handles strings from MySQL). */
function toDate(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Parse a JSON column value that may already be an object or a string. */
function parseJson<T>(v: unknown, fallback: T): T {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "object") return v as T;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

// ============================================================================
// Load from MySQL
// ============================================================================

/**
 * Load the full member store from MySQL. Returns null when the database is
 * unavailable or empty (caller falls back to an empty store or JSON file).
 */
export async function loadStoreFromDb(): Promise<MemberStoreSnapshot | null> {
  const pool = getPoolDirect();
  if (!pool) return null;

  try {
    const conn = await pool.getConnection();
    try {
      // ── Users ──────────────────────────────────────────────────────────
      const [userRows] = await conn.query(
        "SELECT * FROM users ORDER BY id ASC"
      );
      const dbUsers = (userRows as any[]).map(rowToUser);

      // ── Documents ──────────────────────────────────────────────────────
      const [docRows] = await conn.query(
        "SELECT * FROM documents ORDER BY id ASC"
      );
      const dbDocs = (docRows as any[]).map(rowToDocument);

      // ── CV entries ─────────────────────────────────────────────────────
      const [cvRows] = await conn.query(
        "SELECT * FROM cv_entries ORDER BY id ASC"
      );
      const dbCvEntries = (cvRows as any[]).map(rowToCvEntry);

      // ── Lifecycle cases ────────────────────────────────────────────────
      const [lcRows] = await conn.query(
        "SELECT * FROM lifecycle_cases ORDER BY id ASC"
      );
      const dbLifecycleCases = (lcRows as any[]).map(rowToLifecycleCase);

      // ── Member cards ───────────────────────────────────────────────────
      const [cardRows] = await conn.query(
        "SELECT * FROM member_cards ORDER BY id ASC"
      );
      const dbCards = (cardRows as any[]).map(rowToCardRecord);

      // ── Counters ───────────────────────────────────────────────────────
      const maxUserId =
        dbUsers.length > 0 ? Math.max(...dbUsers.map((u) => u.id)) + 1 : 1;
      const maxDocId =
        dbDocs.length > 0 ? Math.max(...dbDocs.map((d) => d.id)) + 1 : 1;
      const maxCvId =
        dbCvEntries.length > 0
          ? Math.max(...dbCvEntries.map((c) => c.id)) + 1
          : 1;

      // ── President signature (from configuration table) ─────────────────
      const [sigRows] = await conn.query(
        "SELECT value FROM configuration WHERE `key` = ?",
        ["presidentSignatureUrl"]
      );
      const sigRow = (sigRows as any[])[0];
      const presidentSignatureUrl = sigRow?.value || null;

      return {
        version: 1,
        savedAt: new Date().toISOString(),
        nextUserId: maxUserId,
        nextDocId: maxDocId,
        nextCvEntryId: maxCvId,
        presidentSignatureUrl,
        users: dbUsers,
        docs: dbDocs,
        cvEntries: dbCvEntries,
        cards: dbCards,
        lifecycleCases: dbLifecycleCases,
      };
    } finally {
      conn.release();
    }
  } catch (error) {
    log.warn({ err: error }, "Failed to load from database");
    return null;
  }
}

// ============================================================================
// Save to MySQL
// ============================================================================

/**
 * Persist the full member store snapshot to MySQL. Uses a transaction for
 * atomicity: delete-then-insert for each table.
 *
 * This is called from `persistStore()` in memberAccountService.ts, replacing
 * the JSON-file write.
 */
export async function saveStoreToDb(snapshot: MemberStoreSnapshot): Promise<void> {
  const pool = getPoolDirect();
  if (!pool) return;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ── Users ──────────────────────────────────────────────────────────
    await conn.query("DELETE FROM users");
    if (snapshot.users.length > 0) {
      // Batch insert in chunks of 100 to avoid packet-size limits
      for (let i = 0; i < snapshot.users.length; i += 100) {
        const chunk = snapshot.users.slice(i, i + 100);
        const values = chunk.map((u) => userToRow(u));
        const placeholders = values.map(() => "(?)").join(",");
        await conn.query(
          `INSERT INTO users VALUES ${placeholders}`,
          values.map((v) => [v]).flat()
        );
      }
    }

    // ── Documents ──────────────────────────────────────────────────────
    await conn.query("DELETE FROM documents");
    if (snapshot.docs.length > 0) {
      for (let i = 0; i < snapshot.docs.length; i += 100) {
        const chunk = snapshot.docs.slice(i, i + 100);
        const values = chunk.map((d) => documentToRow(d));
        const placeholders = values.map(() => "(?)").join(",");
        await conn.query(
          `INSERT INTO documents VALUES ${placeholders}`,
          values.map((v) => [v]).flat()
        );
      }
    }

    // ── CV entries ─────────────────────────────────────────────────────
    await conn.query("DELETE FROM cv_entries");
    if (snapshot.cvEntries.length > 0) {
      for (let i = 0; i < snapshot.cvEntries.length; i += 100) {
        const chunk = snapshot.cvEntries.slice(i, i + 100);
        const values = chunk.map((c) => cvEntryToRow(c));
        const placeholders = values.map(() => "(?)").join(",");
        await conn.query(
          `INSERT INTO cv_entries VALUES ${placeholders}`,
          values.map((v) => [v]).flat()
        );
      }
    }

    // ── Lifecycle cases ────────────────────────────────────────────────
    await conn.query("DELETE FROM lifecycle_cases");
    if (snapshot.lifecycleCases.length > 0) {
      for (let i = 0; i < snapshot.lifecycleCases.length; i += 100) {
        const chunk = snapshot.lifecycleCases.slice(i, i + 100);
        const values = chunk.map((lc) => lifecycleCaseToRow(lc));
        const placeholders = values.map(() => "(?)").join(",");
        await conn.query(
          `INSERT INTO lifecycle_cases VALUES ${placeholders}`,
          values.map((v) => [v]).flat()
        );
      }
    }

    // ── Member cards ───────────────────────────────────────────────────
    await conn.query("DELETE FROM member_cards");
    if (snapshot.cards.length > 0) {
      for (let i = 0; i < snapshot.cards.length; i += 100) {
        const chunk = snapshot.cards.slice(i, i + 100);
        const values = chunk.map((c) => cardRecordToRow(c));
        const placeholders = values.map(() => "(?)").join(",");
        await conn.query(
          `INSERT INTO member_cards VALUES ${placeholders}`,
          values.map((v) => [v]).flat()
        );
      }
    }

    // ── President signature (configuration table) ──────────────────────
    if (snapshot.presidentSignatureUrl !== undefined) {
      await conn.query(
        "INSERT INTO configuration (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
        ["presidentSignatureUrl", snapshot.presidentSignatureUrl || ""]
      );
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback().catch(() => {});
    log.warn({ err: error }, "Failed to save to database");
  } finally {
    conn.release();
  }
}

// ============================================================================
// Row converters: MySQL row → in-memory type
// ============================================================================

function rowToUser(row: any): User {
  return {
    id: row.id,
    openId: row.openId,
    email: row.email,
    name: row.name ?? null,
    cnic: row.cnic ?? null,
    phone: row.phone ?? null,
    institution: row.institution ?? null,
    degree: row.degree ?? null,
    graduationYear: row.graduationYear ?? null,
    localCouncilId: row.localCouncilId ?? null,
    discipline: row.discipline ?? null,
    yearOfStudy: row.yearOfStudy ?? null,
    localCouncil: row.localCouncil ?? null,
    membershipStatus: row.membershipStatus ?? "Pending",
    membershipId: row.membershipId ?? null,
    membershipStartDate: toDate(row.membershipStartDate),
    membershipEndDate: toDate(row.membershipEndDate),
    profilePhotoUrl: row.profilePhotoUrl ?? null,
    bio: row.bio ?? null,
    loginMethod: row.loginMethod ?? null,
    role: row.role ?? "user",
    officialPosition: row.officialPosition ?? null,
    domain: row.domain ?? null,
    moduleAccess: parseJson<string[]>(row.moduleAccess, []),
    standingCommittee: row.standingCommittee ?? null,
    termStart: toDate(row.termStart),
    termEnd: toDate(row.termEnd),
    affiliatedChapterId: row.affiliatedChapterId ?? null,
    createdAt: toDate(row.createdAt) ?? new Date(),
    updatedAt: toDate(row.updatedAt) ?? new Date(),
    lastSignedIn: toDate(row.lastSignedIn),
    passwordHash: row.passwordHash ?? null,
    passwordSetupRequired: row.passwordSetupRequired ?? true,
    setupTokenHash: row.setupTokenHash ?? null,
    setupTokenExpiresAt: toDate(row.setupTokenExpiresAt),
    setupTokenUsedAt: toDate(row.setupTokenUsedAt),
    active: row.active ?? true,
    sessionEpoch: row.sessionEpoch ?? 0,
  };
}

function rowToDocument(row: any): Document {
  return {
    id: row.id,
    memberId: row.memberId,
    type: row.type,
    documentUrl: row.documentUrl,
    documentKey: row.documentKey,
    fileName: row.fileName ?? null,
    generatedAt: toDate(row.generatedAt) ?? new Date(),
    createdAt: toDate(row.createdAt) ?? new Date(),
  };
}

function rowToCvEntry(row: any): CvEntry {
  return {
    id: row.id,
    memberId: row.memberId,
    type: row.type,
    title: row.title,
    description: row.description ?? null,
    organization: row.organization ?? null,
    startDate: toDate(row.startDate),
    endDate: toDate(row.endDate),
    isCurrent: row.isCurrent ?? false,
    order: row.order ?? 0,
    createdAt: toDate(row.createdAt) ?? new Date(),
  };
}

function rowToLifecycleCase(row: any): LifecycleCase {
  return {
    id: row.id,
    userId: row.userId,
    membershipId: row.membershipId ?? "",
    memberName: row.memberName ?? "",
    action: row.action,
    reason: row.reason,
    description: row.description ?? null,
    status: row.status ?? "pending",
    evidence: parseJson<LifecycleEvidenceItem[]>(row.evidence, []),
    requestedByName: row.requestedByName ?? null,
    requestedByEmail: row.requestedByEmail ?? null,
    requestedAt: toDate(row.requestedAt) ?? new Date(),
    decidedByName: row.decidedByName ?? null,
    decidedByEmail: row.decidedByEmail ?? null,
    decidedAt: toDate(row.decidedAt),
    decisionNotes: row.decisionNotes ?? null,
    effectiveDate: toDate(row.effectiveDate),
    notificationQueued: row.notificationQueued ?? false,
    timeline: parseJson<LifecycleTimelineEvent[]>(row.timeline, []).map(
      (e) => ({
        ...e,
        at: toDate(e.at) ?? new Date(),
      })
    ),
    createdAt: toDate(row.createdAt) ?? new Date(),
    updatedAt: toDate(row.updatedAt) ?? new Date(),
  };
}

function rowToCardRecord(row: any): import("./memberAccountService").MemberCardRecord {
  const sig = parseJson<{
    dataUrl: string | null;
    status: string;
    submittedAt: string | null;
    reviewedAt: string | null;
  }>(row.holderSignature, {
    dataUrl: null,
    status: "none",
    submittedAt: null,
    reviewedAt: null,
  });

  return {
    userId: row.userId,
    version: row.version ?? 0,
    holderSignature: {
      dataUrl: sig.dataUrl ?? null,
      status: (sig.status as any) ?? "none",
      submittedAt: toDate(sig.submittedAt),
      reviewedAt: toDate(sig.reviewedAt),
    },
    identitySnapshot: parseJson<any>(row.identitySnapshot, null),
    reissueRequested: row.reissueRequested ?? false,
    reissueRequestedAt: toDate(row.reissueRequestedAt),
    issuedAt: toDate(row.issuedAt),
    expiresAt: toDate(row.expiresAt),
    verificationToken: row.verificationToken ?? null,
  };
}

// ============================================================================
// Row converters: in-memory type → MySQL row arrays
// ============================================================================

function userToRow(u: User): any[] {
  return [
    u.id,
    u.openId,
    u.email,
    u.name,
    u.cnic,
    u.phone,
    u.institution,
    u.degree,
    u.graduationYear,
    u.localCouncilId,
    u.discipline,
    u.yearOfStudy,
    u.localCouncil,
    u.membershipStatus,
    u.membershipId,
    u.membershipStartDate,
    u.membershipEndDate,
    u.profilePhotoUrl,
    u.bio,
    u.loginMethod,
    u.role,
    u.officialPosition,
    u.domain,
    u.moduleAccess ? JSON.stringify(u.moduleAccess) : null,
    u.createdAt,
    u.updatedAt,
    u.lastSignedIn,
    u.passwordHash,
    u.passwordSetupRequired,
    u.setupTokenHash,
    u.setupTokenExpiresAt,
    u.setupTokenUsedAt,
    u.active,
    u.sessionEpoch,
  ];
}

function documentToRow(d: Document): any[] {
  return [
    d.id,
    d.memberId,
    d.type,
    d.documentUrl,
    d.documentKey,
    d.fileName,
    d.generatedAt,
    d.createdAt,
  ];
}

function cvEntryToRow(c: CvEntry): any[] {
  return [
    c.id,
    c.memberId,
    c.type,
    c.title,
    c.description,
    c.organization,
    c.startDate,
    c.endDate,
    c.isCurrent,
    c.order,
    c.createdAt,
  ];
}

function lifecycleCaseToRow(lc: LifecycleCase): any[] {
  return [
    lc.id,
    lc.userId,
    lc.membershipId,
    lc.memberName,
    lc.action,
    lc.reason,
    lc.description,
    lc.status,
    JSON.stringify(lc.evidence),
    lc.requestedByName,
    lc.requestedByEmail,
    lc.requestedAt,
    lc.decidedByName,
    lc.decidedByEmail,
    lc.decidedAt,
    lc.decisionNotes,
    lc.effectiveDate,
    lc.notificationQueued,
    JSON.stringify(lc.timeline),
    lc.createdAt,
    lc.updatedAt,
  ];
}

function cardRecordToRow(c: import("./memberAccountService").MemberCardRecord): any[] {
  return [
    null, // auto-increment id
    c.userId,
    c.version,
    JSON.stringify(c.holderSignature),
    c.identitySnapshot ? JSON.stringify(c.identitySnapshot) : null,
    c.reissueRequested,
    c.reissueRequestedAt,
    c.issuedAt,
    c.expiresAt,
    c.verificationToken,
    new Date(), // createdAt
    new Date(), // updatedAt
  ];
}
