# MSAP Portal — Phase 1: Membership Intake

## Architecture

The Google Sheet + Apps Script remains the membership workflow source of truth.
The React portal does **not** write directly to Google Sheets from the browser.
Instead:

Browser → tRPC → Node server → Apps Script Web App → Google Sheet → existing MSAP sync/approval workflow.

This is deliberate: Google Apps Script API requests do not fire spreadsheet/form triggers, so the portal API explicitly calls `syncResponses(false)` after inserting the response.

## Apps Script changes

In the existing `MSAP_ERP_v7.3` script:

1. Add to `CONFIG`:

```js
PORTAL_APP_URL: "https://YOUR-PORTAL-DOMAIN.example",
MEMBERSHIP_UPLOAD_FOLDER_ID: "YOUR_MEMBERSHIP_UPLOAD_FOLDER_ID"
```

2. Change:

```js
function syncResponses() {
```

to:

```js
function syncResponses(showUi = true) {
```

3. Replace the final `SpreadsheetApp.getUi().alert(...)` with the result object + conditional alert shown in `MSAP-ERP-portal-api-patch.gs`.

4. Add all functions from `MSAP-ERP-portal-api-patch.gs` immediately before `doGet(e)`.

5. Deploy the Apps Script as a Web App:
   - Execute as: **Me / script owner**
   - Who has access: **Anyone**
   - Copy the `/exec` URL into `MSAP_APPS_SCRIPT_URL` on the portal server.

## Drive folder

Create a private Drive folder for applicant uploads and put its ID in `MEMBERSHIP_UPLOAD_FOLDER_ID`.
Do **not** make the CNIC folder public.

## Portal environment

Create `.env` from `.env.example` and set:

```env
MSAP_APPS_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

## Current workflow

The existing Apps Script already uses `Form Responses 1` as the source sheet and `Membership Workflow` as the normalized approval sheet. It assigns membership IDs and generates the membership letter during presidential approval.

## Phase 2 — Approved Member Lifecycle (implemented)

Approved member → portal account → secure password-setup email → password
setup → member login (Membership ID **or** email + password) → member dashboard
→ member documents.

### Flow

```
Apps Script approval
        │
        ▼  (portal-side reconciliation, idempotent)
syncApprovedMember(identifier)  ── lookupMember action ──►  Google Apps Script
        │                                                      │  returns safe profile
        ▼                                                      ▼
Portal member account (users table / memory store)    Membership Workflow (source of truth)
        │
        ├─ issue one-time setup token (SHA-256 digest stored, 24h expiry)
        ├─ queue setup email:  [MSA Pakistan] Set Up Your Member Portal Account
        ▼
/set-password?token=...  →  scrypt password hash stored  →  session cookie
        ▼
/login (Membership ID or email + password)  →  /dashboard (profile + documents)
```

### API (server)

| tRPC procedure | Auth | Purpose |
| --- | --- | --- |
| `auth.login` | public | Membership ID/email + password → httpOnly session cookie |
| `auth.setupPassword` | public | one-time token + new password; invalidates token, logs in |
| `auth.setupTokenInfo` | public | validates a setup token for the /set-password page greeting |
| `auth.me` | public | current session user (credentials stripped) |
| `member.portalProfile` | session | dashboard payload; identity from session, never from input |
| `admin.members.syncApprovedMember` | admin | idempotent reconciliation of one approved member |

Authorization derives member identity from the authenticated session; a
membership ID supplied by the browser is never trusted as authorization
(prevents horizontal privilege escalation).

### Apps Script (redeploy required)

1. Re-apply `docs/MSAP-ERP-portal-api-patch.gs` to the deployed script (or use
   the updated `MSAP_ERP_v7.4.portal.gs`). The patch now:
   - handles the `submitApplication` action alias (top-level application fields)
   - extends `lookupMember` to return the **safe profile**: membershipId, name,
     email/personalEmail, phone, discipline, year of study, graduation year,
     institute, Local Council, status, membership letter URL, membership card
     URL. It never returns CNIC, address, admin comments, COI or internal notes.
2. Add `CONFIG.PORTAL_APP_URL` to the deployed script's CONFIG.
3. Redeploy as Web App (Execute as: owner, access: Anyone) and keep
   `MSAP_APPS_SCRIPT_URL` current.

### Portal environment

```env
MSAP_APPS_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
PORTAL_BASE_URL=https://portal.example.org     # used in setup emails
PASSWORD_SETUP_TOKEN_EXPIRY_MS=86400000        # 24h default
JWT_SECRET=<existing session secret>

# Email delivery (SMTP via nodemailer)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false        # true for port 465 (implicit TLS)
SMTP_USER=your-user
SMTP_PASSWORD=your-pass
SMTP_FROM_NAME=MSA Pakistan
FROM_EMAIL=vpm@msapakistan.org
```

`PORTAL_BASE_URL` and `MSAP_APPS_SCRIPT_URL` are server-side only — never
introduce a `VITE_` copy of the Apps Script URL.

### Email delivery

Queued emails (membership confirmations, approval notices, password-setup
links) are delivered over **SMTP via nodemailer**. Any relay works — Gmail app
password, Zoho, Brevo, Mailgun, or **Elastic Email's SMTP servers** (a
zero-budget option; its REST API was also evaluated). The queue drains every
60 seconds (`startEmailQueueProcessor` in `server/_core/index.ts`) with a
3-attempt retry → `Permanent Failure` state machine.

- `SMTP_HOST` unset → dev mode: emails are logged (memory outbox) instead of
  sent; queued DB rows stay `Pending` and a one-time warning is logged.
- Production with `SMTP_HOST` unset → loud boot-time error (never fail
  silently).
- `admin.email.sendTest` (admin-only tRPC) sends a one-off test email through
  the configured relay to verify delivery.

### Storage note

The portal's member-account store is currently an in-process memory store
because the workspace has no live `DATABASE_URL` (and the legacy drizzle
migrations predate this schema). When a database is provisioned:

1. run `pnpm db:push` (drizzle-kit generate + migrate)
2. swap the `*_memory` helpers in `server/services/memberAccountService.ts`
   for Drizzle queries (the routers and sync logic stay unchanged)

### Security invariants

- Passwords: scrypt (salted, memory-hard); only hashes are stored, never
  logged or returned to the client.
- Setup tokens: 32 random bytes; only a SHA-256 digest is stored; 24h expiry;
  single-use (cleared on success); re-issuing invalidates the previous token.
- Login errors are generic — the API never reveals whether an identifier
  exists or a password is wrong.
- Documents/letter/card URLs come from the approved workflow; the CNIC copy
  and fee receipts are never exposed through the portal API.
