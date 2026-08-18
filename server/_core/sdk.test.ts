import { beforeEach, describe, expect, it } from "vitest";
import { COOKIE_NAME } from "@shared/const";
import { HttpError } from "@shared/_core/errors";
import type { Request } from "express";
import { sdk } from "./sdk";
import {
  findUserByOpenId,
  resetMemberStoreForTests,
  revokeAllSessions,
  updateOfficial,
  upsertUser,
} from "../services/memberAccountService";

function sessionCookieReq(token: string): Request {
  return {
    headers: { cookie: `${COOKIE_NAME}=${token}` },
  } as unknown as Request;
}

beforeEach(() => {
  resetMemberStoreForTests();
});

describe("session revocation epoch (ver claim)", () => {
  it("round-trips the epoch: a session signed at epoch 7 verifies at epoch 7", async () => {
    const token = await sdk.createSessionToken("sdk:roundtrip", {
      name: "Round Trip",
      version: 7,
    });
    const session = await sdk.verifySession(token);
    expect(session?.openId).toBe("sdk:roundtrip");
    expect(session?.ver).toBe(7);
  });

  it("defaults to epoch 0 when no version is supplied", async () => {
    const token = await sdk.createSessionToken("sdk:default", { name: "Default" });
    const session = await sdk.verifySession(token);
    expect(session?.ver).toBe(0);
  });

  it("authenticateRequest rejects a session whose epoch no longer matches (revoked)", async () => {
    upsertUser({
      openId: "sdk:revoked",
      email: "revoked@example.com",
      name: "Revoked Member",
    });
    const token = await sdk.createSessionToken("sdk:revoked", {
      name: "Revoked Member",
      version: 0,
    });
    // Fresh session works...
    const user = await sdk.authenticateRequest(sessionCookieReq(token));
    expect(user.openId).toBe("sdk:revoked");

    // ...until the user logs out (or their password changes/resets) and the
    // epoch is bumped - the same cookie is then rejected server-side.
    expect(revokeAllSessions(user.id)).toBe(true);
    await expect(sdk.authenticateRequest(sessionCookieReq(token))).rejects.toBeInstanceOf(
      HttpError
    );
  });

  it("authenticateRequest rejects sessions for disabled accounts immediately", async () => {
    const created = upsertUser({
      openId: "sdk:disabled",
      email: "disabled@example.com",
      name: "Disabled Official",
      role: "official",
      officialPosition: "supco",
      moduleAccess: [],
    });
    const token = await sdk.createSessionToken("sdk:disabled", {
      name: "Disabled Official",
      version: created.sessionEpoch ?? 0,
    });
    await sdk.authenticateRequest(sessionCookieReq(token));

    // Disabling the account (as the super admin does) locks the user out of
    // any open session NOW - not when the JWT expires.
    updateOfficial(created.id, { active: false });
    await expect(sdk.authenticateRequest(sessionCookieReq(token))).rejects.toMatchObject({
      statusCode: 403,
    });
    // The account is gone from the session layer entirely.
    expect(findUserByOpenId("sdk:disabled")?.active).toBe(false);
  });
});
