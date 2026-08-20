/**
 * Oath System
 * Implements B-8.7.16: Oath of Office
 * 
 * Key Rules:
 * - Every elected/appointed official must take oath before assuming office
 * - Written record with witnesses
 * - Validity period tied to term of office
 * - Revocation upon removal from office
 * - Audit trail
 */

import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import {
  oathDefinitions,
  oathRecords,
  type OathDefinition,
  type InsertOathDefinition,
  type OathRecord,
  type InsertOathRecord,
} from "../../drizzle/schema.proxy_oath_termination";

// ============================================================================
// TYPES
// ============================================================================

export interface OathAdministrationRequest {
  userId: number;
  oathDefinitionId: number;
  meetingId?: number;
  meetingType?: string;
  administeredBy?: number;
  witnesses?: number[];
  method: "verbal" | "written" | "electronic" | "digital_signature";
  writtenCopyPath?: string;
  signatureData?: string;
  validFrom?: Date;
  validUntil?: Date;
}

export interface OathValidation {
  valid: boolean;
  reason?: string;
  record?: OathRecord;
  definition?: OathDefinition;
}

// ============================================================================
// OATH SYSTEM ENGINE
// ============================================================================

export const oathSystem = {
  // ------------------------------------------------------------------
  // DEFINE OATH
  // ------------------------------------------------------------------
  defineOath: async (definition: Omit<InsertOathDefinition, "id" | "createdAt" | "updatedAt">): Promise<OathDefinition> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const [result] = await db
      .insert(oathDefinitions)
      .values(definition as InsertOathDefinition);

    const [inserted] = await db
      .select()
      .from(oathDefinitions)
      .where(eq(oathDefinitions.id, Number(result.insertId)))
      .limit(1);

    return inserted;
  },

  // ------------------------------------------------------------------
  // ADMINISTER OATH (B-8.7.16)
  // ------------------------------------------------------------------
  administerOath: async (request: OathAdministrationRequest): Promise<OathRecord> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    // Check if user already has an active oath for this role
    const existingOath = await db
      .select()
      .from(oathRecords)
      .where(
        and(
          eq(oathRecords.userId, request.userId),
          eq(oathRecords.oathDefinitionId, request.oathDefinitionId),
          eq(oathRecords.status, "administered")
        )
      )
      .then((rows) => rows[0]);

    if (existingOath) {
      // Allow re-administration but supersede the old one
      await db
        .update(oathRecords)
        .set({ status: "superseded" as any })
        .where(eq(oathRecords.id, existingOath.id));
    }

    const now = new Date();
    const validFrom = request.validFrom ?? now;

    const record: InsertOathRecord = {
      userId: request.userId,
      oathDefinitionId: request.oathDefinitionId,
      meetingId: request.meetingId,
      meetingType: request.meetingType,
      administeredAt: now,
      administeredBy: request.administeredBy,
      witnesses: request.witnesses ?? [],
      method: request.method,
      writtenCopyPath: request.writtenCopyPath,
      signatureData: request.signatureData,
      digitalSignatureHash: request.signatureData
        ? await computeHash(request.signatureData)
        : undefined,
      status: "administered",
      validFrom,
      validUntil: request.validUntil,
      auditHash: await computeAuditHash(request.userId, request.oathDefinitionId, now),
    };

    const [result] = await db
      .insert(oathRecords)
      .values(record);

    const [inserted] = await db
      .select()
      .from(oathRecords)
      .where(eq(oathRecords.id, Number(result.insertId)))
      .limit(1);

    return inserted;
  },

  // ------------------------------------------------------------------
  // VERIFY OATH
  // ------------------------------------------------------------------
  verifyOath: async (
    userId: number,
    oathDefinitionId: number
  ): Promise<OathValidation> => {
    const db = getDb();
    if (!db) return { valid: false, reason: "Database not configured." };

    const record = await db
      .select()
      .from(oathRecords)
      .where(
        and(
          eq(oathRecords.userId, userId),
          eq(oathRecords.oathDefinitionId, oathDefinitionId),
          eq(oathRecords.status, "administered")
        )
      )
      .then((rows) => rows[0]);

    if (!record) {
      return {
        valid: false,
        reason: "No active oath record found for this user and oath type.",
      };
    }

    // Check validity period
    const now = new Date();
    if (now < record.validFrom) {
      return {
        valid: false,
        reason: "Oath is not yet effective.",
        record,
      };
    }

    if (record.validUntil && now > record.validUntil) {
      return {
        valid: false,
        reason: "Oath has expired.",
        record,
      };
    }

    // Fetch definition
    const definition = await db
      .select()
      .from(oathDefinitions)
      .where(eq(oathDefinitions.id, oathDefinitionId))
      .then((rows) => rows[0]);

    return {
      valid: true,
      record,
      definition,
    };
  },

  // ------------------------------------------------------------------
  // REVOKE OATH
  // ------------------------------------------------------------------
  revokeOath: async (
    oathRecordId: number,
    revokedBy: number,
    reason: string
  ): Promise<OathRecord> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const record = await db
      .select()
      .from(oathRecords)
      .where(eq(oathRecords.id, oathRecordId))
      .then((rows) => rows[0]);

    if (!record) {
      throw new Error(`Oath record ${oathRecordId} not found.`);
    }

    await db
      .update(oathRecords)
      .set({
        status: "revoked",
        revokedAt: new Date(),
        revokedReason: reason,
        revokedBy,
      })
      .where(eq(oathRecords.id, oathRecordId));

    const [updated] = await db
      .select()
      .from(oathRecords)
      .where(eq(oathRecords.id, oathRecordId))
      .limit(1);

    return updated;
  },

  // ------------------------------------------------------------------
  // GET ACTIVE OATHS FOR USER
  // ------------------------------------------------------------------
  getActiveOathsForUser: async (userId: number): Promise<OathRecord[]> => {
    const db = getDb();
    if (!db) return [];

    return db
      .select()
      .from(oathRecords)
      .where(
        and(
          eq(oathRecords.userId, userId),
          eq(oathRecords.status, "administered")
        )
      );
  },

  // ------------------------------------------------------------------
  // CHECK OATH STATUS FOR OFFICIAL
  // ------------------------------------------------------------------
  checkOathForOfficial: async (
    userId: number,
    officialRole: string
  ): Promise<{ required: boolean; administered: boolean; validation: OathValidation }> => {
    const db = getDb();
    if (!db) {
      return {
        required: false,
        administered: false,
        validation: { valid: true, reason: "Database not configured." },
      };
    }

    // Find applicable oath definition
    const definition = await db
      .select()
      .from(oathDefinitions)
      .where(
        and(
          eq(oathDefinitions.applicableTo, officialRole as any),
          eq(oathDefinitions.status, "active")
        )
      )
      .then((rows) => rows[0]);

    if (!definition) {
      return {
        required: false,
        administered: false,
        validation: { valid: true, reason: "No oath definition found for this role." },
      };
    }

    const validation = await oathSystem.verifyOath(userId, definition.id);

    return {
      required: true,
      administered: validation.valid,
      validation,
    };
  },
};

// ============================================================================
// DEFAULT OATH TEMPLATES
// ============================================================================

export const DEFAULT_OATH_TEMPLATES = {
  president: {
    title: "Presidential Oath of Office",
    content: `I solemnly swear that I will faithfully execute the office of President of MSA Pakistan, and will to the best of my ability, preserve, protect and defend the Constitution and Bylaws of the organization. I will serve the interests of all members impartially and uphold the values and mission of the Muslim Students Association of Pakistan.`,
    applicableTo: "president" as const,
  },
  board: {
    title: "Board Member Oath of Office",
    content: `I solemnly swear that I will faithfully execute my duties as a member of the Executive Board of MSA Pakistan. I will uphold the Constitution and Bylaws, serve with integrity, and act in the best interests of the organization and its members.`,
    applicableTo: "board" as const,
  },
  officials: {
    title: "Officials Oath of Office",
    content: `I solemnly swear that I will faithfully execute my duties as an official of MSA Pakistan. I will uphold the Constitution and Bylaws, act with integrity, and serve the mission of the organization.`,
    applicableTo: "officials" as const,
  },
  delegates: {
    title: "Delegate Oath",
    content: `I solemnly swear that I will faithfully represent my Local Council at the National General Assembly. I will vote according to the interests of my constituents and uphold the Constitution and Bylaws of MSA Pakistan.`,
    applicableTo: "delegates" as const,
  },
};

// ============================================================================
// UTILITY
// ============================================================================

async function computeHash(input: string): Promise<string> {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `sig_${Math.abs(hash).toString(16).padStart(8, "0")}`;
}

async function computeAuditHash(
  userId: number,
  oathDefId: number,
  timestamp: Date
): Promise<string> {
  const input = `${userId}-${oathDefId}-${timestamp.toISOString()}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `audit_${Math.abs(hash).toString(16).padStart(8, "0")}`;
}

export default oathSystem;
