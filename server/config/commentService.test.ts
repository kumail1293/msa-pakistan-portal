/**
 * Tests for the Comments Service
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  createComment,
  listComments,
  getComment,
  editComment,
  deleteComment,
  getCommentCounts,
  getRecentComments,
  getTotalCount,
  resetComments,
  getModuleForEntityType,
} from "./commentService";

describe("Comment Service — Entity Type Mapping", () => {
  it("maps activity to activities module", () => {
    expect(getModuleForEntityType("activity")).toBe("activities");
    expect(getModuleForEntityType("activities")).toBe("activities");
  });

  it("maps event to events module", () => {
    expect(getModuleForEntityType("event")).toBe("events");
    expect(getModuleForEntityType("events")).toBe("events");
  });

  it("maps election to elections module", () => {
    expect(getModuleForEntityType("election")).toBe("elections");
  });

  it("maps finance and transaction to finance module", () => {
    expect(getModuleForEntityType("finance")).toBe("finance");
    expect(getModuleForEntityType("transaction")).toBe("finance");
  });

  it("maps NEF/NRF types to nef module", () => {
    expect(getModuleForEntityType("nef")).toBe("nef");
    expect(getModuleForEntityType("nefsubmission")).toBe("nef");
    expect(getModuleForEntityType("nrf")).toBe("nef");
  });

  it("maps plenary/motion/voting to governance module", () => {
    expect(getModuleForEntityType("plenary")).toBe("governance");
    expect(getModuleForEntityType("motion")).toBe("governance");
    expect(getModuleForEntityType("voting")).toBe("governance");
  });

  it("falls back to entity type for unknown types", () => {
    expect(getModuleForEntityType("customThing")).toBe("customthing");
  });

  it("is case-insensitive", () => {
    expect(getModuleForEntityType("Activity")).toBe("activities");
    expect(getModuleForEntityType("EVENT")).toBe("events");
  });
});

describe("Comment Service — CRUD", () => {
  beforeEach(() => {
    resetComments();
  });

  it("creates a comment and returns it with an ID", () => {
    const comment = createComment({
      entityType: "activity",
      entityId: 1,
      userId: 10,
      userName: "Kumail",
      userRole: "user",
      content: "Great activity!",
    });

    expect(comment.id).toBeGreaterThan(0);
    expect(comment.entityType).toBe("activity");
    expect(comment.entityId).toBe(1);
    expect(comment.userId).toBe(10);
    expect(comment.userName).toBe("Kumail");
    expect(comment.content).toBe("Great activity!");
    expect(comment.deleted).toBe(false);
    expect(comment.edited).toBe(false);
    expect(comment.createdAt).toBeInstanceOf(Date);
  });

  it("trims whitespace from content", () => {
    const comment = createComment({
      entityType: "event",
      entityId: 5,
      userId: 10,
      userName: "Test",
      userRole: "user",
      content: "  Hello!  ",
    });
    expect(comment.content).toBe("Hello!");
  });

  it("rejects empty content", () => {
    expect(() =>
      createComment({
        entityType: "activity",
        entityId: 1,
        userId: 10,
        userName: "Test",
        userRole: "user",
        content: "   ",
      }),
    ).toThrow("Comment cannot be empty");
  });

  it("rejects content over 5000 characters", () => {
    expect(() =>
      createComment({
        entityType: "activity",
        entityId: 1,
        userId: 10,
        userName: "Test",
        userRole: "user",
        content: "x".repeat(5001),
      }),
    ).toThrow("5000 characters or fewer");
  });

  it("allows content up to 5000 characters", () => {
    const comment = createComment({
      entityType: "activity",
      entityId: 1,
      userId: 10,
      userName: "Test",
      userRole: "user",
      content: "x".repeat(5000),
    });
    expect(comment.content).toHaveLength(5000);
  });
});

describe("Comment Service — List", () => {
  beforeEach(() => {
    resetComments();
  });

  it("lists comments for an entity sorted by creation time", () => {
    createComment({ entityType: "activity", entityId: 1, userId: 10, userName: "A", userRole: "user", content: "First" });
    createComment({ entityType: "activity", entityId: 1, userId: 11, userName: "B", userRole: "user", content: "Second" });
    createComment({ entityType: "activity", entityId: 2, userId: 12, userName: "C", userRole: "user", content: "Other entity" });

    const result = listComments({ entityType: "activity", entityId: 1 });
    expect(result.total).toBe(2);
    expect(result.comments).toHaveLength(2);
    expect(result.comments[0].content).toBe("First");
    expect(result.comments[1].content).toBe("Second");
  });

  it("excludes deleted comments", () => {
    const c1 = createComment({ entityType: "event", entityId: 3, userId: 10, userName: "A", userRole: "user", content: "Keep" });
    const c2 = createComment({ entityType: "event", entityId: 3, userId: 11, userName: "B", userRole: "user", content: "Delete me" });
    deleteComment(c2.id, 11, false);

    const result = listComments({ entityType: "event", entityId: 3 });
    expect(result.total).toBe(1);
    expect(result.comments[0].content).toBe("Keep");
  });

  it("supports pagination", () => {
    for (let i = 0; i < 10; i++) {
      createComment({ entityType: "activity", entityId: 1, userId: 10, userName: "User", userRole: "user", content: `Comment ${i}` });
    }

    const page1 = listComments({ entityType: "activity", entityId: 1, limit: 3, offset: 0 });
    expect(page1.comments).toHaveLength(3);
    expect(page1.total).toBe(10);

    const page2 = listComments({ entityType: "activity", entityId: 1, limit: 3, offset: 3 });
    expect(page2.comments).toHaveLength(3);
    expect(page2.comments[0].content).toBe("Comment 3");
  });

  it("returns empty for entity with no comments", () => {
    const result = listComments({ entityType: "activity", entityId: 999 });
    expect(result.total).toBe(0);
    expect(result.comments).toHaveLength(0);
  });
});

describe("Comment Service — Edit", () => {
  beforeEach(() => {
    resetComments();
  });

  it("allows the author to edit their own comment", () => {
    const comment = createComment({
      entityType: "activity",
      entityId: 1,
      userId: 10,
      userName: "Author",
      userRole: "user",
      content: "Original",
    });

    const updated = editComment(comment.id, 10, "Updated content");
    expect(updated).not.toBeNull();
    expect(updated!.content).toBe("Updated content");
    expect(updated!.edited).toBe(true);
  });

  it("rejects edit by a different user", () => {
    const comment = createComment({
      entityType: "activity",
      entityId: 1,
      userId: 10,
      userName: "Author",
      userRole: "user",
      content: "Original",
    });

    const result = editComment(comment.id, 99, "Hacked!");
    expect(result).toBeNull();
    // Original unchanged
    const original = getComment(comment.id);
    expect(original!.content).toBe("Original");
  });

  it("rejects edit of deleted comment", () => {
    const comment = createComment({
      entityType: "activity",
      entityId: 1,
      userId: 10,
      userName: "Author",
      userRole: "user",
      content: "To be deleted",
    });
    deleteComment(comment.id, 10, false);

    const result = editComment(comment.id, 10, "Too late");
    expect(result).toBeNull();
  });
});

describe("Comment Service — Delete", () => {
  beforeEach(() => {
    resetComments();
  });

  it("allows the author to delete their own comment", () => {
    const comment = createComment({
      entityType: "activity",
      entityId: 1,
      userId: 10,
      userName: "Author",
      userRole: "user",
      content: "Delete me",
    });

    const deleted = deleteComment(comment.id, 10, false);
    expect(deleted).toBe(true);

    // Comment is soft-deleted (not returned in getComment)
    expect(getComment(comment.id)).toBeNull();
  });

  it("allows edit-level user to delete any comment", () => {
    const comment = createComment({
      entityType: "activity",
      entityId: 1,
      userId: 10,
      userName: "Author",
      userRole: "user",
      content: "Admin delete",
    });

    const deleted = deleteComment(comment.id, 99, true); // 99 = edit-level user
    expect(deleted).toBe(true);
    expect(getComment(comment.id)).toBeNull();
  });

  it("rejects delete by non-author without edit access", () => {
    const comment = createComment({
      entityType: "activity",
      entityId: 1,
      userId: 10,
      userName: "Author",
      userRole: "user",
      content: "Not yours",
    });

    const deleted = deleteComment(comment.id, 99, false);
    expect(deleted).toBe(false);
    expect(getComment(comment.id)).not.toBeNull();
  });

  it("returns false for non-existent comment", () => {
    expect(deleteComment(9999, 10, false)).toBe(false);
  });
});

describe("Comment Service — Counts & Recent", () => {
  beforeEach(() => {
    resetComments();
  });

  it("getCommentCounts returns counts per entity", () => {
    createComment({ entityType: "activity", entityId: 1, userId: 10, userName: "A", userRole: "user", content: "A1" });
    createComment({ entityType: "activity", entityId: 1, userId: 11, userName: "B", userRole: "user", content: "A1-2" });
    createComment({ entityType: "activity", entityId: 2, userId: 12, userName: "C", userRole: "user", content: "A2" });

    const counts = getCommentCounts("activity", [1, 2, 3]);
    expect(counts[1]).toBe(2);
    expect(counts[2]).toBe(1);
    expect(counts[3]).toBe(0);
  });

  it("getTotalCount returns total across all entities", () => {
    createComment({ entityType: "activity", entityId: 1, userId: 10, userName: "A", userRole: "user", content: "A" });
    createComment({ entityType: "event", entityId: 1, userId: 10, userName: "A", userRole: "user", content: "E" });
    expect(getTotalCount("activity")).toBe(1);
    expect(getTotalCount("event")).toBe(1);
  });

  it("getRecentComments returns most recent across all entities", () => {
    const old = createComment({ entityType: "activity", entityId: 1, userId: 10, userName: "A", userRole: "user", content: "Old" });
    // Ensure different timestamps
    old.createdAt = new Date(Date.now() - 1000);
    const newComment = createComment({ entityType: "event", entityId: 2, userId: 11, userName: "B", userRole: "user", content: "New" });
    newComment.createdAt = new Date(Date.now());

    const recent = getRecentComments(10);
    expect(recent).toHaveLength(2);
    // Most recent first
    expect(recent[0].content).toBe("New");
    expect(recent[1].content).toBe("Old");
  });
});

describe("Comment Service — Reset", () => {
  beforeEach(() => {
    resetComments();
  });

  it("resetComments clears all data", () => {
    createComment({ entityType: "activity", entityId: 1, userId: 10, userName: "A", userRole: "user", content: "Test" });
    expect(getTotalCount("activity")).toBe(1);

    resetComments();
    expect(getTotalCount("activity")).toBe(0);
  });
});
