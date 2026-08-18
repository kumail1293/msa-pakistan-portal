/**
 * Official OAuth client (Google-style)
 *
 * Drives the "Sign in with Google" flow for MSAP officials. The provider is
 * configured via OAUTH_SERVER_URL; when it is unset in development, the
 * bundled mock identity server (pnpm mock:oauth, http://localhost:4100) is
 * used so the whole flow works locally with no external credentials.
 *
 * Security properties:
 * - The `state` parameter is a server-issued, single-use nonce stored
 *   in memory with a TTL (never echoed from the client), and the callback
 *   consumes it exactly once - replaying a callback URL fails.
 * - redirect_uri is always the portal's own /api/oauth/callback, built
 *   from the request origin - it can never be pointed elsewhere.
 * - The callback never creates accounts: the Google email must match an
 *   existing approved member account, otherwise sign-in is refused.
 */

import { randomBytes } from "node:crypto";
import axios from "axios";
import { AXIOS_TIMEOUT_MS } from "@shared/const";
import type { Request } from "express";
import { ENV } from "./env";

/** Local mock identity server used when OAUTH_SERVER_URL is unset in dev. */
const DEV_MOCK_BASE_URL = "http://localhost:4100";

const AUTHORIZE_PATH = "/o/oauth2/v2/auth";
const TOKEN_PATH = "/oauth2/v4/token";
const USERINFO_PATH = "/oauth2/v3/userinfo";

const NONCE_TTL_MS = 10 * 60 * 1000;
const NONCE_MAX_ENTRIES = 5_000;

export type OAuthTokenResponse = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  idToken?: string;
  refreshToken?: string;
  scope: string;
};

export type OAuthUserInfo = {
  sub: string;
  name: string;
  email: string;
  emailVerified: boolean;
  picture?: string;
};

/**
 * Resolve the provider base URL. Production must configure
 * OAUTH_SERVER_URL; development falls back to the bundled mock server.
 */
export function getOAuthBaseUrl(): string | null {
  if (ENV.oAuthServerUrl) return ENV.oAuthServerUrl;
  if (!ENV.isProduction) return DEV_MOCK_BASE_URL;
  return null;
}

/** True when the official Google sign-in can be offered. */
export function isOfficialOAuthConfigured(): boolean {
  return getOAuthBaseUrl() !== null;
}

// ============================================================================
// State (CSRF nonce) store
// ============================================================================

type NonceEntry = {
  redirectUri: string;
  nextPath: string;
  expiresAt: number;
};

const nonceStore = new Map<string, NonceEntry>();

function pruneExpiredNonces(now: number): void {
  nonceStore.forEach((entry, key) => {
    if (entry.expiresAt <= now) nonceStore.delete(key);
  });
}

export function issueOAuthState(
  redirectUri: string,
  nextPath: string,
  now: number = Date.now()
): string {
  pruneExpiredNonces(now);
  // Bound the map so a flood of authorize requests cannot grow memory
  // without limit; dropping all entries is safe (they are only nonces).
  if (nonceStore.size >= NONCE_MAX_ENTRIES) nonceStore.clear();
  const state = randomBytes(24).toString("hex");
  nonceStore.set(state, {
    redirectUri,
    nextPath,
    expiresAt: now + NONCE_TTL_MS,
  });
  return state;
}

/**
 * Consume (and delete) a nonce. Returns null for unknown, expired or
 * already-consumed state - single-use by construction.
 */
export function consumeOAuthState(
  state: string,
  now: number = Date.now()
): NonceEntry | null {
  const entry = nonceStore.get(state);
  if (!entry) return null;
  nonceStore.delete(state);
  if (entry.expiresAt <= now) return null;
  return entry;
}

/** Small helper used by tests. */
export function oAuthStateCount(): number {
  return nonceStore.size;
}

// ============================================================================
// Authorize URL
// ============================================================================

/**
 * Build the provider's authorize URL for this request. redirect_uri is
 * always `<origin>/api/oauth/callback`, and the state nonce is issued
 * server-side. Returns null when no provider is configured.
 */
export function buildAuthorizeUrl(
  req: Request,
  nextPath: string = "/dashboard"
): string | null {
  const base = getOAuthBaseUrl();
  if (!base) return null;

  const host = req.get("host") || "localhost:3000";
  const redirectUri = `${req.protocol}://${host}/api/oauth/callback`;
  const state = issueOAuthState(redirectUri, nextPath);

  const params = new URLSearchParams({
    client_id: ENV.appId || "msap-portal",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
  });

  return `${base}${AUTHORIZE_PATH}?${params.toString()}`;
}

// ============================================================================
// Token + userinfo exchange
// ============================================================================

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<OAuthTokenResponse> {
  const base = getOAuthBaseUrl();
  if (!base) {
    throw new Error("Official OAuth is not configured.");
  }

  const { data } = await axios.post<Record<string, unknown>>(
    `${base}${TOKEN_PATH}`,
    {
      code,
      client_id: ENV.appId || "msap-portal",
      client_secret: process.env.OAUTH_CLIENT_SECRET || "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: AXIOS_TIMEOUT_MS,
    }
  );

  if (!data || typeof data.access_token !== "string") {
    throw new Error(
      `Token exchange failed: ${JSON.stringify(data?.error ?? "no access_token")}`
    );
  }

  return {
    accessToken: data.access_token,
    tokenType: typeof data.token_type === "string" ? data.token_type : "Bearer",
    expiresIn: typeof data.expires_in === "number" ? data.expires_in : 3600,
    idToken: typeof data.id_token === "string" ? data.id_token : undefined,
    refreshToken:
      typeof data.refresh_token === "string" ? data.refresh_token : undefined,
    scope: typeof data.scope === "string" ? data.scope : "",
  };
}

export async function getUserInfo(
  accessToken: string
): Promise<OAuthUserInfo> {
  const base = getOAuthBaseUrl();
  if (!base) {
    throw new Error("Official OAuth is not configured.");
  }

  const { data } = await axios.get<Record<string, unknown>>(
    `${base}${USERINFO_PATH}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: AXIOS_TIMEOUT_MS,
    }
  );

  const email = typeof data.email === "string" ? data.email : "";
  if (!email) {
    throw new Error("Provider did not return an email address.");
  }

  return {
    sub: typeof data.sub === "string" ? data.sub : email,
    name: typeof data.name === "string" ? data.name : "",
    email,
    emailVerified: data.email_verified !== false,
    picture: typeof data.picture === "string" ? data.picture : undefined,
  };
}
