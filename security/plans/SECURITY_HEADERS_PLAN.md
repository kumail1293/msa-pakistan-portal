# SECURITY_HEADERS Fix Plan

## Changes

- `server/_core/securityMiddleware.ts` (new) — `registerSecurityMiddleware`
  sets X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
  Permissions-Policy on every response, and CSP + HSTS in production. The CSP
  is built from constants plus the configured Forge origin (for MapView).
- `server/_core/index.ts` — register the middleware before all routes.

## New files

- `server/_core/securityMiddleware.ts`

## Verification goals

- [x] All five headers present on responses (code + runtime curl check)
- [x] Headers set via a single global middleware, not per-route
- [x] CSP contains `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
      `frame-ancestors 'self'`
- [x] Typecheck passes; tests pass

## Manual verification (for the human)

- `curl -sI http://localhost:3000/` and check `x-content-type-options`,
  `x-frame-options`, `referrer-policy`, `permissions-policy`.
- After deploying behind TLS: `curl -sI https://portal.example/` and confirm
  `content-security-policy` and `strict-transport-security` are present.
- Confirm the app still functions in production mode (CSP blocks nothing that
  the app legitimately loads).
