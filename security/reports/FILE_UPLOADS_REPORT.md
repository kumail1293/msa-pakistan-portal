# FILE_UPLOADS Security Report

## Status: MEDIUM → FIXED

## Findings

### Upload surface

`membershipForm.submit` (public) accepts three optional/required base64
uploads, capped by zod:

| Field | Size cap | Declared mime |
|---|---|---|
| `profilePhoto` | 4 MB base64 | client-supplied |
| `feeReceipt` | 8 MB base64 | client-supplied |
| `cnicCopy` | 8 MB base64 | client-supplied |

The payloads are forwarded to the Google Apps Script
(`submitMembershipApplication`), which stores them in a Drive folder.

### Before

Validation was **declaration-only**: zod enforced a size cap and a `mimeType`
string, but nothing checked that the bytes matched the declared type. A
client could submit arbitrary content labeled `image/jpeg` (e.g. an HTML file
or a polyglot) that would be stored in the membership folder and could be
served to admins later.

### After (fixed)

- New `server/_core/uploads.ts` — `validateUpload()` sniffs the first bytes
  and checks **magic signatures**:
  - JPEG `FF D8 FF`, PNG, WebP (`RIFF…WEBP`), GIF — accepted as images
  - PDF (`%PDF`) — accepted where PDFs are allowed
  - The declared `mimeType` must match the sniffed type (a `mimeType:
    image/png` on a JPEG payload is rejected).
  - `profilePhoto` → images only; `feeReceipt`/`cnicCopy` → image or PDF.
- `server/routers.ts` — the submit mutation validates all three uploads and
  returns `BAD_REQUEST` with a per-field message before anything reaches the
  Apps Script.
- `server/_core/index.ts` — JSON body limit reduced from **50 mb to 30 mb**
  (a legit submission is ~25 mb max: 4+8+8 MB base64 plus form fields), which
  bounds memory use on every endpoint, not just the form.

### Remaining notes

- Stored filenames are generated server-side
  (`documentService` uses `*_<random8>.pdf`; the Apps Script side names
  uploads by applicant) — no user-controlled path is used.
- PDFs/images are stored in Drive (a separate domain from the portal), which
  satisfies the "separate domain" goal; they are not served through this app
  except via signed Drive URLs.
- No executable content types (HTML/SVG/JS) are ever accepted.

## What's at risk

- (Before) Stored-XSS/luring risk from mislabeled uploads reviewed by admins;
  arbitrary-bytes storage abuse.
- (Current) Only genuine image/PDF bytes pass; payload sizes are bounded.

## What's already secure

- Base64 + zod size caps at the input boundary.
- Server-generated storage keys (`appendHashSuffix` random suffix).
- Content is never executed by the portal (images/PDFs only, external host).

## Recommendations

1. ✅ Done — magic-byte validation on all three uploads.
2. ✅ Done — global body limit 30 mb.
3. If uploads ever move to direct S3 presigning, re-sniff at the server before
   issuing the presigned URL (never trust a client-supplied contentType).
