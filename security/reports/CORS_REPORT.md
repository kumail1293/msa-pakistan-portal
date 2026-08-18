# CORS Security Report

## Status: LOW → HARDENED

## Findings

- There was **no CORS middleware** at all: no `Access-Control-Allow-Origin`
  header is ever emitted, so browsers block cross-origin reads of the API by
  default. The client talks only to its own origin (`/api/trpc`, Vite proxy in
  dev, same host in prod).
- No wildcard, no credential reflection, no dynamic origin echo exists
  anywhere.
- The remaining exposure: the server would happily **process** a cross-origin
  request (e.g. an attacker's server-side script or a browser extension)
  without an Origin check. CSRF-style state changes were already mitigated by
  SameSite=Lax cookies (category 7) and the JSON-only body parser, but the
  server had no opinion about Origin.

Hardenings added in `server/_core/securityMiddleware.ts`:

1. Never emit `Access-Control-Allow-Origin` (nothing changes).
2. A global guard: when a request carries an `Origin` header, it must match
   the request `Host` (scheme-insensitive). Mismatches are **rejected with
   403 in production** and logged + allowed in dev (browser-extension
   tooling sends arbitrary Origins during local development).

## What's at risk

- (Before) Cross-origin automated requests were processed — benign for reads,
   but a wasted layer for writes.
- (Current) Cross-origin requests are rejected at the edge in production.

## What's already secure

- Same-origin-only architecture (tRPC on the same host; no separate API
  domain that would even invite CORS config).
- No credentials-across-origin scenario exists.

## Recommendations

1. ✅ Done — fail-closed same-origin guard in production.
2. If a future integration needs a genuine cross-origin client (e.g. a public
   website consuming the API), add an explicit allowlist of actual domains —
   never a wildcard, and only pair `credentials: true` with specific origins.
