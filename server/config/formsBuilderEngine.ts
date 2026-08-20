/**
 * Forms Builder Engine V2
 *
 * Enhanced form building with:
 * - New field types: rating, matrix, address, ranking, richtext, color, autocomplete,
 *   phone_intl, currency, json_editor, signature_pad, file_upload, repeating_group
 * - Form templates for reuse
 * - Version control for form designs
 * - Advanced validation rules (cross-field, API lookup, database check)
 * - Form builder canvas operations (drag-drop ordering, grouping, conditional visibility)
 * - Form preview and rendering hints
 *
 * Usage:
 *   import { createEnhancedField, validateSubmissionV2, snapshotForm } from "./formsBuilderEngine";
 *
 *   await createEnhancedField(formId, { name: "rating", label: "Satisfaction", type: "rating",
 *     extendedType: "rating", ratingMax: 5, ratingStyle: "stars" });
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { forms, formFields, formSubmissions } from "../../drizzle/schema.enterprise";
import {
  formBuilderFieldInfo,
  formTemplates,
  formVersions,
  formValidationRules,
} from "../../drizzle/schema.forms_builder";
import { getDb } from "../db";
import { logAuditEvent } from "./auditService";

// ============================================================================
// Extended Field Types
// ============================================================================

export type ExtendedFieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "phone"
  | "date"
  | "select"
  | "multi_select"
  | "checkbox"
  | "radio"
  | "file"
  | "image"
  | "signature"
  | "divider"
  | "heading"
  | "paragraph"
  // New builder types
  | "rating"
  | "matrix"
  | "address"
  | "ranking"
  | "richtext"
  | "color"
  | "autocomplete"
  | "phone_intl"
  | "currency"
  | "json_editor"
  | "signature_pad"
  | "file_upload"
  | "repeating_group";

/**
 * Maps extended types to their base enum type for the formFields table.
 */
function baseTypeForExtended(extendedType: string): string {
  const mapping: Record<string, string> = {
    rating: "number",
    matrix: "radio",
    address: "text",
    ranking: "multi_select",
    richtext: "textarea",
    color: "text",
    autocomplete: "select",
    phone_intl: "phone",
    currency: "number",
    json_editor: "textarea",
    signature_pad: "signature",
    file_upload: "file",
    repeating_group: "text",
  };
  return mapping[extendedType] ?? extendedType;
}

// ============================================================================
// Enhanced Field Creation
// ============================================================================

export interface CreateEnhancedFieldInput {
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

  // Extended type properties
  extendedType?: string;
  ratingMax?: number;
  ratingStyle?: string;
  matrixRows?: string[];
  matrixColumns?: string[];
  matrixInputType?: string;
  addressFields?: string[];
  addressCountryDefault?: string;
  rankingChoices?: string[];
  rankingMinSelections?: number;
  rankingMaxSelections?: number;
  autocompleteSource?: string;
  autocompleteOptions?: Array<{ label: string; value: string }>;
  autocompleteApiUrl?: string;
  currencyCode?: string;
  currencyMin?: string;
  currencyMax?: string;
  repeatingMinRows?: number;
  repeatingMaxRows?: number;
  repeatingGroupFields?: Array<{
    name: string;
    label: string;
    type: string;
    required?: boolean;
    options?: Array<{ label: string; value: string }>;
  }>;
  fileAcceptedTypes?: string[];
  fileMaxSizeMb?: number;
  fileMaxCount?: number;
  richTextToolbar?: string[];
  cssClasses?: string;
  containerWidth?: string;
  showLabel?: boolean;
  readOnly?: boolean;
  hidden?: boolean;
}

/**
 * Create a form field with extended builder info.
 */
export async function createEnhancedField(
  formId: number,
  input: CreateEnhancedFieldInput
): Promise<{ fieldId: number; infoId: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Determine base type from extended type
    const baseType = input.extendedType
      ? baseTypeForExtended(input.extendedType)
      : input.type;

    // Get next order
    const [maxOrder] = await db
      .select({ maxOrder: formFields.order })
      .from(formFields)
      .where(eq(formFields.formId, formId))
      .orderBy(desc(formFields.order))
      .limit(1);

    const order = input.order ?? ((maxOrder?.maxOrder ?? 0) + 1);

    // Insert base field
    const [fieldResult] = await db.insert(formFields).values({
      formId,
      name: input.name,
      label: input.label,
      type: baseType as any,
      required: input.required ?? false,
      placeholder: input.placeholder,
      helpText: input.helpText,
      defaultValue: input.defaultValue,
      options: input.options,
      validation: input.validation,
      conditions: input.conditions,
      order,
      group: input.group,
      width: input.width ?? "full",
    });

    const fieldId = Number((fieldResult as any)[0].insertId);

    // Insert extended builder info if custom type
    let infoId = fieldId;
    if (input.extendedType) {
      const [infoResult] = await db.insert(formBuilderFieldInfo).values({
        formFieldId: fieldId,
        extendedType: input.extendedType,
        ratingMax: input.ratingMax,
        ratingStyle: input.ratingStyle,
        matrixRows: input.matrixRows,
        matrixColumns: input.matrixColumns,
        matrixInputType: input.matrixInputType,
        addressFields: input.addressFields,
        addressCountryDefault: input.addressCountryDefault,
        rankingChoices: input.rankingChoices,
        rankingMinSelections: input.rankingMinSelections,
        rankingMaxSelections: input.rankingMaxSelections,
        autocompleteSource: input.autocompleteSource,
        autocompleteOptions: input.autocompleteOptions,
        autocompleteApiUrl: input.autocompleteApiUrl,
        currencyCode: input.currencyCode,
        currencyMin: input.currencyMin,
        currencyMax: input.currencyMax,
        repeatingMinRows: input.repeatingMinRows,
        repeatingMaxRows: input.repeatingMaxRows,
        repeatingGroupFields: input.repeatingGroupFields,
        fileAcceptedTypes: input.fileAcceptedTypes,
        fileMaxSizeMb: input.fileMaxSizeMb,
        fileMaxCount: input.fileMaxCount,
        richTextToolbar: input.richTextToolbar,
        cssClasses: input.cssClasses,
        containerWidth: input.containerWidth,
        showLabel: input.showLabel ?? true,
        readOnly: input.readOnly ?? false,
        hidden: input.hidden ?? false,
      });
      infoId = Number((infoResult as any)[0].insertId);
    }

    console.log(`[FormsBuilder] Created field "${input.name}" (#${fieldId}, info #${infoId}).`);
    return { fieldId, infoId };
  } catch (error) {
    console.error("[FormsBuilder] Failed to create enhanced field:", error);
    return null;
  }
}

/**
 * Update a form field's extended builder info.
 */
export async function updateEnhancedField(
  fieldId: number,
  updates: Partial<CreateEnhancedFieldInput>
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    // Update base field if needed
    const baseUpdates: Record<string, unknown> = {};
    if (updates.label !== undefined) baseUpdates.label = updates.label;
    if (updates.required !== undefined) baseUpdates.required = updates.required;
    if (updates.placeholder !== undefined) baseUpdates.placeholder = updates.placeholder;
    if (updates.helpText !== undefined) baseUpdates.helpText = updates.helpText;
    if (updates.defaultValue !== undefined) baseUpdates.defaultValue = updates.defaultValue;
    if (updates.options !== undefined) baseUpdates.options = updates.options;
    if (updates.validation !== undefined) baseUpdates.validation = updates.validation;
    if (updates.conditions !== undefined) baseUpdates.conditions = updates.conditions;
    if (updates.group !== undefined) baseUpdates.group = updates.group;
    if (updates.width !== undefined) baseUpdates.width = updates.width;

    if (Object.keys(baseUpdates).length > 0) {
      baseUpdates.updatedAt = new Date();
      await db
        .update(formFields)
        .set(baseUpdates)
        .where(eq(formFields.id, fieldId));
    }

    // Update extended info
    const extUpdates: Record<string, unknown> = {};
    if (updates.extendedType !== undefined) extUpdates.extendedType = updates.extendedType;
    if (updates.ratingMax !== undefined) extUpdates.ratingMax = updates.ratingMax;
    if (updates.ratingStyle !== undefined) extUpdates.ratingStyle = updates.ratingStyle;
    if (updates.matrixRows !== undefined) extUpdates.matrixRows = updates.matrixRows;
    if (updates.matrixColumns !== undefined) extUpdates.matrixColumns = updates.matrixColumns;
    if (updates.matrixInputType !== undefined) extUpdates.matrixInputType = updates.matrixInputType;
    if (updates.addressFields !== undefined) extUpdates.addressFields = updates.addressFields;
    if (updates.rankingChoices !== undefined) extUpdates.rankingChoices = updates.rankingChoices;
    if (updates.autocompleteSource !== undefined) extUpdates.autocompleteSource = updates.autocompleteSource;
    if (updates.autocompleteOptions !== undefined) extUpdates.autocompleteOptions = updates.autocompleteOptions;
    if (updates.currencyCode !== undefined) extUpdates.currencyCode = updates.currencyCode;
    if (updates.repeatingGroupFields !== undefined) extUpdates.repeatingGroupFields = updates.repeatingGroupFields;
    if (updates.fileAcceptedTypes !== undefined) extUpdates.fileAcceptedTypes = updates.fileAcceptedTypes;
    if (updates.fileMaxSizeMb !== undefined) extUpdates.fileMaxSizeMb = updates.fileMaxSizeMb;
    if (updates.fileMaxCount !== undefined) extUpdates.fileMaxCount = updates.fileMaxCount;
    if (updates.richTextToolbar !== undefined) extUpdates.richTextToolbar = updates.richTextToolbar;
    if (updates.cssClasses !== undefined) extUpdates.cssClasses = updates.cssClasses;
    if (updates.containerWidth !== undefined) extUpdates.containerWidth = updates.containerWidth;
    if (updates.showLabel !== undefined) extUpdates.showLabel = updates.showLabel;
    if (updates.readOnly !== undefined) extUpdates.readOnly = updates.readOnly;
    if (updates.hidden !== undefined) extUpdates.hidden = updates.hidden;

    if (Object.keys(extUpdates).length > 0) {
      extUpdates.updatedAt = new Date();
      const existing = await db
        .select({ id: formBuilderFieldInfo.id })
        .from(formBuilderFieldInfo)
        .where(eq(formBuilderFieldInfo.formFieldId, fieldId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(formBuilderFieldInfo)
          .set(extUpdates)
          .where(eq(formBuilderFieldInfo.formFieldId, fieldId));
      } else {
        await db.insert(formBuilderFieldInfo).values({
          formFieldId: fieldId,
          ...extUpdates,
        } as any);
      }
    }

    return true;
  } catch (error) {
    console.error("[FormsBuilder] Failed to update enhanced field:", error);
    return false;
  }
}

/**
 * Get full field definition including extended builder info.
 */
export async function getEnhancedFields(formId: number): Promise<Array<{
  field: any;
  builderInfo: any | null;
}>> {
  const db = getDb();
  if (!db) return [];

  try {
    const fields = await db
      .select()
      .from(formFields)
      .where(eq(formFields.formId, formId))
      .orderBy(formFields.order);

    const results: Array<{ field: any; builderInfo: any | null }> = [];
    for (const field of fields) {
      const [info] = await db
        .select()
        .from(formBuilderFieldInfo)
        .where(eq(formBuilderFieldInfo.formFieldId, field.id))
        .limit(1);

      results.push({ field, builderInfo: info ?? null });
    }

    return results;
  } catch (error) {
    console.error("[FormsBuilder] Failed to get enhanced fields:", error);
    return [];
  }
}

// ============================================================================
// Form Templates
// ============================================================================

export interface CreateFormTemplateInput {
  name: string;
  description?: string;
  category?: string;
  formId?: number; // copy from existing form
  formDefinition?: {
    fields: Array<{
      name: string;
      label: string;
      type: string;
      required?: boolean;
      options?: Array<{ label: string; value: string }>;
      validation?: Record<string, unknown>;
      conditions?: Record<string, unknown>;
      group?: string;
      width?: string;
      builderInfo?: Record<string, unknown>;
    }>;
    settings?: Record<string, unknown>;
  };
  createdBy?: number;
}

/**
 * Create a form template from an existing form or raw definition.
 */
export async function createFormTemplate(
  input: CreateFormTemplateInput
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    let definition = input.formDefinition;

    // If formId provided, snapshot the form's current state
    if (input.formId && !definition) {
      const fields = await db
        .select()
        .from(formFields)
        .where(eq(formFields.formId, input.formId))
        .orderBy(formFields.order);

      definition = {
        fields: fields.map((f) => ({
          name: f.name,
          label: f.label,
          type: f.type as string,
          required: f.required ?? false,
          options: f.options as any,
          validation: f.validation as any,
          conditions: f.conditions as any,
          group: f.group ?? undefined,
          width: f.width ?? undefined,
        })),
        settings: {},
      };
    }

    const [result] = await db.insert(formTemplates).values({
      name: input.name,
      description: input.description,
      category: input.category,
      formDefinition: definition,
      isSystem: false,
      createdBy: input.createdBy,
    });

    const id = Number((result as any)[0].insertId);
    console.log(`[FormsBuilder] Created template "${input.name}" (#${id}).`);
    return { id };
  } catch (error) {
    console.error("[FormsBuilder] Failed to create template:", error);
    return null;
  }
}

/**
 * Apply a template to create a new form.
 */
export async function applyTemplate(
  templateId: number,
  formName: string,
  createdBy?: number
): Promise<{ formId: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [template] = await db
      .select()
      .from(formTemplates)
      .where(eq(formTemplates.id, templateId))
      .limit(1);

    if (!template || !template.formDefinition) return null;

    const def = template.formDefinition as any;

    // Create the form
    const [formResult] = await db.insert(forms).values({
      name: formName,
      description: `Created from template: ${template.name}`,
      usageType: template.category,
      status: "draft",
      createdBy,
    });

    const formId = Number((formResult as any)[0].insertId);

    // Add fields from template
    for (const fieldDef of def.fields ?? []) {
      await db.insert(formFields).values({
        formId,
        name: fieldDef.name,
        label: fieldDef.label,
        type: fieldDef.type as any,
        required: fieldDef.required ?? false,
        order: 0,
        options: fieldDef.options as any,
        validation: fieldDef.validation as any,
        conditions: fieldDef.conditions as any,
        group: fieldDef.group as string | undefined,
        width: fieldDef.width as string | undefined,
      });
    }

    console.log(`[FormsBuilder] Applied template #${templateId} → form #${formId}.`);
    return { formId };
  } catch (error) {
    console.error("[FormsBuilder] Failed to apply template:", error);
    return null;
  }
}

/**
 * List form templates with optional category filter.
 */
export async function listFormTemplates(
  options: { category?: string; limit?: number } = {}
): Promise<any[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const conditions = [];
    if (options.category) conditions.push(eq(formTemplates.category, options.category));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    return await db
      .select()
      .from(formTemplates)
      .where(where)
      .orderBy(desc(formTemplates.createdAt))
      .limit(options.limit ?? 50);
  } catch (error) {
    console.error("[FormsBuilder] Failed to list templates:", error);
    return [];
  }
}

// ============================================================================
// Form Versioning
// ============================================================================

/**
 * Create a versioned snapshot of a form's current state.
 */
export async function snapshotForm(
  formId: number,
  changeDescription?: string,
  createdBy?: number
): Promise<{ versionNumber: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    // Get current form
    const [form] = await db
      .select()
      .from(forms)
      .where(eq(forms.id, formId))
      .limit(1);

    if (!form) return null;

    // Get fields
    const fields = await db
      .select()
      .from(formFields)
      .where(eq(formFields.formId, formId))
      .orderBy(formFields.order);

    // Get next version number
    const [maxVersion] = await db
      .select({ maxVersion: sql<number>`COALESCE(MAX(${formVersions.versionNumber}), 0)` })
      .from(formVersions)
      .where(eq(formVersions.formId, formId));

    const versionNumber = (maxVersion?.maxVersion ?? 0) + 1;

    await db.insert(formVersions).values({
      formId,
      versionNumber,
      snapshot: {
        name: form.name,
        description: form.description ?? undefined,
        fields: fields.map((f) => ({
          name: f.name,
          label: f.label,
          type: f.type,
          required: f.required,
          placeholder: f.placeholder ?? undefined,
          helpText: f.helpText ?? undefined,
          defaultValue: f.defaultValue ?? undefined,
          options: f.options,
          validation: f.validation,
          conditions: f.conditions,
          order: f.order,
          group: f.group ?? undefined,
          width: f.width ?? undefined,
        })),
        settings: form.settings as any,
      },
      changeDescription,
      createdBy,
    });

    // Also update the form version counter
    await db
      .update(forms)
      .set({ version: versionNumber, updatedAt: new Date() })
      .where(eq(forms.id, formId));

    console.log(`[FormsBuilder] Snapshotted form #${formId} → v${versionNumber}.`);
    return { versionNumber };
  } catch (error) {
    console.error("[FormsBuilder] Failed to snapshot form:", error);
    return null;
  }
}

/**
 * Restore a form to a previous version.
 */
export async function restoreFormVersion(
  formId: number,
  versionNumber: number
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const [version] = await db
      .select()
      .from(formVersions)
      .where(
        and(
          eq(formVersions.formId, formId),
          eq(formVersions.versionNumber, versionNumber)
        )
      )
      .limit(1);

    if (!version) return false;

    const snapshot = version.snapshot as any;

    // Delete current fields
    await db.delete(formFields).where(eq(formFields.formId, formId));

    // Re-insert from snapshot
    for (const field of snapshot.fields ?? []) {
      await db.insert(formFields).values({
        formId,
        name: field.name,
        label: field.label,
        type: field.type,
        required: field.required ?? false,
        placeholder: field.placeholder,
        helpText: field.helpText,
        defaultValue: field.defaultValue,
        options: field.options,
        validation: field.validation,
        conditions: field.conditions,
        order: field.order,
        group: field.group,
        width: field.width,
      });
    }

    // Update form name if changed
    await db
      .update(forms)
      .set({
        name: snapshot.name,
        description: snapshot.description,
        updatedAt: new Date(),
      })
      .where(eq(forms.id, formId));

    console.log(`[FormsBuilder] Restored form #${formId} to v${versionNumber}.`);
    return true;
  } catch (error) {
    console.error("[FormsBuilder] Failed to restore form version:", error);
    return false;
  }
}

/**
 * Get version history for a form.
 */
export async function getFormVersionHistory(formId: number): Promise<any[]> {
  const db = getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(formVersions)
      .where(eq(formVersions.formId, formId))
      .orderBy(desc(formVersions.versionNumber));
  } catch (error) {
    console.error("[FormsBuilder] Failed to get version history:", error);
    return [];
  }
}

// ============================================================================
// Advanced Validation Rules
// ============================================================================

export interface CreateValidationRuleInput {
  formId: number;
  formFieldId?: number;
  name: string;
  type: "field_level" | "cross_field" | "custom_regex" | "api_lookup" | "database_check" | "conditional";
  config: Record<string, unknown>;
  errorMessage: string;
  severity?: "error" | "warning" | "info";
  createdBy?: number;
}

/**
 * Create a custom validation rule for a form.
 */
export async function createValidationRule(
  input: CreateValidationRuleInput
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [result] = await db.insert(formValidationRules).values({
      formId: input.formId,
      formFieldId: input.formFieldId,
      name: input.name,
      type: input.type,
      config: input.config,
      errorMessage: input.errorMessage,
      severity: input.severity ?? "error",
      enabled: true,
      createdBy: input.createdBy,
    });

    const id = Number((result as any)[0].insertId);
    console.log(`[FormsBuilder] Created validation rule "${input.name}" (#${id}).`);
    return { id };
  } catch (error) {
    console.error("[FormsBuilder] Failed to create validation rule:", error);
    return null;
  }
}

/**
 * Validate a form submission against all validation rules.
 */
export async function validateSubmissionV2(
  formId: number,
  data: Record<string, unknown>
): Promise<{
  valid: boolean;
  errors: Array<{ rule: string; field?: string; message: string; severity: string }>;
}> {
  const db = getDb();
  if (!db) return { valid: true, errors: [] };

  try {
    // Get validation rules
    const rules = await db
      .select()
      .from(formValidationRules)
      .where(
        and(
          eq(formValidationRules.formId, formId),
          eq(formValidationRules.enabled, true)
        )
      );

    // Get fields for cross-field validation
    const fields = await db
      .select()
      .from(formFields)
      .where(eq(formFields.formId, formId));

    const errors: Array<{ rule: string; field?: string; message: string; severity: string }> = [];

    for (const rule of rules) {
      const config = rule.config as any;

      switch (rule.type) {
        case "field_level": {
          const fieldName = fields.find((f) => f.id === rule.formFieldId)?.name ?? undefined;
          if (!fieldName) break;
          const value = data[fieldName!];

          const errMsg = rule.errorMessage ?? "Validation failed";
          const errSeverity = rule.severity ?? "error";
          if (config.min !== undefined && typeof value === "number" && value < config.min) {
            errors.push({ rule: rule.name, field: fieldName!, message: errMsg, severity: errSeverity });
          }
          if (config.max !== undefined && typeof value === "number" && value > config.max) {
            errors.push({ rule: rule.name, field: fieldName!, message: errMsg, severity: errSeverity });
          }
          if (config.minLength !== undefined && typeof value === "string" && value.length < config.minLength) {
            errors.push({ rule: rule.name, field: fieldName!, message: errMsg, severity: errSeverity });
          }
          if (config.maxLength !== undefined && typeof value === "string" && value.length > config.maxLength) {
            errors.push({ rule: rule.name, field: fieldName!, message: errMsg, severity: errSeverity });
          }
          if (config.pattern && typeof value === "string" && !new RegExp(config.pattern).test(value)) {
            errors.push({
              rule: rule.name,
              field: fieldName!,
              message: config.patternMessage ?? errMsg,
              severity: errSeverity,
            });
          }
          break;
        }

        case "cross_field": {
          const depFields = (config.dependentFields ?? []) as string[];
          const values = depFields.map((f: string) => data[f]);

          // Simple cross-field: check if at least one is filled
          const crossErrMsg = rule.errorMessage ?? "Cross-field validation failed";
          const crossErrSeverity = rule.severity ?? "error";
          if (config.crossFieldRule === "at_least_one") {
            const allEmpty = values.every(
              (v: unknown) => v === undefined || v === null || v === ""
            );
            if (allEmpty) {
              errors.push({
                rule: rule.name,
                message: crossErrMsg,
                severity: crossErrSeverity,
              });
            }
          }

          // Date comparison
          if (config.crossFieldRule === "endDate_after_startDate") {
            const start = depFields[0] ? new Date(data[depFields[0]] as string) : null;
            const end = depFields[1] ? new Date(data[depFields[1]] as string) : null;
            if (start && end && end <= start) {
              errors.push({
                rule: rule.name,
                message: crossErrMsg,
                severity: crossErrSeverity,
              });
            }
          }
          break;
        }

        case "custom_regex": {
          const regexFieldName = fields.find((f) => f.id === rule.formFieldId)?.name;
          if (!regexFieldName || !config.pattern) break;
          const value = String(data[regexFieldName] ?? "");
          if (value && !new RegExp(config.pattern).test(value)) {
            errors.push({
              rule: rule.name,
              field: regexFieldName,
              message: rule.errorMessage ?? "Regex validation failed",
              severity: rule.severity ?? "error",
            });
          }
          break;
        }

        case "conditional": {
          const condField = config.conditionField as string;
          const condOp = config.conditionOperator as string;
          const condValue = config.conditionValue;
          const fieldValue = data[condField];

          let conditionMet = false;
          switch (condOp) {
            case "eq": conditionMet = fieldValue === condValue; break;
            case "neq": conditionMet = fieldValue !== condValue; break;
            case "gt": conditionMet = Number(fieldValue) > Number(condValue); break;
            case "lt": conditionMet = Number(fieldValue) < Number(condValue); break;
            case "contains": conditionMet = String(fieldValue).includes(String(condValue)); break;
            case "empty": conditionMet = !fieldValue || fieldValue === ""; break;
            case "not_empty": conditionMet = !!fieldValue && fieldValue !== ""; break;
          }

          if (conditionMet && config.thenValidate) {
            const thenRules = config.thenValidate as Record<string, unknown>;
            for (const [tn, tv] of Object.entries(thenRules)) {
              const tvConfig = tv as any;
              if (tvConfig.required && (!data[tn] || data[tn] === "")) {
                errors.push({
                  rule: rule.name,
                  field: tn as string,
                  message: `${tn} is required when ${condField} ${condOp} ${String(condValue)}`,
                  severity: rule.severity ?? "error",
                });
              }
            }
          }
          break;
        }

        // api_lookup and database_check require external calls — mark as needing runtime
        case "api_lookup":
        case "database_check":
          // These require runtime database/API access
          // For now, they are validated at submission time by the caller
          break;
      }
    }

    return {
      valid: errors.filter((e) => e.severity === "error").length === 0,
      errors,
    };
  } catch (error) {
    console.error("[FormsBuilder] Failed to validate submission:", error);
    return { valid: false, errors: [{ rule: "system", message: "Validation system error", severity: "error" }] };
  }
}

// ============================================================================
// Form Canvas Operations
// ============================================================================

/**
 * Reorder fields on the form canvas.
 */
export async function reorderFormFields(
  formId: number,
  fieldOrders: Array<{ fieldId: number; newOrder: number }>
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    for (const { fieldId, newOrder } of fieldOrders) {
      await db
        .update(formFields)
        .set({ order: newOrder })
        .where(
          and(eq(formFields.id, fieldId), eq(formFields.formId, formId))
        );
    }
    return true;
  } catch (error) {
    console.error("[FormsBuilder] Failed to reorder fields:", error);
    return false;
  }
}

/**
 * Group fields under a section/group.
 */
export async function groupFormFields(
  formId: number,
  groupConfig: Array<{ fieldId: number; group: string | null }>
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    for (const { fieldId, group } of groupConfig) {
      await db
        .update(formFields)
        .set({ group })
        .where(
          and(eq(formFields.id, fieldId), eq(formFields.formId, formId))
        );
    }
    return true;
  } catch (error) {
    console.error("[FormsBuilder] Failed to group fields:", error);
    return false;
  }
}

/**
 * Duplicate a field within a form.
 */
export async function duplicateFormField(
  fieldId: number,
  newName?: string
): Promise<{ id: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [original] = await db
      .select()
      .from(formFields)
      .where(eq(formFields.id, fieldId))
      .limit(1);

    if (!original) return null;

    // Get max order
    const [maxOrder] = await db
      .select({ maxOrder: formFields.order })
      .from(formFields)
      .where(eq(formFields.formId, original.formId))
      .orderBy(desc(formFields.order))
      .limit(1);

    const [result] = await db.insert(formFields).values({
      formId: original.formId,
      name: newName ?? `${original.name}_copy`,
      label: `${original.label} (Copy)`,
      type: original.type,
      required: original.required ?? false,
      placeholder: original.placeholder,
      helpText: original.helpText,
      defaultValue: original.defaultValue,
      options: original.options,
      validation: original.validation,
      conditions: original.conditions,
      order: (maxOrder?.maxOrder ?? 0) + 1,
      group: original.group ?? undefined,
      width: original.width ?? undefined,
    });

    return { id: Number((result as any)[0].insertId) };
  } catch (error) {
    console.error("[FormsBuilder] Failed to duplicate field:", error);
    return null;
  }
}
