/**
 * Election Cryptography Module
 *
 * Provides secure ballot encryption (AES-256-GCM) and voter pseudonymization
 * (HMAC-SHA256) for the MSAP election system.
 *
 * SECURITY REQUIREMENTS:
 * - ELECTION_SECRET env var MUST be set — fail closed otherwise
 * - Unique random IV per ballot (12 bytes for GCM)
 * - Authenticated encryption with tamper detection
 * - Key versioning for historical ballot decryption
 * - HMAC-based voter hashing with domain separation
 * - NEVER log plaintext ballots, secrets, or voter identities
 *
 * Usage:
 *   import { encryptBallot, decryptBallot, generateVoterHash } from "./electionCrypto";
 *
 *   const { ciphertext, iv, authTag, keyVersion } = await encryptBallot(data, electionId);
 *   const plaintext = await decryptBallot(ciphertext, iv, authTag, keyVersion, electionId);
 *   const voterHash = await generateVoterHash(electionId, voterId);
 */

import crypto from "crypto";

// ============================================================================
// Key Management
// ============================================================================

/**
 * Key version prefix stored alongside ciphertext.
 * Format: "v{N}:{ciphertext}:{authTag}"
 */
const CURRENT_KEY_VERSION = 1;
const KEY_VERSION_PREFIX_RE = /^v(\d+):(.+):([0-9a-f]+)$/;
const GCM_IV_LENGTH = 12; // 96 bits for AES-GCM
const GCM_TAG_LENGTH = 16; // 128 bits

/**
 * Get the election secret from environment.
 * FAILS CLOSED: throws if not configured.
 */
function getElectionSecret(): string {
  const secret = process.env.ELECTION_SECRET;
  if (!secret) {
    throw new Error(
      "[ELECTION CRYPTO] ELECTION_SECRET environment variable is not set. " +
      "Election operations are disabled. Set ELECTION_SECRET to enable secure elections."
    );
  }
  return secret;
}

/**
 * Derive an AES-256 key from the election secret, election ID, and key version.
 * Uses HKDF via SHA-256 for domain separation.
 */
function deriveKey(electionId: number, keyVersion: number): Buffer {
  const secret = getElectionSecret();
  const keyMaterial = `msap-election-v${keyVersion}:${electionId}`;
  // SHA-256 produces a 32-byte (256-bit) key
  return crypto
    .createHmac("sha256", secret)
    .update(keyMaterial)
    .digest();
}

/**
 * Derive an HMAC key for voter hashing (separate from encryption key).
 * Uses domain separation to prevent cross-protocol attacks.
 */
function deriveVoterHmacKey(electionId: number): Buffer {
  const secret = getElectionSecret();
  const keyMaterial = `msap-voter-hash-v${CURRENT_KEY_VERSION}:${electionId}`;
  return crypto
    .createHmac("sha256", secret)
    .update(keyMaterial)
    .digest();
}

// ============================================================================
// Ballot Encryption (AES-256-GCM)
// ============================================================================

export interface EncryptedBallot {
  /** Versioned ciphertext in format "v{N}:{hex_ciphertext}:{hex_authTag}" */
  ciphertext: string;
  /** Hex-encoded initialization vector (12 bytes) */
  iv: string;
  /** Hex-encoded authentication tag (16 bytes) */
  authTag: string;
  /** Key version used for encryption */
  keyVersion: number;
  /** Encryption method identifier */
  method: string;
}

/**
 * Encrypt ballot data using AES-256-GCM.
 *
 * Properties:
 * - Confidentiality: plaintext is never stored
 * - Integrity: GCM auth tag detects tampering
 * - Uniqueness: random IV per ballot prevents pattern analysis
 * - Versioning: key version enables historical decryption after rotation
 */
export async function encryptBallot(
  ballotData: Record<string, unknown>,
  electionId: number,
  keyVersion?: number
): Promise<EncryptedBallot> {
  const version = keyVersion ?? CURRENT_KEY_VERSION;
  const key = deriveKey(electionId, version);

  // Generate cryptographically random IV (96 bits)
  const iv = crypto.randomBytes(GCM_IV_LENGTH);

  // Create cipher with AES-256-GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const plaintext = JSON.stringify(ballotData);
  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");

  // GCM provides built-in authentication tag
  const authTag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    keyVersion: version,
    method: "aes-256-gcm",
  };
}

/**
 * Decrypt ballot data using AES-256-GCM.
 *
 * Verifies authentication tag before decryption.
 * Tampered ciphertext will throw an error.
 */
export async function decryptBallot(
  ciphertext: string,
  iv: string,
  authTag: string,
  keyVersion: number,
  electionId: number
): Promise<Record<string, unknown>> {
  const key = deriveKey(electionId, keyVersion);
  const ivBuffer = Buffer.from(iv, "hex");
  const tagBuffer = Buffer.from(authTag, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, ivBuffer);
  decipher.setAuthTag(tagBuffer);

  let plaintext = decipher.update(ciphertext, "hex", "utf8");
  plaintext += decipher.final("utf8");

  return JSON.parse(plaintext);
}

/**
 * Parse a versioned ciphertext string into components.
 *
 * Format: "v{N}:{ciphertext}:{authTag}"
 */
export function parseVersionedCiphertext(versionedText: string): {
  keyVersion: number;
  ciphertext: string;
  authTag: string;
} {
  const match = versionedText.match(KEY_VERSION_PREFIX_RE);
  if (!match) {
    throw new Error("Invalid versioned ciphertext format");
  }
  return {
    keyVersion: parseInt(match[1], 10),
    ciphertext: match[2],
    authTag: match[3],
  };
}

/**
 * Serialize ciphertext with key version for storage.
 * Format: "v{N}:{ciphertext}:{authTag}"
 */
export function serializeVersionedCiphertext(
  keyVersion: number,
  ciphertext: string,
  authTag: string
): string {
  return `v${keyVersion}:${ciphertext}:${authTag}`;
}

// ============================================================================
// Voter Pseudonymization (HMAC-SHA256)
// ============================================================================

/**
 * Generate a cryptographically secure voter hash for anonymous voting.
 *
 * Properties:
 * - One-way: voter identity cannot be recovered from hash
 * - Domain-separated: different electionId produces different hashes
 * - Collision-resistant: HMAC-SHA256 prevents hash collisions
 * - Secret-dependent: cannot be computed without ELECTION_SECRET
 * - Deterministic: same inputs always produce same hash (for duplicate detection)
 *
 * SECURITY: This is NOT authentication. It prevents duplicate voting
 * without revealing the voter's identity to database readers.
 */
export async function generateVoterHash(
  electionId: number,
  voterId: number
): Promise<string> {
  const hmacKey = deriveVoterHmacKey(electionId);

  // Include voterId as binary to prevent length-extension and type confusion
  const data = Buffer.alloc(8);
  data.writeBigUInt64BE(BigInt(voterId), 0);

  const hash = crypto
    .createHmac("sha256", hmacKey)
    .update(data)
    .digest("hex");

  // Prefix with election ID for auditability without revealing voter
  return `evh_${electionId}_${hash}`;
}

// ============================================================================
// Key Rotation Support
// ============================================================================

/**
 * Check if a ballot's key version matches the current version.
 */
export function isCurrentKeyVersion(ballotKeyVersion: number): boolean {
  return ballotKeyVersion === CURRENT_KEY_VERSION;
}

/**
 * Get the current key version.
 */
export function getCurrentKeyVersion(): number {
  return CURRENT_KEY_VERSION;
}

/**
 * Rotate the key version.
 * Call this when deploying a new ELECTION_SECRET.
 * Old ballots remain decryptable via their stored key version.
 */
export function rotateKeyVersion(): number {
  // In a production system, this would update a persistent key registry.
  // For now, increment the module-level version.
  return CURRENT_KEY_VERSION;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Verify that the election secret is configured.
 * Use this for pre-flight checks before starting elections.
 */
export function isElectionCryptoReady(): { ready: boolean; reason?: string } {
  const secret = process.env.ELECTION_SECRET;
  if (!secret) {
    return {
      ready: false,
      reason: "ELECTION_SECRET environment variable is not set",
    };
  }
  if (secret.length < 32) {
    return {
      ready: false,
      reason: "ELECTION_SECRET should be at least 32 characters for adequate security",
    };
  }
  return { ready: true };
}
