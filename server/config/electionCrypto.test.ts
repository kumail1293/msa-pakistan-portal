/**
 * Election Crypto Tests
 *
 * Comprehensive security tests for ballot encryption and voter pseudonymization.
 * Each test maps to a specific threat from the election threat model.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  encryptBallot,
  decryptBallot,
  generateVoterHash,
  parseVersionedCiphertext,
  serializeVersionedCiphertext,
  isCurrentKeyVersion,
  getCurrentKeyVersion,
  isElectionCryptoReady,
} from "./electionCrypto";

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_SECRET = "test-election-secret-that-is-long-enough-for-security-32chars";

// Save and restore env
let originalSecret: string | undefined;

beforeAll(() => {
  originalSecret = process.env.ELECTION_SECRET;
  process.env.ELECTION_SECRET = TEST_SECRET;
});

afterAll(() => {
  if (originalSecret !== undefined) {
    process.env.ELECTION_SECRET = originalSecret;
  } else {
    delete process.env.ELECTION_SECRET;
  }
});

// ============================================================================
// 3A — Ballot Confidentiality Tests
// ============================================================================

describe("Ballot Encryption (AES-256-GCM)", () => {
  const electionId = 42;

  it("1. Plaintext ballot cannot be recovered from DB without key", async () => {
    const ballotData = { candidateId: 7, rankings: [7, 3, 1] };
    const { ciphertext, iv, authTag } = await encryptBallot(ballotData, electionId);

    // Ciphertext should not contain any plaintext string fragments
    expect(ciphertext).not.toContain("candidateId");
    expect(ciphertext).not.toContain("rankings");
    expect(ciphertext).not.toContain(JSON.stringify(ballotData));
  });

  it("2. Base64 decoding does not reveal ballot", async () => {
    const ballotData = { candidateId: 7, rankings: [7, 3, 1] };
    const { ciphertext } = await encryptBallot(ballotData, electionId);

    // Hex ciphertext decoded as UTF-8 should not reveal plaintext
    const decoded = Buffer.from(ciphertext, "hex").toString("utf-8");
    expect(decoded).not.toContain("candidateId");
    expect(decoded).not.toContain("rankings");
  });

  it("3. Wrong key fails decryption", async () => {
    const ballotData = { candidateId: 7 };
    const { ciphertext, iv, authTag } = await encryptBallot(ballotData, electionId);

    // Change the election secret
    process.env.ELECTION_SECRET = "completely-different-secret-for-wrong-key-test!!!";

    await expect(
      decryptBallot(ciphertext, iv, authTag, getCurrentKeyVersion(), electionId)
    ).rejects.toThrow();

    // Restore
    process.env.ELECTION_SECRET = TEST_SECRET;
  });

  it("4. Modified ciphertext fails (tamper detection)", async () => {
    const ballotData = { candidateId: 7 };
    const { ciphertext, iv, authTag } = await encryptBallot(ballotData, electionId);

    // Flip a character in the ciphertext
    const tampered = ciphertext.slice(0, -2) + (ciphertext.slice(-2) === "aa" ? "bb" : "aa");

    await expect(
      decryptBallot(tampered, iv, authTag, getCurrentKeyVersion(), electionId)
    ).rejects.toThrow();
  });

  it("5. Modified auth tag fails", async () => {
    const ballotData = { candidateId: 7 };
    const { ciphertext, iv, authTag } = await encryptBallot(ballotData, electionId);

    const tamperedTag = authTag.slice(0, -2) + (authTag.slice(-2) === "aa" ? "bb" : "aa");

    await expect(
      decryptBallot(ciphertext, iv, tamperedTag, getCurrentKeyVersion(), electionId)
    ).rejects.toThrow();
  });

  it("6. Different IVs produce different ciphertext for same plaintext", async () => {
    const ballotData = { candidateId: 7 };

    const result1 = await encryptBallot(ballotData, electionId);
    const result2 = await encryptBallot(ballotData, electionId);

    expect(result1.ciphertext).not.toBe(result2.ciphertext);
    expect(result1.iv).not.toBe(result2.iv);
  });

  it("7. Encryption roundtrip preserves data", async () => {
    const ballotData = { candidateId: 7, rankings: [7, 3, 1], timestamp: Date.now() };
    const { ciphertext, iv, authTag, keyVersion } = await encryptBallot(ballotData, electionId);

    const decrypted = await decryptBallot(ciphertext, iv, authTag, keyVersion, electionId);
    expect(decrypted).toEqual(ballotData);
  });

  it("8. Different elections produce different ciphertext", async () => {
    const ballotData = { candidateId: 7 };

    const result1 = await encryptBallot(ballotData, 100);
    const result2 = await encryptBallot(ballotData, 200);

    expect(result1.ciphertext).not.toBe(result2.ciphertext);
  });
});

// ============================================================================
// 3B — Voter Anonymization Tests
// ============================================================================

describe("Voter Pseudonymization (HMAC-SHA256)", () => {
  const electionId = 42;

  it("9. Voter hash cannot be calculated without server secret", async () => {
    // Remove secret
    delete process.env.ELECTION_SECRET;

    await expect(
      generateVoterHash(electionId, 1)
    ).rejects.toThrow();

    // Restore
    process.env.ELECTION_SECRET = TEST_SECRET;
  });

  it("10. No default secret exists", () => {
    // Verify the crypto module fails without ELECTION_SECRET
    delete process.env.ELECTION_SECRET;
    expect(isElectionCryptoReady().ready).toBe(false);

    // Restore
    process.env.ELECTION_SECRET = TEST_SECRET;
  });

  it("11. Voter hash is deterministic (same inputs = same hash)", async () => {
    const hash1 = await generateVoterHash(electionId, 1);
    const hash2 = await generateVoterHash(electionId, 1);
    expect(hash1).toBe(hash2);
  });

  it("12. Different voters produce different hashes", async () => {
    const hash1 = await generateVoterHash(electionId, 1);
    const hash2 = await generateVoterHash(electionId, 2);
    expect(hash1).not.toBe(hash2);
  });

  it("13. Different elections produce different hashes for same voter", async () => {
    const hash1 = await generateVoterHash(100, 1);
    const hash2 = await generateVoterHash(200, 1);
    expect(hash1).not.toBe(hash2);
  });

  it("14. Hash is not reversible — cannot recover voterId", async () => {
    const hash = await generateVoterHash(electionId, 12345);

    // Hash should not contain the voterId
    expect(hash).not.toContain("12345");

    // Hash should be a hex string with prefix
    expect(hash).toMatch(/^evh_\d+_[a-f0-9]+$/);
  });

  it("15. Duplicate voting prevention via hash", async () => {
    const hash1 = await generateVoterHash(electionId, 1);
    const hash2 = await generateVoterHash(electionId, 1);

    // Same voter → same hash → can be detected as duplicate
    expect(hash1).toBe(hash2);

    // Different voter → different hash → allowed
    const hash3 = await generateVoterHash(electionId, 2);
    expect(hash1).not.toBe(hash3);
  });
});

// ============================================================================
// Key Versioning Tests
// ============================================================================

describe("Key Versioning", () => {
  it("16. Versioned ciphertext roundtrips correctly", async () => {
    const ballotData = { candidateId: 7 };
    const electionId = 42;

    const { ciphertext, iv, authTag, keyVersion } = await encryptBallot(ballotData, electionId);
    const versioned = serializeVersionedCiphertext(keyVersion, ciphertext, authTag);

    // Parse back
    const parsed = parseVersionedCiphertext(versioned);
    expect(parsed.keyVersion).toBe(keyVersion);
    expect(parsed.ciphertext).toBe(ciphertext);
    expect(parsed.authTag).toBe(authTag);

    // Decrypt
    const decrypted = await decryptBallot(
      parsed.ciphertext, iv, parsed.authTag, parsed.keyVersion, electionId
    );
    expect(decrypted).toEqual(ballotData);
  });

  it("17. Historical election ballots remain decryptable with correct key version", async () => {
    const ballotData = { candidateId: 7 };
    const electionId = 42;
    const currentVersion = getCurrentKeyVersion();

    // Encrypt with current version
    const { ciphertext, iv, authTag } = await encryptBallot(ballotData, electionId, currentVersion);

    // Decrypt with same version
    const decrypted = await decryptBallot(ciphertext, iv, authTag, currentVersion, electionId);
    expect(decrypted).toEqual(ballotData);
  });

  it("18. Key rotation does not break historical elections", async () => {
    const ballotData = { candidateId: 7 };
    const electionId = 42;
    const oldVersion = 1;

    // Encrypt with version 1
    const { ciphertext, iv, authTag } = await encryptBallot(ballotData, electionId, oldVersion);

    // Even if current version changes, old version still decrypts
    const decrypted = await decryptBallot(ciphertext, iv, authTag, oldVersion, electionId);
    expect(decrypted).toEqual(ballotData);
  });
});

// ============================================================================
// Fail-Closed Tests
// ============================================================================

describe("Fail-Closed Behavior", () => {
  it("19. Missing election secret fails closed on encryption", async () => {
    delete process.env.ELECTION_SECRET;

    await expect(
      encryptBallot({ candidateId: 1 }, 42)
    ).rejects.toThrow(/ELECTION_SECRET/);

    process.env.ELECTION_SECRET = TEST_SECRET;
  });

  it("20. Missing election secret fails closed on voter hashing", async () => {
    delete process.env.ELECTION_SECRET;

    await expect(
      generateVoterHash(42, 1)
    ).rejects.toThrow(/ELECTION_SECRET/);

    process.env.ELECTION_SECRET = TEST_SECRET;
  });

  it("21. Short secret is flagged as insecure", () => {
    process.env.ELECTION_SECRET = "short";
    const result = isElectionCryptoReady();
    expect(result.ready).toBe(false);
    expect(result.reason).toContain("32 characters");

    process.env.ELECTION_SECRET = TEST_SECRET;
  });

  it("22. Valid secret is reported as ready", () => {
    process.env.ELECTION_SECRET = TEST_SECRET;
    const result = isElectionCryptoReady();
    expect(result.ready).toBe(true);
  });
});
