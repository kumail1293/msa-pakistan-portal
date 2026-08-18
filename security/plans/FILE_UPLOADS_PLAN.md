# FILE_UPLOADS Fix Plan

## Changes

- `server/_core/uploads.ts` (new) — `validateUpload(upload, kinds)` magic-byte
  sniffing for JPEG/PNG/WebP/GIF/PDF, requiring declared mimeType to match
  the sniffed content.
- `server/routers.ts` — `membershipForm.submit` validates `profilePhoto`
  (image), `feeReceipt` and `cnicCopy` (image or PDF) before forwarding;
  rejects with `BAD_REQUEST`.
- `server/_core/index.ts` — JSON/urlencoded body limit `50mb` → `30mb`.

## New files

- `server/_core/uploads.ts`

## Verification goals

- [x] File type validated by magic bytes, not just extension/declared type
- [x] Files rejected when declared type ≠ sniffed type (unit-checkable)
- [x] Executable types (HTML/SVG/JS) cannot pass (no matching magic)
- [x] Size limits enforced server-side (zod + 30mb body cap)
- [x] Typecheck passes; tests pass

## Manual verification (for the human)

- Submit the membership form with a `profilePhoto` whose bytes are a PNG but
  `mimeType: image/jpeg` → rejected with "File type mismatch".
- Submit with an HTML file renamed `.jpg` → rejected ("contents do not
  match").
- Submit with a real phone photo and a PDF fee receipt → accepted.
