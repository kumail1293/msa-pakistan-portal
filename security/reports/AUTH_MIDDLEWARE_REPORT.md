# AUTH_MIDDLEWARE Security Report

## Status: MEDIUM → FIXED

## Findings

Auth is enforced at the tRPC procedure level (`server/_core/trpc.ts`):

- `publicProcedure` — no auth
- `protectedProcedure` — `requireUser` middleware throws `UNAUTHORIZED`
  before the handler runs
- `adminProcedure` — requires `ctx.user.role === 'admin'`, throws
  `FORBIDDEN` otherwise

**Route inventory (exhaustive):**

| Router | Procedure | Auth before handler? |
|---|---|---|
| `auth.me` | public | n/a (returns `null` when anonymous) |
| `auth.login` | public | n/a (by design) |
| `auth.setupPassword` | public | n/a (token is the credential) |
| `auth.setupTokenInfo` | public | n/a (reveals only name/ID for a valid token) |
| `auth.logout` | public | n/a (idempotent cookie clear) |
| `auth.devCreateTestMember` | public + `ENV.isProduction` guard | dev-only; 403 in prod |
| `member.getProfile` / `portalProfile` / `updateProfile` / `getDocuments` | protected | ✅ |
| `membership.getLocalCouncils` | public | n/a (non-sensitive) |
| `membershipForm.submit` | public | n/a (registration by design) |
| `opportunity.list` | public | n/a (non-sensitive) |
| `opportunity.submitApplication` / `getMyApplications` | protected | ✅ |
| `voting.getActiveSessions` | public | n/a (non-sensitive) |
| `voting.list` / `submitVote` / `getSessionResults` | protected | ✅ |
| `cvMaker.getEntries` / `addEntry` / `updateEntry` / `deleteEntry` | protected | ✅ |
| `document.getMemberDocuments` / `generate*` | protected | ✅ |
| `directory.listMembers` / `searchMembers` / `getMemberProfile` | protected | ✅ |
| `admin.email.sendTest` | admin | ✅ |
| `admin.members.syncApprovedMember` | admin | ✅ |
| `admin.getDashboard` | **was protected+manual → now admin** | ✅ |
| `admin.getConfiguration` | **was protected+manual → now admin** | ✅ |
| `admin.updateConfiguration` | **was protected+manual → now admin** | ✅ |
| `system.notifyOwner` | admin | ✅ |

**FIXED — manual role checks with wrong error semantics:**

The three `admin.*` configuration/dashboard procedures used
`protectedProcedure` plus an inline `if (ctx.user.role !== 'admin') throw new Error("Unauthorized")`.
Problems:
1. A plain `Error` is mapped by tRPC to `INTERNAL_SERVER_ERROR` (HTTP 500)
   instead of `FORBIDDEN` (HTTP 403).
2. The raw message string was echoed in the API response (`"Unauthorized"`),
   which is tRPC's default for generic errors — inconsistent with the
   `NOT_ADMIN_ERR_MSG` used by `adminProcedure`.
They now use `adminProcedure`, which returns 403 with the standard message.

**FIXED — dead unauthenticated checks:** the `document.generate*` stubs
contained `if (!ctx.user) throw new Error("Not authenticated")` — unreachable
under `protectedProcedure` and again a 500-on-Error hazard; removed.

**FIXED — dead stub removed:** `membership.submitApplication` (returned a fake
`MSAP-PENDING-001` to anyone) was removed; the real registration endpoint is
`membershipForm.submit`.

**Other observations:**
- `/manus-storage/*` (storageProxy) is intentionally unauthenticated —
  unguessable keys; see ACCESS_CONTROL.
- `/api/oauth/callback` handles its own token exchange server-side.
- `auth.me` returns `null` rather than 401 for anonymous — deliberate so the
  SPA can render the signed-out state.

## What's at risk

- (Before fix) A non-admin hitting `/admin/dashboard` got a 500 instead of
  403, and any future `throw new Error` in a procedure would leak its message
  into the client response.
- (Current) No route serves user data without session validation.

## What's already secure

- `protectedProcedure` / `adminProcedure` run **before** every handler.
- Login failures are indistinguishable for unknown IDs vs wrong passwords
  (generic message; no user enumeration via login).
- `devCreateTestMember` refuses to run in production.
- Directory/voting/opportunity reads that are public expose no PII.

## Recommendations

1. ✅ Done — convert admin procedures to `adminProcedure`.
2. ✅ Done — remove dead `Error` throws; add a global tRPC `onError` (see
   ERROR_HANDLING) so any future generic error is logged server-side and the
   client gets a generic message.
3. Keep the storage proxy's unguessable-key model documented (category 4).
