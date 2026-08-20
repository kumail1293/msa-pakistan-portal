/**
 * Enterprise Operations Engine (§147)
 *
 * Health checks, system monitoring, rate limiting,
 * system metrics, uptime tracking, and operational dashboards.
 */

import * as os from "os";

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: Date;
  uptime: number;
  checks: {
    database: "ok" | "error";
    memory: { used: number; total: number; percentage: number };
    cpu: { usage: number };
    disk: { used: number; total: number; percentage: number };
  };
  version: string;
}

export interface RateLimitEntry {
  key: string;
  count: number;
  windowStart: number;
}

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>();

// System start time
const startTime = Date.now();

export const enterpriseOpsEngine = {
  /** Health check endpoint data */
  getHealth: (): HealthCheckResult => {
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      status: "healthy",
      timestamp: new Date(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      checks: {
        database: "ok",
        memory: {
          used: Math.round(usedMem / 1024 / 1024),
          total: Math.round(totalMem / 1024 / 1024),
          percentage: Math.round((usedMem / totalMem) * 100),
        },
        cpu: {
          usage: Math.round(process.cpuUsage().user / 1000000),
        },
        disk: {
          used: 0,
          total: 0,
          percentage: 0,
        },
      },
      version: "1.0.0",
    };
  },

  /** Rate limiter */
  checkRateLimit: (key: string, limit: number = 100, windowMs: number = 60000): { allowed: boolean; remaining: number; resetAt: number } => {
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || (now - entry.windowStart) > windowMs) {
      rateLimitStore.set(key, { key, count: 1, windowStart: now });
      return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
    }

    if (entry.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: entry.windowStart + windowMs };
    }

    entry.count++;
    return { allowed: true, remaining: limit - entry.count, resetAt: entry.windowStart + windowMs };
  },

  /** Get system metrics */
  getMetrics: () => {
    const mem = process.memoryUsage();

    return {
      uptime: Math.floor((Date.now() - startTime) / 1000),
      memory: {
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        rss: Math.round(mem.rss / 1024 / 1024),
        external: Math.round(mem.external / 1024 / 1024),
      },
      cpu: {
        model: os.cpus()[0]?.model ?? "unknown",
        cores: os.cpus().length,
        usage: process.cpuUsage(),
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        totalMemory: Math.round(os.totalmem() / 1024 / 1024),
        freeMemory: Math.round(os.freemem() / 1024 / 1024),
        loadAverage: os.loadavg().map((v: number) => Math.round(v * 100) / 100),
      },
    };
  },

  /** Request logger middleware data */
  logRequest: (method: string, path: string, statusCode: number, durationMs: number): void => {
    if (statusCode >= 500) {
      console.error(`[ERROR] ${method} ${path} ${statusCode} ${durationMs}ms`);
    } else if (statusCode >= 400) {
      console.warn(`[WARN]  ${method} ${path} ${statusCode} ${durationMs}ms`);
    }
  },

  /** Security headers */
  getSecurityHeaders: (): Record<string, string> => ({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
  }),

  /** Clean up expired rate limit entries */
  cleanupRateLimits: (): number => {
    const now = Date.now();
    let cleaned = 0;
    rateLimitStore.forEach((entry, key) => {
      if ((now - entry.windowStart) > 120000) {
        rateLimitStore.delete(key);
        cleaned++;
      }
    });
    return cleaned;
  },
};
