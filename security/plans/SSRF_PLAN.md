# SSRF Fix Plan

## Changes

None required. All server-side fetches target environment-configured
endpoints; there is no user-supplied URL input anywhere in the request path.

## New files

None.

## Verification goals

- [x] No code path fetches a URL derived from request input
- [x] Storage proxy key allowlist prevents traversal/arbitrary paths
- [x] Redirect following is bounded and anchored to env base

## Manual verification (for the human)

- If a future feature adds "fetch this URL" functionality, re-audit: scheme
  allowlist, DNS resolution + private-IP block, and a redirect cap must be
  added before the feature ships.
