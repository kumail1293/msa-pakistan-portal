/**
 * Production Migration Tests — PART 7, 8, 18, 19
 *
 * Tests:
 * - Organization context resolution (not hardcoded to ID 1)
 * - SSRF protection (blocked IPs, protocols, hostnames)
 * - Asset ingestion (upload, URL, versioning, access control)
 * - Storage provider (local + memory)
 * - Filename sanitization
 * - MIME validation
 * - Security invariants
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  validateUrl,
  safeFetchUrl,
} from "./ssrfProtection";
import {
  MemoryStorageProvider,
  LocalStorageProvider,
} from "./storageProvider";
import { sanitizeFileName, isBlockedMimeType } from "../_core/uploads";
import {
  validateOrgContext,
  testWithDifferentOrg,
  type OrganizationContext,
} from "./organizationContextService";
import crypto from "crypto";

// ============================================================================
// SSRF Protection Tests
// ============================================================================

describe("SSRF Protection", () => {
  describe("validateUrl", () => {
    it("blocks localhost", async () => {
      const result = await validateUrl("http://localhost:3000/admin");
      expect(result.safe).toBe(false);
    });

    it("blocks 0.0.0.0", async () => {
      const result = await validateUrl("https://0.0.0.0/secret");
      expect(result.safe).toBe(false);
    });

    it("blocks private IP 10.x.x.x", async () => {
      const result = await validateUrl("https://10.0.0.1/admin");
      expect(result.safe).toBe(false);
    });

    it("blocks private IP 192.168.x.x", async () => {
      const result = await validateUrl("https://192.168.1.1/admin");
      expect(result.safe).toBe(false);
    });

    it("blocks private IP 172.16-31.x.x", async () => {
      const result = await validateUrl("https://172.16.0.1/admin");
      expect(result.safe).toBe(false);
    });

    it("blocks link-local 169.254.x.x", async () => {
      const result = await validateUrl("https://169.254.169.254/metadata");
      expect(result.safe).toBe(false);
    });

    it("blocks cloud metadata endpoint", async () => {
      const result = await validateUrl("https://169.254.169.254/latest/meta-data/");
      expect(result.safe).toBe(false);
    });

    it("blocks http:// protocol", async () => {
      const result = await validateUrl("http://example.com/file.pdf");
      expect(result.safe).toBe(false);
    });

    it("blocks ftp:// protocol", async () => {
      const result = await validateUrl("ftp://example.com/file.pdf");
      expect(result.safe).toBe(false);
    });

    it("blocks file:// protocol", async () => {
      const result = await validateUrl("file:///etc/passwd");
      expect(result.safe).toBe(false);
    });

    it("allows valid HTTPS URLs", async () => {
      const result = await validateUrl("https://example.com/document.pdf");
      expect(result.safe).toBe(true);
    });

    it("blocks invalid URL format", async () => {
      const result = await validateUrl("not-a-url");
      expect(result.safe).toBe(false);
      expect(result.reason).toContain("Invalid URL");
    });

    it("blocks very long URLs", async () => {
      const longUrl = "https://example.com/" + "a".repeat(3000);
      const result = await validateUrl(longUrl);
      expect(result.safe).toBe(false);
    });

    it("blocks non-standard ports", async () => {
      const result = await validateUrl("https://example.com:8080/file.pdf");
      expect(result.safe).toBe(false);
      expect(result.reason).toContain("Port");
    });
  });
});

// ============================================================================
// Storage Provider Tests
// ============================================================================

describe("Storage Providers", () => {
  describe("MemoryStorageProvider", () => {
    let provider: MemoryStorageProvider;

    beforeEach(() => {
      provider = new MemoryStorageProvider();
    });

    it("put and get a file", async () => {
      const body = Buffer.from("hello world");
      await provider.put("test/file.txt", body, { contentType: "text/plain" });

      const result = await provider.get("test/file.txt");
      expect(result).not.toBeNull();
      expect(result!.body.toString()).toBe("hello world");
      expect(result!.metadata.size).toBe(11);
    });

    it("returns null for missing file", async () => {
      const result = await provider.get("nonexistent.txt");
      expect(result).toBeNull();
    });

    it("delete removes file", async () => {
      await provider.put("del.txt", Buffer.from("x"));
      const deleted = await provider.delete("del.txt");
      expect(deleted).toBe(true);
      expect(await provider.get("del.txt")).toBeNull();
    });

    it("exists checks file presence", async () => {
      expect(await provider.exists("nope.txt")).toBe(false);
      await provider.put("yes.txt", Buffer.from("y"));
      expect(await provider.exists("yes.txt")).toBe(true);
    });

    it("copy creates new entry", async () => {
      await provider.put("src.txt", Buffer.from("data"));
      await provider.copy("src.txt", "dest.txt");

      const result = await provider.get("dest.txt");
      expect(result).not.toBeNull();
      expect(result!.body.toString()).toBe("data");
    });

    it("computes correct checksum", async () => {
      const body = Buffer.from("test data");
      const meta = await provider.put("checksum.txt", body);
      const expected = crypto.createHash("sha256").update(body).digest("hex");
      expect(meta.checksum).toBe(expected);
    });

    it("clear removes all entries", async () => {
      await provider.put("a.txt", Buffer.from("a"));
      await provider.put("b.txt", Buffer.from("b"));
      provider.clear();
      expect(await provider.get("a.txt")).toBeNull();
    });
  });

  describe("LocalStorageProvider", () => {
    const testDir = ".data/test-storage";

    it("put and get a file", async () => {
      const provider = new LocalStorageProvider(testDir);
      const body = Buffer.from("local test");
      await provider.put("test/local.txt", body, { contentType: "text/plain" });

      const result = await provider.get("test/local.txt");
      expect(result).not.toBeNull();
      expect(result!.body.toString()).toBe("local test");
    });

    it("returns null for missing file", async () => {
      const provider = new LocalStorageProvider(testDir);
      const result = await provider.get("nonexistent-local.txt");
      expect(result).toBeNull();
    });

    it("exists checks file", async () => {
      const provider = new LocalStorageProvider(testDir);
      await provider.put("exists.txt", Buffer.from("e"));
      expect(await provider.exists("exists.txt")).toBe(true);
      expect(await provider.exists("nope.txt")).toBe(false);
    });
  });
});

// ============================================================================
// Filename Sanitization Tests
// ============================================================================

describe("Filename Sanitization", () => {
  it("removes path separators", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("____etc_passwd");
  });    it("removes null bytes", () => {
      expect(sanitizeFileName("file\x00.pdf")).toBe("file_.pdf");
    });

  it("removes invalid chars", () => {
    expect(sanitizeFileName('file<>:"|?*.pdf')).toBe("file_______.pdf");
  });

  it("truncates long names", () => {
    const long = "a".repeat(300);
    expect(sanitizeFileName(long).length).toBeLessThanOrEqual(200);
  });

  it("handles empty input", () => {
    expect(sanitizeFileName("")).toBe("unnamed");
  });    it("removes leading dots and traversal", () => {
      // .. becomes _, then leading dot regex removes remaining leading dots
      const result = sanitizeFileName("...hidden");
      expect(result).not.toContain("..");
      expect(result).toContain("hidden");
    });
});

// ============================================================================
// MIME Blocking Tests
// ============================================================================

describe("MIME Blocking", () => {
  it("blocks HTML", () => {
    expect(isBlockedMimeType("text/html")).toBe(true);
  });

  it("blocks executables", () => {
    expect(isBlockedMimeType("application/x-msdownload")).toBe(true);
  });

  it("blocks shockwave", () => {
    expect(isBlockedMimeType("application/x-shockwave-flash")).toBe(true);
  });

  it("allows PDF", () => {
    expect(isBlockedMimeType("application/pdf")).toBe(false);
  });

  it("allows JPEG", () => {
    expect(isBlockedMimeType("image/jpeg")).toBe(false);
  });

  it("allows Word documents", () => {
    expect(isBlockedMimeType("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(false);
  });
});

// ============================================================================
// Organization Context Tests
// ============================================================================

describe("Organization Context", () => {
  describe("validateOrgContext", () => {
    it("validates a correct context", () => {
      const ctx: OrganizationContext = {
        id: 42,
        name: "Test Org",
        shortName: "TO",
        type: "national",
        governanceVersion: "2025-26",
        termName: "2025-26",
        termStartDate: new Date("2025-10-01"),
        termEndDate: new Date("2026-09-30"),
        isTermActive: true,
        config: {},
      };
      const result = validateOrgContext(ctx);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects invalid ID", () => {
      const ctx: OrganizationContext = {
        id: 0,
        name: "Test",
        shortName: "T",
        type: "national",
        governanceVersion: "2025-26",
        termName: "2025-26",
        termStartDate: new Date(),
        termEndDate: new Date(),
        isTermActive: true,
        config: {},
      };
      const result = validateOrgContext(ctx);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("ID"))).toBe(true);
    });

    it("rejects missing name", () => {
      const ctx: OrganizationContext = {
        id: 1,
        name: "",
        shortName: "",
        type: "national",
        governanceVersion: "2025-26",
        termName: "2025-26",
        termStartDate: new Date(),
        termEndDate: new Date(),
        isTermActive: true,
        config: {},
      };
      const result = validateOrgContext(ctx);
      expect(result.valid).toBe(false);
    });

    it("rejects wrong type", () => {
      const ctx: OrganizationContext = {
        id: 1,
        name: "Test",
        shortName: "T",
        type: "chapter",
        governanceVersion: "2025-26",
        termName: "2025-26",
        termStartDate: new Date(),
        termEndDate: new Date(),
        isTermActive: true,
        config: {},
      };
      const result = validateOrgContext(ctx, "national");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("type"))).toBe(true);
    });

    it("rejects expired term", () => {
      const ctx: OrganizationContext = {
        id: 1,
        name: "Test",
        shortName: "T",
        type: "national",
        governanceVersion: "2025-26",
        termName: "2025-26",
        termStartDate: new Date("2020-01-01"),
        termEndDate: new Date("2020-12-31"),
        isTermActive: false,
        config: {},
      };
      const result = validateOrgContext(ctx);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("term"))).toBe(true);
    });
  });

  describe("testWithDifferentOrg", () => {
    it("works with org ID 42", async () => {
      const result = await testWithDifferentOrg(42);
      expect(result.success).toBe(true);
      expect(result.context?.id).toBe(42);
    });

    it("works with org ID 999", async () => {
      const result = await testWithDifferentOrg(999);
      expect(result.success).toBe(true);
      expect(result.context?.id).toBe(999);
    });
  });
});
