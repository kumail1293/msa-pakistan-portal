/**
 * Member Authentication Service - Core Utilities
 *
 * Handles password-based authentication for approved MSAP members.
 *
 * SECURITY NOTES
 * - Passwords are hashed with scrypt (memory-hard, salted) - never stored or
 *   logged in plaintext, and never returned to the client.
 * - Setup tokens are high-entropy random bytes; only a SHA-256 digest is
 *   persisted, and the raw value is never logged.
 */

import { createHash, randomBytes, scrypt, timingSafeEqual } from "crypto";
import type { User } from "../../drizzle/schema";

/** Promise wrapper around Node's scrypt with explicit cost parameters. */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

// scrypt cost parameters (OWASP-recommended for interactive logins).
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_BYTES = 16;

/** Member session lifetime - 30 days. */
export const MEMBER_SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

// Minimum password requirements (kept student-friendly).
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Generate a secure random token (hex). Used for one-time password setup
 * links. High entropy means the stored SHA-256 digest is safe.
 */
export function generateSecureToken(bytes: number = 32): string {
  return randomBytes(bytes).toString("hex");
}

/**
 * Hash a raw token before persisting. Only the digest is stored - the raw
 * token can never be recovered from the database.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Hash a password with scrypt. The stored format is self-describing so the
 * cost parameters can be raised in the future without breaking old hashes:
 *
 *   scrypt$N$r$p$saltHex$hashHex
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const derived = (await scryptAsync(
    password,
    salt,
    SCRYPT_KEYLEN,
    { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }
  )) as Buffer;
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("hex"),
    derived.toString("hex"),
  ].join("$");
}

/**
 * Verify a password against a stored scrypt hash. Uses a constant-time
 * comparison to avoid timing side channels.
 */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    // Unknown or legacy hash format - treat as invalid, never throw.
    return false;
  }
  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!N || !r || !p) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  try {
    const derived = (await scryptAsync(password, salt, expected.length, {
      N,
      r,
      p,
    })) as Buffer;
    return (
      derived.length === expected.length && timingSafeEqual(derived, expected)
    );
  } catch {
    return false;
  }
}

/**
 * Validate password strength.
 *
 * Rules (deliberately student-friendly):
 * - minimum 8 characters
 * - at least one letter and one digit
 * Stronger passwords (upper + lower + digit) are encouraged via the client
 * strength meter but not forced.
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`
    );
  }
  if (!/[a-zA-Z]/.test(password)) {
    errors.push("Password should contain at least one letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password should contain at least one number");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Strip every credential/secret/sensitive field from a user row before it is
 * sent to the browser. Never leak password hashes, setup-token digests or the
 * full CNIC.
 */
export function toPublicUser(user: User) {
  const {
    passwordHash: _passwordHash,
    setupTokenHash: _setupTokenHash,
    setupTokenExpiresAt: _setupTokenExpiresAt,
    setupTokenUsedAt: _setupTokenUsedAt,
    cnic: _cnic,
    ...safe
  } = user;
  return safe;
}

export type PublicUser = ReturnType<typeof toPublicUser>;
