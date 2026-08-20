/**
 * Proxy Voting Engine
 * Implements B-8.7.14: Proxy Voting for NGA/SGA
 * 
 * Key Rules:
 * - Only bylaw change motions can receive proxy votes
 * - Maximum 2 proxies per delegation
 * - Written authorization required
 * - Proxy grants can be revoked
 * - Full audit trail
 */

import { eq, and, count, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  proxyVotingAuthorizations,
  type ProxyVotingAuthorization,
  type InsertProxyVotingAuthorization,
} from "../../drizzle/schema.proxy_oath_termination";

// ============================================================================
// TYPES
// ============================================================================

export interface ProxyGrantRequest {
  meetingId: number;
  granterId: number;
  granterName: string;
  granterDelegationId?: number;
  recipientId: number;
  recipientName: string;
  recipientDelegationId?: number;
  scope: "bylaw_changes_only" | "full" | "election_only";
  validUntil: Date;
  writtenAuthorization?: string;
  metadata?: Record<string, unknown>;
}

export interface ProxyVoteValidation {
  valid: boolean;
  reason?: string;
  authorization?: ProxyVotingAuthorization;
}

// ============================================================================
// PROXY VOTING ENGINE
// ============================================================================

export const proxyVotingEngine = {
  // ------------------------------------------------------------------
  // GRANT PROXY (B-8.7.14: max 2 per delegation)
  // ------------------------------------------------------------------
  grantProxy: async (request: ProxyGrantRequest): Promise<ProxyVotingAuthorization> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    // Count existing active proxies for this granter at this meeting
    const existingProxies = await db
      .select({ count: count() })
      .from(proxyVotingAuthorizations)
      .where(
        and(
          eq(proxyVotingAuthorizations.meetingId, request.meetingId),
          eq(proxyVotingAuthorizations.granterId, request.granterId),
          eq(proxyVotingAuthorizations.status, "active")
        )
      )
      .then((rows) => rows[0]?.count ?? 0);

    // B-8.7.14: Maximum 2 proxies per delegation
    if (existingProxies >= 2) {
      throw new Error(
        `B-8.7.14 VIOLATION: Granter ${request.granterId} already has ${existingProxies} active proxy(ies). Maximum is 2.`
      );
    }

    // Check if same recipient already authorized
    const duplicateProxy = await db
      .select()
      .from(proxyVotingAuthorizations)
      .where(
        and(
          eq(proxyVotingAuthorizations.meetingId, request.meetingId),
          eq(proxyVotingAuthorizations.granterId, request.granterId),
          eq(proxyVotingAuthorizations.recipientId, request.recipientId),
          eq(proxyVotingAuthorizations.status, "active")
        )
      )
      .then((rows) => rows[0]);

    if (duplicateProxy) {
      throw new Error(
        `Granter ${request.granterId} already has an active proxy with recipient ${request.recipientId}.`
      );
    }

    // Prevent self-proxy
    if (request.granterId === request.recipientId) {
      throw new Error("Cannot proxy to self.");
    }

    // Create authorization
    const proxyNumber = existingProxies + 1;
    const now = new Date();

    const authorization: InsertProxyVotingAuthorization = {
      meetingId: request.meetingId,
      granterId: request.granterId,
      granterName: request.granterName,
      granterDelegationId: request.granterDelegationId,
      recipientId: request.recipientId,
      recipientName: request.recipientName,
      recipientDelegationId: request.recipientDelegationId,
      scope: request.scope,
      proxyNumber,
      status: "active",
      validFrom: now,
      validUntil: request.validUntil,
      writtenAuthorization: request.writtenAuthorization,
      authorizationHash: request.writtenAuthorization
        ? await computeHash(request.writtenAuthorization)
        : undefined,
      metadata: request.metadata as any,
    };

    const [result] = await db
      .insert(proxyVotingAuthorizations)
      .values(authorization);

    // Fetch the inserted record
    const [inserted] = await db
      .select()
      .from(proxyVotingAuthorizations)
      .where(eq(proxyVotingAuthorizations.id, Number(result.insertId)))
      .limit(1);

    return inserted;
  },

  // ------------------------------------------------------------------
  // VALIDATE PROXY VOTE
  // ------------------------------------------------------------------
  validateProxyVote: async (
    meetingId: number,
    recipientId: number,
    motionType: string
  ): Promise<ProxyVoteValidation> => {
    const db = getDb();
    if (!db) return { valid: false, reason: "Database not configured." };

    // Find active proxy for this recipient at this meeting
    const proxy = await db
      .select()
      .from(proxyVotingAuthorizations)
      .where(
        and(
          eq(proxyVotingAuthorizations.meetingId, meetingId),
          eq(proxyVotingAuthorizations.recipientId, recipientId),
          eq(proxyVotingAuthorizations.status, "active")
        )
      )
      .then((rows) => rows[0]);

    if (!proxy) {
      return { valid: false, reason: "No active proxy authorization found." };
    }

    // Check validity period
    const now = new Date();
    if (now < proxy.validFrom) {
      return { valid: false, reason: "Proxy authorization has not yet started." };
    }
    if (now > proxy.validUntil) {
      return { valid: false, reason: "Proxy authorization has expired." };
    }

    // Check scope
    if (proxy.scope === "bylaw_changes_only" && motionType !== "bylaw_change") {
      return {
        valid: false,
        reason: `B-8.7.14: This proxy is limited to bylaw change motions only. Motion type '${motionType}' is not eligible.`,
      };
    }

    return { valid: true, authorization: proxy };
  },

  // ------------------------------------------------------------------
  // REVOKE PROXY
  // ------------------------------------------------------------------
  revokeProxy: async (
    proxyId: number,
    granterId: number,
    reason: string
  ): Promise<ProxyVotingAuthorization> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    const proxy = await db
      .select()
      .from(proxyVotingAuthorizations)
      .where(eq(proxyVotingAuthorizations.id, proxyId))
      .then((rows) => rows[0]);

    if (!proxy) {
      throw new Error(`Proxy ${proxyId} not found.`);
    }

    if (proxy.granterId !== granterId) {
      throw new Error("Only the granter can revoke their proxy.");
    }

    if (proxy.status !== "active") {
      throw new Error(`Cannot revoke proxy in status '${proxy.status}'.`);
    }

    await db
      .update(proxyVotingAuthorizations)
      .set({
        status: "revoked",
        revokedAt: new Date(),
        revokedReason: reason,
      })
      .where(eq(proxyVotingAuthorizations.id, proxyId));

    // Return updated record
    const [updated] = await db
      .select()
      .from(proxyVotingAuthorizations)
      .where(eq(proxyVotingAuthorizations.id, proxyId))
      .limit(1);

    return updated;
  },

  // ------------------------------------------------------------------
  // GET PROXIES FOR MEETING
  // ------------------------------------------------------------------
  getProxiesForMeeting: async (meetingId: number): Promise<ProxyVotingAuthorization[]> => {
    const db = getDb();
    if (!db) return [];

    return db
      .select()
      .from(proxyVotingAuthorizations)
      .where(
        and(
          eq(proxyVotingAuthorizations.meetingId, meetingId),
          eq(proxyVotingAuthorizations.status, "active")
        )
      );
  },

  // ------------------------------------------------------------------
  // GET PROXIES BY GRANTER
  // ------------------------------------------------------------------
  getProxiesByGranter: async (
    meetingId: number,
    granterId: number
  ): Promise<ProxyVotingAuthorization[]> => {
    const db = getDb();
    if (!db) return [];

    return db
      .select()
      .from(proxyVotingAuthorizations)
      .where(
        and(
          eq(proxyVotingAuthorizations.meetingId, meetingId),
          eq(proxyVotingAuthorizations.granterId, granterId)
        )
      );
  },

  // ------------------------------------------------------------------
  // COUNT REMAINING PROXY SLOTS
  // ------------------------------------------------------------------
  remainingProxySlots: async (meetingId: number, granterId: number): Promise<number> => {
    const db = getDb();
    if (!db) return 0;

    const activeCount = await db
      .select({ count: count() })
      .from(proxyVotingAuthorizations)
      .where(
        and(
          eq(proxyVotingAuthorizations.meetingId, meetingId),
          eq(proxyVotingAuthorizations.granterId, granterId),
          eq(proxyVotingAuthorizations.status, "active")
        )
      )
      .then((rows) => rows[0]?.count ?? 0);

    return Math.max(0, 2 - activeCount);
  },

  // ------------------------------------------------------------------
  // MARK PROXY USED
  // ------------------------------------------------------------------
  markProxyUsed: async (proxyId: number, motionId: number): Promise<void> => {
    const db = getDb();
    if (!db) return;

    await db
      .update(proxyVotingAuthorizations)
      .set({
        status: "used",
        usedAt: new Date(),
        usedForMotionId: motionId,
      })
      .where(eq(proxyVotingAuthorizations.id, proxyId));
  },

  // ------------------------------------------------------------------
  // EXPIRE STALE PROXIES
  // ------------------------------------------------------------------
  expireStaleProxies: async (meetingId: number): Promise<number> => {
    const db = getDb();
    if (!db) return 0;

    const now = new Date();
    const result = await db
      .update(proxyVotingAuthorizations)
      .set({ status: "expired" })
      .where(
        and(
          eq(proxyVotingAuthorizations.meetingId, meetingId),
          eq(proxyVotingAuthorizations.status, "active"),
          sql`${proxyVotingAuthorizations.validUntil} < ${now}`
        )
      );

    return (result as any).affectedRows ?? 0;
  },
};

// ============================================================================
// UTILITY
// ============================================================================

async function computeHash(input: string): Promise<string> {
  // Simple hash for authorization verification
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `auth_${Math.abs(hash).toString(16).padStart(8, "0")}`;
}

export default proxyVotingEngine;
