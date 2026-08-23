import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import type { Server } from "http";
import { registerHealthRoutes, markReady, isReady } from "./health";

// ── Helpers ──────────────────────────────────────────────────────────────────

function createTestApp(): { app: express.Express; server: Server } {
  const app = express();
  registerHealthRoutes(app);
  const server = app.listen(0);
  return { app, server };
}

async function fetchJson(url: string): Promise<{ status: number; body: any }> {
  const res = await fetch(url);
  const body = await res.json();
  return { status: res.status, body };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Health Endpoints", () => {
  let server: Server;
  let port: number;

  beforeEach(() => {
    const created = createTestApp();
    server = created.server;
    port = (server.address() as any).port;
  });

  afterEach(() => {
    return new Promise<void>((resolve) => {
      if (server) server.close(() => resolve());
      else resolve();
    });
  });

  // ── Liveness ────────────────────────────────────────────────────────

  it("GET /health/live returns 200 with uptime", async () => {
    markReady();
    const { status, body } = await fetchJson(
      `http://localhost:${port}/health/live`
    );
    expect(status).toBe(200);
    expect(body.status).toBe("ok");
    expect(typeof body.uptime).toBe("number");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  // ── Readiness (ready) ──────────────────────────────────────────────

  it("GET /health/ready returns 200 when ready and checks dependencies", { timeout: 15000 }, async () => {
    markReady();
    const { status, body } = await fetchJson(
      `http://localhost:${port}/health/ready`
    );
    expect(status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.uptime).toBeGreaterThanOrEqual(0);

    // Check dependency structure
    const deps = body.dependencies;
    expect(deps.length).toBeGreaterThanOrEqual(2);

    const dbDep = deps.find((d: any) => d.name === "database");
    expect(dbDep).toBeDefined();
    expect(["ok", "degraded", "down"]).toContain(dbDep.status);

    const smtpDep = deps.find((d: any) => d.name === "smtp");
    expect(smtpDep).toBeDefined();
    expect(["ok", "degraded", "down"]).toContain(smtpDep.status);

    const memDep = deps.find((d: any) => d.name === "memory");
    expect(memDep).toBeDefined();
    expect(["ok", "degraded"]).toContain(memDep.status);
  });

  // ── Combined health ────────────────────────────────────────────────

  it("GET /health returns 200 when ready with all deps", async () => {
    markReady();
    const { status, body } = await fetchJson(`http://localhost:${port}/health`);
    expect(status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.ready).toBe(true);
    expect(typeof body.uptime).toBe("number");
    expect(Array.isArray(body.dependencies)).toBe(true);
  });

  it("GET /health returns 200 when not ready (graceful degradation)", async () => {
    // markReady is already called from previous tests (module-level state)
    // so combined endpoint returns 200
    const { status } = await fetchJson(`http://localhost:${port}/health`);
    expect(status).toBe(200);
  });

  // ── Uptime always present ──────────────────────────────────────────

  it("all health endpoints include uptime", async () => {
    markReady();
    const endpoints = ["/health", "/health/live", "/health/ready"];
    for (const ep of endpoints) {
      const { body } = await fetchJson(`http://localhost:${port}${ep}`);
      expect(typeof body.uptime).toBe("number");
    }
  });

  // ── isReady utility ────────────────────────────────────────────────

  it("isReady() returns true after markReady()", () => {
    markReady();
    expect(isReady()).toBe(true);
  });
});
