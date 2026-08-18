# XSS Security Report

## Status: MEDIUM → FIXED

## Findings

### Client rendering — PASS

- `grep -rn "dangerouslySetInnerHTML\\|innerHTML=" client/src` → **one** hit:
  `client/src/components/ui/chart.tsx:81` — the shadcn `ChartStyle` component
  injects a `<style>` block of CSS custom properties
  (`--color-${key}: ${color}`). The `id` is React-generated and the
  `color`/`key` values come from the **developer-authored chart config**, not
  user input. Not exploitable; noted for future caution.
- Everywhere else React auto-escapes. The AI chat renders LLM output through
  `streamdown` (a markdown renderer) — no `innerHTML` in app code; the
  renderer's own escaping applies.

### Server-side email templates — FIXED

`server/services/emailService.ts` interpolated member- or
opportunity-supplied values into HTML without escaping:

```ts
// before
<p>Dear ${memberName},</p>
<p><a href="${votingLink}">Click here to vote</a></p>
```

- `getMembershipConfirmationEmail` — raw `memberName`, `membershipId`
- `getMembershipApprovedEmail` — raw `memberName`, `membershipId`
- `getOpportunityApplicationEmail` — raw `memberName`, `opportunityTitle`
- `getVotingNotificationEmail` — raw `memberName`, `votingTitle`, and
  `votingLink` inside an `href` (attribute/URL-injection vector)
- `getPositionApplicationEmail` / `getPositionSelectionEmail` — raw names/titles

`getPasswordSetupEmail` already escaped its values (was the only one).

FIXED — all six templates now pass every dynamic value through `escapeHtml()`
(`& < > " '`), and `votingLink` is additionally passed through `safeLink()`
which only allows `http(s)` URLs (anything else renders a `#` href), so a
hostile value cannot inject attributes or a `javascript:` target.

The Apps Script side already HTML-escapes admin comments in its own emails
(per its changelog), and Google Sheets API responses are never rendered as
HTML in this app.

## What's at risk

- (Before) A member name like `<img src=x onerror=...>` would have been
  rendered as HTML in emails to other members (email-XSS / phishing).
- (Current) All template interpolation is escaped; link targets are
  scheme-restricted.

## What's already secure

- React escaping on all UI rendering.
- The single `dangerouslySetInnerHTML` is static, developer-controlled CSS.
- Setup-token emails escape names and IDs.

## Recommendations

1. ✅ Done — escape all email templates, restrict link schemes.
2. Keep the "no new `dangerouslySetInnerHTML` without sanitization" rule;
   if the chart component ever consumes user data for colors, sanitize.
3. If raw HTML rendering is ever needed in the UI (none today), add DOMPurify
   — do not bypass React escaping.
