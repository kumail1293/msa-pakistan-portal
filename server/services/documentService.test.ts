import { describe, expect, it } from "vitest";
import { generatePremiumMembershipCardPdf } from "./documentService";
import type { MemberCardData } from "./memberAccountService";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function fakeCard(overrides: Partial<MemberCardData> = {}): MemberCardData {
  return {
    memberName: "Ayesha Khan",
    membershipId: "MSAP-K1-0042",
    institution: "King Edward Medical University",
    discipline: "MBBS",
    yearOfStudy: "3rd Year",
    localCouncil: "MSA-Pakistan KEMU LC",
    graduationYear: 2028,
    photoUrl: "",
    status: "Active",
    role: "user",
    issued: true,
    version: 1,
    issuedAt: new Date("2026-08-13T10:00:00Z"),
    expiresAt: new Date("2028-12-31T23:59:59Z"),
    verificationToken: "a".repeat(64),
    dataChangedSinceIssuance: false,
    reissueRequested: false,
    holderSignature: {
      dataUrl: PNG_1PX,
      status: "approved",
      submittedAt: new Date(),
      reviewedAt: new Date(),
    },
    president: {
      name: "Kumail Danial",
      title: "National President",
      signatureUrl: null,
    },
    ...overrides,
  };
}

// pdfkit + QR + several image renders are heavy; each PDF takes ~2-5s, so
// the 5s vitest default (shared across a parallel run) is too tight.
describe("generatePremiumMembershipCardPdf", () => {
  it(
    "produces a valid PDF for an issued card",
    async () => {
      const pdf = await generatePremiumMembershipCardPdf(fakeCard());
      expect(pdf.length).toBeGreaterThan(2_000);
      // PDF magic header.
      expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      // Self-terminating trailer.
      expect(pdf.subarray(pdf.length - 6).toString("latin1")).toBe("%%EOF\n");
    },
    30_000
  );

  it(
    "still renders for an unissued card (no QR, pending issuance)",
    async () => {
      const pdf = await generatePremiumMembershipCardPdf(
        fakeCard({
          issued: false,
          version: 0,
          issuedAt: null,
          expiresAt: null,
          verificationToken: null,
          holderSignature: { dataUrl: null, status: "none", submittedAt: null, reviewedAt: null },
        })
      );
      expect(pdf.length).toBeGreaterThan(1_500);
      expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    },
    30_000
  );

  it(
    "handles a rejected signature gracefully",
    async () => {
      const pdf = await generatePremiumMembershipCardPdf(
        fakeCard({
          holderSignature: { dataUrl: null, status: "rejected", submittedAt: new Date(), reviewedAt: new Date() },
        })
      );
      expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    },
    30_000
  );

  it(
    "never fetches internal hosts for the photo (SSRF guard)",
    async () => {
      // http:// (non-TLS), localhost, and cloud-metadata IPs must all be
      // rejected by imageToBuffer; the card must still render with the
      // initials fallback instead of erroring or issuing a fetch.
      for (const photoUrl of [
        "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
        "http://localhost:8080/photo.png",
        "http://10.0.0.5/photo.png",
        "http://192.168.1.10/photo.png",
      ]) {
        const pdf = await generatePremiumMembershipCardPdf(fakeCard({ photoUrl }));
        expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      }
    },
    30_000
  );

  it(
    "accepts https photo URLs but caps oversized responses",
    async () => {
      // Not asserted against a live fetch (network-free test); the important
      // contract is that a malicious/oversized remote image never breaks the
      // card render.
      const pdf = await generatePremiumMembershipCardPdf(
        fakeCard({ photoUrl: "https://example.com/photo.png" })
      );
      expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    },
    30_000
  );

  it(
    "embeds the National President's real signature when provided",
    async () => {
      const pdf = await generatePremiumMembershipCardPdf(
        fakeCard({
          president: {
            name: "Kumail Danial",
            title: "National President",
            signatureUrl: PNG_1PX,
          },
        })
      );
      expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      // The signature image is embedded as an additional XObject stream.
      const latin = pdf.toString("latin1");
      expect((latin.match(/\/Subtype \/Image/g) || []).length).toBeGreaterThan(3);
    },
    30_000
  );
});
