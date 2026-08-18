import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createMockIdentityApp, DEFAULT_ACCOUNTS } from "./mockIdentityServer";

let server: Server;
let baseUrl: string;

const REDIRECT_URI = "http://localhost:3000/api/oauth/callback";

beforeAll(async () => {
  const app = createMockIdentityApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(() => {
  server?.close();
});

describe("mockIdentityServer", () => {
  it("renders a consent page listing the seeded accounts", async () => {
    const params = new URLSearchParams({
      client_id: "msap-portal",
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "openid email profile",
      state: "nonce-1",
    });
    const res = await fetch(`${baseUrl}/o/oauth2/v2/auth?${params}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Sign in with Google");
    for (const account of DEFAULT_ACCOUNTS) {
      expect(html).toContain(account.email);
    }
  });

  it("rejects a non-http redirect_uri", async () => {
    const params = new URLSearchParams({
      client_id: "msap-portal",
      redirect_uri: "javascript:alert(1)",
      response_type: "code",
      scope: "openid",
      state: "nonce-2",
    });
    const res = await fetch(`${baseUrl}/o/oauth2/v2/auth?${params}`);
    expect(res.status).toBe(400);
  });

  it("issues a single-use code and completes the token + userinfo roundtrip", async () => {
    const account = DEFAULT_ACCOUNTS[0];
    const state = "nonce-3";
    const params = new URLSearchParams({
      client_id: "msap-portal",
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "openid email profile",
      state,
      login_hint: account.email,
    });

    const authRes = await fetch(`${baseUrl}/o/oauth2/v2/auth?${params}`, {
      redirect: "manual",
    });
    expect(authRes.status).toBe(302);
    const location = new URL(authRes.headers.get("location")!);
    expect(location.origin + location.pathname).toBe(REDIRECT_URI);
    const code = location.searchParams.get("code");
    expect(location.searchParams.get("state")).toBe(state);
    expect(code).toBeTruthy();

    const tokenRes = await fetch(`${baseUrl}/oauth2/v4/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        client_id: "msap-portal",
        redirect_uri: REDIRECT_URI,
      }),
    });
    expect(tokenRes.status).toBe(200);
    const token = (await tokenRes.json()) as Record<string, unknown>;
    expect(token.access_token).toBeTruthy();
    expect(token.id_token).toBeTruthy();
    expect(token.token_type).toBe("Bearer");

    const userRes = await fetch(`${baseUrl}/oauth2/v3/userinfo`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    expect(userRes.status).toBe(200);
    const user = (await userRes.json()) as Record<string, unknown>;
    expect(user.email).toBe(account.email);
    expect(user.name).toBe(account.name);
    expect(user.email_verified).toBe(true);
  });

  it("rejects a reused code (single-use guarantee)", async () => {
    const account = DEFAULT_ACCOUNTS[0];
    const params = new URLSearchParams({
      client_id: "msap-portal",
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "openid",
      state: "nonce-4",
      login_hint: account.email,
    });
    const authRes = await fetch(`${baseUrl}/o/oauth2/v2/auth?${params}`, {
      redirect: "manual",
    });
    const code = new URL(authRes.headers.get("location")!).searchParams.get(
      "code"
    );
    const body = JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: "msap-portal",
      redirect_uri: REDIRECT_URI,
    });

    const first = await fetch(`${baseUrl}/oauth2/v4/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    expect(first.status).toBe(200);

    const second = await fetch(`${baseUrl}/oauth2/v4/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    expect(second.status).toBe(400);
    const payload = (await second.json()) as Record<string, unknown>;
    expect(payload.error).toBe("invalid_grant");
  });

  it("rejects a redirect_uri mismatch on exchange", async () => {
    const account = DEFAULT_ACCOUNTS[0];
    const params = new URLSearchParams({
      client_id: "msap-portal",
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "openid",
      state: "nonce-5",
      login_hint: account.email,
    });
    const authRes = await fetch(`${baseUrl}/o/oauth2/v2/auth?${params}`, {
      redirect: "manual",
    });
    const code = new URL(authRes.headers.get("location")!).searchParams.get(
      "code"
    );

    const res = await fetch(`${baseUrl}/oauth2/v4/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        client_id: "msap-portal",
        redirect_uri: "http://evil.example/callback",
      }),
    });
    expect(res.status).toBe(400);
    const payload = (await res.json()) as Record<string, unknown>;
    expect(payload.error).toBe("invalid_grant");
  });

  it("rejects userinfo with an unknown token", async () => {
    const res = await fetch(`${baseUrl}/oauth2/v3/userinfo`, {
      headers: { Authorization: "Bearer definitely-not-a-token" },
    });
    expect(res.status).toBe(401);
  });
});
