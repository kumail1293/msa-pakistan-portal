# ACCESS_CONTROL Fix Plan

## Changes

- `server/services/memberAccountService.ts` — `getDirectoryMember(id)` now
  returns `null` unless the user's `membershipStatus === "Active"` (matches
  `listDirectoryMembers`).
- `server/_core/storageProxy.ts` — reject storage keys that do not match
  `/^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/` with 400 before calling Forge.

## New files

None.

## Verification goals

- [x] `grep -n "membershipStatus !== \"Active\"" server/services/memberAccountService.ts`
      matches `getDirectoryMember`
- [x] Storage proxy rejects `../` and `?` keys with 400 (code review + unit
      check)
- [x] Typecheck passes
- [x] Existing tests pass

## Manual verification (for the human)

- `curl -i "http://localhost:3000/manus-storage/..%2f..%2fetc%2fpasswd"` → 400.
- `curl -i "http://localhost:3000/manus-storage/ok-key_12345678.pdf"` → 307
  redirect (when Forge is configured) or 500 "Storage proxy not configured".
- With a Pending member's user id, call `directory.getMemberProfile` → must
  return `null`, not a profile.
