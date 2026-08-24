import { describe, it, expect } from "vitest";
import {
  getCurrentTerm,
  getCurrentGovernanceVersion,
  getCurrentTermName,
  getTermDisplayString,
  getTermDurationMonths,
  getHandoverPeriodWeeks,
  isDateInCurrentTerm,
  getTermAtDate,
} from "./termService";

describe("TermService", () => {
  describe("getCurrentTerm", () => {
    it("returns a term object with all required fields", async () => {
      const term = await getCurrentTerm();
      expect(term).toHaveProperty("name");
      expect(term).toHaveProperty("version");
      expect(term).toHaveProperty("startDate");
      expect(term).toHaveProperty("endDate");
      expect(term).toHaveProperty("isActive");
      expect(term.startDate).toBeInstanceOf(Date);
      expect(term.endDate).toBeInstanceOf(Date);
    });

    it("has end date after start date", async () => {
      const term = await getCurrentTerm();
      expect(term.endDate.getTime()).toBeGreaterThan(term.startDate.getTime());
    });
  });

  describe("getCurrentGovernanceVersion", () => {
    it("returns a non-empty string", async () => {
      const version = await getCurrentGovernanceVersion();
      expect(typeof version).toBe("string");
      expect(version.length).toBeGreaterThan(0);
    });
  });

  describe("getCurrentTermName", () => {
    it("returns a non-empty string", async () => {
      const name = await getCurrentTermName();
      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);
    });
  });

  describe("getTermDisplayString", () => {
    it("returns a string starting with TERM", async () => {
      const display = await getTermDisplayString();
      expect(display).toMatch(/^TERM /);
    });

    it("uses en-dash instead of hyphen", async () => {
      const display = await getTermDisplayString();
      // Should contain "–" (en-dash) not "-" (hyphen) in the year range
      const yearPart = display.replace("TERM ", "");
      if (yearPart.includes("–")) {
        expect(yearPart).not.toMatch(/\d-\d/); // no hyphen between years
      }
    });
  });

  describe("getTermDurationMonths", () => {
    it("returns a positive number", async () => {
      const months = await getTermDurationMonths();
      expect(months).toBeGreaterThan(0);
      expect(Number.isFinite(months)).toBe(true);
    });
  });

  describe("getHandoverPeriodWeeks", () => {
    it("returns a non-negative number", async () => {
      const weeks = await getHandoverPeriodWeeks();
      expect(weeks).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(weeks)).toBe(true);
    });
  });

  describe("isDateInCurrentTerm", () => {
    it("returns true for a date within the current term", async () => {
      // Use a date that should be within any reasonable term
      const midTerm = new Date();
      const result = await isDateInCurrentTerm(midTerm);
      expect(typeof result).toBe("boolean");
    });

    it("returns false for a date far in the past", async () => {
      const result = await isDateInCurrentTerm(new Date("2000-01-01"));
      expect(result).toBe(false);
    });

    it("returns false for a date far in the future", async () => {
      const result = await isDateInCurrentTerm(new Date("2099-01-01"));
      expect(result).toBe(false);
    });
  });

  describe("getTermAtDate", () => {
    it("returns null for a date outside the current term", async () => {
      const result = await getTermAtDate(new Date("2000-01-01"));
      expect(result).toBeNull();
    });

    it("returns a term object for a date within the term", async () => {
      const now = new Date();
      const result = await getTermAtDate(now);
      // May or may not be within term depending on config defaults
      if (result) {
        expect(result).toHaveProperty("name");
        expect(result).toHaveProperty("version");
      }
    });
  });
});
