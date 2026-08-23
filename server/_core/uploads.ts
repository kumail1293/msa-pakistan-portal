/**
 * Upload validation helpers.
 *
 * The membership form ships files as base64 with a client-declared mimeType.
 * That declaration is untrusted — validate the actual content via magic bytes
 * before the payload is forwarded to the Apps Script / storage.
 */

export type UploadInput = { fileName: string; mimeType: string; base64: string };

/** Maximum file size: 50MB for all uploads */
export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;

/** Dangerous MIME types that should never be uploaded */
const BLOCKED_MIMES = new Set([
  "text/html",
  "application/xhtml+xml",
  "application/x-shockwave-flash",
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-executable",
  "application/x-sharedlib",
  "application/x-elf",
  "application/x-mach-binary",
]);

/**
 * Sanitize a filename: remove path separators, null bytes, and dangerous chars.
 * Prevents path traversal attacks.
 */
export function sanitizeFileName(name: string): string {
  if (!name) return "unnamed";
  return name
    .replace(/\\/g, "_")           // Windows path separator
    .replace(/\//g, "_")            // Unix path separator
    .replace(/\.\./g, "_")          // Parent directory traversal
    .replace(/\x00/g, "_")          // Null byte
    .replace(/[<>:"|?*]/g, "_")     // Invalid filename chars
    .replace(/^[.\s]+/, "")         // Leading dots/spaces
    .slice(0, 200)                    // Max length
    || "unnamed";
}

/**
 * Check if a MIME type is explicitly blocked.
 */
export function isBlockedMimeType(mimeType: string): boolean {
  return BLOCKED_MIMES.has(mimeType.toLowerCase());
}

const MAGIC: Array<{
  kind: "image" | "pdf";
  mime: string;
  match: (bytes: Uint8Array) => boolean;
}> = [
  {
    kind: "image",
    mime: "image/jpeg",
    match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    kind: "image",
    mime: "image/png",
    match: (b) =>
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    kind: "image",
    mime: "image/webp",
    match: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
  {
    kind: "image",
    mime: "image/gif",
    match: (b) =>
      (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) &&
      (b[4] === 0x37 || b[4] === 0x39) &&
      b[5] === 0x61,
  },
  {
    kind: "pdf",
    mime: "application/pdf",
    match: (b) =>
      b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  },
];

/**
 * Validate an upload by sniffing its first bytes.
 *
 * @param upload  base64 payload with a client-declared mimeType
 * @param kinds   which kinds are accepted ("image" and/or "pdf")
 * @returns an error message, or null when the upload is valid
 */
export function validateUpload(
  upload: UploadInput,
  kinds: Array<"image" | "pdf">
): string | null {
  if (!upload || !upload.base64) return "Missing file data.";

  // Check for blocked MIME types first
  if (isBlockedMimeType(upload.mimeType)) {
    return `File type ${upload.mimeType} is not allowed for security reasons.`;
  }

  // Check file size (base64 is ~33% larger than raw bytes)
  const estimatedSize = Math.floor(upload.base64.length * 0.75);
  if (estimatedSize > MAX_UPLOAD_SIZE_BYTES) {
    return `File size exceeds maximum of ${Math.floor(MAX_UPLOAD_SIZE_BYTES / 1024 / 1024)}MB.`;
  }

  // Block SVG uploads (can contain embedded JavaScript)
  const lowerName = (upload.fileName || "").toLowerCase();
  if (lowerName.endsWith(".svg") || lowerName.endsWith(".svgz")) {
    return "SVG files are not allowed for security reasons.";
  }
  if (upload.mimeType === "image/svg+xml" || upload.mimeType === "text/xml") {
    return "SVG/XML files are not allowed for security reasons.";
  }

  const declared = (upload.mimeType || "").toLowerCase();
  if (!kinds.includes(declared === "application/pdf" ? "pdf" : "image")) {
    return `File type ${upload.mimeType || "unknown"} is not allowed.`;
  }

  const header = declared === "application/pdf" ? "pdf" : "image";

  // Decode just the first 16 bytes — no need to allocate the whole payload
  // for validation.
  let bytes: Uint8Array;
  try {
    const head = upload.base64.slice(0, 24);
    const decoded = Buffer.from(head, "base64");
    bytes = new Uint8Array(decoded);
  } catch {
    return "Could not read file contents.";
  }
  if (bytes.length < 4) return "File appears to be empty or truncated.";

  const match = MAGIC.find((m) => m.kind === header && m.match(bytes));
  if (!match) {
    return `File contents do not match the declared type (${upload.mimeType}).`;
  }

  // The declared mimeType must agree with the sniffed type.
  if (declared !== match.mime) {
    return `File type mismatch: contents look like ${match.mime}.`;
  }

  return null;
}
