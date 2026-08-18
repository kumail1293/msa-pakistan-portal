# CSRF Security Report

## Status: MEDIUM → FIXED

## Findings

### State-changing endpoints (all tRPC mutations)

`auth.login`, `auth.setupPassword`, `auth.logout`,
`member.updateProfile`, `opportunity.submitApplication`,
`voting.submitVote`, `cvMaker.addEntry/updateEntry/deleteEntry`,
`membershipForm.submit`, `admin.email.sendTest`,
`admin.members.syncApprovedMember`, `admin.updateConfiguration`.

### Cookie configuration (before fix)

`server/_core/cookies.ts` set:

```ts
sameSite: secure ? "none" : "lax",
```

- Over **http** (dev): `Lax` — cross-site POSTs don't carry the cookie. ✅
- Over **https** (production): `SameSite=None; Secure` — the session cookie
  **is attached to cross-site requests**. ❌

`SameSite=None` is required only for genuinely cross-site auth flows (e.g.
OAuth popups on a different site). This portal is same-site, so `None` was
both unnecessary and the weakest setting in production.

### Why this was still hard to exploit (defense in depth already present)

tRPC mutations require `Content-Type: application/json` with a tRPC body. A
classic CSRF vector — a cross-origin HTML form POST — cannot set that content
type (browsers only allow `application/x-www-form-urlencoded`,
`multipart/form-data`, `text/plain` for forms), and a fetch-based cross-site
POST is blocked by CORS preflight. So practical exploitation was unlikely, but
the cookie setting should not have been the weakest link.

### FIXED

```ts
sameSite: "lax",   // always
```

`Lax` blocks the cookie on all cross-site requests (GET navigations included
for the top-level, which is fine here — no cross-site navigation depends on
the session cookie). Combined with the JSON-content-type requirement and the
new CORS same-origin guard (category 9), cross-origin state changes are
blocked at three layers.

## What's at risk

- (Before fix) A malicious site could, in principle, drive a victim's browser
  into state-changing requests carrying the session cookie — limited in
  practice by the JSON content-type requirement, but never acceptable to rely
  on.
- (Current) No CSRF vector: Lax cookies + JSON-only mutations + CORS
  same-origin guard.

## What's already secure

- `httpOnly: true` session cookies (never readable by JS).
- Login/setup flows are public by design (no session needed to attack).
- `SameSite=Lax` already applied on http (the dev environment the team uses).

## Recommendations

1. ✅ Done — `sameSite: "lax"` unconditionally.
2. Keep the JSON content-type gate (express `json()` body parser only) as-is —
   it is an effective second layer.
3. If cross-site embedding of the portal (e.g. an iframe on msapakistan.org)
   is ever required, add a `frame-ancestors` CSP directive instead of relaxing
   cookies.
