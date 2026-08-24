/**
 * Tests for Document Template Engine and Notification Engine
 *
 * Phase 21: Document & Notification Migration
 */

import { describe, it, expect } from "vitest";
import {
  getTemplate,
  listTemplates,
  getTemplatesByCategory,
  validateTemplateData,
  type DocumentTemplateKey,
} from "./documentTemplateEngine";
import {
  getNotificationTemplates,
  getNotificationTemplate,
} from "./notificationEngine";

describe("Document Template Engine", () => {
  // ── Template Registry ───────────────────────────────────────

  describe("Template Registry", () => {
    it("has all expected membership templates", () => {
      expect(getTemplate("membership.card")).toBeDefined();
      expect(getTemplate("membership.certificate")).toBeDefined();
      expect(getTemplate("membership.letter")).toBeDefined();
    });

    it("has all expected appointment templates", () => {
      expect(getTemplate("appointment.letter")).toBeDefined();
      expect(getTemplate("appointment.certificate")).toBeDefined();
    });

    it("has all expected finance templates", () => {
      expect(getTemplate("nef.report")).toBeDefined();
      expect(getTemplate("nrf.report")).toBeDefined();
    });

    it("has governance templates", () => {
      expect(getTemplate("meeting.minutes")).toBeDefined();
      expect(getTemplate("proxy.form")).toBeDefined();
    });

    it("has election certificate template", () => {
      expect(getTemplate("election.certificate")).toBeDefined();
    });

    it("returns null for unknown template", () => {
      expect(getTemplate("nonexistent.template" as DocumentTemplateKey)).toBeNull();
    });
  });

  // ── List / Filter ───────────────────────────────────────────

  describe("listTemplates", () => {
    it("lists all templates", () => {
      const all = listTemplates();
      expect(all.length).toBeGreaterThanOrEqual(10);
    });

    it("filters by category", () => {
      const membership = listTemplates("membership");
      expect(membership.length).toBeGreaterThanOrEqual(3);
      for (const t of membership) {
        expect(t.category).toBe("membership");
      }
    });

    it("filters by appointment category", () => {
      const appointments = listTemplates("appointment");
      expect(appointments.length).toBe(2);
    });

    it("filters by finance category", () => {
      const finance = listTemplates("finance");
      expect(finance.length).toBe(2);
    });
  });

  // ── getTemplatesByCategory ──────────────────────────────────

  describe("getTemplatesByCategory", () => {
    it("returns template keys for membership", () => {
      const keys = getTemplatesByCategory("membership");
      expect(keys).toContain("membership.card");
      expect(keys).toContain("membership.certificate");
    });

    it("returns empty array for unknown category", () => {
      const keys = getTemplatesByCategory("nonexistent");
      expect(keys).toHaveLength(0);
    });
  });

  // ── Template Structure ──────────────────────────────────────

  describe("Template Structure", () => {
    it("every template has a name, description, and fields", () => {
      const all = listTemplates();
      for (const t of all) {
        expect(t.name).toBeTruthy();
        expect(t.description).toBeTruthy();
        expect(t.fields.length).toBeGreaterThan(0);
      }
    });

    it("every template has a valid format", () => {
      const all = listTemplates();
      for (const t of all) {
        expect(["pdf", "html", "docx"]).toContain(t.format);
      }
    });

    it("membership card has key identity fields", () => {
      const card = getTemplate("membership.card")!;
      expect(card.fields).toContain("memberName");
      expect(card.fields).toContain("membershipId");
      expect(card.fields).toContain("localCouncil");
    });

    it("appointment letter has term fields", () => {
      const letter = getTemplate("appointment.letter")!;
      expect(letter.fields).toContain("officerName");
      expect(letter.fields).toContain("position");
      expect(letter.fields).toContain("termStart");
      expect(letter.fields).toContain("termEnd");
    });
  });

  // ── Data Validation ─────────────────────────────────────────

  describe("validateTemplateData", () => {
    it("validates complete data as valid", () => {
      const result = validateTemplateData("membership.card", {
        memberName: "Ahmed",
        membershipId: "MSAP-001",
        localCouncil: "KEMU LC",
        discipline: "MBBS",
        yearOfStudy: "3rd Year",
        validFrom: "2025-10-01",
        validUntil: "2026-09-30",
        photoUrl: "https://...",
        qrCode: "ABC123",
        termDisplay: "2025-26",
      });
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it("reports missing fields", () => {
      const result = validateTemplateData("membership.card", {
        memberName: "Ahmed",
      });
      expect(result.valid).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.missing).toContain("membershipId");
    });

    it("reports extra fields", () => {
      const result = validateTemplateData("membership.card", {
        memberName: "Ahmed",
        membershipId: "MSAP-001",
        localCouncil: "KEMU LC",
        discipline: "MBBS",
        yearOfStudy: "3rd",
        validFrom: "2025-10-01",
        validUntil: "2026-09-30",
        photoUrl: "",
        qrCode: "ABC",
        termDisplay: "2025-26",
        extraField: "oops",
      });
      expect(result.extra).toContain("extraField");
    });

    it("returns invalid for unknown template", () => {
      const result = validateTemplateData(
        "nonexistent.template" as DocumentTemplateKey,
        { foo: "bar" }
      );
      expect(result.valid).toBe(false);
      expect(result.missing).toContain("nonexistent.template");
    });
  });
});

describe("Notification Engine", () => {
  // ── Template Registry ───────────────────────────────────────

  describe("Notification Templates", () => {
    it("has membership notification templates", () => {
      expect(getNotificationTemplate("membership.applied")).toBeDefined();
      expect(getNotificationTemplate("membership.approved")).toBeDefined();
      expect(getNotificationTemplate("membership.rejected")).toBeDefined();
    });

    it("has appointment notification templates", () => {
      expect(getNotificationTemplate("appointment.approved")).toBeDefined();
    });

    it("has NEF notification templates", () => {
      expect(getNotificationTemplate("nef.submitted")).toBeDefined();
      expect(getNotificationTemplate("nef.approved")).toBeDefined();
    });

    it("has NGA notification templates", () => {
      expect(getNotificationTemplate("nga.invitation")).toBeDefined();
    });

    it("has workflow notification templates", () => {
      expect(getNotificationTemplate("workflow.task_assigned")).toBeDefined();
      expect(getNotificationTemplate("workflow.task_overdue")).toBeDefined();
    });

    it("has governance notification templates", () => {
      expect(
        getNotificationTemplate("governance.rule_changed")
      ).toBeDefined();
    });

    it("returns null for unknown type", () => {
      expect(getNotificationTemplate("nonexistent")).toBeNull();
    });
  });

  // ── Template Structure ──────────────────────────────────────

  describe("Template Structure", () => {
    it("every template has subject, body, pushTitle, pushBody", () => {
      const all = getNotificationTemplates();
      for (const t of all) {
        const template = getNotificationTemplate(t.type)!;
        expect(template.subject).toBeTruthy();
        expect(template.body).toBeTruthy();
        expect(template.pushTitle).toBeTruthy();
        expect(template.pushBody).toBeTruthy();
      }
    });

    it("every template has channels", () => {
      const all = getNotificationTemplates();
      for (const t of all) {
        expect(t.channels.length).toBeGreaterThan(0);
      }
    });

    it("every template has a valid priority", () => {
      const all = getNotificationTemplates();
      const validPriorities = ["low", "normal", "high", "urgent"];
      for (const t of all) {
        expect(validPriorities).toContain(t.priority);
      }
    });

    it("membership.approved has email channel", () => {
      const t = getNotificationTemplate("membership.approved")!;
      expect(t.channels).toContain("email");
    });

    it("workflow.task_overdue is urgent priority", () => {
      const t = getNotificationTemplate("workflow.task_overdue")!;
      expect(t.priority).toBe("urgent");
    });
  });

  // ── getNotificationTemplates ────────────────────────────────

  describe("getNotificationTemplates", () => {
    it("returns all notification types", () => {
      const all = getNotificationTemplates();
      expect(all.length).toBeGreaterThanOrEqual(10);
    });

    it("each entry has type, subject, channels, priority", () => {
      const all = getNotificationTemplates();
      for (const t of all) {
        expect(t.type).toBeTruthy();
        expect(t.subject).toBeTruthy();
        expect(t.channels.length).toBeGreaterThan(0);
        expect(t.priority).toBeTruthy();
      }
    });
  });
});
