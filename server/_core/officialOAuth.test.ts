import { describe, expect, it } from "vitest";
import {
  consumeOAuthState,
  issueOAuthState,
} from "./officialOAuth";

const REDIRECT = "http://localhost:3000/api/oauth/callback";

describe("officialOAuth state nonce", () => {
  it("returns the stored entry for a freshly issued state", () => {
    const state = issueOAuthState(REDIRECT, "/dashboard");
    const entry = consumeOAuthState(state);
    expect(entry).not.toBeNull();
    expect(entry!.redirectUri).toBe(REDIRECT);
    expect(entry!.nextPath).toBe("/dashboard");
  });

  it("is single-use - a second consume returns null", () => {
    const state = issueOAuthState(REDIRECT, "/dashboard");
    expect(consumeOAuthState(state)).not.toBeNull();
    expect(consumeOAuthState(state)).toBeNull();
  });

  it("rejects unknown state", () => {
    expect(consumeOAuthState("made-up-state")).toBeNull();
  });

  it("rejects expired state even before consumption", () => {
    const now = Date.now();
    const state = issueOAuthState(REDIRECT, "/dashboard", now);
    // Advance past the TTL: the entry was issued at `now`, so a consume
    // at `now + TTL + 1` must fail.
    const entry = consumeOAuthState(state, now + 10 * 60 * 1000 + 1);
    expect(entry).toBeNull();
  });

  it("treats the exact expiry instant as expired", () => {
    const now = Date.now();
    const state = issueOAuthState(REDIRECT, "/dashboard", now);
    // `expiresAt` is inclusive of the instant it was set, so a consume at
    // exactly `now + TTL` has already lapsed.
    const entry = consumeOAuthState(state, now + 10 * 60 * 1000);
    expect(entry).toBeNull();
  });
});
