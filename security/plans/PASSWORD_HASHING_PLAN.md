# PASSWORD_HASHING Fix Plan

## Changes

None required — scrypt is in use with correct structure (salted, memory-hard,
constant-time verification).

Optional future change (documented in the report): raise `SCRYPT_N` from
`16384` to `131072` (2^17) when login latency budget allows, passing
`maxmem: 256 * 1024 * 1024` to the scrypt call. The stored format
(`scrypt$N$r$p$salt$hash`) already supports mixed parameters, so old hashes
keep verifying.

## New files

None.

## Verification goals

- [x] Passwords hashed with scrypt only — no MD5/SHA-1/SHA-256 on passwords
- [x] `timingSafeEqual` used for verification
- [x] Salts are random per password (existing test asserts this)
- [x] Test suite passes (password hashing round-trip covered)

## Manual verification (for the human)

- After a password setup, open the user store: the `passwordHash` field
  starts with `scrypt$16384$8$1$` and never contains the plaintext.
