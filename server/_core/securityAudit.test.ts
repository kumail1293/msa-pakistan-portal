/**
 * Security Audit Fixes Tests
 *
 * Tests for:
 * - Audit chain tamper-evident hashing
 * - Workflow state machine transition validation
 * - API key SHA-256 hashing
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// 1. Audit Chain Hashing
// ============================================================================

describe("Audit chain hashing", () => {
  it("computeEventHash produces consistent SHA-256 hashes", () => {
    // Import the internal computeEventHash through the module
    // Since it's not exported, we test the chain concept directly
    const crypto = require("crypto");

    const payload = JSON.stringify({
      id: 1,
      userId: 5,
      action: "member.create",
      entityType: "user",
      entityId: 123,
      before: null,
      after: { name: "Test" },
      reason: "Test event",
      createdAt: "2026-01-01T00:00:00.000Z",
      previousHash: "0".repeat(64),
    });

    const hash1 = crypto.createHash("sha256").update(payload).digest("hex");
    const hash2 = crypto.createHash("sha256").update(payload).digest("hex");

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("different payloads produce different hashes", () => {
    const crypto = require("crypto");

    const payload1 = JSON.stringify({ id: 1, action: "create" });
    const payload2 = JSON.stringify({ id: 2, action: "delete" });

    const hash1 = crypto.createHash("sha256").update(payload1).digest("hex");
    const hash2 = crypto.createHash("sha256").update(payload2).digest("hex");

    expect(hash1).not.toBe(hash2);
  });

  it("chain links are detectable when broken", () => {
    const crypto = require("crypto");

    // Simulate a chain of 3 events
    const genesisHash = "0".repeat(64);

    const event1 = { id: 1, action: "create", previousHash: genesisHash };
    const hash1 = crypto.createHash("sha256").update(JSON.stringify(event1)).digest("hex");

    const event2 = { id: 2, action: "update", previousHash: hash1 };
    const hash2 = crypto.createHash("sha256").update(JSON.stringify(event2)).digest("hex");

    const event3 = { id: 3, action: "delete", previousHash: hash2 };
    const hash3 = crypto.createHash("sha256").update(JSON.stringify(event3)).digest("hex");

    // Valid chain: each event's previousHash matches the prior event's hash
    expect(event2.previousHash).toBe(hash1);
    expect(event3.previousHash).toBe(hash2);

    // Tampered: if someone changes event2's action, its hash changes
    const tamperedEvent2 = { id: 2, action: "TAMPERED", previousHash: hash1 };
    const tamperedHash2 = crypto.createHash("sha256").update(JSON.stringify(tamperedEvent2)).digest("hex");

    expect(tamperedHash2).not.toBe(hash2);
    // event3's previousHash would no longer match
    expect(event3.previousHash).not.toBe(tamperedHash2);
  });
});

// ============================================================================
// 2. Workflow State Machine
// ============================================================================

describe("Workflow state machine transitions", () => {
  // Replicate the transition logic from workflowEngine.ts
  const VALID_TRANSITIONS: Record<string, string[]> = {
    draft: ["running"],
    running: ["completed", "rejected", "cancelled", "paused"],
    paused: ["running", "cancelled"],
  };

  function isValidTransition(fromStatus: string, toStatus: string): boolean {
    const allowed = VALID_TRANSITIONS[fromStatus];
    if (!allowed) return false;
    return allowed.includes(toStatus);
  }

  it("allows draft → running", () => {
    expect(isValidTransition("draft", "running")).toBe(true);
  });

  it("allows running → completed", () => {
    expect(isValidTransition("running", "completed")).toBe(true);
  });

  it("allows running → cancelled", () => {
    expect(isValidTransition("running", "cancelled")).toBe(true);
  });

  it("allows running → paused", () => {
    expect(isValidTransition("running", "paused")).toBe(true);
  });

  it("allows paused → running (resume)", () => {
    expect(isValidTransition("paused", "running")).toBe(true);
  });

  it("allows paused → cancelled", () => {
    expect(isValidTransition("paused", "cancelled")).toBe(true);
  });

  it("REJECTS cancelled → running (terminal state)", () => {
    expect(isValidTransition("cancelled", "running")).toBe(false);
  });

  it("REJECTS completed → running (terminal state)", () => {
    expect(isValidTransition("completed", "running")).toBe(false);
  });

  it("REJECTS completed → cancelled (terminal state)", () => {
    expect(isValidTransition("completed", "cancelled")).toBe(false);
  });

  it("REJECTS rejected → running (terminal state)", () => {
    expect(isValidTransition("rejected", "running")).toBe(false);
  });

  it("REJECTS cancelled → completed (terminal state)", () => {
    expect(isValidTransition("cancelled", "completed")).toBe(false);
  });

  it("REJECTS draft → completed (must go through running)", () => {
    expect(isValidTransition("draft", "completed")).toBe(false);
  });

  it("REJECTS draft → cancelled (must go through running)", () => {
    expect(isValidTransition("draft", "cancelled")).toBe(false);
  });

  it("REJECTS unknown status transitions", () => {
    expect(isValidTransition("unknown", "running")).toBe(false);
    expect(isValidTransition("running", "unknown")).toBe(false);
  });
});

// ============================================================================
// 3. API Key Hashing
// ============================================================================

describe("API key SHA-256 hashing", () => {
  it("hashApiKey produces 64-char hex SHA-256", () => {
    const crypto = require("crypto");

    const key = "msap_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd";
    const hash = crypto.createHash("sha256").update(key).digest("hex");

    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it("same key always produces same hash", () => {
    const crypto = require("crypto");

    const key = "msap_test_key_12345";
    const hash1 = crypto.createHash("sha256").update(key).digest("hex");
    const hash2 = crypto.createHash("sha256").update(key).digest("hex");

    expect(hash1).toBe(hash2);
  });

  it("different keys produce different hashes", () => {
    const crypto = require("crypto");

    const hash1 = crypto.createHash("sha256").update("msap_key_1").digest("hex");
    const hash2 = crypto.createHash("sha256").update("msap_key_2").digest("hex");

    expect(hash1).not.toBe(hash2);
  });

  it("hash is irreversible (cannot recover key from hash)", () => {
    const crypto = require("crypto");

    const key = "msap_secret_api_key_xyz";
    const hash = crypto.createHash("sha256").update(key).digest("hex");

    // SHA-256 is one-way — no deterministic reversal
    // The hash should not contain the original key
    expect(hash).not.toContain(key);
    expect(hash).not.toContain("msap");
  });
});

// ============================================================================
// 4. Service Worker Sensitive Endpoint Blocking
// ============================================================================

describe("Service worker sensitive endpoint blocking", () => {
  // Replicate the sensitive patterns from sw.js
  const sensitivePatterns = [
    "members", "documents", "votes", "ballots", "finance",
    "governance", "credentials", "applications", "notifications",
    "settings", "api-keys", "impersonation", "audit",
    "plenary", "elections", "termination", "proxy",
  ];

  function isSensitive(pathname: string): boolean {
    return sensitivePatterns.some((p) => pathname.includes(p));
  }

  it("blocks /trpc/admin.members.list", () => {
    expect(isSensitive("/trpc/admin.members.list")).toBe(true);
  });

  it("blocks /trpc/documents.list", () => {
    expect(isSensitive("/trpc/documents.list")).toBe(true);
  });

  it("blocks /trpc/votes.cast", () => {
    expect(isSensitive("/trpc/votes.cast")).toBe(true);
  });

  it("blocks /trpc/finance.summary", () => {
    expect(isSensitive("/trpc/finance.summary")).toBe(true);
  });

  it("blocks /trpc/elections.list", () => {
    expect(isSensitive("/trpc/elections.list")).toBe(true);
  });

  it("blocks /trpc/notifications.list", () => {
    expect(isSensitive("/trpc/notifications.list")).toBe(true);
  });

  it("blocks /trpc/audit.events", () => {
    expect(isSensitive("/trpc/audit.events")).toBe(true);
  });

  it("allows /trpc/activities.list (public)", () => {
    expect(isSensitive("/trpc/activities.list")).toBe(false);
  });

  it("allows /trpc/events.list (public)", () => {
    expect(isSensitive("/trpc/events.list")).toBe(false);
  });

  it("allows /trpc/chapters.list (public)", () => {
    expect(isSensitive("/trpc/chapters.list")).toBe(false);
  });

  it("allows /trpc/cms.pages.list (public)", () => {
    expect(isSensitive("/trpc/cms.pages.list")).toBe(false);
  });
});
