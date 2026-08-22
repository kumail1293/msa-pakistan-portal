interface SkeletonProps {
  className?: string;
  variant?: "text" | "title" | "card" | "circle" | "rect";
  count?: number;
  width?: string;
  height?: string;
}

export function Skeleton({
  className = "",
  variant = "text",
  count = 1,
  width,
  height,
}: SkeletonProps) {
  const baseClass = "msap-skeleton";
  const variantClass =
    variant === "text"
      ? "msap-skeleton-text"
      : variant === "title"
      ? "msap-skeleton-title"
      : variant === "card"
      ? "msap-skeleton-card"
      : "";

  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${baseClass} ${variantClass} ${className}`}
          style={{
            width: width,
            height:
              height ||
              (variant === "circle" ? "2.5rem" : variant === "rect" ? "10rem" : undefined),
            borderRadius: variant === "circle" ? "50%" : undefined,
          }}
        />
      ))}
    </div>
  );
}

/** Card skeleton placeholder */
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="border border-[#D5E2DE] rounded-xl p-6 bg-white"
        >
          <Skeleton variant="rect" count={1} className="mb-3" />
          <Skeleton variant="text" count={3} />
        </div>
      ))}
    </div>
  );
}

/** Table skeleton placeholder */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-3 border border-[#D5E2DE] rounded-lg bg-white"
        >
          <Skeleton variant="circle" width="2.5rem" height="2.5rem" />
          <Skeleton variant="text" width="40%" />
          <div className="flex-1" />
          <Skeleton variant="text" width="20%" />
          <Skeleton variant="text" width="15%" />
        </div>
      ))}
    </div>
  );
}
