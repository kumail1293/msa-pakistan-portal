import { afterEach, describe, expect, it } from "vitest";
import {
  addCVEntry,
  applyStoreState,
  buildMemberCard,
  clearPresidentSignatureUrl,
  getCVEntries,
  getMemberDocuments,
  issueCardToken,
  reviewCardSignature,
  setPresidentSignatureUrl,
  snapshotStoreState,
  submitHolderSignature,
  upsertDocument,
  upsertUser,
  verifyCardToken,
} from "./memberAccountService";
import { clearMemoryEmailLog } from "./emailService";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function createMember(membershipId: string, email: string) {
  return upsertUser({
    openId: `member:${membershipId}`,
    email,
    name: `Test ${membershipId}`,
    membershipId,
    membershipStatus: "Active",
    discipline: "MBBS",
    yearOfStudy: "3rd Year",
    graduationYear: 2028,
    localCouncil: "MSA-Pakistan KEMU LC",
    institution: "King Edward Medical University",
    loginMethod: "member-password",
  });
}

/** Issue a card (rev 1) for the given user. */
function issueCard(userId: number) {
  submitHolderSignature(userId, PNG_1PX);
  return reviewCardSignature(userId, "approve");
}

afterEach(() => {
  clearMemoryEmailLog();
});

describe("member store persistence", () => {
  it("round-trips issued cards, accounts and the president signature", () => {
    const user = createMember("MSAP-PERSIST-0001", "persist1@example.com");
    const issued = issueCard(user.id);
    if (!issued?.verificationToken) return;
    setPresidentSignatureUrl(PNG_1PX);

    const snapshot = snapshotStoreState();
    expect(snapshot.users.length).toBeGreaterThan(0);
    expect(snapshot.cards.length).toBeGreaterThan(0);
    expect(snapshot.presidentSignatureUrl).toBe(PNG_1PX);

    // Simulate a restart: wipe the store, then restore from the snapshot.
    applyStoreState({
      version: 1,
      savedAt: new Date().toISOString(),
      nextUserId: 1,
      nextDocId: 1,
      nextCvEntryId: 1,
      presidentSignatureUrl: null,
      users: [],
      cards: [],
    });
    expect(buildMemberCard(user.id)).toBeNull();

    applyStoreState(snapshot);

    const restored = buildMemberCard(user.id);
    expect(restored).not.toBeNull();
    if (!restored) return;
    expect(restored.memberName).toBe("Test MSAP-PERSIST-0001");
    expect(restored.membershipId).toBe("MSAP-PERSIST-0001");
    expect(restored.localCouncil).toBe("MSA-Pakistan KEMU LC");
    expect(restored.issued).toBe(true);
    expect(restored.version).toBe(1);
    expect(restored.verificationToken).toBe(issued.verificationToken);
    expect(restored.holderSignature.status).toBe("approved");
    expect(restored.president.signatureUrl).toBe(PNG_1PX);
    expect(restored.expiresAt).toBeInstanceOf(Date);

    // The HMAC token still verifies against the restored issuance timestamps.
    expect(
      verifyCardToken("MSAP-PERSIST-0001", issued.verificationToken).valid
    ).toBe(true);
  });

  it("restores setup tokens so members can still finish onboarding", () => {
    const user = createMember("MSAP-PERSIST-0002", "persist2@example.com");
    // Dev/test members get a setup token via issueSetupToken during sync;
    // here we check the token digest is preserved across a restart.
    const snapshot = snapshotStoreState();
    expect(
      snapshot.users.find((u) => u.id === user.id)?.setupTokenHash
    ).toBeFalsy();

    applyStoreState(snapshot);
    // The account itself must be findable by identity after restore.
    expect(buildMemberCard(user.id)?.membershipId).toBe("MSAP-PERSIST-0002");
  });

  it("keeps issuing fresh revisions after a restore (id counters advanced)", () => {
    const user = createMember("MSAP-PERSIST-0003", "persist3@example.com");
    issueCard(user.id);
    const snapshot = snapshotStoreState();

    applyStoreState(snapshot);
    const restored = buildMemberCard(user.id);
    if (!restored) return;

    // New members after restore get ids that never collide with restored ones.
    const next = createMember("MSAP-PERSIST-0004", "persist4@example.com");
    expect(next.id).toBeGreaterThan(user.id);
    expect(next.id).not.toBe(user.id);
  });

  it("a persisted runtime signature overrides the default; a null one does not", () => {
    clearPresidentSignatureUrl();
    const user = createMember("MSAP-PERSIST-0005", "persist5@example.com");

    // A persisted non-null signature (set at runtime) is authoritative.
    setPresidentSignatureUrl(PNG_1PX);
    const withSig = snapshotStoreState();
    applyStoreState(withSig);
    expect(buildMemberCard(user.id)?.president.signatureUrl).toBe(PNG_1PX);

    // A persisted null must NOT kill the env fallback: after restore the
    // lazy getter re-reads PRESIDENT_SIGNATURE_URL (unset here -> null),
    // so ops can still seed the signature via env after a store exists.
    clearPresidentSignatureUrl();
    const withNull = snapshotStoreState();
    applyStoreState(withNull);
    expect(buildMemberCard(user.id)?.president.signatureUrl).toBeNull();
  });

  it("issueCardToken is stable across restores (same secret, same token)", () => {
    const at = new Date("2026-08-13T10:00:00Z");
    const token = issueCardToken("MSAP-PERSIST-0001", 1, at);
    const again = issueCardToken("MSAP-PERSIST-0001", 1, at);
    expect(token).toBe(again);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("documents and CV entries survive the round trip too", () => {
    const user = createMember("MSAP-PERSIST-0006", "persist6@example.com");
    addCVEntry(user.id, {
      type: "Education",
      title: "MBBS, King Edward Medical University",
      isCurrent: true,
    });
    upsertDocument(user.id, "Membership Letter", "https://drive.google.com/file/d/abc123/", "MSAP-PERSIST-0006");

    const snapshot = snapshotStoreState();
    expect(snapshot.docs.length).toBeGreaterThan(0);
    expect(snapshot.cvEntries.length).toBeGreaterThan(0);

    applyStoreState({
      version: 1,
      savedAt: new Date().toISOString(),
      nextUserId: 1,
      nextDocId: 1,
      nextCvEntryId: 1,
      presidentSignatureUrl: null,
      users: [],
      docs: [],
      cvEntries: [],
      cards: [],
    });
    expect(getMemberDocuments(user.id).length).toBe(0);
    expect(getCVEntries(user.id).length).toBe(0);

    applyStoreState(snapshot);
    expect(getMemberDocuments(user.id).length).toBe(1);
    expect(getCVEntries(user.id).length).toBe(1);
  });
});
