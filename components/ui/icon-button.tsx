import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

const SIZES = {
  sm: "h-7 w-7 text-sm",
  md: "h-9 w-9 text-base",
  lg: "h-10 w-10 text-lg",
} as const;

const TONES = {
  default: "text-dark/30 hover:text-dark/60",
  danger: "text-dark/25 hover:text-red-400",
  onDark: "text-white/60 hover:text-white",
} as const;

export type IconButtonProps = {
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
} & ComponentPropsWithoutRef<"button">;

export function IconButton({
  size = "md",
  tone = "default",
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full leading-none transition-colors",
        "disabled:pointer-events-none disabled:opacity-40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40",
        SIZES[size],
        TONES[tone],
        className,
      )}
      {...rest}
    />
  );
}

export function CloseButton({
  "aria-label": ariaLabel = "Fermer",
  ...rest
}: Omit<IconButtonProps, "children">) {
  return (
    <IconButton aria-label={ariaLabel} {...rest}>
      <span aria-hidden="true">×</span>
    </IconButton>
  );
}
