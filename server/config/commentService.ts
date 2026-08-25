/**
 * Comments Service
 *
 * Provides a per-module, per-entity comment system.
 * Comments are scoped by module (e.g. "activities") and entity ID (e.g. activity 5).
 *
 * Access levels:
 *   - view:    can read comments
 *   - comment: can read + create comments
 *   - edit:    can read + create + delete comments
 *
 * Usage:
 *   import { createComment, listComments, deleteComment } from "./commentService";
 *
 *   const comment = createComment({
 *     entityType: "activity",
 *     entityId: 42,
 *     userId: 7,
 *     userName: "Kumail",
 *     content: "Great initiative!",
 *   });
 *
 *   const comments = listComments("activity", 42);
 *   deleteComment(commentId, userId); // only owner or edit-level user
 */

// ============================================================================
// Entity Type → Module Mapping
// ============================================================================

const ENTITY_MODULE_MAP: Record<string, string> = {
  activity: "activities",
  activities: "activities",
  event: "events",
  events: "events",
  election: "elections",
  elections: "elections",
  finance: "finance",
  transaction: "finance",
  nef: "nef",
  nefsubmission: "nef",
  nef_submissions: "nef",
  nrf: "nef",
  nrfreport: "nef",
  nef_nrf: "nef",
  plenary: "governance",
  motion: "governance",
  voting: "governance",
  document: "documents",
  documents: "documents",
  chapter: "chapters",
  chapters: "chapters",
  project: "projects",
  projects: "projects",
  training: "training",
  course: "training",
  meeting: "meetings",
  meetings: "meetings",
  communication: "communications",
  communications: "communications",
  announcement: "communications",
  credential: "credentials",
  credentials: "credentials",
  member: "members",
  members: "members",
};

/**
 * Resolve the module ID for a given entity type string.
 * Falls back to the entity type itself if no mapping exists.
 */
export function getModuleForEntityType(entityType: string): string {
  return ENTITY_MODULE_MAP[entityType.toLowerCase()] ?? entityType.toLowerCase();
}

// ============================================================================
// Types
// =============================================================================

export interface Comment {
  id: number;
  entityType: string;
  entityId: number;
  userId: number;
  userName: string;
  userRole: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  edited: boolean;
  deleted: boolean;
}

export interface CreateCommentInput {
  entityType: string;
  entityId: number;
  userId: number;
  userName: string;
  userRole: string;
  content: string;
}

export interface CommentListOptions {
  entityType: string;
  entityId: number;
  limit?: number;
  offset?: number;
}

// ============================================================================
// In-Memory Store
// ============================================================================

let comments: Comment[] = [];
let nextId = 1;

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new comment.
 */
export function createComment(input: CreateCommentInput): Comment {
  const trimmed = input.content.trim();
  if (!trimmed) {
    throw new Error("Comment cannot be empty.");
  }
  if (trimmed.length > 5000) {
    throw new Error("Comment must be 5000 characters or fewer.");
  }

  const comment: Comment = {
    id: nextId++,
    entityType: input.entityType.toLowerCase(),
    entityId: input.entityId,
    userId: input.userId,
    userName: input.userName || "Unknown",
    userRole: input.userRole || "user",
    content: trimmed,
    createdAt: new Date(),
    updatedAt: new Date(),
    edited: false,
    deleted: false,
  };

  comments.push(comment);
  return comment;
}

/**
 * List comments for a specific entity.
 */
export function listComments(options: CommentListOptions): {
  comments: Comment[];
  total: number;
} {
  const { entityType, entityId, limit = 50, offset = 0 } = options;

  const filtered = comments.filter(
    (c) =>
      c.entityType === entityType.toLowerCase() &&
      c.entityId === entityId &&
      !c.deleted,
  );

  const total = filtered.length;
  const paginated = filtered
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(offset, offset + limit);

  return { comments: paginated, total };
}

/**
 * Get comment counts for multiple entities at once.
 */
export function getCommentCounts(
  entityType: string,
  entityIds: number[],
): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const id of entityIds) {
    counts[id] = comments.filter(
      (c) =>
        c.entityType === entityType.toLowerCase() &&
        c.entityId === id &&
        !c.deleted,
    ).length;
  }
  return counts;
}

/**
 * Delete a comment (soft delete). Only the comment author or users with
 * "edit" access on the module can delete.
 */
export function deleteComment(
  commentId: number,
  userId: number,
  isEditUser: boolean = false,
): boolean {
  const comment = comments.find((c) => c.id === commentId && !c.deleted);
  if (!comment) return false;

  // Only the author or an edit-level user can delete
  if (comment.userId !== userId && !isEditUser) {
    return false;
  }

  comment.deleted = true;
  comment.updatedAt = new Date();
  return true;
}

/**
 * Edit a comment (only by the original author).
 */
export function editComment(
  commentId: number,
  userId: number,
  newContent: string,
): Comment | null {
  const trimmed = newContent.trim();
  if (!trimmed) {
    throw new Error("Comment cannot be empty.");
  }
  if (trimmed.length > 5000) {
    throw new Error("Comment must be 5000 characters or fewer.");
  }

  const comment = comments.find(
    (c) => c.id === commentId && c.userId === userId && !c.deleted,
  );
  if (!comment) return null;

  comment.content = trimmed;
  comment.edited = true;
  comment.updatedAt = new Date();
  return comment;
}

/**
 * Get a single comment by ID.
 */
export function getComment(commentId: number): Comment | null {
  const comment = comments.find((c) => c.id === commentId && !c.deleted);
  return comment ?? null;
}

/**
 * Get total comment count for an entity type.
 */
export function getTotalCount(entityType: string): number {
  return comments.filter(
    (c) => c.entityType === entityType.toLowerCase() && !c.deleted,
  ).length;
}

/**
 * Get recent comments across all entities (for admin dashboard).
 */
export function getRecentComments(limit: number = 20): Comment[] {
  return comments
    .filter((c) => !c.deleted)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

/**
 * Reset store (for testing).
 */
export function resetComments(): void {
  comments = [];
  nextId = 1;
}
