import { COOKIE_NAME } from "@shared/const";
import type { Express, Request, Response } from "express";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import {
  consumeOAuthState,
  exchangeCodeForToken,
  getUserInfo,
  isOfficialOAuthConfigured,
} from "./officialOAuth";
import * as memberAccounts from "../services/memberAccountService";
import { MEMBER_SESSION_MAX_AGE_MS } from "../services/memberAuthService";
import { childLogger } from "./logger";

const log = childLogger("OAuth");

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Official sign-in callback ("Sign in with Google").
 *
 * The provider redirects here with `code` + `state` after the official
 * consents. Unlike the old platform flow, this NEVER creates accounts: the
 * Google email must match an approved member account, otherwise the user is
 * bounced back to /login with an explanatory oauth_error parameter.
 */
export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // State must be a server-issued, single-use nonce. Consuming it here
    // (before any external calls) makes replaying a callback URL a no-op.
    const nonce = consumeOAuthState(state);
    if (!nonce) {
      res.status(400).json({ error: "invalid or expired state" });
      return;
    }

    if (!isOfficialOAuthConfigured()) {
      res.redirect(302, "/login?oauth_error=unconfigured");
      return;
    }

    const redirectToLoginError = (oauthError: string) => {
      const next = nonce.nextPath || "/dashboard";
      const safeNext =
        next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      const target = new URL(
        `/login?oauth_error=${encodeURIComponent(oauthError)}`,
        `${req.protocol}://${req.get("host") || "localhost:3000"}`
      );
      // Keep the intended landing for a successful retry.
      target.searchParams.set("next", safeNext);
      res.redirect(302, target.toString());
    };

    try {
      const tokenResponse = await exchangeCodeForToken(code, nonce.redirectUri);
      const userInfo = await getUserInfo(tokenResponse.accessToken);

      const email = (userInfo.email || "").trim().toLowerCase();
      if (!email) {
        redirectToLoginError("no_email");
        return;
      }

      // Link by email: officials are approved members whose portal account
      // email matches the Google account. No account is ever created here.
      const member = memberAccounts.findUserByIdentity(email);
      if (
        !member ||
        member.active === false ||
        member.membershipStatus !== "Active"
      ) {
        log.warn({ email }, "Sign-in refused — no active member account");
        redirectToLoginError("no_account");
        return;
      }

      // Mark the account as Google-linked and record the sign-in.
      memberAccounts.upsertUser({
        openId: member.openId,
        loginMethod: "google",
      });
      memberAccounts.recordLastSignIn(member.id);

      const sessionToken = await sdk.createSessionToken(member.openId, {
        name: member.name || member.email || "Member",
        expiresInMs: MEMBER_SESSION_MAX_AGE_MS,
        version: member.sessionEpoch ?? 0,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: MEMBER_SESSION_MAX_AGE_MS,
      });

      const next = nonce.nextPath || "/dashboard";
      const safeNext =
        next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      res.redirect(302, safeNext);
    } catch (error) {
      log.error({ err: error }, "Official sign-in callback failed");
      redirectToLoginError("failed");
    }
  });
}
