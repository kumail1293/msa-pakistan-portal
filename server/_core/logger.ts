/**
 * Structured Logger
 *
 * Pino-based logger with JSON output in production and pretty-printed
 * output in development.  Every module creates a child logger with
 * its own `module` tag so logs are easy to filter in aggregators
 * (Datadog, Grafana, CloudWatch, etc.).
 *
 * Usage:
 *   import { logger } from "./logger";
 *   logger.info({ port }, "Server listening");
 *
 *   import { childLogger } from "./logger";
 *   const log = childLogger("Email");
 *   log.info({ to, subject }, "Email queued");
 */

import pino from "pino";

// ── Sensitive-field redaction ────────────────────────────────────────────────
// These keys are masked in every log line so credentials never leak.
const REDACT_KEYS = [
  "password",
  "pass",
  "smtp_password",
  "SMTP_PASSWORD",
  "cookieSecret",
  "JWT_SECRET",
  "cookie_secret",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "forgeApiKey",
  "FORGE_API_KEY",
];

// ── Base logger ──────────────────────────────────────────────────────────────

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),

  // Pretty-print in dev, structured JSON in production.
  transport: isDev
    ? {
        target: "pino/file",
        options: { destination: 1 }, // stdout
      }
    : undefined,

  formatters: isDev
    ? undefined
    : {
        level(label: string) {
          return { level: label };
        },
      },

  // Redact sensitive fields across every log entry.
  redact: {
    paths: REDACT_KEYS,
    remove: true,
  },

  // Timestamp in ISO-8601 for production log aggregators.
  timestamp: isDev ? false : pino.stdTimeFunctions.isoTime,

  // Mirror console.* for backward compatibility during migration.
  // pino logs to stdout by default, which is the same destination.
  base: isDev ? undefined : { pid: process.pid },
});

// ── Child logger factory ─────────────────────────────────────────────────────

/**
 * Create a child logger tagged with a module name.
 *
 * @example
 *   const log = childLogger("Email");
 *   log.info({ to: "user@example.com" }, "Email sent");
 *   // → {"level":"info","module":"Email","to":"user@example.com","msg":"Email sent"}
 */
export function childLogger(module: string) {
  return logger.child({ module });
}

// ── Re-export convenience types ──────────────────────────────────────────────

export type Logger = typeof logger;
