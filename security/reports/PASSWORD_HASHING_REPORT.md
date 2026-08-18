# PASSWORD_HASHING Security Report

## Status: PASS (with a LOW recommendation)

## Findings

`server/services/memberAuthService.ts` implements password hashing with
**scrypt** — not a third-party auth provider, so this category applies:

- **Algorithm:** Node `crypto.scrypt` (memory-hard, salted).
- **Parameters:** `N=16384` (2^14), `r=8`, `p=1`, key length **64 bytes**,
  16-byte random salt per password.
- **Storage format (self-describing):**
  `scrypt$16384$8$1$<saltHex>$<hashHex>` — cost parameters ride along, so they
  can be raised later without breaking existing hashes.
- **Verification:** constant-time compare via `crypto.timingSafeEqual`; wrong
  or malformed formats return `false` (never throw).
- **No weak algorithms:** no MD5, SHA-1, or plain SHA-256 is used for
  passwords anywhere. (SHA-256 is used only for setup **tokens**, which are
  256-bit random secrets — hashing them for at-rest storage is correct.)
- Setup tokens: 32 random bytes, stored only as SHA-256 digests, single-use,
  expiring (24h default).

**LOW recommendation:** OWASP's current scrypt guidance suggests `N=2^17`
with `r=8`. `N=2^14` (16 MiB) is below that but still respectable for
interactive logins and is a deliberate choice to keep login latency low on
shared hosting. Because the stored format is self-describing, raising N later
only requires changing the two constants. Existing hashes continue to verify
with their original parameters.

## What's at risk

Nothing currently. Scrypt with a 64-byte derived key and 16-byte salt is not
feasibly brute-forceable at these parameters for 8+-character passwords.

## What's already secure

- Memory-hard KDF (scrypt) with per-password salt.
- Constant-time comparison.
- Password hashes never leave the server (`toPublicUser` strips them).
- Setup tokens stored as digests only; raw tokens never logged.

## Recommendations

1. When convenient, raise `SCRYPT_N` to `2^17` (requires `maxmem` bump in the
   scrypt call — the params are ready for it in the format string).
2. Existing accounts keep working across any future parameter bump.
