# RATE_LIMITING Fix Plan

## Changes

- `server/_core/rateLimit.ts` (new) — `checkRateLimit(key, limit, windowMs)`
  sliding window keyed by socket address; capped bucket map.
- `server/_core/trpc.ts` — `rateLimitedProcedure(limit, windowMs)` middleware
  that throws `TOO_MANY_REQUESTS` when over the limit.
- `server/routers.ts`
  - `auth.login` → `rateLimitedProcedure(10, 15min)`
  - `auth.setupPassword` → `rateLimitedProcedure(10, 15min)`
  - `auth.setupTokenInfo` → `rateLimitedProcedure(30, 15min)`
  - `membershipForm.submit` → `rateLimitedProcedure(5, 15min)`
  - Cap `reconciliationCooldowns` at 5,000 entries with expiry pruning.
- `server/_core/rateLimit.test.ts` (new) — unit tests for the window.

## New files

- `server/_core/rateLimit.ts`
- `server/_core/rateLimit.test.ts`

## Verification goals

- [x] Login, password setup and membership submission are rate limited
- [x] Limit triggers after the configured count (unit-tested)
- [x] Limiter keys on `req.socket.remoteAddress` — no `X-Forwarded-For`
      (`grep -rn "x-forwarded-for" server/_core/rateLimit.ts` empty)
- [x] Over-limit requests return HTTP 429 / tRPC `TOO_MANY_REQUESTS`
- [x] Typecheck passes; full test suite passes

## Manual verification (for the human)

- From one IP, call `auth.login` 11 times with a wrong password: the 11th
  must return code `TOO_MANY_REQUESTS` (429).
- Send `X-Forwarded-For: 1.2.3.4` with different values on each attempt —
  the limit must still trigger (header ignored).
- Confirm the membership form still submits normally in the browser
  (well under 5/15min).
