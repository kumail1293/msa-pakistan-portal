# File & Content Ingestion Architecture

## Overview

The MSAP Portal uses a **universal asset ingestion system** — one service
for ALL modules. No module implements its own upload logic.

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Asset Ingestion Service             │
│          (assetIngestionService.ts)              │
├─────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Direct   │  │   URL    │  │   Google     │  │
│  │  Upload   │  │  Fetch   │  │   Drive      │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │              │               │           │
│  ┌────▼──────────────▼───────────────▼───────┐  │
│  │         Validation Pipeline                │  │
│  │  MIME allowlist → Extension → Magic bytes  │  │
│  │  Filename sanitization → Size limits       │  │
│  └──────────────────┬────────────────────────┘  │
│                     │                           │
│  ┌──────────────────▼────────────────────────┐  │
│  │         SSRF Protection                   │  │
│  │  DNS resolution → IP validation           │  │
│  │  Private IP blocking → Metadata blocking  │  │
│  │  Protocol enforcement → Redirect limits   │  │
│  └──────────────────┬────────────────────────┘  │
│                     │                           │
│  ┌──────────────────▼────────────────────────┐  │
│  │         Storage Provider                  │  │
│  │  put() → get() → delete() → exists()     │  │
│  │  getSignedUrl() → copy() → metadata()    │  │
│  └──────────────────┬────────────────────────┘  │
│                     │                           │
│  ┌──────────────────▼────────────────────────┐  │
│  │         Audit Trail                       │  │
│  │  upload / import / access / delete /      │  │
│  │  version / associate / disassociate       │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## Source Types

| Type | Description |
|------|-------------|
| `direct_upload` | User uploads file via drag/drop or file picker |
| `url` | User submits a URL (external reference) |
| `imported_asset` | System fetches and imports a remote file |
| `google_drive` | File from Google Drive integration |
| `external_link` | URL stored as reference (not downloaded) |

## Validation Pipeline

Every upload passes through:

1. **MIME allowlist check** — only approved MIME types accepted
2. **Extension blocklist** — `.exe`, `.svg`, `.html`, `.js` etc. blocked
3. **Magic-byte validation** — file content must match declared type
4. **Filename sanitization** — path traversal, null bytes, invalid chars removed
5. **Size limit** — configurable via `upload.maxSizeBytes`
6. **SSRF protection** — for URL imports: DNS check, IP validation

## Storage Providers

| Provider | Use Case |
|----------|----------|
| `LocalStorageProvider` | Development — files stored in `.data/storage/` |
| `MemoryStorageProvider` | Testing — in-memory, cleared between tests |
| `S3Provider` (future) | Production — AWS S3 or compatible |
| `GCSProvider` (future) | Production — Google Cloud Storage |

## Access Control

- **Organization isolation**: Users can only access their org's files
- **Visibility levels**: `private`, `org_read`, `public`
- **Owner always has access**
- **Admin/superadmin override**
- **No predictable public URLs** — all access goes through auth checks

## Workflow Integration

Files integrate with workflows via `entityType` + `entityId`:

```
Membership Application → entityType: "membership", entityId: applicationId
  ├── CNIC photo (direct_upload)
  ├── Fee receipt (direct_upload)
  └── Photo (direct_upload)

NEF Activity → entityType: "nef", entityId: activityId
  ├── Proposal document (direct_upload)
  ├── Budget spreadsheet (direct_upload)
  ├── Supporting URL (external_link)
  └── Final report (direct_upload)
```

## Versioning

- Each asset has a `version` number
- `parentAssetId` links versions together
- Historical versions are preserved
- Workflows can reference exact versions
- `changeDescription` documents why version was created

## Audit Trail

Every mutation creates an audit event:
- `asset.uploaded` — direct upload
- `asset.imported_from_url` — URL import
- `asset.link_added` — external link
- `asset.version_created` — new version
- `asset.soft_deleted` / `asset.permanently_deleted`
- `asset.accessed` — file access (where required)
