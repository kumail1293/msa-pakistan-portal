# SECRETS_EXPOSURE Fix Plan

## Changes

- `.env.example` — add a comment under the Forge keys documenting that
  `VITE_FRONTEND_FORGE_API_KEY` (if ever set) must be a Google-Maps-only key
  distinct from `BUILT_IN_FORGE_API_KEY`, restricted by HTTP referrer, and
  never reused for storage presigning.

## New files

None.

## Verification goals

- [x] `git ls-files .env` returns nothing
- [x] `grep -rn` for secret patterns (`sk_live_`, `AKIA`, `ghp_`, `AIza`,
      `password = "<literal>"`) across all source files returns nothing
- [x] No `VITE_` env var is documented as holding a storage-capable secret
- [x] `.env.example` exists with placeholder values only

## Manual verification (for the human)

- After setting up the real deployment, run `git ls-files | grep -i env` and
  confirm only `.env.example` (and `.gitignore`) appear.
- If `VITE_FRONTEND_FORGE_API_KEY` is ever set, verify in Google Cloud Console
  that the key is HTTP-referrer-restricted to the portal domain and is a
  separate key from the server Forge key.
