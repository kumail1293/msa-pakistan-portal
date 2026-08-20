/**
 * Governance Document Version Management
 *
 * Handles creation, activation, and archival of governance document versions.
 * Ensures temporal integrity: historical decisions always use the correct rule version.
 *
 * Usage:
 *   import { createDocumentVersion, activateDocument, importClauses } from "./governanceDocVersioning";
 *
 *   const doc = await createDocumentVersion({
 *     title: "MSA-Pakistan Bylaws",
 *     type: "bylaws",
 *     version: "2026-27",
 *   });
 *
 *   await importClauses(doc.id, clauses);
 *   await activateDocument(doc.id);
 */

import { eq, and, desc, sql } from "drizzle-orm";
import {
  governanceDocuments,
  governanceClauses,
  governanceRules,
} from "../../drizzle/schema.governance_rules";
import { getDb } from "../db";
import { logAuditEvent } from "./auditService";

// ============================================================================
// Types
// ============================================================================

export interface CreateDocumentInput {
  title: string;
  type: "constitution" | "bylaws" | "iog" | "policy" | "annex" | "regulation";
  version: string;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  sourceDocument?: string;
  createdBy?: number;
}

export interface ClauseImportInput {
  clauseId: string;
  title: string;
  content: string;
  section?: string;
  subsection?: string;
  clauseNumber?: string;
  sourcePage?: number;
  metadata?: Record<string, unknown>;
}

export interface RuleImportInput {
  clauseId: number;
  ruleType: string;
  ruleKey: string;
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

// ============================================================================
// Document Version Management
// ============================================================================

/**
 * Create a new governance document version.
 */
export async function createDocumentVersion(
  input: CreateDocumentInput
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Check if this version already exists
    const [existing] = await db
      .select()
      .from(governanceDocuments)
      .where(
        and(
          eq(governanceDocuments.type, input.type),
          eq(governanceDocuments.version, input.version)
        )
      )
      .limit(1);

    if (existing) {
      console.warn(`[DocVersion] Version "${input.version}" already exists for ${input.type}`);
      return { id: existing.id };
    }

    const [result] = await db.insert(governanceDocuments).values({
      title: input.title,
      type: input.type,
      version: input.version,
      status: "draft",
      effectiveFrom: input.effectiveFrom,
      effectiveUntil: input.effectiveUntil,
      sourceDocument: input.sourceDocument,
      createdBy: input.createdBy,
    });

    const id = Number((result as any)[0].insertId);

    await logAuditEvent({
      userId: input.createdBy,
      action: "governance.document_created",
      entityType: "governance_document",
      entityId: id,
      after: { title: input.title, type: input.type, version: input.version },
    });

    console.log(`[DocVersion] Created: ${input.title} v${input.version} (id=${id})`);
    return { id };
  } catch (error) {
    console.error("[DocVersion] Failed to create:", error);
    return null;
  }
}

/**
 * Import clauses into a document version.
 */
export async function importClauses(
  documentId: number,
  clauses: ClauseImportInput[]
): Promise<{ imported: number; skipped: number }> {
  const db = getDb();
  if (!db) return { imported: 0, skipped: 0 };

  let imported = 0;
  let skipped = 0;

  for (const clause of clauses) {
    try {
      // Check if clause already exists in this document
      const [existing] = await db
        .select()
        .from(governanceClauses)
        .where(
          and(
            eq(governanceClauses.documentId, documentId),
            eq(governanceClauses.clauseId, clause.clauseId)
          )
        )
        .limit(1);

      if (existing) {
        skipped++;
        continue;
      }

      await db.insert(governanceClauses).values({
        documentId,
        clauseId: clause.clauseId,
        title: clause.title,
        content: clause.content,
        section: clause.section,
        subsection: clause.subsection,
        clauseNumber: clause.clauseNumber,
        version: 1,
        status: "active",
        sourcePage: clause.sourcePage,
        metadata: clause.metadata,
      });

      imported++;
    } catch (error) {
      console.error(`[DocVersion] Failed to import clause "${clause.clauseId}":`, error);
      skipped++;
    }
  }

  console.log(`[DocVersion] Imported ${imported} clauses, skipped ${skipped}`);
  return { imported, skipped };
}

/**
 * Import rules for clauses.
 */
export async function importRules(
  rules: RuleImportInput[]
): Promise<{ imported: number; skipped: number }> {
  const db = getDb();
  if (!db) return { imported: 0, skipped: 0 };

  let imported = 0;
  let skipped = 0;

  for (const rule of rules) {
    try {
      // Check if rule already exists
      const [existing] = await db
        .select()
        .from(governanceRules)
        .where(
          and(
            eq(governanceRules.clauseId, rule.clauseId),
            eq(governanceRules.ruleKey, rule.ruleKey)
          )
        )
        .limit(1);

      if (existing) {
        skipped++;
        continue;
      }

      await db.insert(governanceRules).values({
        clauseId: rule.clauseId,
        ruleType: rule.ruleType,
        ruleKey: rule.ruleKey,
        name: rule.name,
        description: rule.description,
        parameters: rule.parameters,
        version: 1,
        status: "active",
      });

      imported++;
    } catch (error) {
      console.error(`[DocVersion] Failed to import rule "${rule.ruleKey}":`, error);
      skipped++;
    }
  }

  console.log(`[DocVersion] Imported ${imported} rules, skipped ${skipped}`);
  return { imported, skipped };
}

// ============================================================================
// Document Status Management
// ============================================================================

/**
 * Submit a document for review.
 */
export async function submitForReview(
  documentId: number,
  userId?: number
): Promise<boolean> {
  return updateDocumentStatus(documentId, "submitted", userId);
}

/**
 * Approve a document.
 */
export async function approveDocument(
  documentId: number,
  approvedBy: string,
  approvalMeeting: string,
  userId?: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .update(governanceDocuments)
      .set({
        status: "approved",
        approvedBy,
        approvalMeeting,
        updatedAt: new Date(),
      })
      .where(eq(governanceDocuments.id, documentId));

    await logAuditEvent({
      userId,
      action: "governance.document_approved",
      entityType: "governance_document",
      entityId: documentId,
      after: { approvedBy, approvalMeeting },
    });

    return true;
  } catch (error) {
    console.error("[DocVersion] Failed to approve:", error);
    return false;
  }
}

/**
 * Activate a document version (make it effective).
 * This supersedes the previous effective version.
 */
export async function activateDocument(
  documentId: number,
  effectiveDate?: Date,
  userId?: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [doc] = await db
      .select()
      .from(governanceDocuments)
      .where(eq(governanceDocuments.id, documentId))
      .limit(1);

    if (!doc) return false;

    if (doc.status !== "approved") {
      console.warn(`[DocVersion] Cannot activate document in status "${doc.status}"`);
      return false;
    }

    const effectiveAt = effectiveDate ?? new Date();

    // Supersede previous effective version of the same type
    await db
      .update(governanceDocuments)
      .set({
        status: "superseded",
        effectiveUntil: effectiveAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(governanceDocuments.type, doc.type),
          eq(governanceDocuments.status, "effective")
        )
      );

    // Activate the new version
    await db
      .update(governanceDocuments)
      .set({
        status: "effective",
        effectiveFrom: effectiveAt,
        updatedAt: new Date(),
      })
      .where(eq(governanceDocuments.id, documentId));

    // Activate all clauses in this document
    await db
      .update(governanceClauses)
      .set({
        status: "active",
        effectiveFrom: effectiveAt,
      })
      .where(
        and(
          eq(governanceClauses.documentId, documentId),
          eq(governanceClauses.status, "active")
        )
      );

    // Activate all rules linked to clauses in this document
    const clauseIds = await db
      .select({ id: governanceClauses.id })
      .from(governanceClauses)
      .where(eq(governanceClauses.documentId, documentId));

    for (const clause of clauseIds) {
      await db
        .update(governanceRules)
        .set({
          status: "active",
          effectiveFrom: effectiveAt,
        })
        .where(eq(governanceRules.clauseId, clause.id));
    }

    await logAuditEvent({
      userId,
      action: "governance.document_activated",
      entityType: "governance_document",
      entityId: documentId,
      after: { effectiveAt, version: doc.version },
    });

    console.log(`[DocVersion] Activated: ${doc.title} v${doc.version} effective ${effectiveAt.toISOString()}`);
    return true;
  } catch (error) {
    console.error("[DocVersion] Failed to activate:", error);
    return false;
  }
}

/**
 * Archive a document version.
 */
export async function archiveDocument(
  documentId: number,
  userId?: number
): Promise<boolean> {
  return updateDocumentStatus(documentId, "archived", userId);
}

/**
 * Generic status update.
 */
async function updateDocumentStatus(
  documentId: number,
  status: string,
  userId?: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .update(governanceDocuments)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(governanceDocuments.id, documentId));

    await logAuditEvent({
      userId,
      action: `governance.document_${status}`,
      entityType: "governance_document",
      entityId: documentId,
    });

    return true;
  } catch (error) {
    console.error(`[DocVersion] Failed to update status to "${status}":`, error);
    return false;
  }
}

// ============================================================================
// Document Queries
// ============================================================================

/**
 * Get a document with its clauses.
 */
export async function getDocumentWithClauses(
  documentId: number
): Promise<{
  document: any;
  clauses: any[];
  rules: any[];
} | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [document] = await db
      .select()
      .from(governanceDocuments)
      .where(eq(governanceDocuments.id, documentId))
      .limit(1);

    if (!document) return null;

    const clauses = await db
      .select()
      .from(governanceClauses)
      .where(eq(governanceClauses.documentId, documentId))
      .orderBy(governanceClauses.clauseId);

    // Get rules for all clauses
    const clauseIds = clauses.map((c) => c.id);
    const rules: any[] = [];
    
    for (const clauseId of clauseIds) {
      const clauseRules = await db
        .select()
        .from(governanceRules)
        .where(eq(governanceRules.clauseId, clauseId));
      rules.push(...clauseRules);
    }

    return { document, clauses, rules };
  } catch (error) {
    console.error("[DocVersion] Failed to get document:", error);
    return null;
  }
}

/**
 * Get the currently effective document of a type.
 */
export async function getEffectiveDocument(
  type: "constitution" | "bylaws" | "iog" | "policy" | "annex" | "regulation"
): Promise<any | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [doc] = await db
      .select()
      .from(governanceDocuments)
      .where(
        and(
          eq(governanceDocuments.type, type),
          eq(governanceDocuments.status, "effective")
        )
      )
      .limit(1);

    return doc ?? null;
  } catch (error) {
    console.error("[DocVersion] Failed to get effective document:", error);
    return null;
  }
}

/**
 * List all versions of a document type.
 */
export async function listDocumentVersions(
  type: "constitution" | "bylaws" | "iog" | "policy" | "annex" | "regulation"
): Promise<any[]> {
  const db = getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(governanceDocuments)
      .where(eq(governanceDocuments.type, type))
      .orderBy(desc(governanceDocuments.version));
  } catch (error) {
    console.error("[DocVersion] Failed to list versions:", error);
    return [];
  }
}

// ============================================================================
// Initial Import Helper
// ============================================================================

/**
 * Import the complete current bylaws from the extracted text.
 * This is a one-time migration helper.
 */
export async function importCurrentBylaws(
  bylawsText: string,
  createdBy?: number
): Promise<{ documentId: number; clausesImported: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Create the document
    const doc = await createDocumentVersion({
      title: "MSA-Pakistan Constitution & Bylaws",
      type: "bylaws",
      version: "2025-26",
      effectiveFrom: new Date("2025-09-06"),
      sourceDocument: "Constitution & Bylaws MSA Pakistan 2025-26.pdf",
      createdBy,
    });

    if (!doc) return null;

    // Parse clauses from text
    const clauses = parseBylawsClauses(bylawsText);

    // Import clauses
    const result = await importClauses(doc.id, clauses);

    console.log(`[DocVersion] Imported current bylaws: ${result.imported} clauses`);
    return { documentId: doc.id, clausesImported: result.imported };
  } catch (error) {
    console.error("[DocVersion] Failed to import bylaws:", error);
    return null;
  }
}

/**
 * Parse bylaws text into structured clauses.
 * This is a simplified parser - in production, would need more sophisticated NLP.
 */
function parseBylawsClauses(text: string): ClauseImportInput[] {
  const clauses: ClauseImportInput[] = [];
  const lines = text.split("\n");

  let currentSection = "";
  let currentSubsection = "";
  let currentClause = "";
  let currentContent = "";
  let currentTitle = "";

  // Simple pattern matching for clause headers
  const clausePattern = /^(\d+\.\d+(?:\.\d+)*)\s+(.+)/;
  const sectionPattern = /^(\d+)\.\s+(.+)/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for clause pattern (e.g., "8.7.1 Each Permanent...")
    const clauseMatch = trimmed.match(clausePattern);
    if (clauseMatch) {
      // Save previous clause
      if (currentClause && currentContent) {
        clauses.push({
          clauseId: `BYLAW-${currentClause}`,
          title: currentTitle,
          content: currentContent.trim(),
          section: currentSection,
          subsection: currentSubsection,
          clauseNumber: currentClause,
        });
      }

      currentClause = clauseMatch[1];
      currentTitle = clauseMatch[2];
      currentContent = "";
      continue;
    }

    // Check for section pattern (e.g., "8. VOTING")
    const sectionMatch = trimmed.match(sectionPattern);
    if (sectionMatch && sectionMatch[1].length <= 2) {
      currentSection = sectionMatch[1];
      currentSubsection = sectionMatch[1];
      continue;
    }

    // Accumulate content
    if (currentClause) {
      currentContent += trimmed + "\n";
    }
  }

  // Save last clause
  if (currentClause && currentContent) {
    clauses.push({
      clauseId: `BYLAW-${currentClause}`,
      title: currentTitle,
      content: currentContent.trim(),
      section: currentSection,
      subsection: currentSubsection,
      clauseNumber: currentClause,
    });
  }

  return clauses;
}
