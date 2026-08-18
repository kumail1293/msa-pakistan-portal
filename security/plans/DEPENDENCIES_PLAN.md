# DEPENDENCIES Fix Plan

## Changes

- `package.json`
  - `@trpc/client` / `@trpc/react-query` / `@trpc/server` → `^11.8.0`
  - `axios` → `^1.16.0`
  - `drizzle-orm` → `^0.45.2`
  - `nanoid` → `^5.1.16`
  - Removed `@aws-sdk/client-s3` / `@aws-sdk/s3-request-presigner` (unused)
  - Removed `add` devDependency
  - `pnpm.overrides`: fast-xml-parser `^5.5.6`, path-to-regexp `0.1.13`,
    mermaid `^11.16.1`, body-parser `^1.20.6`, qs `^6.15.2`,
    mdast-util-to-hast `^13.2.1`, uuid `^11.1.1`
- `pnpm-lock.yaml` regenerated with the patched versions.

## New files

None.

## Verification goals

- [x] `pnpm audit --prod` shows no **critical** vulnerabilities
- [x] All fixable **high** advisories cleared (6 remaining are lodash/lodash-es
      with an unpublished patched version)
- [x] Lockfile committed with exact resolved versions
- [x] `pnpm check` passes with the upgraded dependencies
- [x] Full test suite passes (30/30) with the upgraded dependencies
- [ ] CI runs `pnpm audit --prod` on every merge (human action)

## Manual verification (for the human)

- Run `pnpm audit --prod` in CI and on each dependency change.
- When lodash 4.18.0 (or a lodash-free recharts/mermaid) ships, upgrade and
  confirm the count drops to 0.
- Confirm the app boots and the member + admin logins still work after the
  dependency upgrades (verified in this session's login run).
