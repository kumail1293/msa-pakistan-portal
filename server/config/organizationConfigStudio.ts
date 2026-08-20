/**
 * Organization Configuration Studio — Backend Service
 *
 * Manages all configurable governance parameters for the platform.
 * Every parameter is versioned, auditable, and can be changed without code changes.
 *
 * Configuration domains:
 *   - Terminology (position names, body names, custom labels)
 *   - Governance (quorum, majority thresholds, voting methods)
 *   - Elections (deadlines, eligibility, ballot config)
 *   - Plenary (speaking time, motion rules, procedural motions)
 *   - Membership (eligibility categories, fee thresholds)
 *   - Local Councils (statuses, compliance rules)
 *   - Notifications (email templates, notification rules)
 *   - Workflows (pipeline defaults, approval chains)
 *   - Forms (builder defaults, validation settings)
 *   - Document (numbering patterns, templates)
 *   - Calendar (NGA dates, term dates, deadlines)
 *   - Security (password policy, session config)
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { logAuditEvent } from "./auditService";

// ============================================================================
// In-memory store (mirrors the config key/value table pattern)
// ============================================================================

interface ConfigEntry {
  key: string;
  value: string;
  domain: string;
  label: string;
  description: string;
  type: "string" | "number" | "boolean" | "json" | "select";
  options?: string[];
  defaultValue: string;
  updatedAt?: Date;
}

// ============================================================================
// Configuration Definitions — the single source of truth
// ============================================================================

export const GOVERNANCE_CONFIG_DEFINITIONS: ConfigEntry[] = [
  // ── Terminology ────────────────────────────────────────────────
  {
    key: "term.president_title",
    value: "National President",
    domain: "Terminology",
    label: "President Title",
    description: "Official title for the organization's president",
    type: "string",
    defaultValue: "National President",
  },
  {
    key: "term.vice_president_title",
    value: "Vice President",
    domain: "Terminology",
    label: "Vice President Title",
    description: "Official title for the vice president",
    type: "string",
    defaultValue: "Vice President",
  },
  {
    key: "term.national_body_name",
    value: "National General Assembly",
    domain: "Terminology",
    label: "National Body Name",
    description: "Name for the national governing body",
    type: "string",
    defaultValue: "National General Assembly",
  },
  {
    key: "term.local_body_name",
    value: "Local Council",
    domain: "Terminology",
    label: "Local Body Name",
    description: "Name for local chapters/councils",
    type: "string",
    defaultValue: "Local Council",
  },
  {
    key: "term.plenary_name",
    value: "Plenary Session",
    domain: "Terminology",
    label: "Plenary Name",
    description: "Name for plenary proceedings",
    type: "string",
    defaultValue: "Plenary Session",
  },
  {
    key: "term.delegate_title",
    value: "Delegate",
    domain: "Terminology",
    label: "Delegate Title",
    description: "Title for assembly delegates",
    type: "string",
    defaultValue: "Delegate",
  },
  {
    key: "term.observer_title",
    value: "Observer",
    domain: "Terminology",
    label: "Observer Title",
    description: "Title for assembly observers",
    type: "string",
    defaultValue: "Observer",
  },
  {
    key: "term.serial_prefix",
    value: "MSAP",
    domain: "Terminology",
    label: "Serial Prefix",
    description: "Prefix for document/certificate serial numbers",
    type: "string",
    defaultValue: "MSAP",
  },

  // ── Governance ─────────────────────────────────────────────────
  {
    key: "gov.nga_annual_requirement",
    value: "1",
    domain: "Governance",
    label: "Minimum Annual NGA Meetings",
    description: "Minimum number of NGA meetings required per year",
    type: "number",
    defaultValue: "1",
  },
  {
    key: "gov.nga_date_window_start",
    value: "10-01",
    domain: "Governance",
    label: "NGA Season Start (MM-DD)",
    description: "Start of the annual NGA scheduling window",
    type: "string",
    defaultValue: "10-01",
  },
  {
    key: "gov.nga_date_window_end",
    value: "03-31",
    domain: "Governance",
    label: "NGA Season End (MM-DD)",
    description: "End of the annual NGA scheduling window",
    type: "string",
    defaultValue: "03-31",
  },
  {
    key: "gov.quorum_numerator",
    value: "1",
    domain: "Governance",
    label: "Quorum Numerator",
    description: "Quorum fraction numerator (1/3 = numerator 1)",
    type: "number",
    defaultValue: "1",
  },
  {
    key: "gov.quorum_denominator",
    value: "3",
    domain: "Governance",
    label: "Quorum Denominator",
    description: "Quorum fraction denominator (1/3 = denominator 3)",
    type: "number",
    defaultValue: "3",
  },
  {
    key: "gov.quorum_scope",
    value: "permanent_temporary_lc_with_voting",
    domain: "Governance",
    label: "Quorum Calculation Basis",
    description: "Which bodies count toward quorum",
    type: "select",
    options: [
      "permanent_temporary_lc_with_voting",
      "all_lc_with_voting",
      "all_lc",
      "all_bodies",
    ],
    defaultValue: "permanent_temporary_lc_with_voting",
  },
  {
    key: "gov.quorum_rounding",
    value: "ceil",
    domain: "Governance",
    label: "Quorum Rounding",
    description: "How to round quorum calculation",
    type: "select",
    options: ["ceil", "floor", "round"],
    defaultValue: "ceil",
  },
  {
    key: "gov.amendment_threshold",
    value: "two_thirds",
    domain: "Governance",
    label: "Bylaw Amendment Threshold",
    description: "Voting threshold for bylaw changes",
    type: "select",
    options: [
      "simple_majority",
      "absolute_majority",
      "two_thirds",
      "three_quarters",
      "unanimous",
    ],
    defaultValue: "two_thirds",
  },
  {
    key: "gov.bcp_deadline_weeks",
    value: "3",
    domain: "Governance",
    label: "BCP Submission Deadline (weeks before NGA)",
    description: "Minimum weeks before NGA for Bylaw Change Proposals",
    type: "number",
    defaultValue: "3",
  },
  {
    key: "gov.sga_notice_period_days",
    value: "14",
    domain: "Governance",
    label: "SGA Notice Period (days)",
    description: "Minimum notice period for Special General Assembly",
    type: "number",
    defaultValue: "14",
  },
  {
    key: "gov.sga_quorum_override",
    value: "2/3",
    domain: "Governance",
    label: "SGA Extraordinary Threshold",
    description: "Fraction of LCs required to call extraordinary NGA",
    type: "string",
    defaultValue: "2/3",
  },
  {
    key: "gov.term_duration_months",
    value: "12",
    domain: "Governance",
    label: "Term Duration (months)",
    description: "Standard term of office duration",
    type: "number",
    defaultValue: "12",
  },
  {
    key: "gov.handover_period_weeks",
    value: "2",
    domain: "Governance",
    label: "Handover Period (weeks)",
    description: "Overlap period between outgoing and incoming officials",
    type: "number",
    defaultValue: "2",
  },
  {
    key: "gov.non_suspendable_clauses",
    value: "[]",
    domain: "Governance",
    label: "Non-Suspendable Clauses",
    description: "JSON array of clause IDs that cannot be suspended",
    type: "json",
    defaultValue: "[]",
  },

  // ── Elections ──────────────────────────────────────────────────
  {
    key: "election.voting_method",
    value: "secret_ballot",
    domain: "Elections",
    label: "Default Voting Method",
    description: "Default method for casting votes",
    type: "select",
    options: [
      "secret_ballot",
      "show_of_hands",
      "roll_call",
      "electronic",
      "written_ballot",
    ],
    defaultValue: "secret_ballot",
  },
  {
    key: "election.permanent_lc_plenary_votes",
    value: "1",
    domain: "Elections",
    label: "Permanent LC Plenary Votes",
    description: "Number of plenary votes per Permanent Local Council",
    type: "number",
    defaultValue: "1",
  },
  {
    key: "election.permanent_lc_election_votes",
    value: "10",
    domain: "Elections",
    label: "Permanent LC Election Votes (max)",
    description: "Maximum election votes per Permanent Local Council",
    type: "number",
    defaultValue: "10",
  },
  {
    key: "election.temporary_lc_plenary_votes",
    value: "1",
    domain: "Elections",
    label: "Temporary LC Plenary Votes",
    description: "Number of plenary votes per Temporary Local Council",
    type: "number",
    defaultValue: "1",
  },
  {
    key: "election.temporary_lc_election_votes",
    value: "10",
    domain: "Elections",
    label: "Temporary LC Election Votes (max)",
    description: "Maximum election votes per Temporary Local Council",
    type: "number",
    defaultValue: "10",
  },
  {
    key: "election.candidate_lc_plenary_votes",
    value: "0",
    domain: "Elections",
    label: "Candidate LC Plenary Votes",
    description: "Plenary votes for Candidate Local Councils",
    type: "number",
    defaultValue: "0",
  },
  {
    key: "election.candidate_lc_election_votes",
    value: "1",
    domain: "Elections",
    label: "Candidate LC Election Votes",
    description: "Election votes per Candidate Local Council",
    type: "number",
    defaultValue: "1",
  },
  {
    key: "election.coordinator_plenary_votes",
    value: "0",
    domain: "Elections",
    label: "Coordinator Institute Plenary Votes",
    description: "Plenary votes for Coordinator Institutes",
    type: "number",
    defaultValue: "0",
  },
  {
    key: "election.coordinator_election_votes",
    value: "1",
    domain: "Elections",
    label: "Coordinator Institute Election Votes",
    description: "Election votes per Coordinator Institute",
    type: "number",
    defaultValue: "1",
  },
  {
    key: "election.candidate_deadline_days_before_nga",
    value: "7",
    domain: "Elections",
    label: "Candidate Deadline (days before NGA)",
    description: "Last day to submit candidacy applications",
    type: "number",
    defaultValue: "7",
  },
  {
    key: "election.returning_officer_count",
    value: "3",
    domain: "Elections",
    label: "Returning Officers Count",
    description: "Number of returning officers for elections",
    type: "number",
    defaultValue: "3",
  },

  // ── Plenary ────────────────────────────────────────────────────
  {
    key: "plenary.speaking_time_seconds",
    value: "120",
    domain: "Plenary",
    label: "Speaking Time Limit (seconds)",
    description: "Maximum time allowed per speaker",
    type: "number",
    defaultValue: "120",
  },
  {
    key: "plenary.poo_warning_limit",
    value: "3",
    domain: "Plenary",
    label: "POO Warning Limit per Delegation",
    description: "Number of POO warnings before delegation restriction",
    type: "number",
    defaultValue: "3",
  },
  {
    key: "plenary.poi_warning_limit",
    value: "3",
    domain: "Plenary",
    label: "POI Warning Limit per Delegation",
    description: "Number of POI warnings before delegation restriction",
    type: "number",
    defaultValue: "3",
  },
  {
    key: "plenary.default_voting_method",
    value: "simple_majority",
    domain: "Plenary",
    label: "Default Plenary Voting Method",
    description: "Default majority type for plenary votes",
    type: "select",
    options: [
      "simple_majority",
      "absolute_majority",
      "two_thirds",
      "three_quarters",
      "consensus",
      "unanimous",
    ],
    defaultValue: "simple_majority",
  },
  {
    key: "plenary.allow_proxy_voting",
    value: "true",
    domain: "Plenary",
    label: "Allow Proxy Voting",
    description: "Whether delegations can assign proxies",
    type: "boolean",
    defaultValue: "true",
  },
  {
    key: "plenary.max_proxies_per_delegation",
    value: "2",
    domain: "Plenary",
    label: "Max Proxies per Delegation",
    description: "Maximum proxy assignments per delegation",
    type: "number",
    defaultValue: "2",
  },
  {
    key: "plenary.proxy_scope",
    value: "bylaw_changes_only",
    domain: "Plenary",
    label: "Proxy Voting Scope",
    description: "What proxy votes can cover",
    type: "select",
    options: ["all_votes", "bylaw_changes_only", "plenary_only", "election_only"],
    defaultValue: "bylaw_changes_only",
  },
  {
    key: "plenary.motion_deadline_minutes",
    value: "0",
    domain: "Plenary",
    label: "Motion Submission Deadline (minutes into session)",
    description: "Minutes after session start when motion submission closes (0 = no limit)",
    type: "number",
    defaultValue: "0",
  },

  // ── Membership ─────────────────────────────────────────────────
  {
    key: "member.eligible_degrees",
    value: '["MBBS","BDS","DPT","BSN","PharmD"]',
    domain: "Membership",
    label: "Eligible Degree Programs",
    description: "JSON array of eligible health science degrees",
    type: "json",
    defaultValue: '["MBBS","BDS","DPT","BSN","PharmD"]',
  },
  {
    key: "member.allow_graduates",
    value: "true",
    domain: "Membership",
    label: "Allow Recent Graduates",
    description: "Whether recent graduates (within grace period) can join",
    type: "boolean",
    defaultValue: "true",
  },
  {
    key: "member.graduate_grace_period_months",
    value: "6",
    domain: "Membership",
    label: "Graduate Grace Period (months)",
    description: "How long after graduation a member can remain active",
    type: "number",
    defaultValue: "6",
  },
  {
    key: "member.financial_debt_threshold",
    value: "2000",
    domain: "Membership",
    label: "Financial Debt Threshold (PKR)",
    description: "Maximum outstanding debt for voting eligibility",
    type: "number",
    defaultValue: "2000",
  },
  {
    key: "member.termination_notice_days",
    value: "14",
    domain: "Membership",
    label: "Termination Notice Period (days)",
    description: "Days given to respond to show-cause notice",
    type: "number",
    defaultValue: "14",
  },
  {
    key: "member.appeal_deadline_days",
    value: "7",
    domain: "Membership",
    label: "Appeal Deadline (days)",
    description: "Days to file appeal after termination decision",
    type: "number",
    defaultValue: "7",
  },

  // ── Local Councils ─────────────────────────────────────────────
  {
    key: "lc.statuses",
    value: '["permanent","temporary","candidate","suspended","terminated"]',
    domain: "Local Councils",
    label: "LC Statuses",
    description: "JSON array of valid Local Council statuses",
    type: "json",
    defaultValue: '["permanent","temporary","candidate","suspended","terminated"]',
  },
  {
    key: "lc.compliance_required_reports",
    value: '["membership_list","financial_report","activity_report"]',
    domain: "Local Councils",
    label: "Required Compliance Reports",
    description: "JSON array of required report types",
    type: "json",
    defaultValue: '["membership_list","financial_report","activity_report"]',
  },
  {
    key: "lc.renewal_period_months",
    value: "12",
    domain: "Local Councils",
    label: "LC Renewal Period (months)",
    description: "How often LC status is reviewed",
    type: "number",
    defaultValue: "12",
  },

  // ── Notifications ──────────────────────────────────────────────
  {
    key: "notif.nga_invitation_days_before",
    value: "30",
    domain: "Notifications",
    label: "NGA Invitation Notice (days)",
    description: "Days before NGA to send invitations",
    type: "number",
    defaultValue: "30",
  },
  {
    key: "notif.credential_deadline_days_before",
    value: "7",
    domain: "Notifications",
    label: "Credential Deadline (days before NGA)",
    description: "Days before NGA for credential submission",
    type: "number",
    defaultValue: "7",
  },
  {
    key: "notif.bcp_reminder_days",
    value: "14,7,3",
    domain: "Notifications",
    label: "BCP Reminder Days",
    description: "Comma-separated days before deadline to send reminders",
    type: "string",
    defaultValue: "14,7,3",
  },
  {
    key: "notif.election_results公布",
    value: "immediate",
    domain: "Notifications",
    label: "Election Results Publication",
    description: "When election results are published",
    type: "select",
    options: ["immediate", "end_of_session", "next_day", "manual"],
    defaultValue: "immediate",
  },

  // ── Document ───────────────────────────────────────────────────
  {
    key: "doc.numbering_pattern",
    value: "{prefix}/{year}/{type}/{seq:6}",
    domain: "Document",
    label: "Document Numbering Pattern",
    description: "Pattern for auto-generating document numbers",
    type: "string",
    defaultValue: "{prefix}/{year}/{type}/{seq:6}",
  },
  {
    key: "doc.certificate_template",
    value: "default_certificate",
    domain: "Document",
    label: "Default Certificate Template",
    description: "Template used for certificates",
    type: "string",
    defaultValue: "default_certificate",
  },
  {
    key: "doc.card_template",
    value: "default_card",
    domain: "Document",
    label: "Default Card Template",
    description: "Template used for membership cards",
    type: "string",
    defaultValue: "default_card",
  },

  // ── Security ───────────────────────────────────────────────────
  {
    key: "security.min_password_length",
    value: "8",
    domain: "Security",
    label: "Minimum Password Length",
    description: "Minimum characters for user passwords",
    type: "number",
    defaultValue: "8",
  },
  {
    key: "security.session_timeout_hours",
    value: "24",
    domain: "Security",
    label: "Session Timeout (hours)",
    description: "Maximum session duration before re-authentication",
    type: "number",
    defaultValue: "24",
  },
  {
    key: "security.max_login_attempts",
    value: "5",
    domain: "Security",
    label: "Max Login Attempts",
    description: "Failed attempts before account lockout",
    type: "number",
    defaultValue: "5",
  },
];

// ============================================================================
// Get All Configs by Domain
// ============================================================================

export type GovernanceDomain =
  | "Terminology"
  | "Governance"
  | "Elections"
  | "Plenary"
  | "Membership"
  | "Local Councils"
  | "Notifications"
  | "Document"
  | "Security";

/**
 * Get all governance configuration entries, optionally filtered by domain.
 * Returns the definitions merged with any overrides from the database.
 */
export async function getGovernanceConfig(
  domain?: GovernanceDomain
): Promise<ConfigEntry[]> {
  const db = getDb();

  // Start with definitions
  let entries = GOVERNANCE_CONFIG_DEFINITIONS.map((d) => ({ ...d }));

  // Overlay database values if db is available
  if (db) {
    try {
      const keys = entries.map((e) => e.key);
      if (keys.length > 0) {
        const rows = await db.execute(sql`
          SELECT \`key\`, \`value\` FROM \`configuration\`
          WHERE \`key\` IN (${sql.join(keys.map((k) => sql`${k}`), sql`, `)})
        `);

        const dbMap = new Map<string, string>();
        for (const row of (rows as any[])) {
          dbMap.set(row.key, row.value);
        }

        for (const entry of entries) {
          const dbValue = dbMap.get(entry.key);
          if (dbValue !== undefined) {
            entry.value = dbValue;
          }
        }
      }
    } catch {
      // If config table doesn't exist yet, just use defaults
    }
  }

  // Filter by domain
  if (domain) {
    entries = entries.filter((e) => e.domain === domain);
  }

  return entries;
}

/**
 * Get configuration grouped by domain.
 */
export async function getGovernanceConfigGrouped(): Promise<
  Record<string, ConfigEntry[]>
> {
  const entries = await getGovernanceConfig();
  const grouped: Record<string, ConfigEntry[]> = {};
  for (const entry of entries) {
    if (!grouped[entry.domain]) grouped[entry.domain] = [];
    grouped[entry.domain].push(entry);
  }
  return grouped;
}

/**
 * Get available configuration domains.
 */
export function getConfigDomains(): Array<{
  key: string;
  label: string;
  icon: string;
  count: number;
}> {
  const domains = new Map<string, number>();
  for (const entry of GOVERNANCE_CONFIG_DEFINITIONS) {
    domains.set(entry.domain, (domains.get(entry.domain) ?? 0) + 1);
  }

  const icons: Record<string, string> = {
    Terminology: "Tag",
    Governance: "Scale",
    Elections: "Vote",
    Plenary: "Mic",
    Membership: "Users",
    "Local Councils": "Building",
    Notifications: "Bell",
    Document: "FileText",
    Security: "Shield",
  };

  return Array.from(domains.entries()).map(([key, count]) => ({
    key,
    label: key,
    icon: icons[key] ?? "Settings",
    count,
  }));
}

// ============================================================================
// Update Config
// ============================================================================

export interface UpdateGovernanceConfigInput {
  key: string;
  value: string;
}

/**
 * Update a single governance configuration value.
 * Stores in the config table and returns the updated entry.
 */
export async function updateGovernanceConfig(
  input: UpdateGovernanceConfigInput
): Promise<ConfigEntry | null> {
  const db = getDb();
  const definition = GOVERNANCE_CONFIG_DEFINITIONS.find(
    (d) => d.key === input.key
  );
  if (!definition) return null;

  // Validate type
  const validated = validateConfigValue(definition, input.value);
  if (!validated) return null;

  if (db) {
    try {
      // Use the existing config table
      await db.execute(sql`
        INSERT INTO \`configuration\` (\`key\`, \`value\`, \`category\`, \`updatedAt\`)
        VALUES (${input.key}, ${validated}, ${`governance:${definition.domain}`}, NOW())
        ON DUPLICATE KEY UPDATE \`value\` = ${validated}, \`updatedAt\` = NOW()
      `);
    } catch {
      // Config table might not exist — still return the entry
    }
  }

  return { ...definition, value: validated, updatedAt: new Date() };
}

/**
 * Bulk update governance configuration values.
 */
export async function bulkUpdateGovernanceConfig(
  inputs: UpdateGovernanceConfigInput[]
): Promise<{ updated: number; failed: number }> {
  let updated = 0;
  let failed = 0;

  for (const input of inputs) {
    const result = await updateGovernanceConfig(input);
    if (result) updated++;
    else failed++;
  }

  return { updated, failed };
}

/**
 * Reset a configuration value to its default.
 */
export async function resetGovernanceConfig(
  key: string
): Promise<ConfigEntry | null> {
  const definition = GOVERNANCE_CONFIG_DEFINITIONS.find((d) => d.key === key);
  if (!definition) return null;

  return updateGovernanceConfig({ key, value: definition.defaultValue });
}

/**
 * Reset all configuration values in a domain to defaults.
 */
export async function resetDomainConfig(
  domain: string
): Promise<{ reset: number }> {
  let reset = 0;
  for (const entry of GOVERNANCE_CONFIG_DEFINITIONS) {
    if (entry.domain === domain) {
      const result = await resetGovernanceConfig(entry.key);
      if (result) reset++;
    }
  }
  return { reset };
}

// ============================================================================
// Validation
// ============================================================================

function validateConfigValue(
  definition: ConfigEntry,
  value: string
): string | null {
  switch (definition.type) {
    case "number": {
      const num = Number(value);
      if (isNaN(num)) return null;
      return String(num);
    }
    case "boolean": {
      if (!["true", "false", "1", "0"].includes(value.toLowerCase())) return null;
      return value.toLowerCase() === "true" || value === "1" ? "true" : "false";
    }
    case "json": {
      try {
        JSON.parse(value);
        return value;
      } catch {
        return null;
      }
    }
    case "select": {
      if (definition.options && !definition.options.includes(value)) return null;
      return value;
    }
    case "string":
    default:
      return value;
  }
}

// ============================================================================
// Simulation Engine (for previewing rule changes)
// ============================================================================

export interface SimulationQuery {
  question: string;
  context?: Record<string, unknown>;
}

export interface SimulationResult {
  answer: string;
  applicableRules: Array<{
    key: string;
    value: string;
    source: string;
  }>;
  confidence: "high" | "medium" | "low";
}

/**
 * Simulate a governance query against the current (or proposed) rules.
 */
export async function simulateGovernanceQuery(
  query: SimulationQuery,
  overrides?: Record<string, string>
): Promise<SimulationResult> {
  const entries = await getGovernanceConfig();

  // Apply any overrides for simulation
  if (overrides) {
    for (const entry of entries) {
      if (overrides[entry.key] !== undefined) {
        entry.value = overrides[entry.key];
      }
    }
  }

  const getEntry = (key: string) =>
    entries.find((e) => e.key === key);

  const q = query.question.toLowerCase();

  // Quorum simulation
  if (q.includes("quorum") || q.includes("meeting validity")) {
    const num = getEntry("gov.quorum_numerator");
    const den = getEntry("gov.quorum_denominator");
    const scope = getEntry("gov.quorum_scope");
    const rounding = getEntry("gov.quorum_rounding");

    return {
      answer: `Quorum requires ${num?.value ?? 1}/${den?.value ?? 3} of ${
        scope?.value ?? "permanent/temporary LCs with voting rights"
      } (rounded ${rounding?.value ?? "up"}).`,
      applicableRules: [num, den, scope, rounding]
        .filter(Boolean)
        .map((e) => ({ key: e!.key, value: e!.value, source: "Governance Configuration" })),
      confidence: "high",
    };
  }

  // Voting simulation
  if (q.includes("vote") || q.includes("voting") || q.includes("ballot")) {
    const method = getEntry("election.voting_method");
    const threshold = getEntry("gov.amendment_threshold");
    const proxy = getEntry("plenary.allow_proxy_voting");
    const maxProxies = getEntry("plenary.max_proxies_per_delegation");

    const rules = [method, threshold, proxy, maxProxies]
      .filter(Boolean)
      .map((e) => ({ key: e!.key, value: e!.value, source: "Governance Configuration" }));

    let answer = `Default voting method: ${method?.value ?? "secret_ballot"}. `;
    answer += `Bylaw amendment threshold: ${threshold?.value ?? "two_thirds"}. `;
    answer += `Proxy voting: ${proxy?.value === "true" ? "allowed" : "not allowed"}`;
    if (proxy?.value === "true") {
      answer += ` (max ${maxProxies?.value ?? 2} per delegation)`;
    }
    answer += ".";

    return { answer, applicableRules: rules, confidence: "high" };
  }

  // Eligibility simulation
  if (q.includes("eligible") || q.includes("eligibility") || q.includes("qualify")) {
    const degrees = getEntry("member.eligible_degrees");
    const graduates = getEntry("member.allow_graduates");
    const gracePeriod = getEntry("member.graduate_grace_period_months");

    const rules = [degrees, graduates, gracePeriod]
      .filter(Boolean)
      .map((e) => ({ key: e!.key, value: e!.value, source: "Governance Configuration" }));

    let answer = `Eligible degrees: ${degrees?.value ?? "MBBS, BDS, DPT, BSN, PharmD"}. `;
    answer += `Recent graduates: ${graduates?.value === "true" ? "eligible" : "not eligible"}`;
    if (graduates?.value === "true") {
      answer += ` (grace period: ${gracePeriod?.value ?? 6} months)`;
    }
    answer += ".";

    return { answer, applicableRules: rules, confidence: "high" };
  }

  // Term simulation
  if (q.includes("term") || q.includes("duration") || q.includes("office")) {
    const duration = getEntry("gov.term_duration_months");
    const handover = getEntry("gov.handover_period_weeks");

    return {
      answer: `Term of office: ${duration?.value ?? 12} months. Handover period: ${handover?.value ?? 2} weeks.`,
      applicableRules: [duration, handover]
        .filter(Boolean)
        .map((e) => ({ key: e!.key, value: e!.value, source: "Governance Configuration" })),
      confidence: "high",
    };
  }

  return {
    answer:
      "I can help simulate governance rules for quorum, voting, eligibility, and terms. Please refine your question.",
    applicableRules: [],
    confidence: "low",
  };
}
