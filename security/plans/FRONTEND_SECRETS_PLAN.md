# FRONTEND_SECRETS Fix Plan

## Changes

- `client/src/components/Map.tsx` — `loadMapScript()` now returns early with a
  console warning when `VITE_FRONTEND_FORGE_API_KEY` is unset (fail closed),
  and the key is `encodeURIComponent`-escaped in the script URL.
- `.env.example` — added commented `VITE_FRONTEND_FORGE_API_URL` /
  `VITE_FRONTEND_FORGE_API_KEY` entries with a security note that the key must
  be Maps-only, referrer-restricted, and never equal to
  `BUILT_IN_FORGE_API_KEY`.

## New files

None.

## Verification goals

- [x] No secret key literals in any `client/**` file (`grep -rn` for
      `sk_live_|AKIA|ghp_|AIza|BEGIN.*PRIVATE` returns nothing)
- [x] `MapView` never loads the Maps script without a key
- [x] No `VITE_` var is documented as storage-capable
- [x] Typecheck passes

## Manual verification (for the human)

- With `VITE_FRONTEND_FORGE_API_KEY` unset, render `MapView`: console shows the
  warning and no `maps/api/js` request is made.
- Before enabling maps in production, confirm in Google Cloud Console that the
  Maps key is HTTP-referrer-restricted and is a different key from the Forge
  storage key.
