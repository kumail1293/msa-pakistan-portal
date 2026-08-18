import { afterEach, describe, expect, it, vi } from "vitest";

// The endpoint's message logic must be tested without hitting the real Apps
// Script, so the account service is mocked with the real module preserved for
// everything except syncApprovedMember.
const { syncApprovedMemberMock } = vi.hoisted(() => ({
  syncApprovedMemberMock: vi.fn(),
}));

vi.mock("./services/memberAccountService", async (importOriginal) => {
  const mod =
    await importOriginal<typeof import("./services/memberAccountService")>();
  return { ...mod, syncApprovedMember: syncApprovedMemberMock };
});

import { appRouter } from "./routers";
import { ENV } from "./_core/env";
import { resetRateLimit } from "./_core/rateLimit";
import type { TrpcContext } from "./_core/context";

// requestPasswordSetup is rate-limited per socket address; tests share the
// "unknown"/test address, so reset the window after each case.
const TEST_KEYS = ["unknown", "127.0.0.1"];

const ORIGINAL_IS_PRODUCTION = ENV.isProduction;

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const GENERIC_MESSAGE =
  "If an approved membership matches that ID or email, a new password setup link has been sent to your registered email.";

const ALL_STATUSES = [
  "created",
  "updated",
  "not-found",
  "not-approved",
  "lookup-unavailable",
] as const;

describe("auth.requestPasswordSetup", () => {
  afterEach(() => {
    syncApprovedMemberMock.mockReset();
    for (const key of TEST_KEYS) resetRateLimit(key);
    ENV.isProduction = ORIGINAL_IS_PRODUCTION;
  });

  it("always returns the generic message in production for every outcome", async () => {
    ENV.isProduction = true;
    const caller = appRouter.createCaller(createPublicContext());

    for (const status of ALL_STATUSES) {
      syncApprovedMemberMock.mockResolvedValueOnce({
        status,
        message: `internal detail: ${status}`,
      } as never);
      const result = await caller.auth.requestPasswordSetup({
        identifier: "MSAP-PROD-0001",
      });
      expect(result).toEqual({ success: true, message: GENERIC_MESSAGE });
    }
  });

  it("returns the generic message for successful outcomes in development", async () => {
    ENV.isProduction = false;
    const caller = appRouter.createCaller(createPublicContext());

    for (const status of ["created", "updated"] as const) {
      syncApprovedMemberMock.mockResolvedValueOnce({
        status,
        message: "account ready",
      } as never);
      const result = await caller.auth.requestPasswordSetup({
        identifier: "MSAP-DEV-0001",
      });
      expect(result.message).toBe(GENERIC_MESSAGE);
    }
  });

  it("surfaces diagnostic detail in development when the registry is unreachable", async () => {
    ENV.isProduction = false;
    const caller = appRouter.createCaller(createPublicContext());

    syncApprovedMemberMock.mockResolvedValueOnce({
      status: "lookup-unavailable",
      message: "Could not reach the membership registry.",
    } as never);
    const result = await caller.auth.requestPasswordSetup({
      identifier: "MSAP-DEV-0002",
    });
    expect(result.message).toContain("registry is unreachable");
    expect(result.message).not.toBe(GENERIC_MESSAGE);
  });

  it("rejects an empty identifier", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.auth.requestPasswordSetup({ identifier: "  " })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
