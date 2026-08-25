import type { ModuleAccessLevel } from "@/hooks/useModuleAccess";
import { Eye, MessageSquare, Pencil } from "lucide-react";

const BADGE_STYLES: Record<ModuleAccessLevel, { bg: string; text: string; border: string; icon: typeof Eye; label: string }> = {
  view: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    icon: Eye,
    label: "View",
  },
  comment: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    icon: MessageSquare,
    label: "Comment",
  },
  edit: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    icon: Pencil,
    label: "Edit",
  },
};

interface ModuleAccessBadgeProps {
  level: ModuleAccessLevel | null;
  /** Show the badge as a compact dot instead of a label pill. */
  compact?: boolean;
  className?: string;
}

export function ModuleAccessBadge({ level, compact = false, className = "" }: ModuleAccessBadgeProps) {
  if (!level) return null;

  const style = BADGE_STYLES[level];
  const Icon = style.icon;

  if (compact) {
    return (
      <span
        title={`${style.label} access`}
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${style.bg} ${style.border} ${style.text} ${className}`}
      >
        <Icon className="h-2.5 w-2.5" />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${style.bg} ${style.text} ${style.border} ${className}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {style.label}
    </span>
  );
}
