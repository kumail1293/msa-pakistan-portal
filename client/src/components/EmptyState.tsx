/**
 * EmptyState & LoadingState — consistent empty/loading states across all pages.
 */

import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title = "Nothing here yet",
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <Card className={`py-16 text-center ${className}`}>
      <CardContent>
        {icon && (
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#F0F5F3] text-[#8A9BAE]">
            {icon}
          </div>
        )}
        <p className="text-sm font-medium text-[#5D7086]">{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-sm text-xs text-[#8A9BAE]">
            {description}
          </p>
        )}
        {action && <div className="mt-4">{action}</div>}
      </CardContent>
    </Card>
  );
}

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({
  message = "Loading...",
  className = "",
}: LoadingStateProps) {
  return (
    <Card className={`py-16 text-center ${className}`}>
      <CardContent>
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#138A73]" />
        <p className="text-sm text-[#5D7086]">{message}</p>
      </CardContent>
    </Card>
  );
}
