import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

const VARIANTS = {
  primary: "bg-teal text-white hover:bg-teal-dark",
  accent: "bg-coral text-white hover:bg-coral/90",
  dark: "bg-dark text-white hover:bg-dark/80",
  outline: "border border-teal/20 text-dark/60 hover:bg-teal/5",
  ghost: "bg-white/10 text-white hover:bg-white/20",
  link: "text-teal hover:underline",
} as const;

const SIZES = {
  xs: "px-2.5 py-1.5 text-xs",
  sm: "px-3 py-2 text-xs",
  md: "px-3.5 py-2.5 text-sm",
  lg: "px-4 py-3 text-sm",
} as const;

const LINK_SIZES = {
  xs: "text-[10px]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-sm",
} as const;

const SHAPES = {
  rounded: "rounded-lg",
  pill: "rounded-full",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;
export type ButtonShape = keyof typeof SHAPES;

export type ButtonStyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  fullWidth?: boolean;
  className?: string;
};

/** Classes d'un bouton EgliseUI, utilisables aussi sur un lien. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  shape = "rounded",
  fullWidth = false,
  className,
}: ButtonStyleProps = {}) {
  const isLink = variant === "link";
  return cx(
    "inline-flex items-center justify-center gap-1.5 font-sans font-medium transition-colors",
    "disabled:pointer-events-none disabled:opacity-40",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 focus-visible:ring-offset-2",
    VARIANTS[variant],
    isLink ? LINK_SIZES[size] : SIZES[size],
    isLink ? "" : SHAPES[shape],
    fullWidth && "w-full",
    className,
  );
}

export type ButtonProps = ButtonStyleProps &
  Omit<ComponentPropsWithoutRef<"button">, "className">;

export function Button({
  variant,
  size,
  shape,
  fullWidth,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, shape, fullWidth, className })}
      {...rest}
    />
  );
}
