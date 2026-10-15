"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { signup } from "@/app/(app)/inscription/[token]/actions";
import { buttonClasses } from "@/components/ui/button";
import type { SignupState } from "@/lib/signup";

const initialState: SignupState = { status: "idle" };

const inputClass =
  "h-12 w-full rounded-xl border border-moss-light bg-ink-light px-3.5 text-base font-normal text-sand transition-colors focus:border-teal-pale focus:ring-2 focus:ring-teal-pale/30 focus:outline-none aria-invalid:border-coral-light read-only:opacity-70";

export function SignupForm({ token, email, defaultName }: { token: string; email: string; defaultName: string }) {
  const [state, formAction, pending] = useActionState(signup.bind(null, token), initialState);

  if (state.status === "success") {
    return (
      <div role="status" className="flex flex-col items-center gap-5 text-center">
        <p className="text-[18px] leading-[1.6] font-semibold text-teal-pale">
          Votre compte est créé. Bienvenue dans Comora&nbsp;!
        </p>
        <p className="text-base leading-[1.6] text-mist">
          Vous pourrez vous connecter avec {state.email} dès que votre espace sera prêt. Nous vous écrivons
          très vite pour l’installer ensemble.
        </p>
        <Link href="/" className={buttonClasses({ variant: "accent", size: "lg", shape: "pill" })}>
          Retour à l’accueil
        </Link>
      </div>
    );
  }

  const error = state.status === "error" ? state : null;
  const invalid = (field: "nom" | "password" | "confirm") =>
    error?.field === field ? { "aria-invalid": true, "aria-describedby": "signup-message" } : {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="E-mail">
        <input type="email" value={email} readOnly autoComplete="username" className={inputClass} />
      </Field>
      <Field label="Votre prénom et nom">
        <input
          type="text"
          name="nom"
          required
          maxLength={160}
          defaultValue={defaultName}
          autoComplete="name"
          className={inputClass}
          {...invalid("nom")}
        />
      </Field>
      <Field label="Mot de passe (10 caractères minimum)">
        <input
          type="password"
          name="password"
          required
          minLength={10}
          maxLength={72}
          autoComplete="new-password"
          className={inputClass}
          {...invalid("password")}
        />
      </Field>
      <Field label="Confirmer le mot de passe">
        <input
          type="password"
          name="confirm"
          required
          minLength={10}
          maxLength={72}
          autoComplete="new-password"
          className={inputClass}
          {...invalid("confirm")}
        />
      </Field>
      <button
        type="submit"
        disabled={pending}
        className="mt-1.5 h-[54px] cursor-pointer rounded-full bg-coral text-base font-semibold text-white transition-colors hover:bg-coral/90 disabled:cursor-wait disabled:opacity-80"
      >
        {pending ? "Création du compte…" : "Créer mon compte"}
      </button>
      <p id="signup-message" role="alert" className="min-h-6 text-[15px] leading-[1.5] font-semibold text-coral-light">
        {error?.message}
      </p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[14px] font-semibold text-mist">
      {label}
      {children}
    </label>
  );
}
