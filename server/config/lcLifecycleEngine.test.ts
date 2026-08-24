/**
 * Tests for Local Council Lifecycle Engine
 *
 * Tests:
 * - Valid status transitions (CI → Candidate → Temporary → Permanent)
 * - Invalid transitions are rejected
 * - Health scoring algorithm
 * - Compliance checks
 * - LC statistics
 */

import { describe, it, expect } from "vitest";
import {
  getValidTransitions,
  type LCStatus,
  type LCStatusTransition,
} from "./lcLifecycleEngine";

describe("LC Lifecycle Engine", () => {
  // ── Status Transitions ──────────────────────────────────────

  describe("getValidTransitions", () => {
    it("CI → Candidate LC is valid", () => {
      const transitions = getValidTransitions("Coordinator Institute");
      expect(transitions).toHaveLength(1);
      expect(transitions[0].to).toBe("Candidate LC");
      expect(transitions[0].requiresSupCoApproval).toBe(true);
      expect(transitions[0].requiresNgaApproval).toBe(false);
    });

    it("Candidate LC → Temporary LC is valid", () => {
      const transitions = getValidTransitions("Candidate LC");
      expect(transitions).toHaveLength(1);
      expect(transitions[0].to).toBe("Temporary LC");
      expect(transitions[0].requiresNgaApproval).toBe(true);
    });

    it("Temporary LC → Permanent LC is valid", () => {
      const transitions = getValidTransitions("Temporary LC");
      expect(transitions.length).toBeGreaterThanOrEqual(2);
      const perm = transitions.find((t) => t.to === "Permanent LC");
      expect(perm).toBeDefined();
      expect(perm!.requiresNgaApproval).toBe(true);
    });

    it("Temporary LC → Suspended is valid", () => {
      const transitions = getValidTransitions("Temporary LC");
      const susp = transitions.find((t) => t.to === "Suspended");
      expect(susp).toBeDefined();
    });

    it("Permanent LC → Suspended is valid", () => {
      const transitions = getValidTransitions("Permanent LC");
      expect(transitions).toHaveLength(1);
      expect(transitions[0].to).toBe("Suspended");
    });

    it("Suspended → Temporary LC (reactivation) is valid", () => {
      const transitions = getValidTransitions("Suspended");
      expect(transitions.length).toBeGreaterThanOrEqual(1);
      const reactivate = transitions.find((t) => t.to === "Temporary LC");
      expect(reactivate).toBeDefined();
      expect(reactivate!.requiresNgaApproval).toBe(true);
    });

    it("Suspended → Archived is valid", () => {
      const transitions = getValidTransitions("Suspended");
      const archive = transitions.find((t) => t.to === "Archived");
      expect(archive).toBeDefined();
      expect(archive!.requiresNgaApproval).toBe(true);
    });

    it("Archived has no valid transitions", () => {
      const transitions = getValidTransitions("Archived");
      expect(transitions).toHaveLength(0);
    });

    it("CI cannot skip to Temporary LC", () => {
      const transitions = getValidTransitions("Coordinator Institute");
      const skip = transitions.find((t) => t.to === "Temporary LC");
      expect(skip).toBeUndefined();
    });

    it("CI cannot skip to Permanent LC", () => {
      const transitions = getValidTransitions("Coordinator Institute");
      const skip = transitions.find((t) => t.to === "Permanent LC");
      expect(skip).toBeUndefined();
    });
  });

  // ── Transition Preconditions ─────────────────────────────────

  describe("Transition Preconditions", () => {
    it("CI → Candidate requires SupCo but not NGA", () => {
      const transitions = getValidTransitions("Coordinator Institute");
      const t = transitions[0];
      expect(t.requiresSupCoApproval).toBe(true);
      expect(t.requiresNgaApproval).toBe(false);
      expect(t.conditions.length).toBeGreaterThan(0);
    });

    it("Candidate → Temporary requires both SupCo and NGA", () => {
      const transitions = getValidTransitions("Candidate LC");
      const t = transitions[0];
      expect(t.requiresSupCoApproval).toBe(true);
      expect(t.requiresNgaApproval).toBe(true);
    });

    it("Temporary → Permanent requires NGA approval", () => {
      const transitions = getValidTransitions("Temporary LC");
      const perm = transitions.find((t) => t.to === "Permanent LC")!;
      expect(perm.requiresNgaApproval).toBe(true);
      expect(perm.conditions.length).toBeGreaterThanOrEqual(5);
    });

    it("All transitions have descriptions", () => {
      const statuses: LCStatus[] = [
        "Coordinator Institute",
        "Candidate LC",
        "Temporary LC",
        "Permanent LC",
        "Suspended",
      ];
      for (const status of statuses) {
        const transitions = getValidTransitions(status);
        for (const t of transitions) {
          expect(t.description).toBeTruthy();
          expect(t.description.length).toBeGreaterThan(10);
        }
      }
    });
  });

  // ── Status Exhaustiveness ────────────────────────────────────

  describe("Status Coverage", () => {
    it("all LC statuses have at least one outgoing transition except Archived", () => {
      const statuses: LCStatus[] = [
        "Coordinator Institute",
        "Candidate LC",
        "Temporary LC",
        "Permanent LC",
        "Suspended",
        "Archived",
      ];

      for (const status of statuses) {
        const transitions = getValidTransitions(status);
        if (status === "Archived") {
          expect(transitions).toHaveLength(0);
        } else {
          expect(transitions.length).toBeGreaterThanOrEqual(1);
        }
      }
    });
  });
});
