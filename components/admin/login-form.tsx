"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/admin/actions";

const initialState: LoginState = { error: null };

/** Le mot de passe part uniquement dans le corps de la requête POST de la Server Action. */
export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-[14px] font-semibold text-mist">
        Mot de passe
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          autoFocus
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "login-error" : undefined}
          className="h-12 w-full rounded-xl border border-moss-light bg-ink-light px-3.5 text-base font-normal text-sand transition-colors focus:border-teal-pale focus:ring-2 focus:ring-teal-pale/30 focus:outline-none aria-invalid:border-coral-light"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-12 cursor-pointer rounded-full bg-coral text-base font-semibold text-white transition-colors hover:bg-coral/90 disabled:cursor-wait disabled:opacity-80"
      >
        {pending ? "Vérification…" : "Entrer"}
      </button>
      <p id="login-error" role="alert" className="min-h-6 text-[15px] font-semibold text-coral-light">
        {state.error}
      </p>
    </form>
  );
}
