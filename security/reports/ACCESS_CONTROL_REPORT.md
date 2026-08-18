# ACCESS_CONTROL Security Report

## Status: MEDIUM → FIXED

## Findings

### Resource-ID routes — all scoped to the session user

Every route that takes a resource ID derives ownership from `ctx.user.id`
server-side; a browser-supplied ID is never used as an authorization key.

| Route | ID | Ownership check |
|---|---|---|
| `cvMaker.updateEntry(entryId)` | entry ID | service filters within `ctx.user.id`'s list; else `NOT_FOUND` |
| `cvMaker.deleteEntry(entryId)` | entry ID | same — delete only succeeds on the caller's own entry |
| `opportunity.submitApplication(opportunityId)` | opportunity ID | write is stamped with `ctx.user.id`; reads scoped to own apps |
| `voting.submitVote(sessionId)` | session ID | vote stored under `ctx.user.id`; `castVote` rejects duplicates |
| `voting.getSessionResults(sessionId)` | session ID | reads caller's own vote; totals are aggregate |
| `document.getMemberDocuments` | none | always the session user's docs |
| `member.updateProfile` | none | always `ctx.user.id`; zod whitelist excludes email/CNIC/role/membershipId |
| `directory.getMemberProfile(memberId)` | member ID | **was** any member → now Active-only (see below) |

The zod whitelist on `updateProfile` is a model of the pattern: only
`name/phone/bio/institution/degree/localCouncil` may be written, so a member
cannot escalate their own role, email, or membership status.

### 1. FIXED — directory profile lookup exposed non-Active members

`getDirectoryMember(id)` returned a profile for **any** known user id,
including `Pending`/`Rejected`/inactive accounts, while
`listDirectoryMembers` correctly filtered to `Active` only. This let a member
probe internal user IDs to enumerate accounts that should not be
directory-visible (the returned fields are still the safe public subset —
never CNIC/hashes). Now both code paths require
`membershipStatus === "Active"`.

### 2. FIXED — storage proxy key allowlist

`GET /manus-storage/*` forwarded `req.params[0]` verbatim into the Forge
presign path parameter. The key is generated server-side (UUID + 8-hex random
suffix) and unguessable, but nothing stopped a caller from sending arbitrary
bytes (`../`, `?`, control chars). Added an allowlist
`/^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/` so traversal/query attempts are
rejected with 400 before they reach the storage backend.

### 3. Documented — storage proxy is unauthenticated by design

`/manus-storage/*` serves generated PDFs (membership letters/cards) to anyone
holding the URL. This is a deliberate trade-off (browsers must open the PDF in
a new tab without an Authorization header). Risk is bounded because keys are
random and unguessable (`appendHashSuffix`), and `Cache-Control: no-store` is
set. If the portal grows, move these behind a short-lived signed-URL flow
keyed to the session.

## What's at risk

- (Before fix) Inactive/pending member accounts were enumerable by numeric
  ID through `directory.getMemberProfile`.
- (Current) A leaked document URL grants read access to that one PDF until the
  key rotates — no write path exists through the proxy.

## What's already secure

- All ownership checks use `ctx.user.id` from the validated session — passing
  auth never implies ownership of another member's resources.
- Auth and ownership are separate: `protectedProcedure` gates the endpoint,
  and the service re-scopes by user for every read/write.
- Failed ownership checks return 404/`NOT_FOUND` (no existence oracle).
- Directory payloads are an explicit safe-field projection.

## Recommendations

1. ✅ Done — `getDirectoryMember` requires `Active`.
2. ✅ Done — storage proxy key allowlist.
3. Long-term: issue session-scoped, expiring signed URLs for document
   downloads instead of the static proxy.
