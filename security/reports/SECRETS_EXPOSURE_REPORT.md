# SECRETS_EXPOSURE Security Report

## Status: PASS

## Findings

Searched: `.env*` files, `.gitignore`, git staging state, `.env.example`, all
`server/**` and `client/**` source files, and every environment-variable
reference.

1. **`.env` is gitignored and not tracked**
   - `.gitignore` contains `# Environment variables` followed by `.env`,
     `.env.local`, `.env.development.local`, `.env.test.local`,
     `.env.production.local`.
   - `git ls-files .env` returns nothing. The repo has **no commits yet**
     (everything is staged), so there is no history to scrub.

2. **`.env.example` contains placeholders only**
   - `JWT_SECRET=`, `MSAP_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec`,
     `SUPABASE_URL=`, `SMTP_PASSWORD=`, etc. No real credential values.

3. **No hardcoded secrets in source**
   - Pattern search for `sk_live_`, `sk_test_`, `AKIA`, `ghp_`, `AIza`,
     `password = "..."`, `secret = "..."`, `api_key = "..."` across all source
     files returned **zero** matches.
   - The only `secret =` hit is `server/_core/sdk.ts:164` which *reads*
     `ENV.cookieSecret` (from `JWT_SECRET`) — correct usage, not a literal.
   - `server/_core/env.ts` maps every credential to `process.env.*`; the env
     probe confirmed `JWT_SECRET` is set (96-char, strong) while Supabase /
     DATABASE_URL / SMTP / Forge keys are unset (features inert until set).

4. **No public env vars hold secrets today**
   - `VITE_` vars in use: `VITE_APP_ID`, `VITE_FRONTEND_FORGE_API_KEY`,
     `VITE_FRONTEND_FORGE_API_URL` (client/src/components/Map.tsx). The env
     probe confirmed `VITE_FRONTEND_FORGE_API_KEY` is **unset** (inert).
   - Guard-rail added (see plan): `.env.example` now documents that
     `VITE_FRONTEND_FORGE_API_KEY` must be a Google-Maps-only key, distinct
     from the server-side `BUILT_IN_FORGE_API_KEY` (which authorizes storage
     presigning), and restricted by HTTP referrer in Google Cloud Console.

5. **SMTP / OAuth credentials are server-side only**
   - `emailService.ts` reads `SMTP_USER`/`SMTP_PASSWORD` server-side and strips
     them from error messages before they reach logs or API responses
     (`sanitizeEmailError`).

## What's at risk

Nothing currently. The residual (documented) risk is a future operator error:
setting `VITE_FRONTEND_FORGE_API_KEY` to the same value as
`BUILT_IN_FORGE_API_KEY` would publish a storage-presign-capable key in the
browser bundle. The `.env.example` note and the Map.tsx guard (category 5)
mitigate this.

## What's already secure

- `.env` ignored; no real secrets in `.env.example`
- No hardcoded credentials anywhere in source
- All secrets flow through `process.env` via `server/_core/env.ts`
- Setup tokens are stored only as SHA-256 digests; raw tokens never logged
- SMTP error messages sanitized before surfacing

## Recommendations

1. ✅ Done — add the `VITE_FRONTEND_FORGE_API_KEY` distinction note to
   `.env.example`.
2. When a real deployment exists, re-run `git ls-files .env` after `git init`
   history is created; keep `.env*` out of any future commits.
3. Rotate `JWT_SECRET` at least once per term.
