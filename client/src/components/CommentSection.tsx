import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useModuleAccess, type ModuleAccessLevel } from "@/hooks/useModuleAccess";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  MessageSquare,
  Send,
  Trash2,
  Pencil,
  X,
  Check,
  Clock,
  User,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface Comment {
  id: number;
  entityType: string;
  entityId: number;
  userId: number;
  userName: string;
  userRole: string;
  content: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  edited: boolean;
  deleted: boolean;
}

interface CommentSectionProps {
  /** Entity type — e.g. "activity", "event", "election" */
  entityType: string;
  /** Entity ID */
  entityId: number;
  /** The module ID for permission checks (e.g. "activities", "events") */
  module: string;
  /** Compact mode — for embedding inside cards */
  compact?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function formatDate(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const ROLE_COLORS: Record<string, string> = {
  superadmin: "bg-purple-100 text-purple-700",
  admin: "bg-red-100 text-red-700",
  official: "bg-blue-100 text-blue-700",
  user: "bg-gray-100 text-gray-600",
};

// ============================================================================
// Component
// ============================================================================

export function CommentSection({
  entityType,
  entityId,
  module: moduleId,
  compact = false,
}: CommentSectionProps) {
  const { user } = useAuth();
  const { hasAccess } = useModuleAccess();
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  // Permission checks
  const canComment = hasAccess(moduleId, "comment");
  const canEdit = hasAccess(moduleId, "edit");
  const isSuperadmin = user?.role === "superadmin";

  // tRPC queries
  const commentsQuery = trpc.comments.list.useQuery(
    { entityType, entityId, limit: 50 },
    { enabled: !!entityId },
  );

  const utils = trpc.useUtils();

  const createMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      setNewComment("");
      utils.comments.list.invalidate({ entityType, entityId });
      toast.success("Comment posted");
    },
    onError: (err: any) => toast.error(err.message || "Could not post comment"),
  });

  const editMutation = trpc.comments.edit.useMutation({
    onSuccess: () => {
      setEditingId(null);
      setEditContent("");
      utils.comments.list.invalidate({ entityType, entityId });
      toast.success("Comment edited");
    },
    onError: (err: any) => toast.error(err.message || "Could not edit comment"),
  });

  const deleteMutation = trpc.comments.delete.useMutation({
    onSuccess: () => {
      utils.comments.list.invalidate({ entityType, entityId });
      toast.success("Comment deleted");
    },
    onError: (err: any) => toast.error(err.message || "Could not delete comment"),
  });

  // Auto-focus edit textarea
  useEffect(() => {
    if (editingId !== null && editRef.current) {
      editRef.current.focus();
      editRef.current.selectionStart = editRef.current.value.length;
    }
  }, [editingId]);

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    createMutation.mutate({ entityType, entityId, content: newComment.trim() });
  };

  const handleEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleSaveEdit = () => {
    if (!editContent.trim() || editingId === null) return;
    editMutation.mutate({ commentId: editingId, content: editContent.trim() });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleDelete = (commentId: number) => {
    if (!confirm("Delete this comment?")) return;
    deleteMutation.mutate({ commentId });
  };

  const comments = (commentsQuery.data?.comments ?? []) as Comment[];
  const total = commentsQuery.data?.total ?? 0;

  // Don't render anything if user can't even view comments
  if (!hasAccess(moduleId, "view") && !isSuperadmin) return null;

  return (
    <div className={compact ? "" : "border-t border-[#E7F4F0] pt-4"}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="h-4 w-4 text-[#5D7086]" />
        <h4 className="text-sm font-semibold text-[#1B355E]">
          Comments
          {total > 0 && (
            <span className="ml-1.5 text-xs font-normal text-[#8A9BAE]">
              ({total})
            </span>
          )}
        </h4>
      </div>

      {/* Comment List */}
      {comments.length > 0 && (
        <div className="space-y-3 mb-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={user?.id}
              canEditAny={canEdit || isSuperadmin}
              isEditing={editingId === comment.id}
              editContent={editContent}
              editRef={editRef}
              onEdit={() => handleEdit(comment)}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              onEditContentChange={setEditContent}
              onDelete={() => handleDelete(comment.id)}
            />
          ))}
        </div>
      )}

      {commentsQuery.isLoading && (
        <p className="text-xs text-[#8A9BAE] mb-3">Loading comments…</p>
      )}

      {!commentsQuery.isLoading && comments.length === 0 && (
        <p className="text-xs text-[#8A9BAE] mb-3 italic">
          No comments yet. Be the first to share your thoughts.
        </p>
      )}

      {/* New Comment Input */}
      {(canComment || isSuperadmin) && (
        <div className="flex gap-2 items-start">
          <div className="shrink-0 mt-1">
            <div className="h-7 w-7 rounded-full bg-[linear-gradient(135deg,#1B355E,#138A73)] flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">
                {initialsOf(user?.name || "")}
              </span>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <Textarea
              ref={textareaRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment…"
              rows={compact ? 1 : 2}
              className="text-sm resize-none border-[#D9E4E1] focus:border-[#138A73] focus:ring-[#138A73]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSubmit();
                }
              }}
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#8A9BAE]">
                Ctrl+Enter to post
              </span>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!newComment.trim() || createMutation.isPending}
                className="h-7 px-3 text-xs bg-[#138A73] hover:bg-[#106E5B] text-white"
              >
                {createMutation.isPending ? (
                  <span className="animate-spin h-3 w-3 border-2 border-white/30 border-t-white rounded-full" />
                ) : (
                  <Send className="h-3 w-3 mr-1" />
                )}
                Post
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* No permission message */}
      {!canComment && !isSuperadmin && user && (
        <p className="text-xs text-[#8A9BAE] italic">
          You have view-only access for this module. Comments are not enabled.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Comment Item
// ============================================================================

function CommentItem({
  comment,
  currentUserId,
  canEditAny,
  isEditing,
  editContent,
  editRef,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onEditContentChange,
  onDelete,
}: {
  comment: Comment;
  currentUserId?: number;
  canEditAny: boolean;
  isEditing: boolean;
  editContent: string;
  editRef: React.RefObject<HTMLTextAreaElement | null>;
  onEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditContentChange: (v: string) => void;
  onDelete: () => void;
}) {
  const isAuthor = comment.userId === currentUserId;
  const roleColor = ROLE_COLORS[comment.userRole] ?? ROLE_COLORS.user;

  return (
    <div className="group flex gap-2.5">
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        <div className="h-7 w-7 rounded-full bg-[#F0F5F3] border border-[#D9E4E1] flex items-center justify-center">
          <span className="text-[10px] font-bold text-[#1B355E]">
            {initialsOf(comment.userName)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold text-[#1B355E]">
            {comment.userName}
          </span>
          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${roleColor}`}>
            {comment.userRole}
          </span>
          <span className="text-[10px] text-[#8A9BAE] flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {formatDate(comment.createdAt)}
          </span>
          {comment.edited && (
            <span className="text-[10px] text-[#8A9BAE] italic">(edited)</span>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-1.5">
            <Textarea
              ref={editRef}
              value={editContent}
              onChange={(e) => onEditContentChange(e.target.value)}
              rows={2}
              className="text-sm resize-none border-[#D9E4E1] focus:border-[#138A73]"
            />
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={onCancelEdit}
                className="h-6 px-2 text-[10px]"
              >
                <X className="h-3 w-3 mr-0.5" /> Cancel
              </Button>
              <Button
                size="sm"
                onClick={onSaveEdit}
                className="h-6 px-2 text-[10px] bg-[#138A73] hover:bg-[#106E5B] text-white"
              >
                <Check className="h-3 w-3 mr-0.5" /> Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#374151] whitespace-pre-wrap break-words">
            {comment.content}
          </p>
        )}

        {/* Actions — visible on hover */}
        {!isEditing && (isAuthor || canEditAny) && (
          <div className="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isAuthor && (
              <button
                onClick={onEdit}
                className="text-[10px] text-[#8A9BAE] hover:text-[#138A73] flex items-center gap-0.5"
              >
                <Pencil className="h-2.5 w-2.5" /> Edit
              </button>
            )}
            {(isAuthor || canEditAny) && (
              <button
                onClick={onDelete}
                className="text-[10px] text-[#8A9BAE] hover:text-red-600 flex items-center gap-0.5"
              >
                <Trash2 className="h-2.5 w-2.5" /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
