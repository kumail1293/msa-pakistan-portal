import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearMemoryEmailLog,
  getMemoryEmailLog,
} from "./emailService";
import {
  applyStoreState,
  canAccessModule,
  cancelLifecycleCase,
  completePasswordSetup,
  createOfficial,
  ensureBootstrapSuperAdmin,
  findUserByIdentity,
  findUserBySetupTokenHash,
  getLifecycleCase,
  getLifecycleCounts,
  isSetupTokenValid,
  issueSetupToken,
  listLifecycleCases,
  listOfficials,
  openLifecycleCase,
  resetMemberStoreForTests,
  resetOfficialPassword,
  reviewLifecycleCase,
  revokeAllSessions,
  setOfficialModuleAccess,
  snapshotStoreState,
  syncApprovedMember,
  updateOfficial,
} from "./memberAccountService";
import { hashPassword, hashToken } from "./memberAuthService";
import type { MembershipLookup } from "./googleSheetsService";

const approvedMember = (membershipId: string, email: string): MembershipLookup => ({
  found: true,
  approved: true,
  membershipId,
  email,
  personalEmail: "",
  name: "Test Approved Member",
  phone: "+920000000000",
  discipline: "MBBS",
  yearOfStudy: "3rd Year",
  graduationYear: "2028",
  institute: "King Edward Medical University",
  localCouncil: "MSA-Pakistan KEMU LC",
  status: "Approved",
  letterUrl: "https://drive.google.com/file/d/LETTER123/view",
  cardUrl: "",
  profilePhotoUrl: "",
});

const fakeLookup =
  (member: MembershipLookup | null) =>
  async (): Promise<MembershipLookup | null> =>
    member;

beforeEach(() => {
  // Hermetic store per test (member IDs below are unique per test anyway,
  // but the officials tests need a clean slate for id/email assertions).
  resetMemberStoreForTests();
});

afterEach(() => {
  clearMemoryEmailLog();
});

describe("memberAccountService sync", () => {
  it("creates an account, issues a setup token and queues the setup email once", async () => {
    const first = await syncApprovedMember(
      "MSAP-SYNC-0001",
      {},
      fakeLookup(approvedMember("MSAP-SYNC-0001", "sync1@example.com"))
    );
    expect(first.status).toBe("created");
    if (first.status !== "created") return;
    expect(first.setupEmailQueued).toBe(true);

    // Account is findable by membership ID AND by email.
    expect(findUserByIdentity("MSAP-SYNC-0001")?.membershipId).toBe("MSAP-SYNC-0001");
    expect(findUserByIdentity("SYNC1@EXAMPLE.COM")?.email).toBe("sync1@example.com");

    // Exactly one setup email was queued.
    expect(getMemoryEmailLog()).toHaveLength(1);
    expect(getMemoryEmailLog()[0]?.subject).toContain("Set Up Your Member Portal Account");
  });

  it("never creates a duplicate account and does not resend the setup email on re-sync", async () => {
    const member = approvedMember("MSAP-SYNC-0002", "sync2@example.com");
    const first = await syncApprovedMember("MSAP-SYNC-0002", {}, fakeLookup(member));
    expect(first.status).toBe("created");

    // Re-sync by a different identifier (email) for the same member.
    const second = await syncApprovedMember(
      "sync2@example.com",
      {},
      fakeLookup(member)
    );
    expect(second.status).toBe("updated");
    if (second.status !== "updated") return;
    expect(second.setupEmailQueued).toBe(false);
    expect(second.newSetupTokenIssued).toBe(false);

    // Still exactly one account and one email.
    const byId = findUserByIdentity("MSAP-SYNC-0002");
    const byEmail = findUserByIdentity("sync2@example.com");
    expect(byId).toBe(byEmail);
    expect(getMemoryEmailLog()).toHaveLength(1);
  });

  it("resendSetupEmail forces a fresh token and queues a new setup email", async () => {
    const member = approvedMember("MSAP-RESEND-0001", "resend1@example.com");
    const first = await syncApprovedMember("MSAP-RESEND-0001", {}, fakeLookup(member));
    expect(first.status).toBe("created");

    const before = findUserByIdentity("MSAP-RESEND-0001");
    if (!before) return;
    const oldHash = before.setupTokenHash;

    const second = await syncApprovedMember(
      "MSAP-RESEND-0001",
      { resendSetupEmail: true },
      fakeLookup(member)
    );
    expect(second.status).toBe("updated");
    if (second.status !== "updated") return;
    expect(second.newSetupTokenIssued).toBe(true);
    expect(second.setupEmailQueued).toBe(true);

    // The old token was invalidated and a second setup email was queued.
    const after = findUserByIdentity("MSAP-RESEND-0001");
    expect(after?.setupTokenHash).not.toBe(oldHash);
    expect(getMemoryEmailLog()).toHaveLength(2);
  });

  it("resending a setup link for a member who already set a password keeps setup complete", async () => {
    const member = approvedMember("MSAP-RESEND-0002", "resend2@example.com");
    await syncApprovedMember("MSAP-RESEND-0002", {}, fakeLookup(member));
    const user = findUserByIdentity("MSAP-RESEND-0002");
    if (!user) return;
    completePasswordSetup(user.id, await hashPassword("newPass123"));

    const resent = await syncApprovedMember(
      "MSAP-RESEND-0002",
      { resendSetupEmail: true },
      fakeLookup(member)
    );
    expect(resent.status).toBe("updated");

    // A resend issues a fresh token (password reset link) but must not flip
    // the account back to "setup required".
    const refreshed = findUserByIdentity("MSAP-RESEND-0002");
    expect(refreshed?.passwordSetupRequired).toBe(false);
    expect(refreshed?.setupTokenHash).not.toBeNull();
  });

  it("reports unapproved and unknown members without creating accounts", async () => {
    const pending = await syncApprovedMember(
      "MSAP-SYNC-0003",
      {},
      fakeLookup({ found: true, approved: false, membershipId: "MSAP-SYNC-0003" })
    );
    expect(pending.status).toBe("not-approved");

    const missing = await syncApprovedMember(
      "MSAP-SYNC-0004",
      {},
      fakeLookup({ found: false, approved: false })
    );
    expect(missing.status).toBe("not-found");

    const unavailable = await syncApprovedMember("MSAP-SYNC-0005", {}, fakeLookup(null));
    expect(unavailable.status).toBe("lookup-unavailable");
  });
});

describe("setup token lifecycle", () => {
  it("tokens are single-use: consumed on successful password setup", async () => {
    await syncApprovedMember(
      "MSAP-TOKEN-0001",
      {},
      fakeLookup(approvedMember("MSAP-TOKEN-0001", "token1@example.com"))
    );
    const user = findUserByIdentity("MSAP-TOKEN-0001");
    expect(user).toBeDefined();
    if (!user || !user.setupTokenHash) return;

    // The stored digest matches the raw token, but the raw token itself is not recoverable.
    expect(user.setupTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(findUserBySetupTokenHash(user.setupTokenHash)).toBe(user);

    const passwordHash = await hashPassword("newPass123");
    const completed = completePasswordSetup(user.id, passwordHash);
    expect(completed?.passwordSetupRequired).toBe(false);

    // Token digest is cleared -> cannot be looked up or reused.
    expect(completed?.setupTokenHash).toBeNull();
    expect(findUserBySetupTokenHash(user.setupTokenHash)).toBeUndefined();
  });

  it("issuing a new token invalidates the previous one", async () => {
    await syncApprovedMember(
      "MSAP-TOKEN-0002",
      {},
      fakeLookup(approvedMember("MSAP-TOKEN-0002", "token2@example.com"))
    );
    const user = findUserByIdentity("MSAP-TOKEN-0002");
    if (!user) return;
    const oldHash = user.setupTokenHash;

    const issued = issueSetupToken(user.id);
    expect(issued).not.toBeNull();

    const refreshed = findUserByIdentity("MSAP-TOKEN-0002");
    expect(refreshed?.setupTokenHash).not.toBe(oldHash);
    expect(refreshed?.setupTokenHash).toBe(hashToken(issued?.rawToken || ""));
  });
});

describe("session revocation epoch", () => {
  it("completing password setup bumps the epoch (old sessions die)", async () => {
    await syncApprovedMember(
      "MSAP-EPOCH-0001",
      {},
      fakeLookup(approvedMember("MSAP-EPOCH-0001", "epoch1@example.com"))
    );
    const user = findUserByIdentity("MSAP-EPOCH-0001");
    expect(user?.sessionEpoch).toBe(0);
    if (!user) return;

    const completed = completePasswordSetup(
      user.id,
      await hashPassword("newPass123")
    );
    // A changed password must invalidate every previously issued session.
    expect(completed?.sessionEpoch).toBe(1);
  });

  it("revokeAllSessions bumps the epoch so copied cookies die", async () => {
    await syncApprovedMember(
      "MSAP-EPOCH-0002",
      {},
      fakeLookup(approvedMember("MSAP-EPOCH-0002", "epoch2@example.com"))
    );
    const user = findUserByIdentity("MSAP-EPOCH-0002");
    if (!user) return;

    expect(revokeAllSessions(user.id)).toBe(true);
    expect(findUserByIdentity("MSAP-EPOCH-0002")?.sessionEpoch).toBe(1);
    expect(revokeAllSessions(999_999)).toBe(false);
  });

  it("resetting an official password bumps the epoch (revokes their sessions)", () => {
    const result = createOfficial({
      name: "President",
      email: "epochpres@example.com",
      position: "national-president",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(findUserByIdentity("epochpres@example.com")?.sessionEpoch).toBe(0);

    resetOfficialPassword(result.user.id);
    expect(findUserByIdentity("epochpres@example.com")?.sessionEpoch).toBe(1);
  });

  it("disabling an official bumps the epoch; unrelated updates do not", () => {
    const result = createOfficial({
      name: "Gone",
      email: "epochgone@example.com",
      position: "supco",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // A harmless profile tweak keeps the epoch untouched...
    updateOfficial(result.user.id, { name: "Gone (away)" });
    expect(findUserByIdentity("epochgone@example.com")?.sessionEpoch).toBe(0);

    // ...but disabling the account revokes every open session immediately.
    updateOfficial(result.user.id, { active: false });
    expect(findUserByIdentity("epochgone@example.com")?.sessionEpoch).toBe(1);
  });
});

describe("membership lifecycle (workflow-based, audited)", () => {
  const asOfficial = { name: "Reviewing Official", email: "reviewer@example.com" };
  // Decisions must come from a DIFFERENT official than the one who opened the
  // case (separation of duties), so approvals use a separate identity.
  const asDecider = { name: "National President", email: "president@example.com" };
  const pngEvidence = [{ label: "Reminder email", dataUrl: "data:image/png;base64,iVBORw0KGgo=" }];

  it("opens a suspend case with evidence and an audit entry, changing nothing yet", async () => {
    await syncApprovedMember(
      "MSAP-LIFE-0001",
      {},
      fakeLookup(approvedMember("MSAP-LIFE-0001", "life1@example.com"))
    );
    const result = openLifecycleCase({
      identifier: "MSAP-LIFE-0001",
      action: "suspend",
      reason: "Dues non-payment",
      description: "No payment after two reminders.",
      evidence: pngEvidence,
      requestedBy: { name: "Supco Member", email: "supco@example.com" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.status).toBe("pending");
    expect(result.case.action).toBe("suspend");
    expect(result.case.timeline[0]?.action).toBe("case.opened");
    // Pending changes nothing on the member.
    expect(findUserByIdentity("MSAP-LIFE-0001")?.membershipStatus).toBe("Active");
  });

  it("refuses unknown accounts and official accounts", async () => {
    const missing = openLifecycleCase({
      identifier: "NOPE-0000",
      action: "suspend",
      reason: "x",
      requestedBy: asOfficial,
    });
    expect(missing.ok).toBe(false);

    createOfficial({ name: "Official", email: "official@example.com", position: "supco" });
    const onOfficial = openLifecycleCase({
      identifier: "official@example.com",
      action: "suspend",
      reason: "x",
      requestedBy: asOfficial,
    });
    expect(onOfficial.ok).toBe(false);
  });

  it("refuses suspend/terminate on a non-Active member", async () => {
    await syncApprovedMember(
      "MSAP-LIFE-0002",
      {},
      fakeLookup(approvedMember("MSAP-LIFE-0002", "life2@example.com"))
    );
    const t = openLifecycleCase({
      identifier: "MSAP-LIFE-0002",
      action: "terminate",
      reason: "By-law violation",
      requestedBy: asOfficial,
    });
    expect(t.ok).toBe(true);
    if (!t.ok) return;
    reviewLifecycleCase(t.case.id, "approve", asDecider);

    const s = openLifecycleCase({
      identifier: "MSAP-LIFE-0002",
      action: "suspend",
      reason: "Again",
      requestedBy: asOfficial,
    });
    expect(s.ok).toBe(false);
  });

  it("approving a suspension applies status, locks the account and queues the email", async () => {
    await syncApprovedMember(
      "MSAP-LIFE-0003",
      {},
      fakeLookup(approvedMember("MSAP-LIFE-0003", "life3@example.com"))
    );
    const opened = openLifecycleCase({
      identifier: "MSAP-LIFE-0003",
      action: "suspend",
      reason: "Dues",
      requestedBy: asOfficial,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const reviewed = reviewLifecycleCase(
      opened.case.id,
      "approve",
      asDecider,
      "Confirmed with records."
    );
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;
    expect(reviewed.case.status).toBe("approved");
    expect(reviewed.case.decidedByEmail).toBe("president@example.com");
    expect(reviewed.case.decisionNotes).toBe("Confirmed with records.");
    expect(reviewed.case.notificationQueued).toBe(true);

    const member = findUserByIdentity("MSAP-LIFE-0003");
    expect(member?.membershipStatus).toBe("Suspended");
    expect(member?.active).toBe(false);
    expect(member?.sessionEpoch).toBe(1);

    // The notification is queued best-effort (fire-and-forget) - let the
    // memory-outbox microtask flush before asserting on it.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const email = getMemoryEmailLog().find(
      (e) => e.emailType === "MEMBERSHIP_SUSPEND"
    );
    expect(email).toBeDefined();
    expect(email?.subject).toContain("Suspended");
    expect(
      reviewed.case.timeline[reviewed.case.timeline.length - 1]?.action
    ).toBe("case.approved");
  });

  it("terminates then reinstates through the same workflow", async () => {
    await syncApprovedMember(
      "MSAP-LIFE-0004",
      {},
      fakeLookup(approvedMember("MSAP-LIFE-0004", "life4@example.com"))
    );
    const t = openLifecycleCase({
      identifier: "MSAP-LIFE-0004",
      action: "terminate",
      reason: "Disciplinary",
      requestedBy: asOfficial,
    });
    expect(t.ok).toBe(true);
    if (!t.ok) return;
    reviewLifecycleCase(t.case.id, "approve", asDecider);
    expect(findUserByIdentity("MSAP-LIFE-0004")?.membershipStatus).toBe("Terminated");
    expect(findUserByIdentity("MSAP-LIFE-0004")?.active).toBe(false);

    const r = openLifecycleCase({
      identifier: "MSAP-LIFE-0004",
      action: "reinstate",
      reason: "Appeal upheld",
      requestedBy: asOfficial,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    reviewLifecycleCase(r.case.id, "approve", asDecider);
    const member = findUserByIdentity("MSAP-LIFE-0004");
    expect(member?.membershipStatus).toBe("Active");
    expect(member?.active).toBe(true);
  });

  it("rejecting a case changes nothing and records the decision", async () => {
    await syncApprovedMember(
      "MSAP-LIFE-0005",
      {},
      fakeLookup(approvedMember("MSAP-LIFE-0005", "life5@example.com"))
    );
    const opened = openLifecycleCase({
      identifier: "MSAP-LIFE-0005",
      action: "suspend",
      reason: "Weak claim",
      requestedBy: asOfficial,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const reviewed = reviewLifecycleCase(
      opened.case.id,
      "reject",
      asDecider,
      "No evidence of violation."
    );
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;
    expect(reviewed.case.status).toBe("rejected");
    expect(findUserByIdentity("MSAP-LIFE-0005")?.membershipStatus).toBe("Active");
    expect(reviewed.case.notificationQueued).toBe(false);
    expect(
      getMemoryEmailLog().some((e) => e.emailType === "MEMBERSHIP_SUSPEND")
    ).toBe(false);
    expect(
      reviewed.case.timeline[reviewed.case.timeline.length - 1]?.action
    ).toBe("case.rejected");
  });

  it("validates evidence payloads", async () => {
    await syncApprovedMember(
      "MSAP-LIFE-0006",
      {},
      fakeLookup(approvedMember("MSAP-LIFE-0006", "life6@example.com"))
    );
    const bad = openLifecycleCase({
      identifier: "MSAP-LIFE-0006",
      action: "suspend",
      reason: "x",
      evidence: [{ label: "Bad", dataUrl: "data:text/html;base64,PHNjcmlwdD4=" }],
      requestedBy: asOfficial,
    });
    expect(bad.ok).toBe(false);
  });

  it("lists cases with status/action filters and free-text search", async () => {
    await syncApprovedMember(
      "MSAP-LIFE-0007",
      {},
      fakeLookup(approvedMember("MSAP-LIFE-0007", "life7@example.com"))
    );
    await syncApprovedMember(
      "MSAP-LIFE-0008",
      {},
      fakeLookup(approvedMember("MSAP-LIFE-0008", "life8@example.com"))
    );
    const a = openLifecycleCase({
      identifier: "MSAP-LIFE-0007",
      action: "suspend",
      reason: "Dues",
      requestedBy: asOfficial,
    });
    const b = openLifecycleCase({
      identifier: "MSAP-LIFE-0008",
      action: "terminate",
      reason: "Discipline",
      requestedBy: asOfficial,
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    reviewLifecycleCase(b.case.id, "approve", asDecider);

    expect(listLifecycleCases({ status: "pending" })).toHaveLength(1);
    expect(listLifecycleCases({ action: "terminate" })).toHaveLength(1);
    expect(listLifecycleCases({ query: "0008" }).map((c) => c.membershipId)).toEqual([
      "MSAP-LIFE-0008",
    ]);
    expect(getLifecycleCounts()).toEqual({
      pending: 1,
      approved: 1,
      rejected: 0,
      cancelled: 0,
    });
  });

  it("cases survive the store snapshot round-trip", async () => {
    await syncApprovedMember(
      "MSAP-LIFE-0009",
      {},
      fakeLookup(approvedMember("MSAP-LIFE-0009", "life9@example.com"))
    );
    const opened = openLifecycleCase({
      identifier: "MSAP-LIFE-0009",
      action: "suspend",
      reason: "Dues",
      requestedBy: asOfficial,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    reviewLifecycleCase(opened.case.id, "approve", asDecider, "Ok");

    const snap = snapshotStoreState();
    applyStoreState(snap);

    const restored = getLifecycleCase(opened.case.id);
    expect(restored).toBeDefined();
    expect(restored?.status).toBe("approved");
    expect(restored?.decisionNotes).toBe("Ok");
    expect(restored?.timeline).toHaveLength(2);
    expect(findUserByIdentity("MSAP-LIFE-0009")?.membershipStatus).toBe("Suspended");

    // Id counters advanced past the restored case.
    const next = openLifecycleCase({
      identifier: "MSAP-LIFE-0009",
      action: "reinstate",
      reason: "Appeal",
      requestedBy: asOfficial,
    });
    expect(next.ok).toBe(true);
  });

  it("blocks an official from deciding their own case (separation of duties)", async () => {
    await syncApprovedMember(
      "MSAP-LIFE-0010",
      {},
      fakeLookup(approvedMember("MSAP-LIFE-0010", "life10@example.com"))
    );
    const opened = openLifecycleCase({
      identifier: "MSAP-LIFE-0010",
      action: "suspend",
      reason: "Dues",
      requestedBy: asOfficial,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    // The opener cannot approve their own case...
    const selfApprove = reviewLifecycleCase(opened.case.id, "approve", asOfficial);
    expect(selfApprove.ok).toBe(false);
    // ...nor reject it.
    const selfReject = reviewLifecycleCase(opened.case.id, "reject", asOfficial);
    expect(selfReject.ok).toBe(false);

    // The member was untouched and the case is still pending for review.
    expect(findUserByIdentity("MSAP-LIFE-0010")?.membershipStatus).toBe("Active");
    expect(getLifecycleCase(opened.case.id)?.status).toBe("pending");
  });

  it("cancels a pending case that became unactionable", async () => {
    await syncApprovedMember(
      "MSAP-LIFE-0011",
      {},
      fakeLookup(approvedMember("MSAP-LIFE-0011", "life11@example.com"))
    );
    // A suspend case is opened but, before it is decided, the member is
    // terminated through a second case — the suspend case is now stale.
    const stale = openLifecycleCase({
      identifier: "MSAP-LIFE-0011",
      action: "suspend",
      reason: "Dues",
      requestedBy: asOfficial,
    });
    const terminate = openLifecycleCase({
      identifier: "MSAP-LIFE-0011",
      action: "terminate",
      reason: "Disciplinary",
      requestedBy: asOfficial,
    });
    expect(stale.ok && terminate.ok).toBe(true);
    if (!stale.ok || !terminate.ok) return;
    reviewLifecycleCase(terminate.case.id, "approve", asDecider);

    // Approving the stale suspend case is correctly refused (status moved on)…
    const staleApprove = reviewLifecycleCase(stale.case.id, "approve", asDecider);
    expect(staleApprove.ok).toBe(false);
    // …but it can be cancelled instead of staying pending forever.
    const cancelled = cancelLifecycleCase(
      stale.case.id,
      asDecider,
      "Superseded by termination case."
    );
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;
    expect(cancelled.case.status).toBe("cancelled");
    expect(
      cancelled.case.timeline[cancelled.case.timeline.length - 1]?.action
    ).toBe("case.cancelled");

    // Non-pending cases cannot be cancelled.
    const reopen = cancelLifecycleCase(terminate.case.id, asDecider);
    expect(reopen.ok).toBe(false);
    expect(getLifecycleCounts().cancelled).toBe(1);
  });
});

describe("officials & module access (super-admin provisioned)", () => {
  it("creates an official with position, domain and grants plus a setup token", () => {
    const result = createOfficial({
      name: "VP Members",
      email: "vp.members@example.com",
      position: "vice-president",
      domain: "Members",
      moduleAccess: ["card-queue", "recruitment"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user.role).toBe("official");
    expect(result.user.officialPosition).toBe("vice-president");
    expect(result.user.domain).toBe("Members");
    expect(result.user.moduleAccess).toEqual(["card-queue", "recruitment"]);
    expect(result.created).toBe(true);
    expect(result.setupToken).not.toBeNull();
    expect(findUserByIdentity("VP.MEMBERS@example.com")?.email).toBe(
      "vp.members@example.com"
    );
  });

  it("re-provisions an existing official by email instead of duplicating", () => {
    const first = createOfficial({
      name: "Official A",
      email: "a@example.com",
      position: "supco",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.created).toBe(true);

    const second = createOfficial({
      name: "Official A (reprovisioned)",
      email: "a@example.com",
      position: "lc-president",
      localCouncil: "MSA-Pakistan KEMU LC",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.created).toBe(false);
    expect(second.user.officialPosition).toBe("lc-president");
    expect(second.user.localCouncil).toBe("MSA-Pakistan KEMU LC");
    expect(listOfficials()).toHaveLength(1);
  });

  it("refuses to silently convert a member account into an official one", async () => {
    await syncApprovedMember(
      "MSAP-OFF-0001",
      {},
      fakeLookup(approvedMember("MSAP-OFF-0001", "memberoff@example.com"))
    );
    const result = createOfficial({
      name: "Same Person",
      email: "memberoff@example.com",
      position: "supco",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("member account");
  });

  it("listOfficials returns only non-member accounts", async () => {
    await syncApprovedMember(
      "MSAP-OFF-0002",
      {},
      fakeLookup(approvedMember("MSAP-OFF-0002", "mem@example.com"))
    );
    createOfficial({ name: "VP", email: "vp@example.com", position: "vice-president" });
    createOfficial({ name: "Boss", email: "boss@example.com", position: "supco" });
    const emails = listOfficials().map((o) => o.email).sort();
    expect(emails).toEqual(["boss@example.com", "vp@example.com"]);
  });

  it("canAccessModule enforces the role matrix", () => {
    const member = { role: "user", moduleAccess: [] };
    const official = { role: "official", moduleAccess: ["card-queue"] };
    const admin = { role: "admin", moduleAccess: [] };
    const superadmin = { role: "superadmin", moduleAccess: [] };

    // Members never open official modules.
    expect(canAccessModule(member, "card-queue")).toBe(false);
    // Officials only what they were granted.
    expect(canAccessModule(official, "card-queue")).toBe(true);
    expect(canAccessModule(official, "recruitment")).toBe(false);
    // Admins inherit every official module.
    expect(canAccessModule(admin, "recruitment")).toBe(true);
    expect(canAccessModule(admin, "config")).toBe(true);
    expect(canAccessModule(admin, "interviews")).toBe(true);
    // Super admin opens everything, including the officials page.
    expect(canAccessModule(superadmin, "card-queue")).toBe(true);
    expect(canAccessModule(superadmin, "officials")).toBe(true);
    // The officials page itself is super-admin reserved.
    expect(canAccessModule(official, "officials")).toBe(false);
    expect(canAccessModule(admin, "officials")).toBe(false);
    expect(canAccessModule(null, "card-queue")).toBe(false);
  });

  it("setOfficialModuleAccess replaces grants and drops unknown keys", () => {
    const result = createOfficial({
      name: "Official",
      email: "o@example.com",
      position: "supco",
      moduleAccess: ["card-queue"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const updated = setOfficialModuleAccess(result.user.id, [
      "config",
      "not-a-module",
    ]);
    expect(updated?.moduleAccess).toEqual(["config"]);

    // Grants only apply to role "official" - admins inherit, not granted.
    const adminResult = createOfficial({
      name: "Admin",
      email: "adm@example.com",
      position: "supco",
      role: "admin",
    });
    expect(adminResult.ok).toBe(true);
    if (adminResult.ok) {
      expect(setOfficialModuleAccess(adminResult.user.id, ["config"])).toBeNull();
    }
  });

  it("resetOfficialPassword issues a fresh setup token", () => {
    const result = createOfficial({
      name: "President",
      email: "pres@example.com",
      position: "national-president",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const before = findUserByIdentity("pres@example.com")?.setupTokenHash;
    const raw = resetOfficialPassword(result.user.id);
    expect(raw).not.toBeNull();
    const after = findUserByIdentity("pres@example.com");
    expect(after?.setupTokenHash).not.toBe(before);
  });

  it("ensureBootstrapSuperAdmin promotes an existing account via env", () => {
    const result = createOfficial({
      name: "Boss",
      email: "boss@example.com",
      position: "supco",
    });
    expect(result.ok).toBe(true);
    process.env.SUPER_ADMIN_EMAIL = "boss@example.com";
    try {
      ensureBootstrapSuperAdmin();
    } finally {
      delete process.env.SUPER_ADMIN_EMAIL;
    }
    expect(findUserByIdentity("boss@example.com")?.role).toBe("superadmin");
  });

  it("resetOfficialPassword refuses disabled accounts", () => {
    const result = createOfficial({
      name: "Gone",
      email: "gone@example.com",
      position: "supco",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    updateOfficial(result.user.id, { active: false });
    expect(resetOfficialPassword(result.user.id)).toBeNull();
  });
});

describe("isSetupTokenValid (expiry / single-use guard)", () => {
  const now = Date.now();
  const base = {
    active: true,
    setupTokenExpiresAt: new Date(now + 60_000),
    setupTokenUsedAt: null,
  };

  it("accepts an unexpired, unused token", () => {
    expect(isSetupTokenValid(base, now)).toBe(true);
  });

  it("rejects an expired token", () => {
    expect(
      isSetupTokenValid(
        { ...base, setupTokenExpiresAt: new Date(now - 1) },
        now
      )
    ).toBe(false);
  });

  it("rejects a used token", () => {
    expect(isSetupTokenValid({ ...base, setupTokenUsedAt: new Date() }, now)).toBe(
      false
    );
  });

  it("rejects an inactive account and a missing expiry", () => {
    expect(isSetupTokenValid({ ...base, active: false }, now)).toBe(false);
    expect(isSetupTokenValid({ ...base, setupTokenExpiresAt: null }, now)).toBe(
      false
    );
    expect(isSetupTokenValid(null, now)).toBe(false);
  });
});
