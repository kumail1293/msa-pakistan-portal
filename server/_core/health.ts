/**
 * Health Check Endpoints
 *
 * Provides three routes for container orchestrators (Docker, Kubernetes,
 * ECS, Cloud Run) and load balancers:
 *
 *   GET /health        — combined status (200 when live + ready, 503 otherwise)
 *   GET /health/live   — liveness probe (200 if process is up)
 *   GET /health/ready  — readiness probe (200 when all deps are reachable)
 *
 * Readiness checks:
 *   - MySQL / database connectivity (when DATABASE_URL is set)
 *   - SMTP transport (informational — not a hard gate)
 *   - Process memory (soft guard at 512 MB RSS)
 *
 * All endpoints are unauthenticated and return JSON.
 */

import type { Express, Request, Response } from "express";
import { childLogger } from "./logger";

const log = childLogger("Health");

// ── Boot timestamp ───────────────────────────────────────────────────────────
const BOOT_TIME = Date.now();

// ── Readiness state ──────────────────────────────────────────────────────────
// Set to `true` once the server has finished listening and all post-boot
// initialisation (branding preload, RBAC seed, etc.) is complete.
let _ready = false;

/**
 * Mark the server as ready to accept traffic.  Call this after all post-boot
 * initialisation is finished (e.g. after `server.listen` callback runs).
 */
export function markReady(): void {
  _ready = true;
  log.info("Server marked ready");
}

/**
 * Returns `true` when the server has completed post-boot initialisation.
 */
export function isReady(): boolean {
  return _ready;
}

// ── Dependency checkers ──────────────────────────────────────────────────────

interface DependencyStatus {
  name: string;
  status: "ok" | "degraded" | "down";
  message?: string;
  latencyMs?: number;
}

/**
 * Check MySQL / database connectivity.
 * Returns "ok" when the pool can execute a ping, "degraded" when no
 * DATABASE_URL is set (no DB configured), or "down" on error.
 */
async function checkDatabase(): Promise<DependencyStatus> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return { name: "database", status: "degraded", message: "DATABASE_URL not configured" };
  }

  const start = Date.now();
  try {
    const { getPoolDirect } = await import("../db");
    const pool = getPoolDirect();
    if (!pool) {
      return { name: "database", status: "down", message: "Pool not initialised" };
    }
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    return { name: "database", status: "ok", latencyMs: Date.now() - start };
  } catch (error) {
    return {
      name: "database",
      status: "down",
      message: error instanceof Error ? error.message : "Unknown error",
      latencyMs: Date.now() - start,
    };
  }
}

/**
 * Check SMTP transport configuration (informational).
 */
async function checkSmtp(): Promise<DependencyStatus> {
  try {
    const { isSmtpConfigured } = await import("../services/emailService");
    if (isSmtpConfigured()) {
      return { name: "smtp", status: "ok" };
    }
    return { name: "smtp", status: "degraded", message: "SMTP not configured" };
  } catch {
    return { name: "smtp", status: "degraded", message: "SMTP module unavailable" };
  }
}

/**
 * Soft memory guard: report "degraded" if RSS exceeds 512 MB.
 */
function checkMemory(): DependencyStatus {
  const rssBytes = process.memoryUsage().rss;
  const rssMB = Math.round(rssBytes / 1024 / 1024);
  if (rssMB > 512) {
    return { name: "memory", status: "degraded", message: `RSS ${rssMB} MB exceeds 512 MB soft limit` };
  }
  return { name: "memory", status: "ok", message: `RSS ${rssMB} MB` };
}

// ── Route registration ───────────────────────────────────────────────────────

export function registerHealthRoutes(app: Express): void {
  // ── Liveness: "Is the process alive?" ──────────────────────────────────
  app.get("/health/live", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      uptime: Math.floor((Date.now() - BOOT_TIME) / 1000),
    });
  });

  // ── Readiness: "Can the process serve traffic?" ────────────────────────
  app.get("/health/ready", async (_req: Request, res: Response) => {
    if (!_ready) {
      res.status(503).json({ status: "not_ready", message: "Server initialisation in progress" });
      return;
    }

    const [db, smtp, memory] = await Promise.all([
      checkDatabase(),
      checkSmtp(),
      checkMemory(),
    ]);

    const deps = [db, smtp, memory];
    const hasDown = deps.some(d => d.status === "down");
    const httpStatus = hasDown ? 503 : 200;

    res.status(httpStatus).json({
      status: hasDown ? "degraded" : "ok",
      uptime: Math.floor((Date.now() - BOOT_TIME) / 1000),
      dependencies: deps,
    });
  });

  // ── Combined: "Overall health" ─────────────────────────────────────────
  app.get("/health", async (_req: Request, res: Response) => {
    // Liveness gate: if process is up but not ready yet, return 503.
    if (!_ready) {
      res.status(503).json({
        status: "not_ready",
        uptime: Math.floor((Date.now() - BOOT_TIME) / 1000),
        message: "Server initialisation in progress",
      });
      return;
    }

    const [db, smtp, memory] = await Promise.all([
      checkDatabase(),
      checkSmtp(),
      checkMemory(),
    ]);

    const deps = [db, smtp, memory];
    const hasDown = deps.some(d => d.status === "down");
    const httpStatus = hasDown ? 503 : 200;

    res.status(httpStatus).json({
      status: hasDown ? "degraded" : "ok",
      uptime: Math.floor((Date.now() - BOOT_TIME) / 1000),
      ready: true,
      dependencies: deps,
    });
  });

  log.info("Health routes registered (/health, /health/live, /health/ready)");
}
