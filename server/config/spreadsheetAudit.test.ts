/**
 * Tests for Spreadsheet Dependency Audit
 *
 * Phase 22: Verifies all Google Sheets dependencies are identified and categorized.
 */

import { describe, it, expect } from "vitest";
import {
  SPREADSHEET_DEPENDENCIES,
  getReplaceableDependencies,
  getDependenciesByEntity,
  getMigrationStatus,
  getWorkflowColumns,
} from "./spreadsheetDependencyAudit";

describe("Spreadsheet Dependency Audit", () => {
  // ── Dependency Registry ─────────────────────────────────────

  describe("Dependency Registry", () => {
    it("has identified all major spreadsheet dependencies", () => {
      expect(SPREADSHEET_DEPENDENCIES.length).toBeGreaterThanOrEqual(5);
    });

    it("has membership Excel dependency", () => {
      const dep = SPREADSHEET_DEPENDENCIES.find(
        (d) => d.sheetId === "membership-master"
      );
      expect(dep).toBeDefined();
      expect(dep!.action).toBe("REPLACE");
      expect(dep!.replacementEngine).toBe("membershipWorkflowService");
    });

    it("has NEF tracker dependency", () => {
      const dep = SPREADSHEET_DEPENDENCIES.find(
        (d) => d.sheetId === "nef-tracker"
      );
      expect(dep).toBeDefined();
      expect(dep!.action).toBe("REPLACE");
    });

    it("has LC mapping dependency", () => {
      const dep = SPREADSHEET_DEPENDENCIES.find(
        (d) => d.sheetId === "lc-mapping"
      );
      expect(dep).toBeDefined();
      expect(dep!.action).toBe("REPLACE");
    });

    it("has approval matrix dependency", () => {
      const dep = SPREADSHEET_DEPENDENCIES.find(
        (d) => d.sheetId === "approval-matrix"
      );
      expect(dep).toBeDefined();
      expect(dep!.action).toBe("REPLACE");
    });

    it("has financial ledger dependency", () => {
      const dep = SPREADSHEET_DEPENDENCIES.find(
        (d) => d.sheetId === "financial-ledger"
      );
      expect(dep).toBeDefined();
      expect(dep!.action).toBe("REPLACE");
    });
  });

  // ── Replaceable Dependencies ────────────────────────────────

  describe("getReplaceableDependencies", () => {
    it("returns all REPLACE dependencies", () => {
      const replaceable = getReplaceableDependencies();
      expect(replaceable.length).toBeGreaterThanOrEqual(4);
      for (const dep of replaceable) {
        expect(dep.action).toBe("REPLACE");
        expect(dep.replacementEngine).toBeTruthy();
      }
    });
  });

  // ── Entity-based Filtering ──────────────────────────────────

  describe("getDependenciesByEntity", () => {
    it("filters by member entity", () => {
      const deps = getDependenciesByEntity("member");
      expect(deps.length).toBe(1);
      expect(deps[0].sheetId).toBe("membership-master");
    });

    it("filters by activity entity", () => {
      const deps = getDependenciesByEntity("activity");
      expect(deps.length).toBe(1);
      expect(deps[0].sheetId).toBe("nef-tracker");
    });

    it("returns empty for unknown entity", () => {
      const deps = getDependenciesByEntity("nonexistent");
      expect(deps).toHaveLength(0);
    });
  });

  // ── Migration Status ────────────────────────────────────────

  describe("getMigrationStatus", () => {
    it("returns correct total", () => {
      const status = getMigrationStatus();
      expect(status.total).toBe(SPREADSHEET_DEPENDENCIES.length);
    });

    it("all dependencies start as identified", () => {
      const status = getMigrationStatus();
      expect(status.identified).toBe(status.total);
      expect(status.migrating).toBe(0);
      expect(status.completed).toBe(0);
    });

    it("tracks action distribution", () => {
      const status = getMigrationStatus();
      expect(status.byAction["REPLACE"]).toBeGreaterThanOrEqual(4);
      expect(status.byAction["SYNC"]).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Workflow Columns ────────────────────────────────────────

  describe("getWorkflowColumns", () => {
    it("finds workflow state columns across all sheets", () => {
      const cols = getWorkflowColumns();
      expect(cols.length).toBeGreaterThanOrEqual(10);
    });

    it("membership sheet has approval workflow columns", () => {
      const cols = getWorkflowColumns();
      const membershipCols = cols.filter(
        (c) => c.sheet === "Membership Master"
      );
      expect(membershipCols.length).toBeGreaterThanOrEqual(3);
      expect(membershipCols.some((c) => c.column.includes("VPF"))).toBe(true);
    });

    it("NEF sheet has approval workflow columns", () => {
      const cols = getWorkflowColumns();
      const nefCols = cols.filter((c) => c.sheet === "NEF Activity Tracker");
      expect(nefCols.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ── Column Mapping Quality ──────────────────────────────────

  describe("Column Mapping Quality", () => {
    it("every dependency has at least 3 columns mapped", () => {
      for (const dep of SPREADSHEET_DEPENDENCIES) {
        expect(dep.columns.length).toBeGreaterThanOrEqual(3);
      }
    });

    it("every column has a valid target type", () => {
      const validTargets = [
        "database_field",
        "workflow_state",
        "document",
        "config",
        "derived",
        "legacy",
        "remove",
      ];
      for (const dep of SPREADSHEET_DEPENDENCIES) {
        for (const col of dep.columns) {
          expect(validTargets).toContain(col.target);
        }
      }
    });

    it("workflow_controller sheets have workflow_state columns", () => {
      const controllers = SPREADSHEET_DEPENDENCIES.filter(
        (d) => d.usage === "workflow_controller"
      );
      for (const dep of controllers) {
        const wfCols = dep.columns.filter((c) => c.target === "workflow_state");
        expect(wfCols.length).toBeGreaterThanOrEqual(2);
      }
    });
  });
});
