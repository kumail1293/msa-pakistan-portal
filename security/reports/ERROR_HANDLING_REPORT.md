# ERROR_HANDLING Security Report

## Status: MEDIUM → FIXED

## Findings

### tRPC layer

- The tRPC middleware had **no `onError` handler**, so tRPC's default
  behavior applied: any generic (non-`TRPCError`) throw had its **message
  echoed into the API response** under `INTERNAL_SERVER_ERROR`. The admin
  routes previously did `throw new Error("Unauthorized")` (category 3) —
  exactly the shape that leaks strings into client responses.
- `admin.email.sendTest` rethrows `(error as Error).message` — acceptable
  because `emailService.sanitizeEmailError` strips SMTP credentials from the
  message first (verified: `config.user`, `config.pass`, `config.host` are
  redacted).

FIXED — `createExpressMiddleware` now receives `onError`:
- `TRPCError`s with non-500 codes (auth, validation, rate limit) are
  intentional and user-safe; skipped.
- `INTERNAL_SERVER_ERROR` TRPCErrors and all other throws are logged
  server-side with path/type; clients get tRPC's standard generic message.

### Express layer

- `registerStorageProxy` and OAuth routes have their own try/catch with
  generic client messages (`"Storage backend error"`, `"Storage proxy error"`).
- The static/Vite SPA fallback (`app.use("*")`) handled 404s; nothing handled
  **unexpected throws** outside tRPC — Express's default error handler would
  have returned a **stack trace with file paths** in dev.

FIXED — `registerErrorHandler` is registered **after all routes**: it logs the
full error server-side and returns a generic `500 Internal server error.` to
the client (no stack traces, no file paths, no SQL).

### Application layer

- `memberAccountService` / `db.ts` degrade to typed, safe fallbacks (`[]`,
  `null`, `{success:false}`) instead of throwing on unprovisioned resources.
- `EMAIL` queue processor logs failures but never throws out of the loop.
- Error messages user-facing are pre-written, friendly strings
  (e.g. GENERIC_LOGIN_ERROR) with no internals.

## What's at risk

- (Before) Generic `Error` messages leaked into API responses; a non-tRPC
  exception would have dumped a stack trace (Express default) in dev and a
  raw error in prod.
- (Current) Clients receive only generic or intentional messages; full
  details stay server-side.

## What's already secure

- Login failures are deliberately indistinguishable (no account enumeration).
- SMTP credentials are stripped from email error messages before surfacing.
- The environment probe confirmed no debug mode leaks: `NODE_ENV` drives
  production behavior and `devCreateTestMember` is gated on it.

## Recommendations

1. ✅ Done — global tRPC `onError` + Express error handler.
2. Consider wiring the audit log table (`db.logAuditEvent`) into the admin
   routes for a permanent trail.
3. Keep `NODE_ENV=production` in the deploy env so dev-mode stacks never
   reach the running instance.
