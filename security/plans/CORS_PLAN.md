# CORS Fix Plan

## Changes

- `server/_core/securityMiddleware.ts` (new) — same-origin guard: if an
  `Origin` header is present and does not match the request `Host`, reject
  with 403 in production (log-and-continue in dev). No
  `Access-Control-Allow-Origin` header is ever emitted.
- `server/_core/index.ts` — registered globally before routes.

## New files

- `server/_core/securityMiddleware.ts`

## Verification goals

- [x] No `Access-Control-Allow-Origin` anywhere in the codebase
- [x] No wildcard origin configuration
- [x] Production rejects cross-origin requests (403) — verified by curl with
      a spoofed Origin
- [x] Same-origin requests (with matching Origin or no Origin) are unaffected
- [x] Typecheck passes; tests pass

## Manual verification (for the human)

- `curl -sI -H "Origin: https://evil.example" http://localhost:3000/` in a
  production build → 403. (In dev it logs a warning and continues.)
- `curl -sI http://localhost:3000/` → 200 with no `access-control-allow-origin`
  header.
- Confirm the SPA works normally (same-origin fetches carry no Origin for GET,
  and POSTs carry the matching Origin).
