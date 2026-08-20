/**
 * Forms Builder Schema Extension
 *
 * Adds:
 * - Extended field types (rating, matrix, address, ranking, richtext, color, autocomplete, etc.)
 * - Form templates for reuse
 * - Form snapshots (versioned form layouts)
 * - Form → Workflow pipeline configuration
 * - Pipeline stages and tracking
 * - Form-to-document generation config
 * - Submission approval chains
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
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// ============================================================================
// FORM BUILDER — Extended Field Types
// ============================================================================

/**
 * Extended field type definitions.
 * The base formFields table uses a mysqlEnum which cannot be extended without
 * a migration, so we store the extended type info in a parallel table.
 * The runtime checks both formFields.type and formBuilderFieldInfo.extendedType.
 */
export const formBuilderFieldInfo = mysqlTable(
  "form_builder_field_info",
  {
    id: int("id").autoincrement().primaryKey(),
    formFieldId: int("formFieldId").notNull().unique(),

    // Extended type overrides the base type when present
    extendedType: varchar("extendedType", { length: 50 }), // rating | matrix | address | ranking | richtext | color | autocomplete | phone_intl | currency | json_editor | signature_pad | file_upload | repeating_group

    // Rating-specific
    ratingMax: int("ratingMax").default(5),
    ratingStyle: varchar("ratingStyle", { length: 30 }), // stars | hearts | thumbs | emoji | numeric

    // Matrix-specific
    matrixRows: json("matrixRows").$type<string[]>(),
    matrixColumns: json("matrixColumns").$type<string[]>(),
    matrixInputType: varchar("matrixInputType", { length: 30 }), // radio | checkbox | dropdown | text

    // Address-specific
    addressFields: json("addressFields").$type<string[]>(), // street, city, state, zip, country
    addressCountryDefault: varchar("addressCountryDefault", { length: 3 }),

    // Ranking-specific
    rankingChoices: json("rankingChoices").$type<string[]>(),
    rankingMinSelections: int("rankingMinSelections"),
    rankingMaxSelections: int("rankingMaxSelections"),

    // Autocomplete-specific
    autocompleteSource: varchar("autocompleteSource", { length: 100 }), // static | api | database
    autocompleteOptions: json("autocompleteOptions").$type<Array<{ label: string; value: string }>>(),
    autocompleteApiUrl: varchar("autocompleteApiUrl", { length: 500 }),

    // Currency-specific
    currencyCode: varchar("currencyCode", { length: 3 }).default("PKR"),
    currencyMin: varchar("currencyMin", { length: 20 }),
    currencyMax: varchar("currencyMax", { length: 20 }),

    // Repeating group
    repeatingMinRows: int("repeatingMinRows").default(0),
    repeatingMaxRows: int("repeatingMaxRows"),
    repeatingGroupFields: json("repeatingGroupFields").$type<Array<{
      name: string;
      label: string;
      type: string;
      required?: boolean;
      options?: Array<{ label: string; value: string }>;
    }>>(),

    // File upload
    fileAcceptedTypes: json("fileAcceptedTypes").$type<string[]>(), // mime types
    fileMaxSizeMb: int("fileMaxSizeMb").default(10),
    fileMaxCount: int("fileMaxCount").default(1),

    // Rich text
    richTextToolbar: json("richTextToolbar").$type<string[]>(), // bold, italic, lists, links, images

    // Layout and display
    cssClasses: varchar("cssClasses", { length: 500 }),
    containerWidth: varchar("containerWidth", { length: 30 }), // full | half | third
    showLabel: boolean("showLabel").default(true),
    readOnly: boolean("readOnly").default(false),
    hidden: boolean("hidden").default(false),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    fieldIdx: index("fbi_field_idx").on(table.formFieldId),
    typeIdx: index("fbi_type_idx").on(table.extendedType),
  })
);

export type FormBuilderFieldInfo = typeof formBuilderFieldInfo.$inferSelect;
export type InsertFormBuilderFieldInfo = typeof formBuilderFieldInfo.$inferInsert;

// ============================================================================
// FORM TEMPLATES
// ============================================================================

export const formTemplates = mysqlTable(
  "form_templates",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 100 }), // membership | application | survey | evaluation | registration | custom
    formDefinition: json("formDefinition").$type<{
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
    }>(),
    isSystem: boolean("isSystem").default(false),
    createdBy: int("createdBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    categoryIdx: index("ft_category_idx").on(table.category),
  })
);

export type FormTemplate = typeof formTemplates.$inferSelect;
export type InsertFormTemplate = typeof formTemplates.$inferInsert;

// ============================================================================
// FORM → WORKFLOW PIPELINE
// ============================================================================

/**
 * Configures the automated pipeline that connects:
 *   Form Submission → Workflow Initiation → Approval Chain → Document Generation
 */
export const formPipelines = mysqlTable(
  "form_pipelines",
  {
    id: int("id").autoincrement().primaryKey(),
    formId: int("formId").notNull(),
    workflowId: int("workflowId"), // links to existing workflows table
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    status: mysqlEnum("status", ["draft", "active", "archived"]).default("draft").notNull(),

    // Trigger configuration
    triggerOnSubmission: boolean("triggerOnSubmission").default(true),
    triggerOnStatusChange: boolean("triggerOnStatusChange").default(false),
    triggerStatusFilter: varchar("triggerStatusFilter", { length: 50 }),

    // Mapping: how form fields map to workflow metadata
    fieldMapping: json("fieldMapping").$type<Record<string, string>>(), // formFieldName → workflowMetadataKey

    // Document generation
    documentTemplateId: int("documentTemplateId"),
    documentOutputFormat: varchar("documentOutputFormat", { length: 20 }), // pdf | html | docx
    documentNamingPattern: varchar("documentNamingPattern", { length: 200 }),

    // Notifications
    notifyOnSubmission: boolean("notifyOnSubmission").default(true),
    notifyOnCompletion: boolean("notifyOnCompletion").default(true),
    notifyOnRejection: boolean("notifyOnRejection").default(true),
    notificationRecipients: json("notificationRecipients").$type<string[]>(), // role keys or user IDs

    // Metadata
    organizationId: int("organizationId"),
    createdBy: int("createdBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    formIdx: index("fp_form_idx").on(table.formId),
    workflowIdx: index("fp_workflow_idx").on(table.workflowId),
    statusIdx: index("fp_status_idx").on(table.status),
  })
);

export type FormPipeline = typeof formPipelines.$inferSelect;
export type InsertFormPipeline = typeof formPipelines.$inferInsert;

// ============================================================================
// PIPELINE INSTANCES — Tracks each submission through the pipeline
// ============================================================================

export const pipelineInstances = mysqlTable(
  "pipeline_instances",
  {
    id: int("id").autoincrement().primaryKey(),
    pipelineId: int("pipelineId").notNull(),
    formSubmissionId: int("formSubmissionId").notNull(),
    workflowInstanceId: int("workflowInstanceId"), // created when pipeline triggers workflow

    status: mysqlEnum("status", [
      "pending",       // submission received, not yet processed
      "validating",    // running validation rules
      "processing",    // workflow initiated
      "awaiting_approval", // in approval chain
      "approved",      // all approvals received
      "rejected",      // rejected at some stage
      "needs_revision", // needs changes, send back
      "generating_document", // creating output document
      "completed",     // pipeline finished successfully
      "failed",        // pipeline error
      "cancelled",     // manually cancelled
    ]).default("pending").notNull(),

    currentStep: int("currentStep").default(1),
    totalSteps: int("totalSteps"),

    // Pipeline execution log
    steps: json("steps").$type<Array<{
      stepNumber: number;
      name: string;
      type: string; // validate | workflow | approval | document | notify
      status: string; // pending | running | completed | failed | skipped
      startedAt?: string;
      completedAt?: string;
      result?: Record<string, unknown>;
      error?: string;
    }>>(),

    // Approval chain state
    approvalChain: json("approvalChain").$type<Array<{
      stepNumber: number;
      approverRole: string;
      approverUserId?: number;
      decision?: string; // approved | rejected | needs_revision | escalated
      decidedAt?: string;
      notes?: string;
    }>>(),

    // Document output
    generatedDocumentId: int("generatedDocumentId"),
    documentUrl: varchar("documentUrl", { length: 500 }),

    // Error tracking
    lastError: text("lastError"),
    retryCount: int("retryCount").default(0),

    startedAt: timestamp("startedAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    pipelineIdx: index("pi_pipeline_idx").on(table.pipelineId),
    submissionIdx: index("pi_submission_idx").on(table.formSubmissionId),
    statusIdx: index("pi_status_idx").on(table.status),
  })
);

export type PipelineInstance = typeof pipelineInstances.$inferSelect;
export type InsertPipelineInstance = typeof pipelineInstances.$inferInsert;

// ============================================================================
// APPROVAL CHAINS — Configurable multi-level approval definitions
// ============================================================================

export const approvalChains = mysqlTable(
  "approval_chains",
  {
    id: int("id").autoincrement().primaryKey(),
    pipelineId: int("pipelineId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),

    // Chain definition
    steps: json("steps").$type<Array<{
      stepNumber: number;
      name: string;
      type: string; // single_approver | any_of_group | all_of_group | conditional
      approverRole?: string;
      approverUserIds?: number[];
      condition?: Record<string, unknown>; // conditional approval: when this step applies
      slaHours?: number;
      escalateToRole?: string;
      escalationHours?: number;
      allowDelegation: boolean;
      requireComments: boolean;
      autoApproveIfNoResponse: boolean;
      autoApproveAfterHours?: number;
    }>>(),

    // Who can override the chain
    overrideRole: varchar("overrideRole", { length: 100 }),
    overrideRequiresReason: boolean("overrideRequiresReason").default(true),

    status: mysqlEnum("status", ["draft", "active", "archived"]).default("draft").notNull(),
    createdBy: int("createdBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    pipelineIdx: index("ac_pipeline_idx").on(table.pipelineId),
    statusIdx: index("ac_status_idx").on(table.status),
  })
);

export type ApprovalChain = typeof approvalChains.$inferSelect;
export type InsertApprovalChain = typeof approvalChains.$inferInsert;

// ============================================================================
// FORM VALIDATION RULES — Custom validation beyond basic required/optional
// ============================================================================

export const formValidationRules = mysqlTable(
  "form_validation_rules",
  {
    id: int("id").autoincrement().primaryKey(),
    formId: int("formId").notNull(),
    formFieldId: int("formFieldId"),
    name: varchar("name", { length: 255 }).notNull(),
    type: mysqlEnum("type", [
      "field_level",     // validates a single field
      "cross_field",     // validates across multiple fields
      "custom_regex",    // regex pattern
      "api_lookup",      // external API validation
      "database_check",  // database lookup validation
      "conditional",     // conditional validation
    ]).notNull(),
    config: json("config").$type<{
      // field_level
      min?: number;
      max?: number;
      minLength?: number;
      maxLength?: number;
      pattern?: string;
      patternMessage?: string;

      // cross_field
      dependentFields?: string[];
      crossFieldRule?: string; // e.g. "endDate > startDate"

      // api_lookup
      apiUrl?: string;
      apiMethod?: string;
      apiHeaders?: Record<string, string>;
      apiErrorMessage?: string;

      // database_check
      tableName?: string;
      columnName?: string;
      checkType?: string; // unique | exists | not_exists
      scopeColumn?: string; // e.g., "formId" to check uniqueness within a form

      // conditional
      conditionField?: string;
      conditionOperator?: string; // eq | neq | gt | lt | contains | empty | not_empty
      conditionValue?: unknown;
      thenValidate?: Record<string, unknown>;
    }>(),
    errorMessage: text("errorMessage"),
    severity: mysqlEnum("severity", ["error", "warning", "info"]).default("error"),
    enabled: boolean("enabled").default(true),
    createdBy: int("createdBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    formIdx: index("fvr_form_idx").on(table.formId),
    fieldIdx: index("fvr_field_idx").on(table.formFieldId),
    typeIdx: index("fvr_type_idx").on(table.type),
  })
);

export type FormValidationRule = typeof formValidationRules.$inferSelect;
export type InsertFormValidationRule = typeof formValidationRules.$inferInsert;

// ============================================================================
// FORM VERSION HISTORY — Track form design changes
// ============================================================================

export const formVersions = mysqlTable(
  "form_versions",
  {
    id: int("id").autoincrement().primaryKey(),
    formId: int("formId").notNull(),
    versionNumber: int("versionNumber").notNull(),
    snapshot: json("snapshot").$type<{
      name: string;
      description?: string;
      fields: unknown[];
      settings?: Record<string, unknown>;
      templates?: Record<string, unknown>;
    }>().notNull(),
    changeDescription: text("changeDescription"),
    createdBy: int("createdBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    formIdx: index("fv_form_idx").on(table.formId),
    uniqueVersion: uniqueIndex("fv_unique_version").on(table.formId, table.versionNumber),
  })
);

export type FormVersion = typeof formVersions.$inferSelect;
export type InsertFormVersion = typeof formVersions.$inferInsert;
