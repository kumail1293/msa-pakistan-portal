# SQL_INJECTION Fix Plan

## Changes

None required. All queries are parameterized through Drizzle.

## New files

None.

## Verification goals

- [x] `grep -rn "sql\`" server/ drizzle/` returns nothing
- [x] No string concatenation / template literals in SQL with user input
- [x] Every query uses Drizzle builders or parameters
- [x] Typecheck passes; tests pass

## Manual verification (for the human)

- After any future query change, re-run the greps above.
- When a database is provisioned, spot-check the MySQL general log during a
  vote/application write to confirm values are bound parameters, not
  inlined.
