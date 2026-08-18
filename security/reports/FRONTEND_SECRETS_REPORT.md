# FRONTEND_SECRETS Security Report

## Status: MEDIUM (latent) → HARDENED

## Findings

Searched every file under `client/src/` and `client/public/` plus all
client-side network calls.

1. **No secret keys in frontend code.** The only API-key references are:

   - `client/src/components/Map.tsx:89` —
     `const API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;`
     (Google Maps JS API key for the `MapView` component)
   - `client/src/lib/trpc.ts` / `main.tsx` — tRPC calls to the **same-origin**
     `/api/trpc` endpoint (no third-party credentials involved)

2. **The Forge storage key never appears in the client.** Storage presigning
   (`server/storage.ts`, `server/_core/storageProxy.ts`) uses
   `BUILT_IN_FORGE_API_KEY` server-side only.

3. **Latent risk (now guarded):** `MapView` would previously attempt to load
   `https://forge.../v1/maps/proxy/maps/api/js?key=<VITE key>` even with an
   empty key. If an operator ever set `VITE_FRONTEND_FORGE_API_KEY` to the
   *same* value as `BUILT_IN_FORGE_API_KEY` (both are named "FORGE" — easy to
   conflate), the browser bundle would carry a key that can **presign storage
   writes** (arbitrary file upload to the project's S3 bucket) and call the
   maps proxy. The env probe confirms both are currently **unset** (feature
   inert).

## What's at risk

- (If misconfigured) Storage-write capability published in the bundle → S3
  abuse / data tampering, plus unrestricted Maps usage billed to the project.
- (Current) Nothing — no key is present in the client.

## What's already secure

- Sensitive API calls (storage presign, Maps proxy, Apps Script bridge) all
  proxy through the backend (`/api/trpc`, `/manus-storage/*`,
  `server/services/googleSheetsService.ts`).
- No Supabase publishable key is consumed client-side.
- Zod input limits cap payload sizes before they reach the backend.

## Recommendations

1. ✅ Done — `MapView` now fails closed (no script load, console warning)
   when `VITE_FRONTEND_FORGE_API_KEY` is unset, and `encodeURIComponent`s the
   key in the URL.
2. ✅ Done — `.env.example` documents the separation requirement and the
   HTTP-referrer restriction.
3. If the map feature is enabled: create a dedicated Google Maps key in
   Cloud Console, restrict it by HTTP referrer to the portal domain, and
   verify `BUILT_IN_FORGE_API_KEY !== VITE_FRONTEND_FORGE_API_KEY` in the
   deployment's env.
