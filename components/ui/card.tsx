import type { ReactNode } from "react";
import { cx } from "./cx";

const VARIANTS = {
  bordered: "border border-teal/20",
  elevated: "shadow-[0_1px_4px_rgba(0,0,0,0.06)]",
} as const;

const PADDINGS = {
  none: "",
  sm: "p-3",
  md: "p-5",
} as const;

export type CardProps = {
  variant?: keyof typeof VARIANTS;
  padding?: keyof typeof PADDINGS;
  className?: string;
  children: ReactNode;
};

export function Card({ variant = "bordered", padding = "none", className, children }: CardProps) {
  return (
    <div
      className={cx(
        "overflow-hidden rounded-2xl bg-white",
        VARIANTS[variant],
        PADDINGS[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}
