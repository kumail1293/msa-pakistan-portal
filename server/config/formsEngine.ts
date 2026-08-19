/**
 * Forms Engine
 *
 * Provides dynamic form creation, rendering, and submission management.
 * Forms can be used for applications, surveys, evaluations, registrations, etc.
 *
 * Usage:
 *   import { createForm, addFormField, submitForm } from "./formsEngine";
 *
 *   const form = await createForm({ name: "Membership Application", usageType: "membership_application" });
 *   await addFormField(form.id, { name: "fullName", label: "Full Name", type: "text", required: true });
 *   await submitForm(form.id, { fullName: "John Doe" }, userId);
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { forms, formFields, formSubmissions } from "../../drizzle/schema.enterprise";
import { getDb } from "../db";
import { logAuditEvent } from "./auditService";

// ============================================================================
// Form Management
// ============================================================================

export interface CreateFormInput {
  name: string;
  description?: string;
  usageType?: string;
  settings?: Record<string, unknown>;
  createdBy?: number;
}

/**
 * Create a new form definition.
 */
export async function createForm(input: CreateFormInput): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [result] = await db.insert(forms).values({
      name: input.name,
      description: input.description,
      usageType: input.usageType,
      settings: input.settings,
      createdBy: input.createdBy,
      status: "draft",
    });

    const formId = Number((result as any)[0].insertId);
    console.log(`[Forms] Created form "${input.name}" (#${formId}).`);
    return { id: formId };
  } catch (error) {
    console.error("[Forms] Failed to create form:", error);
    return null;
  }
}

/**
 * Activate a form (make it available for submissions).
 */
export async function activateForm(formId: number): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .update(forms)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(forms.id, formId));
    return true;
  } catch (error) {
    console.error("[Forms] Failed to activate form:", error);
    return false;
  }
}

/**
 * List all forms with optional filters.
 */
export async function listForms(options: {
  usageType?: string;
  status?: string;
  limit?: number;
} = {}): Promise<Array<{
  id: number;
  name: string;
  description: string | null;
  version: number;
  status: string;
  usageType: string | null;
  createdAt: Date;
}>> {
  const db = getDb();
  if (!db) return [];

  try {
    const conditions = [];
    if (options.usageType) conditions.push(eq(forms.usageType, options.usageType));
    if (options.status) conditions.push(eq(forms.status, options.status as any));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    return await db
      .select()
      .from(forms)
      .where(where)
      .orderBy(desc(forms.createdAt))
      .limit(options.limit ?? 50);
  } catch (error) {
    console.error("[Forms] Failed to list forms:", error);
    return [];
  }
}

/**
 * Get a form with all its fields.
 */
export async function getFormWithFields(formId: number): Promise<{
  form: any;
  fields: any[];
} | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [form] = await db
      .select()
      .from(forms)
      .where(eq(forms.id, formId))
      .limit(1);

    if (!form) return null;

    const fields = await db
      .select()
      .from(formFields)
      .where(eq(formFields.formId, formId))
      .orderBy(formFields.order);

    return { form, fields };
  } catch (error) {
    console.error("[Forms] Failed to get form:", error);
    return null;
  }
}

// ============================================================================
// Field Management
// ============================================================================

export interface AddFieldInput {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  defaultValue?: string;
  options?: Array<{ label: string; value: string }>;
  validation?: Record<string, unknown>;
  conditions?: Record<string, unknown>;
  order?: number;
  group?: string;
  width?: string;
}

/**
 * Add a field to a form.
 */
export async function addFormField(
  formId: number,
  input: AddFieldInput
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Get the next order number
    const [maxOrder] = await db
      .select({ maxOrder: formFields.order })
      .from(formFields)
      .where(eq(formFields.formId, formId))
      .orderBy(desc(formFields.order))
      .limit(1);

    const order = input.order ?? ((maxOrder?.maxOrder ?? 0) + 1);

    const [result] = await db.insert(formFields).values({
      formId,
      name: input.name,
      label: input.label,
      type: input.type as any,
      required: input.required ?? false,
      placeholder: input.placeholder,
      helpText: input.helpText,
      defaultValue: input.defaultValue,
      options: input.options,
      validation: input.validation,
      conditions: input.conditions,
      order,
      group: input.group,
      width: input.width,
    });

    return { id: Number((result as any)[0].insertId) };
  } catch (error) {
    console.error("[Forms] Failed to add field:", error);
    return null;
  }
}

/**
 * Remove a field from a form.
 */
export async function removeFormField(fieldId: number): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await db.delete(formFields).where(eq(formFields.id, fieldId));
    return true;
  } catch (error) {
    console.error("[Forms] Failed to remove field:", error);
    return false;
  }
}

// ============================================================================
// Submission Management
// ============================================================================

/**
 * Submit a form with data. Validates required fields.
 */
export async function submitForm(
  formId: number,
  data: Record<string, unknown>,
  submittedBy?: number,
  options: {
    entityType?: string;
    entityId?: number;
  } = {}
): Promise<{ id: number; validationErrors: string[] } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Get form and fields for validation
    const { form, fields } = (await getFormWithFields(formId)) ?? {};
    if (!form || !fields) return null;

    // Validate required fields
    const validationErrors: string[] = [];
    for (const field of fields) {
      if (field.required && (data[field.name] === undefined || data[field.name] === null || data[field.name] === "")) {
        validationErrors.push(`${field.label} is required.`);
      }
    }

    if (validationErrors.length > 0) {
      return { id: 0, validationErrors };
    }

    // Create submission
    const [result] = await db.insert(formSubmissions).values({
      formId,
      submittedBy,
      entityType: options.entityType,
      entityId: options.entityId,
      data,
      status: "submitted",
    });

    const submissionId = Number((result as any)[0].insertId);

    await logAuditEvent({
      userId: submittedBy,
      action: "form.submitted",
      entityType: options.entityType,
      entityId: options.entityId,
      after: { formId, formName: form.name, submissionId },
    });

    console.log(`[Forms] Form "${form.name}" submitted (#${submissionId}).`);
    return { id: submissionId, validationErrors: [] };
  } catch (error) {
    console.error("[Forms] Failed to submit form:", error);
    return null;
  }
}

/**
 * Review a form submission.
 */
export async function reviewSubmission(
  submissionId: number,
  options: {
    status: "reviewed" | "approved" | "rejected";
    reviewedBy: number;
    reviewNotes?: string;
  }
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .update(formSubmissions)
      .set({
        status: options.status,
        reviewedBy: options.reviewedBy,
        reviewedAt: new Date(),
        reviewNotes: options.reviewNotes,
        updatedAt: new Date(),
      })
      .where(eq(formSubmissions.id, submissionId));

    await logAuditEvent({
      userId: options.reviewedBy,
      action: `form.submission.${options.status}`,
      entityType: "form_submission",
      entityId: submissionId,
      after: { status: options.status, notes: options.reviewNotes },
    });

    return true;
  } catch (error) {
    console.error("[Forms] Failed to review submission:", error);
    return false;
  }
}

/**
 * Get submissions for a form.
 */
export async function getFormSubmissions(
  formId: number,
  options: { status?: string; limit?: number; offset?: number } = {}
): Promise<Array<{
  id: number;
  submittedBy: number | null;
  data: unknown;
  status: string;
  reviewedBy: number | null;
  reviewNotes: string | null;
  createdAt: Date;
}>> {
  const db = getDb();
  if (!db) return [];

  try {
    const conditions = [eq(formSubmissions.formId, formId)];
    if (options.status) conditions.push(eq(formSubmissions.status, options.status as any));

    return await db
      .select()
      .from(formSubmissions)
      .where(and(...conditions))
      .orderBy(desc(formSubmissions.createdAt))
      .limit(options.limit ?? 50)
      .offset(options.offset ?? 0);
  } catch (error) {
    console.error("[Forms] Failed to get submissions:", error);
    return [];
  }
}

/**
 * Get submission count by status for a form.
 */
export async function getSubmissionCounts(formId: number): Promise<{
  submitted: number;
  reviewed: number;
  approved: number;
  rejected: number;
}> {
  const db = getDb();
  if (!db) return { submitted: 0, reviewed: 0, approved: 0, rejected: 0 };

  try {
    const counts = await db
      .select({
        status: formSubmissions.status,
        count: sql<number>`count(*)`,
      })
      .from(formSubmissions)
      .where(eq(formSubmissions.formId, formId))
      .groupBy(formSubmissions.status);

    const result = { submitted: 0, reviewed: 0, approved: 0, rejected: 0 };
    for (const row of counts) {
      if (row.status in result) {
        (result as any)[row.status] = row.count;
      }
    }
    return result;
  } catch (error) {
    console.error("[Forms] Failed to get submission counts:", error);
    return { submitted: 0, reviewed: 0, approved: 0, rejected: 0 };
  }
}


