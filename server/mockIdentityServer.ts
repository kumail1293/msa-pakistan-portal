/**
 * Mock Google Identity Server (development only)
 *
 * A faithful-enough stand-in for Google's OAuth 2.0 endpoints so the
 * official "Sign in with Google" flow can be built and exercised without
 * real Google Cloud credentials.
 *
 * Endpoints (mirror Google's shapes):
 *   GET  /o/oauth2/v2/auth          consent page / code issuance
 *   POST /oauth2/v4/token           authorization_code exchange
 *   GET  /oauth2/v3/userinfo        profile lookup by access token
 *
 * Run it standalone:
 *   pnpm mock:oauth                 # http://localhost:4100
 *
 * The account picker is seeded from MOCK_GOOGLE_ACCOUNTS (JSON array of
 * { email, name }), falling back to a small set of MSAP official-style
 * accounts. Each mock account maps to a real portal member by email, which
 * is exactly how the portal links Google identity to approved members.
 *
 * This file is never imported by the portal server - it only exists for
 * local development. Point OAUTH_SERVER_URL at a real Google-style
 * provider (or Google itself) in production.
 */

import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { SignJWT } from "jose";
import express from "express";
import type { Express, Request, Response } from "express";

export type MockGoogleAccount = {
  email: string;
  name: string;
};

export const DEFAULT_ACCOUNTS: MockGoogleAccount[] = [
  { email: "vpm@msapakistan.org", name: "M. Sarim Sheikh" },
  { email: "president@msapakistan.org", name: "Kumail Danial" },
  { email: "lc.kemu@msap.local", name: "Dr. Ali Hassan" },
  { email: "admin@msap.local", name: "Portal Admin" },
];

/** Parse MOCK_GOOGLE_ACCOUNTS env (JSON) with a safe fallback to defaults. */
function parseConfiguredAccounts(): MockGoogleAccount[] {
  const raw = process.env.MOCK_GOOGLE_ACCOUNTS;
  if (!raw || !raw.trim()) return DEFAULT_ACCOUNTS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_ACCOUNTS;
    const accounts = parsed
      .filter(
        (a): a is MockGoogleAccount =>
          typeof a === "object" &&
          a !== null &&
          typeof (a as MockGoogleAccount).email === "string" &&
          (a as MockGoogleAccount).email.includes("@") &&
          typeof (a as MockGoogleAccount).name === "string"
      )
      .map((a) => ({ email: a.email, name: a.name }));
    return accounts.length > 0 ? accounts : DEFAULT_ACCOUNTS;
  } catch {
    console.warn(
      "[MockOAuth] MOCK_GOOGLE_ACCOUNTS is not valid JSON - using default accounts."
    );
    return DEFAULT_ACCOUNTS;
  }
}

type AuthRequestParams = {
  clientId: string;
  redirectUri: string;
  responseType: string;
  scope: string;
  state: string;
};

type StoredCode = {
  account: MockGoogleAccount;
  redirectUri: string;
  expiresAt: number;
  used: boolean;
};

const CODE_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1h, like Google

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Escape a value for safe embedding in the consent page HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function createMockIdentityApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  const accounts = parseConfiguredAccounts();
  const codes = new Map<string, StoredCode>();
  const tokens = new Map<string, MockGoogleAccount>();

  function readAuthParams(req: Request): AuthRequestParams {
    const clientId =
      (typeof req.query.client_id === "string" && req.query.client_id) || "";
    const redirectUri =
      (typeof req.query.redirect_uri === "string" && req.query.redirect_uri) ||
      "";
    const responseType =
      (typeof req.query.response_type === "string" && req.query.response_type) ||
      "";
    const scope =
      (typeof req.query.scope === "string" && req.query.scope) || "";
    const state = (typeof req.query.state === "string" && req.query.state) || "";
    return { clientId, redirectUri, responseType, scope, state };
  }

  function renderErrorPage(res: Response, message: string): void {
    res
      .status(400)
      .send(
        `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;padding:40px"><h2>Mock Google — invalid request</h2><p>${escapeHtml(
          message
        )}</p></body></html>`
      );
  }

  app.get("/", (_req, res) => {
    res
      .status(200)
      .type("html")
      .send(
        `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;padding:40px">
          <h2>Mock Google Identity Server</h2>
          <p>Dev-only stand-in for Google's OAuth endpoints.</p>
          <ul>
            <li>GET /o/oauth2/v2/auth — consent page / code issuance</li>
            <li>POST /oauth2/v4/token — authorization_code exchange</li>
            <li>GET /oauth2/v3/userinfo — profile by access token</li>
          </ul>
          <p>Accounts on this instance:</p>
          <ul>${accounts
            .map(
              (a) => `<li>${escapeHtml(a.name)} &lt;${escapeHtml(a.email)}&gt;</li>`
            )
            .join("")}</ul>
        </body></html>`
      );
  });

  app.get("/o/oauth2/v2/auth", (req, res) => {
    const params = readAuthParams(req);
    if (!params.clientId) return renderErrorPage(res, "Missing client_id.");
    if (!isHttpUrl(params.redirectUri)) {
      return renderErrorPage(res, "redirect_uri must be an http(s) URL.");
    }
    if (params.responseType !== "code") {
      return renderErrorPage(res, "Only response_type=code is supported.");
    }
    if (!params.state) return renderErrorPage(res, "Missing state.");

    const loginHint =
      (typeof req.query.login_hint === "string" && req.query.login_hint) || "";

    // Selecting an account re-enters /auth with login_hint -> issue the code.
    if (loginHint) {
      const account = accounts.find(
        (a) => a.email.toLowerCase() === loginHint.toLowerCase()
      );
      if (!account) {
        return renderErrorPage(res, `Unknown account: ${loginHint}`);
      }
      const code = randomBytes(24).toString("hex");
      codes.set(code, {
        account,
        redirectUri: params.redirectUri,
        expiresAt: Date.now() + CODE_TTL_MS,
        used: false,
      });
      const target = new URL(params.redirectUri);
      target.searchParams.set("code", code);
      target.searchParams.set("state", params.state);
      return res.redirect(302, target.toString());
    }

    // Consent page: Google-style account chooser.
    const baseQuery = new URLSearchParams({
      client_id: params.clientId,
      redirect_uri: params.redirectUri,
      response_type: params.responseType,
      scope: params.scope,
      state: params.state,
    });
    const rows = accounts
      .map((account) => {
        const linkQuery = new URLSearchParams(baseQuery);
        linkQuery.set("login_hint", account.email);
        return `
          <a class="account" href="/o/oauth2/v2/auth?${linkQuery.toString()}">
            <span class="avatar">${escapeHtml(initialsOf(account.name))}</span>
            <span class="meta">
              <span class="name">${escapeHtml(account.name)}</span>
              <span class="email">${escapeHtml(account.email)}</span>
            </span>
          </a>`;
      })
      .join("");

    res.status(200).type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sign in with Google — Mock</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body {
    font-family: "Google Sans", Roboto, Arial, sans-serif;
    background: #fff; color: #202124;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; padding: 24px;
  }
  .card {
    width: 100%; max-width: 460px; border: 1px solid #dadce0;
    border-radius: 8px; padding: 48px 40px 36px; text-align: center;
  }
  .google { display: inline-flex; align-items: center; gap: 10px; }
  .google .g { font-size: 26px; font-weight: 500; letter-spacing: -1px; }
  .google .g span:nth-child(1){color:#4285F4}
  .google .g span:nth-child(2){color:#EA4335}
  .google .g span:nth-child(3){color:#FBBC05}
  .google .g span:nth-child(4){color:#34A853}
  .google .word { font-size: 20px; color: #5f6368; }
  h1 { font-size: 24px; font-weight: 400; margin: 20px 0 4px; }
  .sub { color: #5f6368; font-size: 14px; margin-bottom: 32px; }
  .account {
    display: flex; align-items: center; gap: 16px; text-align: left;
    padding: 12px 16px; border-radius: 999px; text-decoration: none;
    color: #202124; transition: background .15s ease;
  }
  .account:hover { background: #f1f3f4; }
  .avatar {
    width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
    background: #1a73e8; color: #fff; font-weight: 600; font-size: 16px;
    display: flex; align-items: center; justify-content: center;
  }
  .meta { display: flex; flex-direction: column; min-width: 0; }
  .name { font-size: 15px; font-weight: 500; }
  .email { font-size: 13px; color: #5f6368; }
  .hint { margin-top: 32px; font-size: 13px; color: #5f6368; }
  .hint a { color: #1a73e8; text-decoration: none; }
</style>
</head>
<body>
  <div class="card">
    <div class="google">
      <span class="g"><span>G</span><span>o</span><span>o</span><span>g</span>l</span><span class="g">e</span>
      <span class="word">&nbsp;</span>
    </div>
    <h1>Sign in with Google</h1>
    <p class="sub">to continue to <b>MSAP Member Portal</b> (mock identity server)</p>
    ${rows}
    <p class="hint"><a href="https://developers.google.com/identity/protocols/oauth2" target="_blank" rel="noreferrer">Learn more</a></p>
  </div>
</body>
</html>`);
  });

  app.post("/oauth2/v4/token", async (req, res) => {
    const body = req.body ?? {};
    const grantType = body.grant_type ?? "";
    const code = body.code ?? "";
    const clientId = body.client_id ?? "";
    const redirectUri = body.redirect_uri ?? "";

    if (grantType !== "authorization_code") {
      return res
        .status(400)
        .json({ error: "unsupported_grant_type", error_description: "Only authorization_code is supported." });
    }

    const stored = codes.get(code);
    if (!stored || stored.expiresAt <= Date.now()) {
      return res.status(400).json({ error: "invalid_grant", error_description: "Code is unknown or expired." });
    }
    if (stored.used) {
      return res.status(400).json({ error: "invalid_grant", error_description: "Code has already been used." });
    }
    if (redirectUri && stored.redirectUri !== redirectUri) {
      return res.status(400).json({ error: "invalid_grant", error_description: "redirect_uri mismatch." });
    }

    stored.used = true;

    const accessToken = randomBytes(32).toString("hex");
    const refreshToken = randomBytes(32).toString("hex");
    const secret = new TextEncoder().encode(
      process.env.MOCK_OAUTH_SECRET || "mock-google-identity-server-secret"
    );
    const issuer = `${req.protocol}://${req.get("host")}`;
    const idToken = await new SignJWT({
      email: stored.account.email,
      email_verified: true,
      name: stored.account.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer(issuer)
      .setAudience(clientId)
      .setSubject(stored.account.email)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);

    tokens.set(accessToken, stored.account);

    return res.status(200).json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: Math.floor(TOKEN_TTL_MS / 1000),
      scope: "openid email profile",
      refresh_token: refreshToken,
      id_token: idToken,
    });
  });

  app.get("/oauth2/v3/userinfo", (req, res) => {
    const header = req.headers.authorization ?? "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    const token = match ? match[1] : "";
    const account = token ? tokens.get(token) : undefined;

    if (!account) {
      return res.status(401).json({ error: "invalid_token", error_description: "Invalid or expired access token." });
    }

    return res.status(200).json({
      sub: account.email,
      name: account.name,
      given_name: account.name.split(/\s+/)[0] ?? "",
      family_name: account.name.split(/\s+/).slice(1).join(" "),
      picture: "",
      email: account.email,
      email_verified: true,
      locale: "en",
    });
  });

  return app;
}

/** Standalone entry point: `pnpm mock:oauth` */
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const port = parseInt(process.env.MOCK_OAUTH_PORT || "4100", 10);
  const app = createMockIdentityApp();
  app.listen(port, () => {
    console.log(`[MockOAuth] Google identity server running on http://localhost:${port}/`);
    console.log(
      "[MockOAuth] Set OAUTH_SERVER_URL=http://localhost:4100 (or leave unset in dev) and sign in with Google from /login."
    );
  });
}
