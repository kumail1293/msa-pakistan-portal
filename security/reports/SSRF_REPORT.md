# SSRF Security Report

## Status: PASS

## Findings

Inventory of every server-side outbound fetch in the codebase:

| Location | URL source | User-controlled? |
|---|---|---|
| `server/storage.ts` — presign PUT/GET | `ENV.forgeApiUrl` (env) | No |
| `server/_core/storageProxy.ts` | `ENV.forgeApiUrl` (env) | No |
| `server/_core/map.ts` — Maps proxy | `ENV.forgeApiUrl` (env); `endpoint`/`params` come from code callers | No |
| `server/_core/llm.ts` | `ENV`-configured endpoint | No |
| `server/services/googleSheetsService.ts` — Apps Script bridge | `MSAP_APPS_SCRIPT_URL` (env) | No |
| `server/services/emailService.ts` — nodemailer | `SMTP_HOST` (env) | No |
| `server/_core/imageGeneration.ts` | `ENV.forgeApiUrl` | No |

There is **no user-supplied URL fetching**: no link previews, no
import-from-URL, no webhook URL testing, no image proxy that accepts arbitrary
URLs, no open redirect. The only path-ish input is the storage **key**, which
is server-generated (UUID + random suffix) and now allowlisted
(`/^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/` — see ACCESS_CONTROL), so it cannot
be pointed at an arbitrary host.

The Apps Script bridge follows redirects explicitly
(`postJsonWithAppsScriptRedirect`, max 3 hops) — the redirect location is
relative to the configured Apps Script URL, which is env-owned.

## What's at risk

Nothing. An attacker cannot induce the server to fetch an arbitrary internal
address.

## What's already secure

- All fetch targets derive from environment configuration, never request
  input.
- Storage keys are allowlisted and server-generated.
- Redirect following is bounded (3 hops) and anchored to the env-configured
  base.

## Recommendations

1. Keep it this way: if a "preview link" or "import from URL" feature is ever
   added, validate scheme (http/https only), resolve the hostname, and block
   private/loopback ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12,
   192.168.0.0/16, 169.254.0.0/16, ::1, fc00::/7) before requesting.
