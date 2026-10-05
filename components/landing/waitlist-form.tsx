"use client";

import { startTransition, useActionState, useState, type FormEvent, type ReactNode } from "react";
import { requestAccess } from "@/app/(site)/actions";
import { cx } from "@/components/ui/cx";
import {
  ROLE_OPTIONS,
  SIZE_OPTIONS,
  WAITLIST_LIMITS,
  readWaitlistValues,
  validateWaitlist,
  waitlistMessages,
  type WaitlistField,
  type WaitlistState,
} from "@/lib/waitlist";

const initialState: WaitlistState = { status: "idle" };

const inputClass =
  "h-12 w-full rounded-xl border border-moss-light bg-ink-light px-3.5 text-base font-normal text-sand scheme-dark transition-colors focus:border-teal-pale focus:ring-2 focus:ring-teal-pale/30 focus:outline-none aria-invalid:border-coral-light";

export function WaitlistForm() {
  const [state, formAction, pending] = useActionState(requestAccess, initialState);
  // Erreur détectée dans le navigateur, avant tout envoi.
  const [localError, setLocalError] = useState<WaitlistField[] | null>(null);

  const serverError = state.status === "error" ? state : null;
  const invalid = localError ?? serverError?.invalid ?? [];
  const message =
    localError !== null ? waitlistMessages.invalid : state.status === "idle" ? "" : state.message;
  // Sans JavaScript, la page est rendue à nouveau : on réaffiche ce qui avait été saisi.
  const values = serverError?.values;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Envoi manuel plutôt que par l'attribut action : React ne vide pas le
    // formulaire, la saisie reste en place si le serveur refuse la demande.
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = validateWaitlist(readWaitlistValues(data));
    if (!result.ok) {
      setLocalError(result.invalid);
      const first = form.elements.namedItem(result.invalid[0]);
      if (first instanceof HTMLElement) first.focus();
      return;
    }
    setLocalError(null);
    data.set("source", new URLSearchParams(window.location.search).get("utm_source") ?? "");
    startTransition(() => formAction(data));
  }

  const fieldProps = (name: WaitlistField) => ({
    name,
    defaultValue: values?.[name],
    "aria-invalid": invalid.includes(name) || undefined,
    "aria-describedby": invalid.includes(name) ? "waitlist-message" : undefined,
  });

  return (
    <>
      {state.status !== "success" && (
        <form action={formAction} onSubmit={handleSubmit} noValidate className="relative flex flex-col gap-4">
          <Field label="Nom de l’église">
            <input
              type="text"
              placeholder={"Ex.\u00a0: Église du Centre"}
              required
              maxLength={WAITLIST_LIMITS.eglise}
              autoComplete="organization"
              className={inputClass}
              {...fieldProps("eglise")}
            />
          </Field>
          <Field label="Ville">
            <input
              type="text"
              placeholder={"Ex.\u00a0: Lyon"}
              required
              maxLength={WAITLIST_LIMITS.ville}
              autoComplete="address-level2"
              className={inputClass}
              {...fieldProps("ville")}
            />
          </Field>
          <Field label="Votre prénom et nom">
            <input
              type="text"
              required
              maxLength={WAITLIST_LIMITS.nom}
              autoComplete="name"
              className={inputClass}
              {...fieldProps("nom")}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              placeholder="vous@exemple.fr"
              required
              maxLength={WAITLIST_LIMITS.email}
              autoComplete="email"
              className={inputClass}
              {...fieldProps("email")}
            />
          </Field>
          <Field label="Votre rôle dans l’église">
            <select className={inputClass} {...fieldProps("role")} defaultValue={values?.role ?? ""}>
              <option value="">Choisir…</option>
              {ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Personnes présentes le dimanche">
            <select className={inputClass} {...fieldProps("taille")} defaultValue={values?.taille ?? ""}>
              <option value="">Choisir…</option>
              {SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
          <Field label={"Comment vous organisez-vous aujourd’hui\u00a0?"}>
            <input
              type="text"
              placeholder="WhatsApp, Excel, Planning Center…"
              maxLength={WAITLIST_LIMITS.outil}
              className={inputClass}
              {...fieldProps("outil")}
            />
          </Field>

          {/* Champ piège pour les robots : invisible et hors de la navigation clavier. */}
          <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
            <label>
              Site web
              <input type="text" name="site_web" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="mt-1.5 h-[54px] cursor-pointer rounded-full bg-coral text-base font-semibold text-white transition-colors hover:bg-coral/90 disabled:cursor-wait disabled:opacity-80"
          >
            {pending ? "Envoi en cours…" : "Demander mon accès"}
          </button>
          <p className="text-[13px] leading-[1.5] text-[#8a9a94]">
            En envoyant ce formulaire, vous acceptez d’être recontacté par l’équipe Comora au sujet de
            votre accès. Pas de démarchage, et vous pouvez demander la suppression de vos données à tout
            moment.
          </p>
        </form>
      )}
      <p
        id="waitlist-message"
        role="status"
        className={cx(
          "text-base leading-[1.55] font-semibold",
          state.status === "success" && localError === null ? "text-teal-pale" : "text-coral-light",
        )}
      >
        {message}
      </p>
    </>
  );
}

function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[14px] font-semibold text-mist">
      {label}
      {children}
    </label>
  );
}
