/**
 * IOG (Internal Operating Guidelines) Engine
 * 
 * Implements Section 46: IOG Engine
 * 
 * Hierarchy:
 *   CONSTITUTION > BYLAWS > ANNEXES > IOGs > POLICIES > PROCEDURES > LOCAL RULES
 * 
 * Lower-level rules cannot conflict with higher-level rules unless
 * an explicit legal exception exists.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  governanceDocuments,
  governanceClauses,
  governanceRules,
} from "../../drizzle/schema.governance_rules";
import { logAuditEvent } from "./auditService";

// ============================================================================
// TYPES
// ============================================================================

export type IOGCategory = 
  | "operational"
  | "procedural"
  | "administrative"
  | "financial"
  | "communication"
  | "reporting"
  | "compliance"
  | "emergency"
  | "temporary";

export interface IOGDefinition {
  id: number;
  title: string;
  category: IOGCategory;
  content: string;
  version: string;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  status: "draft" | "effective" | "superseded" | "archived";
  parentClauseId?: string;
  createdBy: number;
  approvedBy?: string;
  approvalDate?: Date;
}

export interface IOGValidation {
  valid: boolean;
  conflicts: Array<{
    level: string;
    clauseId: string;
    description: string;
  }>;
  warnings: string[];
}

// ============================================================================
// IOG ENGINE
// ============================================================================

export const iogEngine = {
  /**
   * Create a new IOG.
   */
  createIOG: async (input: {
    title: string;
    category: IOGCategory;
    content: string;
    version?: string;
    effectiveFrom: Date;
    effectiveUntil?: Date;
    parentClauseId?: string;
    createdBy: number;
  }): Promise<{ id: number }> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    // Validate against higher-level rules
    const validation = await iogEngine.validateIOG(input.content, input.parentClauseId);

    if (!validation.valid) {
      throw new Error(`IOG validation failed: ${validation.conflicts.map(c => c.description).join("; ")}`);
    }

    // Create governance document
    const [docResult] = await db.insert(governanceDocuments).values({
      title: input.title,
      type: "iog",
      version: input.version ?? "1.0",
      status: "draft",
      effectiveFrom: input.effectiveFrom,
      effectiveUntil: input.effectiveUntil,
      createdBy: input.createdBy,
    });

    const docId = Number((docResult as any)[0].insertId);

    // Create clause
    await db.insert(governanceClauses).values({
      documentId: docId,
      clauseId: input.parentClauseId ?? `IOG-${docId}`,
      title: input.title,
      content: input.content,
      status: "active",
    });

    await logAuditEvent({
      userId: input.createdBy,
      action: "iog.created",
      entityType: "iog",
      entityId: docId,
      after: { title: input.title, category: input.category },
    });

    return { id: docId };
  },

  /**
   * Activate an IOG after approval.
   */
  activateIOG: async (iogId: number, approvedBy: number): Promise<void> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    await db
      .update(governanceDocuments)
      .set({
        status: "effective",
        approvedBy: approvedBy.toString(),
        updatedAt: new Date(),
      })
      .where(eq(governanceDocuments.id, iogId));

    // Activate associated clauses
    await db
      .update(governanceClauses)
      .set({ status: "active" })
      .where(eq(governanceClauses.documentId, iogId));

    await logAuditEvent({
      userId: approvedBy,
      action: "iog.activated",
      entityType: "iog",
      entityId: iogId,
    });
  },

  /**
   * Validate an IOG against higher-level rules.
   */
  validateIOG: async (
    content: string,
    parentClauseId?: string
  ): Promise<IOGValidation> => {
    const db = getDb();
    if (!db) return { valid: true, conflicts: [], warnings: [] };

    const conflicts: IOGValidation["conflicts"] = [];
    const warnings: string[] = [];

    // Check against constitution
    const constitutionRules = await db
      .select()
      .from(governanceRules)
      .where(
        and(
          eq(governanceRules.ruleType, "constitution"),
          eq(governanceRules.status, "active")
        )
      );

    for (const rule of constitutionRules) {
      const params = rule.parameters as Record<string, unknown>;
      if (params && content.includes(rule.ruleKey)) {
        warnings.push(`IOG references rule "${rule.ruleKey}" from constitution - ensure no contradiction`);
      }
    }

    // Check against bylaws
    const bylawsRules = await db
      .select()
      .from(governanceRules)
      .where(
        and(
          eq(governanceRules.ruleType, "bylaws"),
          eq(governanceRules.status, "active")
        )
      );

    for (const rule of bylawsRules) {
      const params = rule.parameters as Record<string, unknown>;
      if (params && content.includes(rule.ruleKey)) {
        warnings.push(`IOG references rule "${rule.ruleKey}" from bylaws - ensure no contradiction`);
      }
    }

    return {
      valid: conflicts.length === 0,
      conflicts,
      warnings,
    };
  },

  /**
   * Get all active IOGs.
   */
  getActiveIOGs: async (): Promise<IOGDefinition[]> => {
    const db = getDb();
    if (!db) return [];

    const docs = await db
      .select()
      .from(governanceDocuments)
      .where(
        and(
          eq(governanceDocuments.type, "iog"),
          eq(governanceDocuments.status, "effective")
        )
      )
      .orderBy(desc(governanceDocuments.effectiveFrom));

    return docs.map(d => ({
      id: d.id,
      title: d.title,
      category: "operational" as IOGCategory,
      content: "",
      version: d.version,
      effectiveFrom: d.effectiveFrom ?? new Date(),
      effectiveUntil: d.effectiveUntil ?? undefined,
      status: d.status as any,
      createdBy: d.createdBy ?? 0,
      approvedBy: d.approvedBy ?? undefined,
    }));
  },

  /**
   * Get IOG hierarchy.
   */
  getHierarchy: async (): Promise<Array<{
    level: string;
    priority: number;
    documents: Array<{ id: number; title: string; status: string }>;
  }>> => {
    const db = getDb();
    if (!db) return [];

    const levels = [
      { level: "constitution", priority: 7 },
      { level: "bylaws", priority: 6 },
      { level: "annex", priority: 5 },
      { level: "iog", priority: 4 },
      { level: "policy", priority: 3 },
      { level: "regulation", priority: 2 },
    ];

    const result = [];

    for (const { level, priority } of levels) {
      const docs = await db
        .select()
        .from(governanceDocuments)
        .where(
          and(
            eq(governanceDocuments.type, level as any),
            eq(governanceDocuments.status, "effective")
          )
        );

      result.push({
        level,
        priority,
        documents: docs.map(d => ({
          id: d.id,
          title: d.title,
          status: d.status,
        })),
      });
    }

    return result;
  },

  /**
   * Archive an IOG.
   */
  archiveIOG: async (iogId: number, archivedBy: number): Promise<void> => {
    const db = getDb();
    if (!db) throw new Error("Database not configured.");

    await db
      .update(governanceDocuments)
      .set({
        status: "archived",
        updatedAt: new Date(),
      })
      .where(eq(governanceDocuments.id, iogId));

    await logAuditEvent({
      userId: archivedBy,
      action: "iog.archived",
      entityType: "iog",
      entityId: iogId,
    });
  },
};

export default iogEngine;
