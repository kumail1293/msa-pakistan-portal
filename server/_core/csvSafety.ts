/**
 * CSV Injection Prevention
 *
 * When CSV data is exported and opened in Excel/LibreOffice, values
 * starting with =, +, -, @, or tab can be interpreted as formulas.
 * This can lead to CSV injection attacks where exported data triggers
 * commands when opened locally.
 *
 * Reference: https://www.owasp.org/index.php/CSV_Injection
 */

/**
 * Sanitize a value for safe CSV export.
 * Prefixes dangerous characters with a single quote to prevent formula execution.
 */
export function sanitizeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  const raw = String(value);
  const str = raw.trim();

  // Empty values are safe
  if (!str) return "";

  // Characters that can trigger formulas in Excel/LibreOffice
  if (str[0] === "=" || str[0] === "+" || str[0] === "-" || str[0] === "@") {
    return `'${str}`;
  }

  // Tab-prefixed values can also trigger DDE
  if (raw[0] === "\t" || raw[0] === "\r" || raw[0] === "\n") {
    return `'${str}`;
  }

  return str;
}

/**
 * Sanitize an entire row of values for CSV export.
 */
export function sanitizeCsvRow(values: unknown[]): string[] {
  return values.map(sanitizeCsvValue);
}

/**
 * Escape a value for proper CSV field formatting.
 * Handles commas, quotes, and newlines within values.
 */
export function escapeCsvField(value: string): string {
  // If the value contains a comma, quote, or newline, wrap in quotes
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    // Double any existing quotes
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  return value;
}

/**
 * Generate a safe CSV string from rows of data.
 */
export function generateCsv(headers: string[], rows: unknown[][]): string {
  const lines: string[] = [];

  // Header row
  lines.push(headers.map(h => escapeCsvField(sanitizeCsvValue(h))).join(","));

  // Data rows
  for (const row of rows) {
    lines.push(row.map(cell => escapeCsvField(sanitizeCsvValue(cell))).join(","));
  }

  return lines.join("\r\n"); // Use \r\n for Excel compatibility
}
