/**
 * Audit Service
 *
 * Records all business-critical actions with full context:
 * actor, timestamp, before/after values, reason, IP, correlation ID.
 *
 * Audit records are append-only and designed to be tamper-evident.
 *
 * Usage:
 *   import { logAuditEvent, getAuditEvents } from "./auditService";
 *
 *   await logAuditEvent({
 *     userId: 5,
 *     actorEmail: "admin@msapakistan.org",
 *     action: "member.create",
 *     entityType: "user",
 *     entityId: 123,
 *     before: null,
 *     after: { name: "John Doe", status: "Active" },
 *     reason: "Approved membership application #456",
 *   });
 */

import { eq, and, desc, like, sql } from "drizzle-orm";
import { auditEvents } from "../../drizzle/schema.enterprise";
import { getDb } from "../db";
import { childLogger } from "../_core/logger";

const log = childLogger("Audit");

// ============================================================================
// Logging
// ============================================================================

export interface AuditEventInput {
  userId?: number;
  actorEmail?: string;
  actorName?: string;
  action: string;
  category?: string;
  entityType?: string;
  entityId?: number;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  scopeType?: string;
  scopeId?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Log an audit event. This is the primary entry point for all audit logging.
 * Best-effort: never throws, never blocks the caller.
 */
export async function logAuditEvent(input: AuditEventInput): Promise<number | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const result = await db.insert(auditEvents).values({
      userId: input.userId,
      actorEmail: input.actorEmail,
      actorName: input.actorName,
      action: input.action,
      category: input.category,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before ?? null,
      after: input.after ?? null,
      reason: input.reason,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      correlationId: input.correlationId,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      metadata: input.metadata,
    });

    const id = Number(result[0].insertId);
    log.info({ id, action: input.action, entityType: input.entityType ?? "system", entityId: input.entityId ?? "-", actorEmail: input.actorEmail ?? "system" }, "Audit event logged");
    return id;
  } catch (error) {
    log.error({ err: error }, "Failed to log audit event");
    return null;
  }
}

/**
 * Convenience function for logging with a user object.
 */
export async function logAuditForUser(
  user: { id?: number | null; email?: string | null; name?: string | null },
  action: string,
  details: Omit<AuditEventInput, "userId" | "actorEmail" | "actorName" | "action">
): Promise<number | null> {
  return logAuditEvent({
    userId: user.id ?? undefined,
    actorEmail: user.email ?? undefined,
    actorName: user.name ?? undefined,
    action,
    ...details,
  });
}

// ============================================================================
// Querying
// ============================================================================

export interface AuditQueryFilters {
  userId?: number;
  action?: string;
  entityType?: string;
  entityId?: number;
  category?: string;
  correlationId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string; // Free-text search in action, reason, actorEmail
  limit?: number;
  offset?: number;
}

/**
 * Query audit events with filters. Results are ordered by most recent first.
 */
export async function getAuditEvents(
  filters: AuditQueryFilters = {}
): Promise<Array<{
  id: number;
  userId: number | null;
  actorEmail: string | null;
  actorName: string | null;
  action: string;
  category: string | null;
  entityType: string | null;
  entityId: number | null;
  before: unknown;
  after: unknown;
  reason: string | null;
  ipAddress: string | null;
  correlationId: string | null;
  createdAt: Date;
}>> {
  const db = getDb();
  if (!db) return [];

  try {
    const conditions = [];

    if (filters.userId !== undefined) {
      conditions.push(eq(auditEvents.userId, filters.userId));
    }
    if (filters.action) {
      conditions.push(eq(auditEvents.action, filters.action));
    }
    if (filters.entityType) {
      conditions.push(eq(auditEvents.entityType, filters.entityType));
    }
    if (filters.entityId !== undefined) {
      conditions.push(eq(auditEvents.entityId, filters.entityId));
    }
    if (filters.category) {
      conditions.push(eq(auditEvents.category, filters.category));
    }
    if (filters.correlationId) {
      conditions.push(eq(auditEvents.correlationId, filters.correlationId));
    }
    if (filters.startDate) {
      conditions.push(sql`${auditEvents.createdAt} >= ${filters.startDate}`);
    }
    if (filters.endDate) {
      conditions.push(sql`${auditEvents.createdAt} <= ${filters.endDate}`);
    }
    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        sql`(${auditEvents.action} LIKE ${searchPattern} OR ${auditEvents.actorEmail} LIKE ${searchPattern} OR ${auditEvents.reason} LIKE ${searchPattern})`
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const limit = filters.limit ?? 100;
    const offset = filters.offset ?? 0;

    const rows = await db
      .select()
      .from(auditEvents)
      .where(where)
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit)
      .offset(offset);

    return rows;
  } catch (error) {
    log.error({ err: error }, "Failed to query audit events");
    return [];
  }
}

/**
 * Get audit events for a specific entity.
 */
export async function getEntityAuditHistory(
  entityType: string,
  entityId: number,
  limit: number = 50
): Promise<Array<{
  id: number;
  action: string;
  actorEmail: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
  createdAt: Date;
}>> {
  return getAuditEvents({
    entityType,
    entityId,
    limit,
  }) as any;
}

/**
 * Get count of audit events by action category.
 */
export async function getAuditStats(): Promise<{
  totalEvents: number;
  eventsByCategory: Record<string, number>;
  recentEvents: Array<{ action: string; count: number }>;
}> {
  const db = getDb();
  if (!db) return { totalEvents: 0, eventsByCategory: {}, recentEvents: [] };

  try {
    // Total count
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditEvents);

    // Count by category
    const categoryRows = await db
      .select({
        category: auditEvents.category,
        count: sql<number>`count(*)`,
      })
      .from(auditEvents)
      .groupBy(auditEvents.category);

    const eventsByCategory: Record<string, number> = {};
    for (const row of categoryRows) {
      eventsByCategory[row.category ?? "uncategorized"] = row.count;
    }

    // Recent actions (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentRows = await db
      .select({
        action: auditEvents.action,
        count: sql<number>`count(*)`,
      })
      .from(auditEvents)
      .where(sql`${auditEvents.createdAt} >= ${oneDayAgo}`)
      .groupBy(auditEvents.action)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    return {
      totalEvents: totalResult?.count ?? 0,
      eventsByCategory,
      recentEvents: recentRows.map((r) => ({ action: r.action, count: r.count })),
    };
  } catch (error) {
    log.error({ err: error }, "Failed to get audit stats");
    return { totalEvents: 0, eventsByCategory: {}, recentEvents: [] };
  }
}

// ============================================================================
// Helper: Generate correlation ID
// ============================================================================

/**
 * Generate a correlation ID for request tracing.
 */
export function generateCorrelationId(): string {
  return `corr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
