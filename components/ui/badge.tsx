import type { ReactNode } from "react";
import { cx } from "./cx";

const TONES = {
  teal: "bg-teal/10 text-teal",
  orange: "bg-orange-100 text-orange-500",
  green: "bg-green-50 text-green-700",
  red: "bg-red-50 text-red-400",
  amber: "bg-amber-50 text-amber-600",
  neutral: "bg-dark/5 text-dark/50",
} as const;

const SIZES = {
  sm: "px-2.5 py-0.5 text-[10px] font-semibold",
  md: "px-3 py-1 text-xs font-medium",
} as const;

export type BadgeProps = {
  tone?: keyof typeof TONES;
  size?: keyof typeof SIZES;
  className?: string;
  children: ReactNode;
};

export function Badge({ tone = "teal", size = "sm", className, children }: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-sans",
        TONES[tone],
        SIZES[size],
        className,
      )}
    >
      {children}
    </span>
  );
}
