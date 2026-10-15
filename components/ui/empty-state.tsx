import type { ReactNode } from "react";
import { cx } from "./cx";

export function EmptyState({
  variant = "inline",
  className,
  children,
}: {
  variant?: "inline" | "block";
  className?: string;
  children: ReactNode;
}) {
  if (variant === "block") {
    return (
      <div className={cx("px-6 py-10 text-center", className)}>
        <p className="font-sans text-sm text-dark/40">{children}</p>
      </div>
    );
  }
  return <p className={cx("font-sans text-xs italic text-dark/40", className)}>{children}</p>;
}
