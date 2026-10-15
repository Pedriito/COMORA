import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

/** Surtitre en petites capitales espacées, au-dessus des titres de section. */
export function Eyebrow({
  onDark = false,
  className,
  children,
}: {
  onDark?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <p
      className={cx(
        "text-[13px] font-semibold uppercase tracking-[0.16em]",
        onDark ? "text-teal-pale" : "text-teal-dark",
        className,
      )}
    >
      {children}
    </p>
  );
}
