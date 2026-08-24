/**
 * PageHeader — consistent page header used across admin and member pages.
 *
 * Renders a label + title + description + optional action, matching the
 * existing MSAP brand style (uppercase tracking label, bold title, muted desc).
 */

import { ReactNode } from "react";

interface PageHeaderProps {
  /** Small uppercase label above the title (e.g. "Get involved", "Overview") */
  label?: string;
  /** Main page title */
  title: string;
  /** Optional subtitle / description */
  description?: string;
  /** Optional action button(s) rendered on the right */
  action?: ReactNode;
  /** Extra className on the outer wrapper */
  className?: string;
}

export function PageHeader({
  label,
  title,
  description,
  action,
  className = "",
}: PageHeaderProps) {
  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`}>
      <div>
        {label && (
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#106E5B]">
            {label}
          </p>
        )}
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[#1B355E] sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-[#66788D]">{description}</p>
        )}
      </div>
      {action && <div className="self-start">{action}</div>}
    </div>
  );
}
