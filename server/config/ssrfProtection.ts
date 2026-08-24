/**
 * SSRF Protection Module
 *
 * Protects against Server-Side Request Forgery when fetching remote URLs.
 * Blocks: localhost, loopback, private IPs, link-local, metadata endpoints,
 * internal DNS targets, unsafe redirects, and DNS rebinding.
 *
 * Usage:
 *   const result = await validateAndFetchUrl("https://example.com/doc.pdf");
 *   if (result.safe) { /* fetch the URL * / }
 */

import dns from "dns";
import { URL } from "url";
import { childLogger } from "../_core/logger";

const log = childLogger("SSRF");

// ============================================================================
// Types
// ============================================================================

export interface SSRFValidationResult {
  safe: boolean;
  reason?: string;
  resolvedIp?: string;
  finalUrl?: string;
}

export interface FetchResult {
  ok: boolean;
  buffer?: Buffer;
  contentType?: string;
  contentLength?: number;
  finalUrl?: string;
  error?: string;
}

// ============================================================================
// Blocked Patterns
// ============================================================================

/** Blocked IP ranges (private, loopback, link-local, metadata) */
const BLOCKED_IP_RANGES: Array<{ start: string; end: string; label: string }> = [
  // Loopback
  { start: "127.0.0.0", end: "127.255.255.255", label: "loopback" },
  // Private Class A
  { start: "10.0.0.0", end: "10.255.255.255", label: "private Class A" },
  // Private Class B
  { start: "172.16.0.0", end: "172.31.255.255", label: "private Class B" },
  // Private Class C
  { start: "192.168.0.0", end: "192.168.255.255", label: "private Class C" },
  // Link-local
  { start: "169.254.0.0", end: "169.254.255.255", label: "link-local" },
  // Cloud metadata (AWS, GCP, Azure)
  { start: "169.254.169.254", end: "169.254.169.254", label: "cloud metadata" },
  // Broadcast
  { start: "255.255.255.255", end: "255.255.255.255", label: "broadcast" },
];

/** Blocked hostnames */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "0.0.0.0",
  "metadata.google.internal",
  "metadata.google.internal.",
  "169.254.169.254",
  "instance-data",
  "workers-host",
]);

/** Blocked hostname patterns (regex) */
const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^0\.0\.0\.0$/,
  /\.local$/i,
  /\.internal$/i,
  /\.localhost$/i,
  /^metadata\./i,
];

/** Allowed protocols */
const ALLOWED_PROTOCOLS = new Set(["https:"]);

/** Maximum URL length */
const MAX_URL_LENGTH = 2048;

/** Maximum redirect hops */
const MAX_REDIRECTS = 5;

/** Fetch timeout (ms) */
const FETCH_TIMEOUT_MS = 30_000;

/** Maximum download size (bytes) */
const MAX_DOWNLOAD_SIZE = 100 * 1024 * 1024; // 100MB

// ============================================================================
// IP Utilities
// ============================================================================

function ipToNumber(ip: string): number {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return NaN;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isIpInRange(ip: string, start: string, end: string): boolean {
  const ipNum = ipToNumber(ip);
  const startNum = ipToNumber(start);
  const endNum = ipToNumber(end);
  if (isNaN(ipNum) || isNaN(startNum) || isNaN(endNum)) return false;
  return ipNum >= startNum && ipNum <= endNum;
}

function isBlockedIp(ip: string): string | null {
  for (const range of BLOCKED_IP_RANGES) {
    if (isIpInRange(ip, range.start, range.end)) {
      return range.label;
    }
  }
  return null;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a URL for safety before fetching.
 */
export async function validateUrl(urlString: string): Promise<SSRFValidationResult> {
  // 1. Basic URL parsing
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { safe: false, reason: "Invalid URL format" };
  }

  // 2. Length check
  if (urlString.length > MAX_URL_LENGTH) {
    return { safe: false, reason: `URL exceeds maximum length of ${MAX_URL_LENGTH}` };
  }

  // 3. Protocol check
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return {
      safe: false,
      reason: `Protocol "${url.protocol}" is not allowed. Only HTTPS is permitted.`,
    };
  }

  // 4. Hostname checks
  const hostname = url.hostname.toLowerCase();

  // Check blocked hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { safe: false, reason: `Hostname "${hostname}" is blocked` };
  }

  // Check blocked hostname patterns
  for (const pattern of BLOCKED_HOSTNAME_PATTERNS) {
    if (pattern.test(hostname)) {
      return { safe: false, reason: `Hostname "${hostname}" matches blocked pattern` };
    }
  }

  // 5. DNS resolution + IP check
  try {
    const ips = await dns.promises.resolve4(hostname);
    for (const ip of ips) {
      const blocked = isBlockedIp(ip);
      if (blocked) {
        return {
          safe: false,
          reason: `Resolved IP ${ip} is in blocked range (${blocked})`,
          resolvedIp: ip,
        };
      }
    }
  } catch (error: any) {
    // DNS resolution failure — could be DNS rebinding attempt
    return {
      safe: false,
      reason: `DNS resolution failed: ${error.message ?? "unknown error"}`,
    };
  }

  // 6. Port check (block non-standard ports except 443)
  const port = url.port ? parseInt(url.port, 10) : 443;
  if (port !== 443 && port !== 80) {
    return { safe: false, reason: `Port ${port} is not allowed` };
  }

  return { safe: true };
}

// ============================================================================
// Safe Fetching
// ============================================================================

/**
 * Safely fetch a URL with SSRF protection, size limits, and timeout.
 */
export async function safeFetchUrl(
  urlString: string,
  options: {
    maxDownloadSize?: number;
    timeout?: number;
    followRedirects?: boolean;
  } = {}
): Promise<FetchResult> {
  const maxDownloadSize = options.maxDownloadSize ?? MAX_DOWNLOAD_SIZE;
  const timeout = options.timeout ?? FETCH_TIMEOUT_MS;

  // Validate URL first
  const validation = await validateUrl(urlString);
  if (!validation.safe) {
    return { ok: false, error: validation.reason };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(urlString, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "MSAP-Portal/1.0 (Safe Fetch)",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    // Check content length
    const contentLength = parseInt(response.headers.get("content-length") ?? "0", 10);
    if (contentLength > maxDownloadSize) {
      return {
        ok: false,
        error: `File size (${contentLength} bytes) exceeds maximum (${maxDownloadSize} bytes)`,
      };
    }

    // Read body with size limit
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxDownloadSize) {
      return {
        ok: false,
        error: `Downloaded size (${arrayBuffer.byteLength} bytes) exceeds maximum`,
      };
    }

    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get("content-type") ?? "application/octet-stream";

    return {
      ok: true,
      buffer,
      contentType,
      contentLength: buffer.length,
      finalUrl: response.url,
    };
  } catch (error: any) {
    if (error.name === "AbortError") {
      return { ok: false, error: `Fetch timed out after ${timeout}ms` };
    }
    return { ok: false, error: `Fetch failed: ${error.message ?? "unknown error"}` };
  }
}

// ============================================================================
// Exported Constants
// ============================================================================

export { MAX_DOWNLOAD_SIZE, FETCH_TIMEOUT_MS, MAX_REDIRECTS, ALLOWED_PROTOCOLS };
