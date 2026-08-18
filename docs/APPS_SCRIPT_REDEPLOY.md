# Apps Script Redeploy Checklist — Portal API

> **Why this matters:** the login flow (and the membership form) depend on
> server → Apps Script requests. A read-only `lookupMember` probe against the
> deployment currently configured in `.env` returns **HTTP 405** — the deployed
> script has no `doPost` handler, so it predates the portal API patch. Until it
> is redeployed, first-login reconciliation cannot create member accounts and
> the portal cannot submit membership applications.

## 1. Update the script in the Apps Script editor

1. Open the Apps Script project behind `MSAP_APPS_SCRIPT_URL`
   (the script `MSAP_ERP_v7.4.portal.gs` — the deployment ID in `.env` is
   `AKfycbzbP26JqdDwTlse9F5kToRqptMqR3mgUeXmm6Royfgzk2SXbnOcypnFDhmCFiWTMG8Icw`).
2. Replace the project code with the contents of `MSAP_ERP_v7.4.portal.gs`
   (or re-apply `docs/MSAP-ERP-portal-api-patch.gs` on top of your working copy
   if you keep local modifications).
3. Confirm the following exist in the script (all present in v7.4):

   | Piece | Purpose |
   | --- | --- |
   | `doPost(e)` with `action` switch | Required for any portal request |
   | `action === "register"` | Legacy application submit |
   | `action === "submitApplication"` | Current portal application submit |
   | `action === "lookupMember"` | Member lookup for login reconciliation |
   | `lookupPortalMember_(identifier)` | Safe profile (never CNIC/comments) |
   | `resolveLocalCouncilForInstitute_()` | LC name resolution for the profile |
   | `CONFIG.PORTAL_APP_URL` | Must be set to your real portal origin |
   | `CONFIG.MEMBERSHIP_UPLOAD_FOLDER_ID` | Drive folder for applicant uploads |

4. In `CONFIG`, replace the placeholders:
   ```js
   PORTAL_APP_URL: "https://YOUR-PORTAL-DOMAIN.example",
   MEMBERSHIP_UPLOAD_FOLDER_ID: "YOUR_MEMBERSHIP_UPLOAD_FOLDER_ID",
   ```
   with the real values (portal origin, and the Drive folder ID created for
   uploads — do **not** make the CNIC upload folder public).

## 2. Save a new version and redeploy the Web App

1. Click **Save** (💾) in the Apps Script editor.
2. **Deploy ▸ Manage deployments**.
3. Open the existing Web App deployment (or create a new one).
4. Under **Version**, choose **New version** — the deployed code is a snapshot;
   editing the file alone does **not** change what the `/exec` URL runs.
5. Confirm deployment settings:
   - **Execute as:** `Me` (the script owner) — never "User accessing the web app".
   - **Who has access:** `Anyone` (so the Node server can call it anonymously).
6. **Deploy**.
7. Copy the `/exec` URL (it should match `MSAP_APPS_SCRIPT_URL` in `.env`).
   It does **not** change when you redeploy — if it is unchanged, you are done.

## 3. Verify the bridge

Restart the portal server (`pnpm dev`) and confirm the lookup succeeds:

```bash
# A dummy identifier should return found:false — NOT an HTTP 405 / HTML page
curl -s -X POST "<MSAP_APPS_SCRIPT_URL>" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"action":"lookupMember","identifier":"ZZ-UNKNOWN-ID-999"}'
```

Expected: `{"ok":true,"data":{"found":false,"approved":false}}`.
A 405 or an HTML error page means the deployed version is still stale.

## 4. After redeploy

- A member's **first login attempt** with their Membership ID/email now creates
  their portal account and queues the password-setup email.
- The setup email is only *delivered* when SMTP is configured (see
  `docs/PORTAL_BUILD.md` → Email delivery). Without it, the link appears in the
  server console only.
- The membership form (`/membership`) can submit applications again.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| 405 / HTML error from the URL | Deployment predates `doPost` | Redeploy a new version (step 2) |
| `lookup-unavailable` in dev login | Bridge unreachable or stale | Check URL, redeploy, watch server console |
| Setup emails not arriving | `SMTP_HOST` empty | Configure a relay (see SMTP setup) |
| Account vanished after restart | In-memory store, no `DATABASE_URL` | Restart wipes accounts; provision a DB or re-sync by logging in again |
