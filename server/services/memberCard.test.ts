import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildMemberCard,
  clearPresidentSignatureUrl,
  isValidSignatureDataUrl,
  listCardQueue,
  listPendingCardApprovals,
  requestCardReissue,
  resetMemberStoreForTests,
  reviewCardSignature,
  setPresidentSignatureUrl,
  submitHolderSignature,
  updateMemberProfile,
  upsertUser,
  verifyCardToken,
} from "./memberAccountService";
import { clearMemoryEmailLog } from "./emailService";
import type { User } from "../../drizzle/schema";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function createMember(
  membershipId: string,
  email: string,
  localCouncil = "MSA-Pakistan KEMU LC"
): User {
  return upsertUser({
    openId: `member:${membershipId}`,
    email,
    name: `Test ${membershipId}`,
    membershipId,
    membershipStatus: "Active",
    discipline: "MBBS",
    yearOfStudy: "3rd Year",
    graduationYear: 2028,
    localCouncil,
    institution: "King Edward Medical University",
    loginMethod: "member-password",
  });
}

/** Approve the holder's signature so the card is issued (rev 1). */
async function issueCard(userId: number) {
  await submitHolderSignature(userId, PNG_1PX);
  return await reviewCardSignature(userId, "approve");
}

/** Member with fully customised searchable fields (name, institute, council). */
function createCustomMember(opts: {
  membershipId: string;
  email: string;
  name?: string;
  localCouncil?: string;
  institution?: string;
}): User {
  return upsertUser({
    openId: `member:${opts.membershipId}`,
    email: opts.email,
    name: opts.name ?? `Test ${opts.membershipId}`,
    membershipId: opts.membershipId,
    membershipStatus: "Active",
    discipline: "MBBS",
    yearOfStudy: "3rd Year",
    graduationYear: 2028,
    localCouncil: opts.localCouncil ?? "MSA-Pakistan KEMU LC",
    institution: opts.institution ?? "King Edward Medical University",
    loginMethod: "member-password",
  });
}

// The store is shared per module; reset it so every test is hermetic and
// order-independent (persistence tests call applyStoreState themselves).
beforeEach(() => {
  resetMemberStoreForTests();
});

afterEach(() => {
  clearMemoryEmailLog();
});

describe("membership card", () => {
  it("builds the card from registry data, unissued until approval", async () => {
    const user = createMember("MSAP-CARD-0001", "card1@example.com");
    const card = await buildMemberCard(user.id);
    expect(card).not.toBeNull();
    if (!card) return;
    expect(card.memberName).toBe("Test MSAP-CARD-0001");
    expect(card.membershipId).toBe("MSAP-CARD-0001");
    expect(card.localCouncil).toBe("MSA-Pakistan KEMU LC");
    expect(card.graduationYear).toBe(2028);
    expect(card.issued).toBe(false);
    expect(card.version).toBe(0);
    expect(card.holderSignature.status).toBe("none");
    expect(card.verificationToken).toBeNull();
    expect(card.president.name).toBeTruthy();
    expect(card.president.signatureUrl).toBeNull();
  });

  it("National Office can set the President's real signature; invalid PNGs are refused", async () => {
    const user = createMember("MSAP-CARD-SIG01", "sigsig01@example.com");
    expect(setPresidentSignatureUrl("javascript:alert(1)")).toBe(false);
    expect(
      setPresidentSignatureUrl("data:image/svg+xml;base64,AAAA")
    ).toBe(false);

    const ok = setPresidentSignatureUrl(PNG_1PX);
    expect(ok).toBe(true);
    // The signature flows onto every card, issued or not.
    expect((await buildMemberCard(user.id))?.president.signatureUrl).toBe(PNG_1PX);

    // National Office can clear it again (revert to the placeholder).
    clearPresidentSignatureUrl();
    expect((await buildMemberCard(user.id))?.president.signatureUrl).toBeNull();
  });

  it("shared signature validation rejects non-PNG payloads and oversized data", async () => {
    expect(isValidSignatureDataUrl(PNG_1PX)).toBe(true);
    expect(isValidSignatureDataUrl("data:image/jpeg;base64,AAAA")).toBe(false);
    expect(isValidSignatureDataUrl("data:image/png;base64,")).toBe(false);
    // Over the 400KB cap.
    const huge = `data:image/png;base64,${"A".repeat(400_001)}`;
    expect(isValidSignatureDataUrl(huge)).toBe(false);
  });

  it("submits a PNG holder signature as pending; rejects non-PNG payloads", async () => {
    const user = createMember("MSAP-CARD-0002", "card2@example.com");

    const submitted = await submitHolderSignature(user.id, PNG_1PX);
    expect(submitted?.holderSignature.status).toBe("pending");
    expect(submitted?.holderSignature.dataUrl).toBe(PNG_1PX);
    expect(submitted?.issued).toBe(false);

    // Anything that is not a PNG data URL is refused.
    expect(await submitHolderSignature(user.id, "javascript:alert(1)")).toBeNull();
    expect(
      await submitHolderSignature(user.id, "data:image/svg+xml;base64,AAAA")
    ).toBeNull();
  });

  it("approval issues the card with a fresh HMAC token and expiry", async () => {
    const user = createMember("MSAP-CARD-0003", "card3@example.com");
    const before = await submitHolderSignature(user.id, PNG_1PX);
    expect(before?.holderSignature.status).toBe("pending");

    const issued = await reviewCardSignature(user.id, "approve");
    expect(issued?.holderSignature.status).toBe("approved");
    expect(issued?.issued).toBe(true);
    expect(issued?.version).toBe(1);
    expect(issued?.issuedAt).not.toBeNull();
    expect(issued?.verificationToken).toMatch(/^[0-9a-f]{64}$/);
    // Expiry is the end of the member's graduation year.
    expect(issued?.expiresAt?.getFullYear()).toBe(2028);
  });

  it("rejection keeps the card unissued and the signature rejected", async () => {
    const user = createMember("MSAP-CARD-0004", "card4@example.com");
    await submitHolderSignature(user.id, PNG_1PX);

    const rejected = await reviewCardSignature(user.id, "reject");
    expect(rejected?.holderSignature.status).toBe("rejected");
    expect(rejected?.issued).toBe(false);
    expect(rejected?.verificationToken).toBeNull();
  });

  it("queue filters by request kind and status", async () => {
    const pendingSig = createMember("MSAP-QUEUE-001", "q1@example.com");
    const rejectedSig = createMember("MSAP-QUEUE-002", "q2@example.com");
    const reissue = createMember("MSAP-QUEUE-003", "q3@example.com");

    // pending signature
    await submitHolderSignature(pendingSig.id, PNG_1PX);
    // rejected signature
    await submitHolderSignature(rejectedSig.id, PNG_1PX);
    await reviewCardSignature(rejectedSig.id, "reject");
    // pending re-issue
    await issueCard(reissue.id);
    updateMemberProfile(reissue.id, { name: "Reissue Me" });
    await requestCardReissue(reissue.id);

    // kind = signature returns the signature rows (pending + rejected, and
    // the approved one left behind by issueCard on the re-issue member).
    const signatures = listCardQueue({ kind: "signature" });
    const sigIds = signatures.map((i) => i.membershipId);
    expect(sigIds).toContain("MSAP-QUEUE-001");
    expect(sigIds).toContain("MSAP-QUEUE-002");
    expect(sigIds).toContain("MSAP-QUEUE-003");

    // kind = reissue returns the re-issue requests only.
    const reissues = listCardQueue({ kind: "reissue" });
    expect(reissues.map((i) => i.membershipId)).toContain("MSAP-QUEUE-003");
    expect(reissues.map((i) => i.membershipId)).not.toContain("MSAP-QUEUE-001");
    expect(reissues.every((i) => i.request === "reissue")).toBe(true);

    // status = pending holds the unreviewed ones.
    const pending = listCardQueue({ status: "pending" });
    const pendingIds = pending.map((i) => i.membershipId);
    expect(pendingIds).toContain("MSAP-QUEUE-001");
    expect(pendingIds).toContain("MSAP-QUEUE-003");
    expect(pendingIds).not.toContain("MSAP-QUEUE-002");

    // status = rejected holds only the rejected signature.
    const rejected = listCardQueue({ status: "rejected" });
    expect(rejected.map((i) => i.membershipId)).toEqual(["MSAP-QUEUE-002"]);

    // Combined filters intersect.
    const rejectedSignatures = listCardQueue({
      kind: "signature",
      status: "rejected",
    });
    expect(rejectedSignatures.map((i) => i.membershipId)).toEqual([
      "MSAP-QUEUE-002",
    ]);
  });

  it("queue filters by free-text query and local council", async () => {
    const kemu = createMember(
      "MSAP-QUEUE-011",
      "q11@example.com",
      "MSA-Pakistan KEMU LC"
    );
    const ajk = createMember(
      "MSAP-QUEUE-012",
      "q12@example.com",
      "MSA-Pakistan AJKMC LC"
    );
    await submitHolderSignature(kemu.id, PNG_1PX);
    await submitHolderSignature(ajk.id, PNG_1PX);

    // Text query matches name, membership ID, institute or council.
    expect(
      listCardQueue({ query: "MSAP-QUEUE-011" }).map((i) => i.membershipId)
    ).toContain("MSAP-QUEUE-011");
    expect(
      listCardQueue({ query: "MSAP-QUEUE-011" }).map((i) => i.membershipId)
    ).not.toContain("MSAP-QUEUE-012");

    // Council filter is a case-insensitive substring.
    const kemuOnly = listCardQueue({ localCouncil: "kemu" });
    expect(kemuOnly.map((i) => i.membershipId)).toContain("MSAP-QUEUE-011");
    expect(kemuOnly.map((i) => i.membershipId)).not.toContain("MSAP-QUEUE-012");

    // limit caps the response.
    expect(listCardQueue({ limit: 1 }).length).toBe(1);
  });

  it("queue status filter isolates approved (issued) history", async () => {
    const pending = createMember("MSAP-QUEUE-021", "q21@example.com");
    const issued = createMember("MSAP-QUEUE-022", "q22@example.com");
    const rejected = createMember("MSAP-QUEUE-023", "q23@example.com");

    await submitHolderSignature(pending.id, PNG_1PX);
    await issueCard(issued.id);
    await submitHolderSignature(rejected.id, PNG_1PX);
    await reviewCardSignature(rejected.id, "reject");

    const approved = listCardQueue({ status: "approved" });
    const ids = approved.map((i) => i.membershipId);
    expect(ids).toContain("MSAP-QUEUE-022");
    expect(ids).not.toContain("MSAP-QUEUE-021");
    expect(ids).not.toContain("MSAP-QUEUE-023");

    // An issued member appears twice under "approved": the approved
    // signature row plus the resolved re-issue history row (documented
    // behaviour of the queue - issued cards have an identity snapshot).
    const issuedRows = approved.filter(
      (i) => i.membershipId === "MSAP-QUEUE-022"
    );
    expect(issuedRows.map((i) => i.request).sort()).toEqual([
      "reissue",
      "signature",
    ]);
    expect(issuedRows.every((i) => i.status === "approved")).toBe(true);
  });

  it("queue free-text search matches name, email, institute and council", async () => {
    const zainab = createCustomMember({
      membershipId: "MSAP-QUEUE-041",
      email: "zainab@example.com",
      name: "Zainab Ali",
      localCouncil: "MSA-Pakistan DMC LC",
      institution: "Dow Medical College, Karachi",
    });
    const bilal = createCustomMember({
      membershipId: "MSAP-QUEUE-042",
      email: "bilal@example.com",
      name: "Bilal Ahmed",
      localCouncil: "MSA-Pakistan AIMC LC",
      institution: "Allama Iqbal Medical College, Lahore",
    });
    await submitHolderSignature(zainab.id, PNG_1PX);
    await submitHolderSignature(bilal.id, PNG_1PX);

    const ids = (q: string) =>
      listCardQueue({ query: q }).map((i) => i.membershipId);

    // Name only ("ali" is in the name but not in the email/membership ID,
    // so this isolates the name field).
    expect(ids("ali")).toEqual(["MSAP-QUEUE-041"]);
    expect(ids("BILAL")).toEqual(["MSAP-QUEUE-042"]);
    // Email.
    expect(ids("zainab@example.com")).toEqual(["MSAP-QUEUE-041"]);
    // Institute substring.
    expect(ids("iqbal medical")).toEqual(["MSAP-QUEUE-042"]);
    // Council substring, case-insensitive.
    expect(ids("dmc")).toEqual(["MSAP-QUEUE-041"]);
    expect(ids("aimc")).toEqual(["MSAP-QUEUE-042"]);
    // A term shared by both still returns both.
    expect(ids("lc").sort()).toEqual(["MSAP-QUEUE-041", "MSAP-QUEUE-042"]);
    // Ordering is by submission time (zainab submitted first).
    expect(ids("lc")).toEqual(["MSAP-QUEUE-041", "MSAP-QUEUE-042"]);
  });

  it("queue filters return empty for no matches and never leak other members", async () => {
    const kemu = createMember("MSAP-QUEUE-051", "q51@example.com");
    await submitHolderSignature(kemu.id, PNG_1PX);

    expect(listCardQueue({ query: "no-such-member" })).toEqual([]);
    expect(listCardQueue({ localCouncil: "NONEXISTENT LC" })).toEqual([]);
    expect(listCardQueue({ status: "approved" })).toEqual([]);
    expect(listCardQueue({ kind: "reissue" })).toEqual([]);
    expect(
      listCardQueue({ query: "q51@example.com", localCouncil: "AJKMC" })
    ).toEqual([]);
  });

  it("queue combined filters (kind + status + query + council) intersect", async () => {
    const kemuPending = createMember("MSAP-QUEUE-061", "q61@example.com");
    const kemuRejected = createMember("MSAP-QUEUE-062", "q62@example.com");
    const ajkPending = createMember(
      "MSAP-QUEUE-063",
      "q63@example.com",
      "MSA-Pakistan AJKMC LC"
    );
    const kemuIssued = createMember("MSAP-QUEUE-064", "q64@example.com");

    await submitHolderSignature(kemuPending.id, PNG_1PX);
    await submitHolderSignature(kemuRejected.id, PNG_1PX);
    await reviewCardSignature(kemuRejected.id, "reject");
    await submitHolderSignature(ajkPending.id, PNG_1PX);
    await issueCard(kemuIssued.id);

    // signature + pending + KEMU council -> only the KEMU pending signature
    // (the issued KEMU member is approved, the AJK member is filtered out).
    const pendingKemu = listCardQueue({
      kind: "signature",
      status: "pending",
      localCouncil: "KEMU",
    });
    expect(pendingKemu.map((i) => i.membershipId)).toEqual(["MSAP-QUEUE-061"]);

    // signature + rejected + KEMU council -> the rejected KEMU signature.
    const rejectedKemu = listCardQueue({
      kind: "signature",
      status: "rejected",
      localCouncil: "kemu",
    });
    expect(rejectedKemu.map((i) => i.membershipId)).toEqual(["MSAP-QUEUE-062"]);

    // Adding a query narrows a matching filter set further.
    const narrowed = listCardQueue({
      kind: "signature",
      status: "pending",
      localCouncil: "kemu",
      query: "q61",
    });
    expect(narrowed.map((i) => i.membershipId)).toEqual(["MSAP-QUEUE-061"]);

    // A query for a different member turns the same filter set empty.
    const noMatch = listCardQueue({
      kind: "signature",
      status: "pending",
      localCouncil: "kemu",
      query: "q63",
    });
    expect(noMatch).toEqual([]);

    // signature + approved + KEMU council -> the issued member only.
    const approvedKemu = listCardQueue({
      kind: "signature",
      status: "approved",
      localCouncil: "kemu",
    });
    expect(approvedKemu.map((i) => i.membershipId)).toEqual(["MSAP-QUEUE-064"]);
  });

  it("only pending signatures appear in the admin queue", async () => {
    const user = createMember("MSAP-CARD-0005", "card5@example.com");
    const other = createMember("MSAP-CARD-0006", "card6@example.com");
    await submitHolderSignature(user.id, PNG_1PX);
    await submitHolderSignature(other.id, PNG_1PX);
    await reviewCardSignature(user.id, "approve");

    const pending = listPendingCardApprovals();
    expect(pending.map((p) => p.membershipId).sort()).toEqual([
      "MSAP-CARD-0006",
    ]);
    expect(pending.every((p) => p.request === "signature")).toBe(true);
  });

  it("the card freezes approved data: later profile edits never appear unapproved", async () => {
    const user = createMember("MSAP-CARD-0007", "card7@example.com");
    await issueCard(user.id);

    const before = await buildMemberCard(user.id);
    expect(before?.memberName).toBe("Test MSAP-CARD-0007");
    expect(before?.dataChangedSinceIssuance).toBe(false);

    // Member edits their own name via the profile route - no approval.
    updateMemberProfile(user.id, { name: "HACKED NAME" });

    const after = await buildMemberCard(user.id);
    expect(after?.memberName).toBe("Test MSAP-CARD-0007"); // still the approved name
    expect(after?.dataChangedSinceIssuance).toBe(true);
    expect(after?.reissueRequested).toBe(false);
  });

  it("a re-issue request goes through approval and re-freezes the new data", async () => {
    const user = createMember("MSAP-CARD-0008", "card8@example.com");
    await issueCard(user.id);
    updateMemberProfile(user.id, {
      name: "Updated Name",
      localCouncil: "New LC",
    });

    // Member requests re-issue -> appears in the admin queue as a reissue item.
    const requested = await requestCardReissue(user.id);
    expect(requested?.reissueRequested).toBe(true);
    expect(
      listPendingCardApprovals().some(
        (p) => p.request === "reissue" && p.userId === user.id
      )
    ).toBe(true);

    // Approve the re-issue: new name + council are now frozen on the card.
    const reissued = await reviewCardSignature(user.id, "approve", "reissue");
    expect(reissued?.memberName).toBe("Updated Name");
    expect(reissued?.localCouncil).toBe("New LC");
    expect(reissued?.version).toBe(2);
    expect(reissued?.issued).toBe(true);
    expect(reissued?.reissueRequested).toBe(false);
    expect(reissued?.dataChangedSinceIssuance).toBe(false);
    expect(reissued?.holderSignature.status).toBe("approved");

    // A fresh token was minted and it verifies.
    const token = reissued?.verificationToken;
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyCardToken("MSAP-CARD-0008", token ?? "").valid).toBe(true);
  });

  it("rejecting a re-issue request clears it without changing the card", async () => {
    const user = createMember("MSAP-CARD-0009", "card9@example.com");
    await issueCard(user.id);
    await requestCardReissue(user.id);

    const rejected = await reviewCardSignature(user.id, "reject", "reissue");
    expect(rejected?.reissueRequested).toBe(false);
    expect(rejected?.version).toBe(1);
    expect(rejected?.memberName).toBe("Test MSAP-CARD-0009");
  });

  it("verifyCardToken accepts only the authentic issued token", async () => {
    const user = createMember("MSAP-CARD-0010", "card10@example.com");
    const issued = await issueCard(user.id);
    if (!issued?.verificationToken) return;

    const ok = verifyCardToken("MSAP-CARD-0010", issued.verificationToken);
    expect(ok.valid).toBe(true);
    if (ok.valid) {
      expect(ok.name).toBe("Test MSAP-CARD-0010");
      expect(ok.version).toBe(1);
    }

    // Tampered token, wrong member, and unissued member all fail.
    expect(
      verifyCardToken("MSAP-CARD-0010", "deadbeef".repeat(8)).valid
    ).toBe(false);
    expect(
      verifyCardToken("MSAP-CARD-UNKNOWN", issued.verificationToken).valid
    ).toBe(false);

    const unissued = createMember("MSAP-CARD-0011", "card11@example.com");
    expect(verifyCardToken("MSAP-CARD-0011", "0".repeat(64)).valid).toBe(false);
    expect(unissued).toBeDefined();
  });
});
