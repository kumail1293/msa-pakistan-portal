# MSAP Phase 1 — Membership Form Rebuild

This build replaces the initial prototype membership form with a closer digital implementation of the attached MSAP National Membership Form.

## Included

- Intro/welcome section
- PKR 1,000 payment information
- Official membership agreement before proceeding
- Personal details
- Year of graduation / final result date
- CNIC upload
- Course level and official course options
- Searchable official college/institute list from the attached form
- Other institute/course handling
- College/university roll number
- Reason for joining MSAP
- Conflict of interest with organization + role
- Discovery sources + Other
- Payment account/JazzCash/EasyPaisa payer name
- Fee receipt upload and filename guidance
- Disclaimer
- Full Code of Conduct / Members Pledge section
- Yes/No undertaking
- Completion acknowledgement
- Final review
- Local browser draft autosave for text fields (uploads are intentionally not saved)

## Local setup

1. Keep your existing `.env` private.
2. Run `pnpm install`.
3. Run `pnpm check`.
4. Run `pnpm dev`.
5. Open `http://localhost:3000/join`.

Google Sheets/App Script is intentionally not required for the UI review stage.

## Important

Do not submit real CNICs or real payment receipts while testing the local UI until the Apps Script endpoint and storage workflow are connected and verified.
