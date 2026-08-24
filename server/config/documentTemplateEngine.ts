/**
 * Document Template Engine
 *
 * Config-driven document generation for all MSAP organizational documents:
 * - Membership Cards
 * - Membership Certificates
 * - Appointment Letters
 * - NEF/NRF Reports
 * - Activity Reports
 * - Credential Documents
 * - Meeting Minutes
 *
 * Templates are resolved from config, not hardcoded.
 * All fields are populated from workflow data, not source code.
 *
 * Usage:
 *   import { generateDocument } from "./documentTemplateEngine";
 *
 *   const doc = await generateDocument({
 *     templateKey: "membership.certificate",
 *     data: { memberName: "Ahmed Khan", lcName: "KEMU LC", ... },
 *   });
 */

import { getConfig, getConfigNumber } from "./configService";
import { getCurrentGovernanceVersion, getTermDisplayString } from "./termService";

// ============================================================================
// Types
// ============================================================================

export type DocumentTemplateKey =
  | "membership.card"
  | "membership.certificate"
  | "membership.letter"
  | "appointment.letter"
  | "appointment.certificate"
  | "nef.report"
  | "nrf.report"
  | "activity.certificate"
  | "activity.report"
  | "credential.document"
  | "meeting.minutes"
  | "election.certificate"
  | "proxy.form";

export interface DocumentTemplate {
  key: DocumentTemplateKey;
  name: string;
  description: string;
  category: "membership" | "appointment" | "activity" | "finance" | "governance" | "credential" | "election";
  fields: string[];
  format: "pdf" | "html" | "docx";
}

export interface GenerateDocumentInput {
  templateKey: DocumentTemplateKey;
  data: Record<string, unknown>;
  format?: "pdf" | "html" | "docx";
  watermark?: string;
  generatedBy?: number;
}

export interface GeneratedDocument {
  templateKey: DocumentTemplateKey;
  format: string;
  content: string | Buffer;
  filename: string;
  metadata: {
    generatedAt: Date;
    governanceVersion: string;
    termDisplay: string;
    watermark?: string;
  };
}

// ============================================================================
// Template Registry
// ============================================================================

const TEMPLATES: Record<DocumentTemplateKey, DocumentTemplate> = {
  "membership.card": {
    key: "membership.card",
    name: "Membership Card",
    description: "Official MSA-Pakistan membership card (front + back)",
    category: "membership",
    fields: [
      "memberName", "membershipId", "localCouncil", "discipline",
      "yearOfStudy", "validFrom", "validUntil", "photoUrl",
      "qrCode", "termDisplay",
    ],
    format: "pdf",
  },
  "membership.certificate": {
    key: "membership.certificate",
    name: "Membership Certificate",
    description: "Formal membership certificate",
    category: "membership",
    fields: [
      "memberName", "membershipId", "localCouncil", "institution",
      "enrollmentDate", "certificateNumber", "termDisplay", "signatories",
    ],
    format: "pdf",
  },
  "membership.letter": {
    key: "membership.letter",
    name: "Membership Welcome Letter",
    description: "Welcome letter for new members",
    category: "membership",
    fields: ["memberName", "localCouncil", "enrollmentDate"],
    format: "pdf",
  },
  "appointment.letter": {
    key: "appointment.letter",
    name: "Appointment Letter",
    description: "Official appointment letter for elected/appointed positions",
    category: "appointment",
    fields: [
      "officerName", "position", "appointmentDate", "termStart", "termEnd",
      "scope", "reportingTo", "governanceVersion", "termDisplay",
    ],
    format: "pdf",
  },
  "appointment.certificate": {
    key: "appointment.certificate",
    name: "Appointment Certificate",
    description: "Certificate of appointment for framing",
    category: "appointment",
    fields: [
      "officerName", "position", "scope", "appointmentDate",
      "termDisplay", "signatories",
    ],
    format: "pdf",
  },
  "nef.report": {
    key: "nef.report",
    name: "NEF Activity Report",
    description: "National Executive Finance activity report",
    category: "finance",
    fields: [
      "activityName", "coordinator", "localCouncil", "budget",
      "expenditure", "status", "dates", "outcomes",
    ],
    format: "pdf",
  },
  "nrf.report": {
    key: "nrf.report",
    name: "NRF Report",
    description: "National Reserve Fund report",
    category: "finance",
    fields: [
      "reportPeriod", "totalBudget", "allocated", "expended",
      "remaining", "lineItems",
    ],
    format: "pdf",
  },
  "activity.certificate": {
    key: "activity.certificate",
    name: "Activity Participation Certificate",
    description: "Certificate of participation in an activity",
    category: "activity",
    fields: [
      "participantName", "activityName", "activityDate",
      "localCouncil", "duration", "certificateNumber",
    ],
    format: "pdf",
  },
  "activity.report": {
    key: "activity.report",
    name: "Activity Report",
    description: "Post-activity report with outcomes",
    category: "activity",
    fields: [
      "activityName", "coordinator", "localCouncil", "date",
      "participants", "outcomes", "budget", "photos",
    ],
    format: "pdf",
  },
  "credential.document": {
    key: "credential.document",
    name: "Credential Document",
    description: "Official credential document for NGA delegation",
    category: "credential",
    fields: [
      "delegationName", "organizationType", "delegateCount",
      "headOfDelegation", "meetingTitle", "credentialNumber",
    ],
    format: "pdf",
  },
  "meeting.minutes": {
    key: "meeting.minutes",
    name: "Meeting Minutes",
    description: "Official meeting minutes template",
    category: "governance",
    fields: [
      "meetingTitle", "meetingDate", "attendees", "agenda",
      "discussions", "resolutions", "nextMeeting",
    ],
    format: "pdf",
  },
  "election.certificate": {
    key: "election.certificate",
    name: "Election Result Certificate",
    description: "Certification of election results",
    category: "election",
    fields: [
      "position", "winner", "voteCount", "totalVotes",
      "electionDate", "termDisplay", "signatories",
    ],
    format: "pdf",
  },
  "proxy.form": {
    key: "proxy.form",
    name: "Proxy Voting Form",
    description: "Form for proxy voting authorization",
    category: "governance",
    fields: [
      "proxyGrantor", "proxyGrantee", "meetingTitle",
      "scope", "duration", "signature",
    ],
    format: "pdf",
  },
};

// ============================================================================
// Template Resolution
// ============================================================================

/**
 * Get a document template by key.
 */
export function getTemplate(
  key: DocumentTemplateKey
): DocumentTemplate | null {
  return TEMPLATES[key] ?? null;
}

/**
 * List all templates, optionally filtered by category.
 */
export function listTemplates(
  category?: string
): DocumentTemplate[] {
  const all = Object.values(TEMPLATES);
  if (!category) return all;
  return all.filter((t) => t.category === category);
}

/**
 * Get all template keys for a category.
 */
export function getTemplatesByCategory(
  category: string
): DocumentTemplateKey[] {
  return Object.values(TEMPLATES)
    .filter((t) => t.category === category)
    .map((t) => t.key);
}

// ============================================================================
// Document Generation
// ============================================================================

/**
 * Generate a document from a template.
 * Resolves all config-driven fields (term, governance version, etc.).
 */
export async function generateDocument(
  input: GenerateDocumentInput
): Promise<GeneratedDocument | null> {
  const template = TEMPLATES[input.templateKey];
  if (!template) {
    console.error(`[DocTemplate] Unknown template: ${input.templateKey}`);
    return null;
  }

  // Validate required fields are present
  const missingFields = template.fields.filter(
    (f) => input.data[f] === undefined || input.data[f] === null
  );

  if (missingFields.length > 0) {
    console.warn(
      `[DocTemplate] Missing fields for ${input.templateKey}: ${missingFields.join(", ")}`
    );
    // Continue with defaults — don't block generation
  }

  // Resolve config-driven metadata
  const governanceVersion = await getCurrentGovernanceVersion();
  const termDisplay = await getTermDisplayString();
  const watermark = input.watermark ?? (await getConfig("brand.watermark", ""));

  // Merge config-driven data into the input data
  const enrichedData: Record<string, unknown> = {
    ...input.data,
    termDisplay: input.data.termDisplay ?? termDisplay,
    governanceVersion,
  };

  const format = input.format ?? template.format;

  // Generate content based on template type
  let content: string;
  let filename: string;

  if (format === "html") {
    content = generateHTML(template, enrichedData);
    filename = `${input.templateKey.replace(/\./g, "_")}_${Date.now()}.html`;
  } else {
    // For PDF/DOCX, return a structured JSON representation
    // In production, this would use PDFKit or docx library
    content = JSON.stringify({
      template: template.key,
      data: enrichedData,
      generatedAt: new Date().toISOString(),
    });
    filename = `${input.templateKey.replace(/\./g, "_")}_${Date.now()}.json`;
  }

  return {
    templateKey: input.templateKey,
    format,
    content,
    filename,
    metadata: {
      generatedAt: new Date(),
      governanceVersion,
      termDisplay,
      watermark,
    },
  };
}

// ============================================================================
// HTML Generation
// ============================================================================

/**
 * Generate HTML content from a template and data.
 */
function generateHTML(
  template: DocumentTemplate,
  data: Record<string, unknown>
): string {
  const rows = template.fields
    .map((field) => {
      const value = data[field];
      const displayValue =
        value === undefined || value === null
          ? "<em style='color:#999'>—</em>"
          : String(value);
      return `      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:500;color:#1B355E;text-transform:capitalize">${field.replace(/([A-Z])/g, " $1")}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${displayValue}</td>
      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${template.name}</title>
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; margin: 40px; color: #1a1a1a; }
    h1 { color: #1B355E; border-bottom: 3px solid #D4AF37; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    .meta { color: #666; font-size: 12px; margin-top: 24px; }
  </style>
</head>
<body>
  <h1>${template.name}</h1>
  <p style="color:#666">${template.description}</p>
  <table>${rows}
  </table>
  <div class="meta">
    <p>Category: ${template.category} | Format: ${template.format}</p>
    <p>Generated: ${new Date().toISOString()}</p>
    <p>Governance Version: ${data.governanceVersion ?? "—"}</p>
    <p>Term: ${data.termDisplay ?? "—"}</p>
  </div>
</body>
</html>`;
}

// ============================================================================
// Template Validation
// ============================================================================

/**
 * Validate that all required data fields are present for a template.
 */
export function validateTemplateData(
  templateKey: DocumentTemplateKey,
  data: Record<string, unknown>
): { valid: boolean; missing: string[]; extra: string[] } {
  const template = TEMPLATES[templateKey];
  if (!template) {
    return { valid: false, missing: [templateKey], extra: [] };
  }

  const templateFields = new Set(template.fields);
  const dataFields = new Set(Object.keys(data));

  const missing = template.fields.filter((f) => !dataFields.has(f));
  const extra = Object.keys(data).filter((f) => !templateFields.has(f));

  return {
    valid: missing.length === 0,
    missing,
    extra,
  };
}
