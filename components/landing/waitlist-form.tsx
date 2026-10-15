"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type FormEvent,
  type Ref,
  type ReactNode,
} from "react";
import { requestAccess } from "@/app/(site)/actions";
import { cx } from "@/components/ui/cx";
import {
  COUNTRY_OPTIONS,
  MINISTRY_OPTIONS,
  PRIORITY_OPTIONS,
  ROLE_OPTIONS,
  SERVICE_OPTIONS,
  SIZE_OPTIONS,
  VOLUNTEER_OPTIONS,
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

const checkClass = "size-[18px] flex-none accent-coral";

export function WaitlistForm() {
  const [state, formAction, pending] = useActionState(requestAccess, initialState);
  // Erreur détectée dans le navigateur, avant tout envoi.
  const [localError, setLocalError] = useState<WaitlistField[] | null>(null);
  const multiSitesRef = useRef<HTMLInputElement>(null);

  // Arrivée depuis l'offre Réseau (?offre=reseau) : on coche « plusieurs sites ».
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("offre") === "reseau" && multiSitesRef.current) {
      multiSitesRef.current.checked = true;
    }
  }, []);

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

  const fieldProps = (name: Exclude<WaitlistField, "ministeres" | "multi_sites" | "visio">) => ({
    name,
    defaultValue: values?.[name],
    "aria-invalid": invalid.includes(name) || undefined,
    "aria-describedby": invalid.includes(name) ? "waitlist-message" : undefined,
  });

  return (
    <>
      {state.status !== "success" && (
        <form action={formAction} onSubmit={handleSubmit} noValidate className="relative flex flex-col gap-7">
          <Fieldset legend="Votre église">
            <Field label="Nom de l’église">
              <input
                type="text"
                placeholder={"Ex. : Église du Centre"}
                required
                maxLength={WAITLIST_LIMITS.eglise}
                autoComplete="organization"
                className={inputClass}
                {...fieldProps("eglise")}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ville">
                <input
                  type="text"
                  placeholder={"Ex. : Lyon"}
                  required
                  maxLength={WAITLIST_LIMITS.ville}
                  autoComplete="address-level2"
                  className={inputClass}
                  {...fieldProps("ville")}
                />
              </Field>
              <Field label="Pays">
                <Options options={COUNTRY_OPTIONS} required {...fieldProps("pays")} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre de membres">
                <Options options={SIZE_OPTIONS} required {...fieldProps("taille")} />
              </Field>
              <Field label="Bénévoles réguliers">
                <Options options={VOLUNTEER_OPTIONS} {...fieldProps("benevoles")} />
              </Field>
            </div>
            <Field label="Cultes par semaine">
              <Options options={SERVICE_OPTIONS} {...fieldProps("cultes")} />
            </Field>
            <Check name="multi_sites" inputRef={multiSitesRef} defaultChecked={values?.multi_sites}>
              Plusieurs sites, ou une union / fédération d’églises
            </Check>
          </Fieldset>

          <Fieldset legend="Votre organisation">
            <div className="flex flex-col gap-2.5">
              <span className="text-[14px] font-semibold text-mist">Équipes actives</span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                {MINISTRY_OPTIONS.map((option) => (
                  <Check
                    key={option}
                    name="ministeres"
                    value={option}
                    defaultChecked={values?.ministeres.includes(option)}
                  >
                    {option}
                  </Check>
                ))}
              </div>
            </div>
            <Field label="Votre besoin n°1">
              <Options options={PRIORITY_OPTIONS} {...fieldProps("priorite")} />
            </Field>
            <Field label={"Comment vous organisez-vous aujourd’hui ?"}>
              <input
                type="text"
                placeholder="WhatsApp, Excel, Planning Center…"
                maxLength={WAITLIST_LIMITS.outil}
                className={inputClass}
                {...fieldProps("outil")}
              />
            </Field>
          </Fieldset>

          <Fieldset legend="Vous">
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
            <Field label="E-mail">
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
              <Options options={ROLE_OPTIONS} {...fieldProps("role")} />
            </Field>
            <Check name="visio" defaultChecked={values?.visio}>
              Je suis disponible pour une visio de 30 minutes
            </Check>
          </Fieldset>

          {/* Champ piège pour les robots : invisible et hors de la navigation clavier. */}
          <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
            <label>
              Site web
              <input type="text" name="site_web" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <div className="flex flex-col gap-4">
            <button
              type="submit"
              disabled={pending}
              className="h-[54px] cursor-pointer rounded-full bg-coral text-base font-semibold text-white transition-colors hover:bg-coral/90 disabled:cursor-wait disabled:opacity-80"
            >
              {pending ? "Envoi en cours…" : "Demander mon accès"}
            </button>
            <p className="text-[13px] leading-[1.5] text-[#8a9a94]">
              En envoyant ce formulaire, vous acceptez d’être recontacté par l’équipe Comora au sujet de
              votre accès. Pas de démarchage, et vous pouvez demander la suppression de vos données à
              tout moment.
            </p>
          </div>
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

function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-teal-pale">
        {legend}
      </legend>
      {children}
    </fieldset>
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

function Options({
  options,
  defaultValue,
  ...rest
}: { options: readonly string[] } & Omit<ComponentPropsWithoutRef<"select">, "className">) {
  return (
    <select className={inputClass} defaultValue={defaultValue ?? ""} {...rest}>
      <option value="">Choisir…</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function Check({
  name,
  value,
  defaultChecked,
  inputRef,
  children,
}: {
  name: string;
  value?: string;
  defaultChecked?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[15px] text-mist">
      <input
        ref={inputRef}
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className={checkClass}
      />
      {children}
    </label>
  );
}
