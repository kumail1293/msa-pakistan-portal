# ERROR_HANDLING Fix Plan

## Changes

- `server/_core/index.ts`
  - Add `onError` to the `createExpressMiddleware` options: log every
    unexpected error server-side (with `type`/`path`); non-500 TRPCErrors are
    intentional and not re-logged at error level.
  - Register `registerErrorHandler(app)` after all routes.
- `server/_core/securityMiddleware.ts` (new) — `registerErrorHandler`:
  console.error the full error, return generic `500 Internal server error.`

## New files

- `server/_core/securityMiddleware.ts`

## Verification goals

- [x] Global error handler catches unhandled exceptions (registered last)
- [x] Client responses contain only generic or intentional messages
- [x] No stack traces / SQL errors / file paths in any API response
- [x] `grep -rn "throw new Error" server/` shows only intentional,
      message-sanitized throws
- [x] Typecheck passes; tests pass

## Manual verification (for the human)

- Temporarily throw in a test route (or trigger an SMTP failure) and confirm
  the client sees a generic message while the server log has the detail.
- Confirm `/manus-storage/bad-key` returns 400/502-style generic messages,
  never internal text.
