# DATABASE_ACCESS Security Report

## Status: MEDIUM → FIXED

## Findings

### 1. Row-level security (RLS) — N/A today, required if Supabase is adopted

- `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
  are **all unset** (verified via env probe). The app currently runs with no
  database: `server/db.ts` only opens a connection when `DATABASE_URL` is set,
  and `memberAccountService.ts` uses a typed in-process memory store with a
  documented swap-in path for Drizzle.
- There are no Supabase clients, no PostgREST calls, and no RLS policies in
  the codebase. RLS therefore cannot be evaluated — it must be established
  *before* the portal is ever pointed at Supabase (see plan).

### 2. FIXED — Session-scoping conditions silently dropped by `&&`

`server/db.ts` combined two SQL conditions with the JavaScript `&&` operator,
which **drops the first condition** (an SQL expression is always truthy, so
`a && b` evaluates to `b` only):

```ts
// castVote — duplicate check (before fix)
.where(eq(votes.sessionId, sessionId) && eq(votes.voterId, voterId))

// getUserVote — per-session vote lookup (before fix)
.where(eq(votes.sessionId, sessionId) && eq(votes.voterId, userId))
```

Effect:
- `castVote`: the duplicate check matched *any* vote by the voter in *any*
  session → a member who had voted in one session would be told "You have
  already voted in this session." for a different session (false conflict).
- `getUserVote`: returned the voter's vote from an arbitrary session → the
  wrong `userVote` could surface on a session page (cross-session vote
  leakage to the member; the voter's own data, but mis-scoped).

Fixed with drizzle's `and(...)`:

```ts
.where(and(eq(votes.sessionId, sessionId), eq(votes.voterId, voterId)))
```

### 3. Unauthenticated storage proxy (see ACCESS_CONTROL report)

`GET /manus-storage/*` is unauthenticated. Keys are unguessable
(UUID + random suffix), so this is defense-in-depth-weak but not directly
exploitable; it is documented and hardened in category 4.

## What's at risk

- (Fixed) Vote duplicate-checks and result lookups were not scoped to the
  requested session.
- (Future) If Supabase is enabled without RLS, the anon key could read any
  table (members, votes, documents).

## What's already secure

- Every query is parameterized through the Drizzle ORM (`eq`, `and`) — no raw
  SQL concatenation (see category 11).
- DB functions degrade safely to empty results when no database is configured
  (no crash, no partial writes).
- `castVote` returns a typed `duplicate` flag so the router can reject a
  second ballot without inserting it.

## Recommendations

1. ✅ Done — replace `&&` condition combining with drizzle `and()`.
2. Before enabling Supabase: enable RLS on every table, add per-table policies
   scoped to `auth.uid()`, and verify the anon key returns empty/403 (see
   plan).
3. When a MySQL `DATABASE_URL` is provisioned, run `pnpm db:push` and confirm
   migrations match `drizzle/schema.ts` (the in-memory store currently
   substitutes for a schema that was noted as out of sync with legacy
   migrations).
