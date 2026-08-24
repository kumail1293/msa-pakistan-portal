/**
 * StatCard — compact stat display card used across dashboards.
 *
 * Shows an icon, label, and a large number with optional detail text.
 * Consistent styling across admin and member pages.
 */

import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  /** Lucide icon component */
  icon: ReactNode;
  /** Stat label (e.g. "Activities") */
  label: string;
  /** Primary stat value */
  value: string | number;
  /** Optional detail text below the label */
  detail?: string;
  /** Tailwind color classes for the icon container */
  iconColor?: string;
  /** Click handler — makes the card interactive */
  onClick?: () => void;
  /** Extra className */
  className?: string;
}

export function StatCard({
  icon,
  label,
  value,
  detail,
  iconColor = "bg-[#E7F4F0] text-[#106E5B] border border-[#A8D8CD]",
  onClick,
  className = "",
}: StatCardProps) {
  const Wrapper = onClick ? "button" : "div";
  const wrapperProps = onClick
    ? { onClick, className: `text-left w-full ${className}` }
    : { className };

  return (
    <Wrapper {...wrapperProps}>
      <Card
        className={`overflow-hidden transition-all ${
          onClick
            ? "hover:-translate-y-0.5 hover:shadow-md hover:border-[#A8D8CD] cursor-pointer"
            : ""
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconColor}`}
            >
              {icon}
            </div>
            <span className="text-2xl font-bold text-[#1B355E]">{value}</span>
          </div>
          <p className="mt-2 text-xs font-medium text-[#66788D]">{label}</p>
          {detail && (
            <p className="mt-0.5 text-[11px] text-[#8A9BAE] line-clamp-1">
              {detail}
            </p>
          )}
        </CardContent>
      </Card>
    </Wrapper>
  );
}
