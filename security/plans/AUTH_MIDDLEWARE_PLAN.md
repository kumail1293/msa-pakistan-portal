# AUTH_MIDDLEWARE Fix Plan

## Changes

- `server/routers.ts`
  - `admin.getDashboard`, `admin.getConfiguration`,
    `admin.updateConfiguration`: change `protectedProcedure` + inline role
    check to `adminProcedure` (returns 403 with the standard
    `NOT_ADMIN_ERR_MSG`).
  - `document.generateMembershipLetter` / `generateMembershipCard` /
    `generateCertificate`: remove the unreachable `!ctx.user` guard that
    threw a bare `Error`.
  - Remove the dead `membership.submitApplication` stub (fake
    `MSAP-PENDING-001`); keep `membership.getLocalCouncils`.

## New files

None.

## Verification goals

- [x] `grep -n "throw new Error" server/routers.ts` returns nothing
- [x] Every admin route uses `adminProcedure` (verified by review)
- [x] Every member-data route uses `protectedProcedure`
- [x] Typecheck passes
- [x] Existing auth tests still pass (`pnpm test`)
- [ ] Non-admin session calling `admin.getDashboard` receives 403
      (see manual verification)

## Manual verification (for the human)

- With an admin account, open `/admin/dashboard` — must render.
- Sign out (or use a member account) and call `admin.getDashboard` from the
  browser devtools: expect tRPC error code `FORBIDDEN` (HTTP 403), not 500.
- Confirm `/login` still works end-to-end after the router changes.
