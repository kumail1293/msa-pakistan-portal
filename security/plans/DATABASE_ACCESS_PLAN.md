# DATABASE_ACCESS Fix Plan

## Changes

- `server/db.ts` — replace the two `eq(a) && eq(b)` conditions (in
  `castVote` and `getUserVote`) with drizzle's `and(eq(a), eq(b))` so both
  conditions are applied. Import `and` from `drizzle-orm`.

## New files

None.

## Verification goals

- [x] `grep -n "&& eq(" server/db.ts` returns nothing
- [x] `and(eq(...), eq(...))` is used in `castVote` and `getUserVote`
- [x] Typecheck passes (`pnpm check`)
- [ ] (Future) Every Supabase table has RLS enabled with policies scoped to
      `auth.uid()` before the portal is connected to Supabase
- [ ] (Future) A curl request with just the Supabase anon key to any table
      returns empty or 403

## Manual verification (for the human)

- When a MySQL `DATABASE_URL` is configured, create two voting sessions, cast
  a vote in one, then vote in the other: the second vote must succeed and the
  first session's results must be unaffected.
- Re-run the audit command above whenever the vote queries are touched.
