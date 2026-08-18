import { afterEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimit } from "./rateLimit";

const KEY = "127.0.0.1";
const LIMIT = 3;
const WINDOW = 60_000;

afterEach(() => {
  resetRateLimit(KEY);
});

describe("rateLimit", () => {
  it("allows requests up to the limit within a window", () => {
    expect(checkRateLimit(KEY, LIMIT, WINDOW).allowed).toBe(true);
    expect(checkRateLimit(KEY, LIMIT, WINDOW).allowed).toBe(true);
    expect(checkRateLimit(KEY, LIMIT, WINDOW).allowed).toBe(true);
  });

  it("blocks once the limit is exceeded and reports a retry delay", () => {
    checkRateLimit(KEY, LIMIT, WINDOW);
    checkRateLimit(KEY, LIMIT, WINDOW);
    checkRateLimit(KEY, LIMIT, WINDOW);
    const blocked = checkRateLimit(KEY, LIMIT, WINDOW);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(WINDOW);
  });

  it("keys are independent (one IP cannot exhaust another's budget)", () => {
    checkRateLimit(KEY, LIMIT, WINDOW);
    checkRateLimit(KEY, LIMIT, WINDOW);
    checkRateLimit(KEY, LIMIT, WINDOW);
    expect(checkRateLimit("10.0.0.9", LIMIT, WINDOW).allowed).toBe(true);
  });

  it("resets the window after it expires", async () => {
    const shortKey = `${KEY}-expiry`;
    const SHORT_WINDOW = 5; // ms
    checkRateLimit(shortKey, LIMIT, SHORT_WINDOW);
    checkRateLimit(shortKey, LIMIT, SHORT_WINDOW);
    checkRateLimit(shortKey, LIMIT, SHORT_WINDOW);
    // A fresh window must be granted once the old one has lapsed.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(checkRateLimit(shortKey, LIMIT, SHORT_WINDOW).allowed).toBe(true);
    resetRateLimit(shortKey);
  });
});
