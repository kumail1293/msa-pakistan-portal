# SECURITY_HEADERS Security Report

## Status: HIGH → FIXED

## Findings

Before this audit, `server/_core/index.ts` set **no** security headers on any
response. `server/_core/vite.ts` (dev) and the static server (prod) served
raw responses with Express defaults.

Now `server/_core/securityMiddleware.ts` is registered globally (before any
route) and sets:

| Header | Value | Always / prod |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' [forge origin]; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https: [forge]; connect-src 'self' [forge]; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'` | production |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | production |
| `X-Frame-Options` | `DENY` | always |
| `X-Content-Type-Options` | `nosniff` | always |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | always |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` | always |

Notes:
- CSP is production-only because Vite's dev HMR requires inline/eval scripts;
  the other five headers apply in dev too.
- `style-src 'unsafe-inline'` is required because the React components set
  inline `style` props (Tailwind UI kit) — a pragmatic, low-risk allowance.
- `script-src 'self'` blocks all third-party scripts; the Google Maps loader
  origin is added dynamically only when `BUILT_IN_FORGE_API_URL` is set.
- HSTS is production-only (invalid over plain http; harmless in dev either
  way since dev runs on http://localhost).

## What's at risk

- (Before) No CSP: any injected script would run; clickjacking possible
  (no frame protections); MIME sniffing on user-uploaded content; referrer
  leakage.
- (Current) The five standard headers plus CSP/HSTS are present on every
  response, set in one global middleware.

## What's already secure

- No third-party analytics scripts remain in `client/index.html` (umami was
  removed earlier).
- React's default escaping prevents most XSS payloads (see category 12).

## Recommendations

1. ✅ Done — global header middleware.
2. When the map feature ships, confirm the Forge proxy origin is the only
   addition to `script-src`.
3. Re-run `curl -I` on every route after deploy and check the five headers.
