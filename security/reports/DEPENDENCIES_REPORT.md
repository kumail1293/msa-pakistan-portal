# DEPENDENCIES Security Report

## Status: HIGH → MITIGATED (residual low-risk advisories with no published fix)

## Findings

Baseline (`pnpm audit --prod` before this audit): **81 vulnerabilities
(10 low | 49 moderate | 21 high | 1 critical)**.

### Fixed (all fixable advisories cleared)

| Change | Cleared |
|---|---|
| `@trpc/*` `^11.6.0` → `^11.8.0` (resolved 11.18) | HIGH 1111524 (tRPC auth bypass) |
| `axios` `^1.12.0` → `^1.16.0` (resolved 1.19) | 10+ HIGH axios advisories + `form-data` |
| `nanoid` `^5.1.5` → `^5.1.16` | HIGH 1138810 |
| `drizzle-orm` `^0.44.5` → `^0.45.2` | HIGH 1116251 |
| **Removed** `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (never imported — storage uses the Forge presign API) | **CRITICAL 1113568** fast-xml-parser + 3 HIGH fast-xml-parser + @smithy/config-resolver LOW |
| Removed `add` devDependency (empty registry canary, 0 real downloads) | supply-chain hygiene |
| `pnpm.overrides`: `fast-xml-parser ^5.5.6`, `path-to-regexp 0.1.13`, `mermaid ^11.16.1`, `body-parser ^1.20.6`, `qs ^6.15.2`, `mdast-util-to-hast ^13.2.1`, `uuid ^11.1.1` | CRITICAL fast-xml-parser chain, HIGH path-to-regexp ReDoS, HIGH mermaid prototype pollution, body-parser/qs/mdast/uuid |

Resolved versions verified in `pnpm-lock.yaml` (committed; exact pins live in
the lockfile): fast-xml-parser@5.10.1, path-to-regexp@0.1.13, mermaid@11.16.1,
body-parser@1.20.6, qs@6.15.3, mdast-util-to-hast@13.2.1, uuid@11.1.1.

### Residual (no fix exists)

`pnpm audit --prod` now reports **6 vulnerabilities (4 moderate | 2 high)** —
**all** `lodash` / `lodash-es` prototype-pollution advisories:

- `recharts@2.15.4 > lodash@4.17.21` (chart rendering)
- `streamdown > mermaid@11.16.1 > dagre-d3-es > lodash-es@4.17.21` (AI chat markdown/diagram rendering)

The advisories list a patched version of `>=4.18.0` that **has never been
published to npm** — `lodash` 4.17.21 is the latest real release, and there is
no upstream fix to upgrade to. Both chains are **client-side renderers** whose
input is developer-authored chart config or LLM output, so the practical
exposure is minimal. The `dompurify` IN_PLACE advisory (via mermaid) cleared
with mermaid 11.16.1.

## What's at risk

- (Before) A **critical** DoS in the XML parser used by the (unused) AWS SDK
  and **21 high** advisories including an auth-bypass vector in the version of
  tRPC shipped, plus ReDoS in express's router.
- (Current) Six prototype-pollution advisories in client-side chart/markdown
  renderers with no fixable upstream version — low practical risk, accepted
  and tracked.

## What's already secure

- `pnpm-lock.yaml` is committed — exact versions are pinned at install time.
- The audit is re-runnable (`pnpm audit --prod`) and tracked as a verification goal.
- Removed an unused dependency tree (AWS SDK) that was the source of the
  critical advisory and ~100 MB of install weight.
- The `packageManager` field pins pnpm itself (10.4.1).

## Recommendations

1. Monitor for a lodash 4.18.0 release (or recharts/mermaid dropping lodash)
   and re-run `pnpm audit` then — nothing actionable exists today.
2. Consider replacing the mermaid-heavy `streamdown` renderer in the AI chat
   with a lighter markdown renderer when chat features are next touched.
3. Re-run `pnpm audit --prod` in CI.
