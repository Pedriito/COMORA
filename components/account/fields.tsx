import type { ReactNode } from "react";

/** Champs des formulaires de compte (fond sombre, comme la page de connexion). */
export const inputClass =
  "h-12 w-full rounded-xl border border-moss-light bg-ink-light px-3.5 text-base font-normal text-sand transition-colors placeholder:text-mist-dark/60 focus:border-teal-pale focus:ring-2 focus:ring-teal-pale/30 focus:outline-none aria-invalid:border-coral-light read-only:opacity-70";

export const primaryButtonClass =
  "mt-1.5 h-[54px] cursor-pointer rounded-full bg-coral text-base font-semibold text-white transition-colors hover:bg-coral/90 disabled:cursor-wait disabled:opacity-80";

export function Field({
  label,
  hint,
  error,
  id,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[14px] font-semibold text-mist">
        {label}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-[13px] text-mist-dark">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[14px] font-semibold text-coral-light">
          {error}
        </p>
      )}
    </div>
  );
}
