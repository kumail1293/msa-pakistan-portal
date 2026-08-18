# Security Audit Summary

Date: 2026-08-13

## Results

| # | Category | Status | Report | Plan |
|---|----------|--------|--------|------|
| 1 | SECRETS_EXPOSURE | PASS | [report](reports/SECRETS_EXPOSURE_REPORT.md) | [plan](plans/SECRETS_EXPOSURE_PLAN.md) |
| 2 | DATABASE_ACCESS | MEDIUM → FIXED | [report](reports/DATABASE_ACCESS_REPORT.md) | [plan](plans/DATABASE_ACCESS_PLAN.md) |
| 3 | AUTH_MIDDLEWARE | MEDIUM → FIXED | [report](reports/AUTH_MIDDLEWARE_REPORT.md) | [plan](plans/AUTH_MIDDLEWARE_PLAN.md) |
| 4 | ACCESS_CONTROL | MEDIUM → FIXED | [report](reports/ACCESS_CONTROL_REPORT.md) | [plan](plans/ACCESS_CONTROL_PLAN.md) |
| 5 | FRONTEND_SECRETS | MEDIUM (latent) → HARDENED | [report](reports/FRONTEND_SECRETS_REPORT.md) | [plan](plans/FRONTEND_SECRETS_PLAN.md) |
| 6 | SSRF | PASS | [report](reports/SSRF_REPORT.md) | [plan](plans/SSRF_PLAN.md) |
| 7 | CSRF | MEDIUM → FIXED | [report](reports/CSRF_REPORT.md) | [plan](plans/CSRF_PLAN.md) |
| 8 | SECURITY_HEADERS | HIGH → FIXED | [report](reports/SECURITY_HEADERS_REPORT.md) | [plan](plans/SECURITY_HEADERS_PLAN.md) |
| 9 | CORS | LOW → HARDENED | [report](reports/CORS_REPORT.md) | [plan](plans/CORS_PLAN.md) |
| 10 | RATE_LIMITING | HIGH → FIXED | [report](reports/RATE_LIMITING_REPORT.md) | [plan](plans/RATE_LIMITING_PLAN.md) |
| 11 | SQL_INJECTION | PASS | [report](reports/SQL_INJECTION_REPORT.md) | [plan](plans/SQL_INJECTION_PLAN.md) |
| 12 | XSS | MEDIUM → FIXED | [report](reports/XSS_REPORT.md) | [plan](plans/XSS_PLAN.md) |
| 13 | PAYMENT_WEBHOOKS | N/A | [report](reports/PAYMENT_WEBHOOKS_REPORT.md) | [plan](plans/PAYMENT_WEBHOOKS_PLAN.md) |
| 14 | FILE_UPLOADS | MEDIUM → FIXED | [report](reports/FILE_UPLOADS_REPORT.md) | [plan](plans/FILE_UPLOADS_PLAN.md) |
| 15 | ERROR_HANDLING | MEDIUM → FIXED | [report](reports/ERROR_HANDLING_REPORT.md) | [plan](plans/ERROR_HANDLING_PLAN.md) |
| 16 | PASSWORD_HASHING | PASS | [report](reports/PASSWORD_HASHING_REPORT.md) | [plan](plans/PASSWORD_HASHING_PLAN.md) |
| 17 | DEPENDENCIES | HIGH → MITIGATED | [report](reports/DEPENDENCIES_REPORT.md) | [plan](plans/DEPENDENCIES_PLAN.md) |

## Critical issues

**None remaining.** The single critical advisory (fast-xml-parser, via the
unused AWS SDK) was removed by dropping the unused SDK; a CRITICAL-to-HIGH
dependency set (81 advisories) was reduced to 6 residual low-practical-risk
`lodash` advisories that have no published fix (patched version `4.18.0` does
not exist on npm).

## Significant fixes made

1. **Auth**: `admin.getDashboard` / `getConfiguration` / `updateConfiguration`
   now use `adminProcedure` (403 instead of a 500 from a bare `Error`).
2. **CSRF**: session cookies are now `SameSite=Lax` on both http and https
   (was `None` in production).
3. **Rate limiting**: login (10/15min), password setup (10/15min), token info
   (30/15min) and membership submission (5/15min), keyed on the socket IP —
   `X-Forwarded-For` is never trusted. New unit tests included.
4. **Headers**: CSP + HSTS (prod) and X-Content-Type-Options, X-Frame-Options,
   Referrer-Policy, Permissions-Policy always, via one global middleware;
   fail-closed CORS same-origin guard; global error handler + tRPC `onError`.
5. **DB**: fixed a `eq(a) && eq(b)` condition-combining bug that silently
   dropped session scoping in `castVote` / `getUserVote`.
6. **Uploads**: magic-byte validation (JPEG/PNG/WebP/GIF/PDF) on the
   membership form's three uploads; body limit 50mb → 30mb.
7. **XSS**: all email templates now escape dynamic values and restrict link
   schemes (`safeLink`).
8. **Access control**: directory profiles are Active-members-only; storage
   proxy keys are allowlisted.
9. **Dependencies**: bumped tRPC/axios/drizzle/nanoid, dropped unused AWS SDK,
   added seven pnpm overrides. `pnpm audit --prod`: 81 → 6.
10. **Dev testing gap**: added production-gated `auth.devCreateTestAdmin` so
    the admin login path is exercisable in dev (member helper already existed).

## Verification performed

- `pnpm check` (tsc --noEmit) — clean
- `pnpm test` — 30/30 pass (incl. new rate-limit tests; logout test updated
  for the intentional `SameSite=Lax` change)
- `pnpm audit --prod` — 6 residual (4 moderate | 2 high), no criticals
- Real browser login flows (member + admin) — all pass, screenshots in
  `screenshots/login/`
- Security headers/CORS/rate-limit behaviors verified in code + unit tests

## Remaining manual verification (for the human)

1. Deploy behind TLS and run `curl -sI https://<portal>/` — confirm
   `content-security-policy`, `strict-transport-security`,
   `x-content-type-options`, `x-frame-options`, `referrer-policy`.
2. When Supabase is adopted: enable RLS on every table, scope policies to
   `auth.uid()`, verify the anon key gets 403/empty.
3. Before enabling Google Maps: restrict `VITE_FRONTEND_FORGE_API_KEY` by
   HTTP referrer and confirm it differs from `BUILT_IN_FORGE_API_KEY`.
4. Add `pnpm audit --prod` to CI.
5. When lodash 4.18.0 (or a lodash-free recharts/mermaid) ships, re-run the
   audit and upgrade.
6. Raise scrypt `SCRYPT_N` to 2^17 (with `maxmem`) when login-latency budget
   allows — the stored hash format already supports mixed parameters.
