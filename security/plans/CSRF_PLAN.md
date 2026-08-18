# CSRF Fix Plan

## Changes

- `server/_core/cookies.ts` — set `sameSite: "lax"` unconditionally
  (previously `secure ? "none" : "lax"`, which shipped `SameSite=None` in
  production).

## New files

None (the CORS same-origin guard and security headers live in
`server/_core/securityMiddleware.ts`, see categories 8 & 9).

## Verification goals

- [x] `grep -n sameSite server/_core/cookies.ts` shows `sameSite: "lax"`
- [x] No `sameSite: "none"` remains anywhere
- [x] Typecheck passes
- [x] Existing `auth.logout` test still passes (session cookie flow intact)
- [ ] A cross-origin form POST to any state-changing endpoint does not change
      state (manual)

## Manual verification (for the human)

- In a browser, craft `fetch("https://portal.example/api/trpc/voting.submitVote", {method:"POST", credentials:"include", ...})` from `https://evil.example` → must fail CORS (no `Access-Control-Allow-Origin`).
- Log in on the real site, then visit `https://evil.example` and confirm no
  session cookie is sent on any cross-site request (DevTools → Network →
  cookies column).
