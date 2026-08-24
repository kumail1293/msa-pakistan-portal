/**
 * Term Service — Centralized Term & Governance Version Resolution
 *
 * Provides a single source of truth for:
 *   - Current term (name, start date, end date)
 *   - Current governance version
 *   - Historical term resolution (what term was active at a given date)
 *
 * All engines should use this service instead of hardcoding "2025-26" or dates.
 *
 * Usage:
 *   import { getCurrentTerm, getCurrentGovernanceVersion, getTermAtDate } from "./termService";
 *
 *   const term = await getCurrentTerm();
 *   // { name: "2025-26", version: "2025-26", startDate: Date, endDate: Date }
 *
 *   const version = await getCurrentGovernanceVersion();
 *   // "2025-26"
 */

import { getConfig } from "./configService";
import { childLogger } from "../_core/logger";

const log = childLogger("TermService");

// ============================================================================
// Types
// ============================================================================

export interface TermInfo {
  /** Display name, e.g. "2025-26" */
  name: string;
  /** Governance version identifier, e.g. "2025-26" */
  version: string;
  /** Term start date */
  startDate: Date;
  /** Term end date */
  endDate: Date;
  /** Whether the current date falls within this term */
  isActive: boolean;
}

// ============================================================================
// Core Resolution
// ============================================================================

/**
 * Get the current term information from configuration.
 * Resolves all term-related config keys in one call.
 */
export async function getCurrentTerm(): Promise<TermInfo> {
  const [name, version, startStr, endStr] = await Promise.all([
    getConfig("gov.currentTerm", "2025-26"),
    getConfig("gov.currentVersion", "2025-26"),
    getConfig("gov.termStartDate", "2025-10-01"),
    getConfig("gov.termEndDate", "2026-09-30"),
  ]);

  const startDate = parseDate(startStr);
  const endDate = parseDate(endStr);
  const now = new Date();

  return {
    name,
    version,
    startDate,
    endDate,
    isActive: now >= startDate && now <= endDate,
  };
}

/**
 * Get just the current governance version string.
 * This is the most commonly needed value — replaces all "2025-26" fallbacks.
 */
export async function getCurrentGovernanceVersion(): Promise<string> {
  return getConfig("gov.currentVersion", "2025-26");
}

/**
 * Get the current term display name (e.g., "2025-26").
 * Used for card rendering, document headers, UI display.
 */
export async function getCurrentTermName(): Promise<string> {
  return getConfig("gov.currentTerm", "2025-26");
}

/**
 * Resolve which term was active at a given historical date.
 * Uses the configured term start/end dates.
 * For multi-year historical resolution, this would need a terms table,
 * but for the current single-term model it returns the configured term
 * if the date falls within its range, or null otherwise.
 */
export async function getTermAtDate(date: Date): Promise<TermInfo | null> {
  const term = await getCurrentTerm();

  if (date >= term.startDate && date <= term.endDate) {
    return term;
  }

  // Date is outside the current term — return null (historical terms
  // would need a terms table for proper resolution)
  log.debug({ date: date.toISOString() }, "Date falls outside current term");
  return null;
}

/**
 * Get the term duration in months from configuration.
 */
export async function getTermDurationMonths(): Promise<number> {
  const raw = await getConfig("gov.termDurationMonths", "12");
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
}

/**
 * Get the handover period in weeks from configuration.
 */
export async function getHandoverPeriodWeeks(): Promise<number> {
  const raw = await getConfig("gov.handoverPeriodWeeks", "2");
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 2;
}

/**
 * Check if a date is within the current term.
 */
export async function isDateInCurrentTerm(date: Date): Promise<boolean> {
  const term = await getCurrentTerm();
  return date >= term.startDate && date <= term.endDate;
}

/**
 * Get the term display string for documents and cards.
 * Returns e.g., "TERM 2025–26"
 */
export async function getTermDisplayString(): Promise<string> {
  const name = await getCurrentTermName();
  // Replace hyphen with en-dash for display: "2025-26" → "2025–26"
  return `TERM ${name.replace("-", "–")}`;
}

// ============================================================================
// Helpers
// ============================================================================

function parseDate(dateStr: string): Date {
  // Handle YYYY-MM-DD format
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    log.warn({ dateStr }, "Invalid date string, using fallback");
    return new Date("2025-10-01");
  }
  return d;
}
