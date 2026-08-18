# RATE_LIMITING Security Report

## Status: HIGH → FIXED

## Findings

### Before

There was **no rate limiting anywhere**. Every auth endpoint was wide open:

| Endpoint | Exposure |
|---|---|
| `auth.login` | unlimited online password guessing |
| `auth.setupPassword` | unlimited attempts against a setup token |
| `auth.setupTokenInfo` | unlimited queries (token is 256-bit random, so guessing is infeasible, but still unbounded work) |
| `membershipForm.submit` | unlimited public submissions → Apps Script spam + SMTP load |
| `admin.members.syncApprovedMember` | admin-only; gated by role (no limiter needed) |

The only throttle was `shouldReconcile()` — a 60-second per-identifier
cooldown on the Apps Script reconciliation lookup. Useful, but: (a) it only
guarded the registry lookup, not password verification; (b) its backing map
grew **without bound** (an attacker cycling identifiers could exhaust memory).

### After

- New `server/_core/rateLimit.ts` — in-memory sliding-window limiter keyed on
  `req.socket.remoteAddress`. **`X-Forwarded-For` is never read**, so the
  limit cannot be bypassed by spoofing that header. Bucket count is capped
  (10k) with pruning.
- New `rateLimitedProcedure(limit, windowMs)` in `server/_core/trpc.ts` —
  throws tRPC `TOO_MANY_REQUESTS` (HTTP **429**) past the limit.
- Applied:
  - `auth.login` — **10 / 15 min / IP**
  - `auth.setupPassword` — **10 / 15 min / IP**
  - `auth.setupTokenInfo` — **30 / 15 min / IP**
  - `membershipForm.submit` — **5 / 15 min / IP**
- `reconciliationCooldowns` is now capped at 5,000 entries with expired-entry
  pruning before resetting.

Trade-off note: keying purely by IP means a shared NAT (e.g. a campus or
office) shares one budget. That is the safe direction for a brute-force
limiter and matches the audit's requirements; it can be relaxed to
per-identifier-per-IP with a store once a database is provisioned.

## What's at risk

- (Before) Brute-forceable login, spam-able registration, unbounded memory
  growth from the cooldown map.
- (Current) Rate-limited auth; spoofing `X-Forwarded-For` does not bypass it.

## What's already secure

- Generic login error (no account enumeration) combined with the limiter.
- `devCreateTestMember` is production-gated.
- The cooldown map now has a hard size cap.

## Recommendations

1. ✅ Done — limiter + procedure-level enforcement on all four public
   auth/form endpoints.
2. When a DB store is available, persist buckets (or use
   `express-rate-limit` behind a trusted proxy) so restarts don't reset
   windows.
3. Monitor 429s in logs; tune the membership-form limit (5/15min) if the
   council ever runs form-screening drives that legitimately exceed it.
