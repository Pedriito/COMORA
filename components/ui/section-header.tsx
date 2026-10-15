import type { ReactNode } from "react";
import { cx } from "./cx";

const SIZES = {
  sm: "text-[10px] font-semibold",
  md: "text-xs font-medium",
} as const;

const TONES = {
  default: "text-dark/40",
  onDark: "text-white/30",
} as const;

export type SectionHeaderProps = {
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
  className?: string;
  children: ReactNode;
};

export function SectionHeader({
  size = "sm",
  tone = "default",
  className,
  children,
}: SectionHeaderProps) {
  return (
    <p className={cx("font-sans uppercase tracking-widest", SIZES[size], TONES[tone], className)}>
      {children}
    </p>
  );
}
