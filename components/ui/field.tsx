import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "./cx";

const SURFACES = {
  sand: "bg-sand",
  tealSoft: "bg-teal-50",
  plain: "bg-white",
} as const;

const SURFACE_BORDERS = {
  sand: "border-dark/10",
  tealSoft: "border-teal/30",
  plain: "border-teal/20",
} as const;

const SIZES = {
  sm: "px-3 py-2 text-base sm:text-xs",
  md: "px-3.5 py-2.5 text-base sm:text-sm",
} as const;

export type FieldStyleProps = {
  surface?: keyof typeof SURFACES;
  size?: keyof typeof SIZES;
  invalid?: boolean;
  className?: string;
};

export function fieldClasses({
  surface = "tealSoft",
  size = "md",
  invalid = false,
  className,
}: FieldStyleProps = {}) {
  return cx(
    "w-full rounded-xl border font-sans text-dark transition-colors placeholder:text-dark/30",
    "focus:outline-none focus:ring-2",
    invalid
      ? "border-red-300 focus:ring-red-200"
      : cx(SURFACE_BORDERS[surface], "focus:ring-teal/30"),
    "disabled:pointer-events-none disabled:opacity-60",
    SURFACES[surface],
    SIZES[size],
    className,
  );
}

type NativeProps<T extends "input" | "textarea" | "select"> = Omit<
  ComponentPropsWithoutRef<T>,
  "size" | "className"
>;

export function TextField({
  surface,
  size,
  invalid,
  className,
  ...rest
}: FieldStyleProps & NativeProps<"input">) {
  return (
    <input
      className={fieldClasses({ surface, size, invalid, className })}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Textarea({
  surface,
  size,
  invalid,
  className,
  ...rest
}: FieldStyleProps & NativeProps<"textarea">) {
  return (
    <textarea
      className={fieldClasses({ surface, size, invalid, className: cx("resize-none", className) })}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Select({
  surface,
  size,
  invalid,
  className,
  children,
  ...rest
}: FieldStyleProps & NativeProps<"select">) {
  return (
    <select
      className={fieldClasses({ surface, size, invalid, className })}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  );
}

const LABELS = {
  caps: "font-sans text-[10px] font-semibold uppercase tracking-widest text-dark/40",
  sentence: "font-sans text-sm text-dark/70",
} as const;

export function FieldLabel({
  variant = "caps",
  className,
  ...rest
}: { variant?: keyof typeof LABELS } & ComponentPropsWithoutRef<"label">) {
  return <label className={cx("mb-1.5 block", LABELS[variant], className)} {...rest} />;
}

export function HelperText({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cx("font-sans text-[10px] text-dark/40", className)}>{children}</p>;
}

export function ErrorText({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <p role="alert" className={cx("font-sans text-xs text-red-500", className)}>
      {children}
    </p>
  );
}
