/**
 * Storage Provider Abstraction
 *
 * Decouples application logic from storage implementation.
 * Supports local dev, production object storage, and future cloud providers.
 *
 * Core operations: put, get, delete, exists, getSignedUrl, copy, metadata.
 */

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { childLogger } from "../_core/logger";

const log = childLogger("Storage");

// ============================================================================
// Types
// ============================================================================

export interface StorageMetadata {
  key: string;
  size: number;
  contentType: string;
  checksum: string;
  lastModified: Date;
  etag?: string;
  customMetadata?: Record<string, string>;
}

export interface PutOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  visibility?: "private" | "public-read";
}

export interface StorageProvider {
  name: string;
  put(key: string, body: Buffer, options?: PutOptions): Promise<StorageMetadata>;
  get(key: string): Promise<{ body: Buffer; metadata: StorageMetadata } | null>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  copy(source: string, destination: string): Promise<StorageMetadata>;
  metadata(key: string): Promise<StorageMetadata | null>;
}

// ============================================================================
// Local Filesystem Provider (Development)
// ============================================================================

export class LocalStorageProvider implements StorageProvider {
  name = "local";
  private baseDir: string;

  constructor(baseDir: string = ".data/storage") {
    this.baseDir = baseDir;
  }

  async put(key: string, body: Buffer, options?: PutOptions): Promise<StorageMetadata> {
    const filePath = path.join(this.baseDir, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, body);

    const checksum = crypto.createHash("sha256").update(body).digest("hex");

    return {
      key,
      size: body.length,
      contentType: options?.contentType ?? "application/octet-stream",
      checksum,
      lastModified: new Date(),
    };
  }

  async get(key: string): Promise<{ body: Buffer; metadata: StorageMetadata } | null> {
    try {
      const filePath = path.join(this.baseDir, key);
      const body = await fs.readFile(filePath);
      const stat = await fs.stat(filePath);
      const checksum = crypto.createHash("sha256").update(body).digest("hex");

      return {
        body,
        metadata: {
          key,
          size: stat.size,
          contentType: "application/octet-stream",
          checksum,
          lastModified: stat.mtime,
        },
      };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await fs.unlink(path.join(this.baseDir, key));
      return true;
    } catch {
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.baseDir, key));
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(key: string, _expiresIn?: number): Promise<string> {
    // Local dev: return a direct path
    return `/api/assets/${key}`;
  }

  async copy(source: string, destination: string): Promise<StorageMetadata> {
    const srcPath = path.join(this.baseDir, source);
    const destPath = path.join(this.baseDir, destination);
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(srcPath, destPath);
    const stat = await fs.stat(destPath);
    const body = await fs.readFile(destPath);
    const checksum = crypto.createHash("sha256").update(body).digest("hex");

    return {
      key: destination,
      size: stat.size,
      contentType: "application/octet-stream",
      checksum,
      lastModified: stat.mtime,
    };
  }

  async metadata(key: string): Promise<StorageMetadata | null> {
    try {
      const filePath = path.join(this.baseDir, key);
      const stat = await fs.stat(filePath);
      const body = await fs.readFile(filePath);
      const checksum = crypto.createHash("sha256").update(body).digest("hex");

      return {
        key,
        size: stat.size,
        contentType: "application/octet-stream",
        checksum,
        lastModified: stat.mtime,
      };
    } catch {
      return null;
    }
  }
}

// ============================================================================
// In-Memory Provider (Testing)
// ============================================================================

export class MemoryStorageProvider implements StorageProvider {
  name = "memory";
  private store = new Map<string, { body: Buffer; metadata: StorageMetadata }>();

  async put(key: string, body: Buffer, options?: PutOptions): Promise<StorageMetadata> {
    const checksum = crypto.createHash("sha256").update(body).digest("hex");
    const metadata: StorageMetadata = {
      key,
      size: body.length,
      contentType: options?.contentType ?? "application/octet-stream",
      checksum,
      lastModified: new Date(),
    };
    this.store.set(key, { body, metadata });
    return metadata;
  }

  async get(key: string): Promise<{ body: Buffer; metadata: StorageMetadata } | null> {
    const entry = this.store.get(key);
    return entry ?? null;
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async getSignedUrl(key: string, _expiresIn?: number): Promise<string> {
    return `/api/assets/${key}`;
  }

  async copy(source: string, destination: string): Promise<StorageMetadata> {
    const entry = this.store.get(source);
    if (!entry) throw new Error(`Source not found: ${source}`);
    const newMetadata = { ...entry.metadata, key: destination, lastModified: new Date() };
    this.store.set(destination, { body: entry.body, metadata: newMetadata });
    return newMetadata;
  }

  async metadata(key: string): Promise<StorageMetadata | null> {
    return this.store.get(key)?.metadata ?? null;
  }

  /** Clear all entries (for testing) */
  clear(): void {
    this.store.clear();
  }
}

// ============================================================================
// Factory
// ============================================================================

let _provider: StorageProvider | null = null;

/**
 * Get the active storage provider. Creates one based on environment.
 */
export function getStorageProvider(): StorageProvider {
  if (_provider) return _provider;

  const storageType = process.env.MSAP_STORAGE_TYPE ?? "local";

  switch (storageType) {
    case "memory":
      _provider = new MemoryStorageProvider();
      break;
    case "local":
    default:
      _provider = new LocalStorageProvider(
        process.env.MSAP_STORAGE_DIR ?? ".data/storage"
      );
      break;
  }

  log.info({ provider: _provider.name }, "Storage provider initialized");
  return _provider;
}

/**
 * Override the storage provider (for testing or custom implementations).
 */
export function setStorageProvider(provider: StorageProvider): void {
  _provider = provider;
}
