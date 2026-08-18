import { describe, expect, it } from "vitest";
import {
  generateSecureToken,
  hashPassword,
  hashToken,
  toPublicUser,
  validatePassword,
  verifyPassword,
} from "./memberAuthService";
import type { User } from "../../drizzle/schema";

describe("memberAuthService", () => {
  describe("password hashing", () => {
    it("hashes and verifies a password round-trip", async () => {
      const hash = await hashPassword("S3curePass!2026");
      expect(hash.startsWith("scrypt$")).toBe(true);
      await expect(verifyPassword("S3curePass!2026", hash)).resolves.toBe(true);
    });

    it("rejects a wrong password", async () => {
      const hash = await hashPassword("correct-horse");
      await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
    });

    it("does not store the plaintext password in the hash", async () => {
      const password = "PlaintextP@ss9";
      const hash = await hashPassword(password);
      expect(hash).not.toContain(password);
    });

    it("produces unique salts (same password, different hashes)", async () => {
      const a = await hashPassword("SamePass123");
      const b = await hashPassword("SamePass123");
      expect(a).not.toBe(b);
    });

    it("returns false for malformed hashes instead of throwing", async () => {
      await expect(verifyPassword("x", "not-a-scrypt-hash")).resolves.toBe(false);
      await expect(verifyPassword("x", "")).resolves.toBe(false);
    });
  });

  describe("setup token hashing", () => {
    it("generates high-entropy tokens and stable digests", () => {
      const token = generateSecureToken(32);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
      expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
      expect(hashToken(token)).toBe(hashToken(token));
      expect(hashToken(token)).not.toBe(token);
    });
  });

  describe("validatePassword", () => {
    it("accepts a student-friendly 8-char password with letter + number", () => {
      expect(validatePassword("student1")).toEqual({ valid: true, errors: [] });
    });

    it("rejects short passwords", () => {
      const result = validatePassword("short1");
      expect(result.valid).toBe(false);
      expect(result.errors.join(" ")).toContain("8");
    });

    it("rejects passwords without letters or without numbers", () => {
      expect(validatePassword("12345678").valid).toBe(false);
      expect(validatePassword("abcdefgh").valid).toBe(false);
    });
  });

  describe("toPublicUser", () => {
    it("strips every credential field before returning a user to the client", () => {
      const user = {
        id: 1,
        openId: "member:MSAP-TEST-0001",
        email: "a@b.com",
        name: "Test Member",
        cnic: "1234512345671",
        phone: null,
        institution: null,
        degree: null,
        graduationYear: null,
        localCouncilId: null,
        membershipStatus: "Active",
        membershipId: "MSAP-TEST-0001",
        membershipStartDate: null,
        membershipEndDate: null,
        profilePhotoUrl: null,
        bio: null,
        loginMethod: "member-password",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: null,
        passwordHash: "scrypt$...",
        passwordSetupRequired: false,
        setupTokenHash: "sha256digest",
        setupTokenExpiresAt: new Date(),
        setupTokenUsedAt: new Date(),
        active: true,
        discipline: null,
        yearOfStudy: null,
        localCouncil: null,
      } as User;

      const safe = toPublicUser(user);
      expect(safe).not.toHaveProperty("passwordHash");
      expect(safe).not.toHaveProperty("setupTokenHash");
      expect(safe).not.toHaveProperty("setupTokenExpiresAt");
      expect(safe).not.toHaveProperty("setupTokenUsedAt");
      // Full CNIC must never leave the server.
      expect(safe).not.toHaveProperty("cnic");
      expect(safe.membershipId).toBe("MSAP-TEST-0001");
      expect(safe.email).toBe("a@b.com");
    });
  });
});
