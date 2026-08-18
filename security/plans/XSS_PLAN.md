# XSS Fix Plan

## Changes

- `server/services/emailService.ts` — every template
  (`getMembershipConfirmationEmail`, `getMembershipApprovedEmail`,
  `getOpportunityApplicationEmail`, `getVotingNotificationEmail`,
  `getPositionApplicationEmail`, `getPositionSelectionEmail`) now escapes all
  dynamic values with `escapeHtml()` and validates link targets with
  `safeLink()` (http/https only). `escapeHtml` was moved to a shared location
  above the templates (used by `getPasswordSetupEmail` too).

## New files

None.

## Verification goals

- [x] No template interpolates a raw variable (grep shows `escapeHtml(` on
      every `memberName`/`membershipId`/`*Title` interpolation)
- [x] `votingLink` is scheme-validated (`safeLink`)
- [x] The only `dangerouslySetInnerHTML` is the static chart style block
- [x] Typecheck passes; tests pass

## Manual verification (for the human)

- Queue an email for a member whose name contains `<script>` and confirm the
  delivered HTML shows it escaped (inspect source of the email).
- Trigger the voting-notification template with a `javascript:alert(1)` link
  and confirm the href renders as `#`.
