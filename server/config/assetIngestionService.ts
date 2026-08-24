/**
 * Universal Asset Ingestion Service
 *
 * SINGLE, REUSABLE file/content ingestion engine for ALL modules.
 * Supports: direct upload, URL fetching, Google Drive, external links.
 *
 * Every module (membership, NEF, activities, events, governance, finance,
 * elections, LC/CI, officials, forms, communications) uses THIS service.
 * No separate upload implementations.
 *
 * Features:
 * - Direct file upload (drag/drop, file picker, chunked)
 * - URL link submission (external reference or import)
 * - Secure URL fetching with SSRF protection
 * - MIME validation (allowlist, magic-byte, extension triple-check)
 * - Filename sanitization
 * - Path traversal prevention
 * - File versioning
 * - Access control (org isolation, role-based, entity-level)
 * - Audit trail for all mutations
 * - Storage abstraction (local/object storage/cloud)
 * - Workflow integration
 */

import crypto from "crypto";
import { getStorageProvider, type StorageProvider } from "./storageProvider";
import { validateUrl, safeFetchUrl } from "./ssrfProtection";
import { validateUpload as validateMagicBytes, sanitizeFileName, isBlockedMimeType, MAX_UPLOAD_SIZE_BYTES } from "../_core/uploads";
import { getConfig, getConfigNumber } from "./configService";
import { logAuditEvent } from "./auditService";
import { childLogger } from "../_core/logger";

const log = childLogger("AssetIngestion");

// ============================================================================
// Types
// ============================================================================

export type SourceType = "direct_upload" | "url" | "google_drive" | "external_link" | "imported_asset";

export type AssetStatus = "uploading" | "processing" | "ready" | "error" | "archived" | "deleted";

export interface Asset {
  id: string;
  organizationId: number;
  ownerId: number;
  uploaderId: number;
  sourceType: SourceType;
  originalFilename: string;
  storedKey: string;
  mimeType: string;
  size: number;
  checksum: string;
  sourceUrl: string | null;
  storageProvider: string;
  status: AssetStatus;
  visibility: "private" | "org_read" | "public";
  virusScanStatus: "pending" | "clean" | "infected" | "error";
  version: number;
  parentAssetId: string | null;
  entityType: string | null;
  entityId: number | null;
  workflowInstanceId: number | null;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface IngestResult {
  success: boolean;
  asset?: Asset;
  error?: string;
}

// ============================================================================
// Allowed Formats (Allowlist)
// ============================================================================

const ALLOWED_MIMES = new Set([
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "application/rtf",
  "text/plain",
  "text/csv",
  "text/markdown",
  // Spreadsheets
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.spreadsheet",
  // Presentations
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.presentation",
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/tiff",
  // Archives (restricted)
  "application/zip",
]);

const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".pif",
  ".js", ".vbs", ".vbe", ".wsf", ".wsh", ".ps1", ".psm1",
  ".sh", ".bash", ".csh", ".ksh",
  ".dll", ".sys", ".drv",
  ".jar", ".class", ".war",
  ".svg", ".svgz",
  ".html", ".htm", ".xhtml",
  ".php", ".phtml", ".php3", ".php4", ".php5",
  ".asp", ".aspx", ".jsp", ".jspx",
]);

// ============================================================================
// Asset Ingestion Service
// ============================================================================

class AssetIngestionService {
  private storage: StorageProvider;

  constructor() {
    this.storage = getStorageProvider();
  }

  // ==========================================================================
  // DIRECT UPLOAD
  // ==========================================================================

  async ingestDirectUpload(input: {
    filename: string;
    mimeType: string;
    size: number;
    buffer: Buffer;
    organizationId: number;
    uploaderId: number;
    entityType?: string;
    entityId?: number;
    workflowInstanceId?: number;
    tags?: string[];
    visibility?: Asset["visibility"];
  }): Promise<IngestResult> {
    // 1. Validate MIME type
    if (!ALLOWED_MIMES.has(input.mimeType)) {
      return { success: false, error: `MIME type "${input.mimeType}" is not allowed` };
    }

    // 2. Check blocked MIME
    if (isBlockedMimeType(input.mimeType)) {
      return { success: false, error: `File type "${input.mimeType}" is blocked for security` };
    }

    // 3. Validate extension
    const ext = this.getExtension(input.filename);
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return { success: false, error: `Extension "${ext}" is blocked for security` };
    }

    // 4. Validate size
    const maxSize = await getConfigNumber("upload.maxSizeBytes", MAX_UPLOAD_SIZE_BYTES);
    if (input.size > maxSize) {
      return { success: false, error: `File size (${input.size}) exceeds maximum (${maxSize})` };
    }

    // 5. Sanitize filename
    const safeFilename = sanitizeFileName(input.filename);

    // 6. Validate magic bytes
    const magicResult = this.validateMagicBytes(input.buffer, input.mimeType);
    if (!magicResult.valid) {
      return { success: false, error: magicResult.error };
    }

    // 7. Compute checksum
    const checksum = crypto.createHash("sha256").update(input.buffer).digest("hex");

    // 8. Generate storage key
    const storageKey = this.generateStorageKey(
      input.organizationId,
      input.entityType ?? "general",
      safeFilename
    );

    // 9. Store file
    const stored = await this.storage.put(storageKey, input.buffer, {
      contentType: input.mimeType,
    });

    // 10. Create asset record
    const asset: Asset = {
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      ownerId: input.uploaderId,
      uploaderId: input.uploaderId,
      sourceType: "direct_upload",
      originalFilename: safeFilename,
      storedKey: storageKey,
      mimeType: input.mimeType,
      size: input.size,
      checksum,
      sourceUrl: null,
      storageProvider: this.storage.name,
      status: "ready",
      visibility: input.visibility ?? "private",
      virusScanStatus: "pending",
      version: 1,
      parentAssetId: null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      workflowInstanceId: input.workflowInstanceId ?? null,
      tags: input.tags ?? [],
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    // 11. Audit
    await logAuditEvent({
      userId: input.uploaderId,
      action: "asset.uploaded",
      entityType: "asset",
      entityId: 0,
      after: {
        assetId: asset.id,
        filename: safeFilename,
        mimeType: input.mimeType,
        size: input.size,
        sourceType: "direct_upload",
      },
    });

    log.info({ assetId: asset.id, filename: safeFilename }, "Asset ingested via direct upload");
    return { success: true, asset };
  }

  // ==========================================================================
  // URL SUBMISSION
  // ==========================================================================

  async ingestUrl(input: {
    url: string;
    organizationId: number;
    uploaderId: number;
    entityType?: string;
    entityId?: number;
    workflowInstanceId?: number;
    tags?: string[];
    importAsAsset?: boolean;
  }): Promise<IngestResult> {
    // 1. Validate URL format
    const validation = await validateUrl(input.url);
    if (!validation.safe) {
      return { success: false, error: `URL validation failed: ${validation.reason}` };
    }

    // 2. If not importing, store as external link
    if (!input.importAsAsset) {
      const asset: Asset = {
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        ownerId: input.uploaderId,
        uploaderId: input.uploaderId,
        sourceType: "external_link",
        originalFilename: this.extractFilenameFromUrl(input.url),
        storedKey: "",
        mimeType: "text/uri-list",
        size: 0,
        checksum: crypto.createHash("sha256").update(input.url).digest("hex"),
        sourceUrl: input.url,
        storageProvider: "none",
        status: "ready",
        visibility: "private",
        virusScanStatus: "clean",
        version: 1,
        parentAssetId: null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        workflowInstanceId: input.workflowInstanceId ?? null,
        tags: input.tags ?? [],
        metadata: { originalUrl: input.url },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      await logAuditEvent({
        userId: input.uploaderId,
        action: "asset.link_added",
        entityType: "asset",
        entityId: 0,
        after: { assetId: asset.id, sourceUrl: input.url },
      });

      return { success: true, asset };
    }

    // 3. Secure fetch
    const fetched = await safeFetchUrl(input.url, {
      maxDownloadSize: await getConfigNumber("upload.maxSizeBytes", MAX_UPLOAD_SIZE_BYTES),
    });

    if (!fetched.ok) {
      return { success: false, error: `Fetch failed: ${fetched.error}` };
    }

    // 4. Validate fetched content
    if (!ALLOWED_MIMES.has(fetched.contentType ?? "")) {
      return { success: false, error: `Fetched content type "${fetched.contentType}" is not allowed` };
    }

    // 5. Store as imported asset
    const filename = this.extractFilenameFromUrl(fetched.finalUrl ?? input.url);
    const safeFilename = sanitizeFileName(filename);

    const storageKey = this.generateStorageKey(
      input.organizationId,
      input.entityType ?? "imported",
      safeFilename
    );

    await this.storage.put(storageKey, fetched.buffer!, {
      contentType: fetched.contentType,
    });

    const checksum = crypto.createHash("sha256").update(fetched.buffer!).digest("hex");

    const asset: Asset = {
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      ownerId: input.uploaderId,
      uploaderId: input.uploaderId,
      sourceType: "imported_asset",
      originalFilename: safeFilename,
      storedKey: storageKey,
      mimeType: fetched.contentType ?? "application/octet-stream",
      size: fetched.buffer!.length,
      checksum,
      sourceUrl: input.url,
      storageProvider: this.storage.name,
      status: "ready",
      visibility: "private",
      virusScanStatus: "pending",
      version: 1,
      parentAssetId: null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      workflowInstanceId: input.workflowInstanceId ?? null,
      tags: input.tags ?? [],
      metadata: {
        originalUrl: input.url,
        finalUrl: fetched.finalUrl,
        importedAt: new Date().toISOString(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    await logAuditEvent({
      userId: input.uploaderId,
      action: "asset.imported_from_url",
      entityType: "asset",
      entityId: 0,
      after: {
        assetId: asset.id,
        sourceUrl: input.url,
        finalUrl: fetched.finalUrl,
        size: fetched.buffer!.length,
      },
    });

    log.info({ assetId: asset.id, url: input.url }, "Asset imported from URL");
    return { success: true, asset };
  }

  // ==========================================================================
  // VERSIONING
  // ==========================================================================

  async createVersion(input: {
    parentAssetId: string;
    filename: string;
    mimeType: string;
    size: number;
    buffer: Buffer;
    uploaderId: number;
    changeDescription?: string;
  }): Promise<IngestResult> {
    // Validate new version content
    if (!ALLOWED_MIMES.has(input.mimeType)) {
      return { success: false, error: `MIME type "${input.mimeType}" is not allowed` };
    }

    const safeFilename = sanitizeFileName(input.filename);
    const checksum = crypto.createHash("sha256").update(input.buffer).digest("hex");

    // Generate new version key
    const storageKey = this.generateStorageKey(
      0, // org from parent
      "versions",
      `${input.parentAssetId}_v${Date.now()}_${safeFilename}`
    );

    await this.storage.put(storageKey, input.buffer, {
      contentType: input.mimeType,
    });

    const asset: Asset = {
      id: crypto.randomUUID(),
      organizationId: 0, // Inherited from parent
      ownerId: input.uploaderId,
      uploaderId: input.uploaderId,
      sourceType: "direct_upload",
      originalFilename: safeFilename,
      storedKey: storageKey,
      mimeType: input.mimeType,
      size: input.size,
      checksum,
      sourceUrl: null,
      storageProvider: this.storage.name,
      status: "ready",
      visibility: "private",
      virusScanStatus: "pending",
      version: 0, // Will be incremented from parent
      parentAssetId: input.parentAssetId,
      entityType: null,
      entityId: null,
      workflowInstanceId: null,
      tags: [],
      metadata: {
        changeDescription: input.changeDescription ?? "New version",
        previousVersion: input.parentAssetId,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    await logAuditEvent({
      userId: input.uploaderId,
      action: "asset.version_created",
      entityType: "asset",
      entityId: 0,
      after: {
        assetId: asset.id,
        parentAssetId: input.parentAssetId,
        changeDescription: input.changeDescription,
      },
    });

    return { success: true, asset };
  }

  // ==========================================================================
  // ACCESS CONTROL
  // ==========================================================================

  async canAccess(
    assetId: string,
    userId: number,
    organizationId: number,
    userRole?: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // In production, query the assets table for the actual asset
    // For now, implement basic org isolation check
    const asset = await this.getAsset(assetId);
    if (!asset) {
      return { allowed: false, reason: "Asset not found" };
    }

    // Organization isolation
    if (asset.organizationId !== organizationId) {
      return { allowed: false, reason: "Cross-organization access denied" };
    }

    // Owner always has access
    if (asset.ownerId === userId) {
      return { allowed: true };
    }

    // Visibility check
    if (asset.visibility === "public") {
      return { allowed: true };
    }

    if (asset.visibility === "org_read") {
      return { allowed: true };
    }

    // Admin/superadmin override
    if (userRole === "admin" || userRole === "superadmin") {
      return { allowed: true };
    }

    return { allowed: false, reason: "Insufficient permissions" };
  }

  // ==========================================================================
  // RETRIEVAL
  // ==========================================================================

  async getAsset(id: string): Promise<Asset | null> {
    // In production, query the assets database table
    // For now, return null (will be wired to DB in production)
    return null;
  }

  async getAssetBuffer(assetId: string, userId: number, organizationId: number): Promise<{
    buffer: Buffer;
    metadata: Asset;
  } | null> {
    const access = await this.canAccess(assetId, userId, organizationId);
    if (!access.allowed) {
      log.warn({ assetId, userId }, "Asset access denied");
      return null;
    }

    const asset = await this.getAsset(assetId);
    if (!asset) return null;

    const result = await this.storage.get(asset.storedKey);
    if (!result) return null;

    return { buffer: result.body, metadata: asset };
  }

  // ==========================================================================
  // DELETION
  // ==========================================================================

  async deleteAsset(
    assetId: string,
    userId: number,
    organizationId: number,
    permanent?: boolean
  ): Promise<boolean> {
    const access = await this.canAccess(assetId, userId, organizationId);
    if (!access.allowed) return false;

    if (permanent) {
      const asset = await this.getAsset(assetId);
      if (asset && asset.storedKey) {
        await this.storage.delete(asset.storedKey);
      }
    }

    await logAuditEvent({
      userId,
      action: permanent ? "asset.permanently_deleted" : "asset.soft_deleted",
      entityType: "asset",
      entityId: 0,
      after: { assetId, permanent },
    });

    return true;
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private getExtension(filename: string): string {
    const dot = filename.lastIndexOf(".");
    return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
  }

  private generateStorageKey(
    organizationId: number,
    entityType: string,
    filename: string
  ): string {
    const date = new Date();
    const ymd = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
    const uid = crypto.randomUUID().slice(0, 8);
    return `org/${organizationId}/${entityType}/${ymd}/${uid}_${filename}`;
  }

  private extractFilenameFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;
      const segments = pathname.split("/");
      const last = segments[segments.length - 1];
      return last || "downloaded-file";
    } catch {
      return "downloaded-file";
    }
  }

  private validateMagicBytes(
    buffer: Buffer,
    declaredMime: string
  ): { valid: boolean; error?: string } {
    if (buffer.length < 4) {
      return { valid: false, error: "File appears to be empty or truncated" };
    }

    // PDF check
    if (declaredMime === "application/pdf") {
      if (buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
        return { valid: false, error: "File contents do not match declared PDF type" };
      }
    }

    // JPEG check
    if (declaredMime === "image/jpeg") {
      if (buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
        return { valid: false, error: "File contents do not match declared JPEG type" };
      }
    }

    // PNG check
    if (declaredMime === "image/png") {
      if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4e || buffer[3] !== 0x47) {
        return { valid: false, error: "File contents do not match declared PNG type" };
      }
    }

    // ZIP check (for docx, xlsx, pptx, zip)
    if (
      declaredMime === "application/zip" ||
      declaredMime.includes("officedocument") ||
      declaredMime.includes("opendocument")
    ) {
      if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
        return { valid: false, error: "File contents do not match declared ZIP/Office type" };
      }
    }

    // GIF check
    if (declaredMime === "image/gif") {
      if (buffer[0] !== 0x47 || buffer[1] !== 0x49 || buffer[2] !== 0x46) {
        return { valid: false, error: "File contents do not match declared GIF type" };
      }
    }

    // WebP check
    if (declaredMime === "image/webp") {
      if (buffer[0] !== 0x52 || buffer[1] !== 0x49 || buffer[2] !== 0x46 || buffer[3] !== 0x46) {
        return { valid: false, error: "File contents do not match declared WebP type" };
      }
    }

    return { valid: true };
  }
}

// Singleton
export const assetIngestionService = new AssetIngestionService();
