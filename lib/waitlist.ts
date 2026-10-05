import { siteConfig } from "@/lib/site";

/*
 * Formulaire « Demander mon accès » : règles partagées entre le navigateur
 * (retour immédiat) et la Server Action (seule source de vérité).
 * Les limites reprennent les contraintes de la table public.waitlist.
 */

export const ROLE_OPTIONS = [
  "Pasteur",
  "Responsable de ministère",
  "Membre du conseil",
  "Autre",
] as const;

export const SIZE_OPTIONS = ["Moins de 30", "30 à 100", "100 à 300", "Plus de 300"] as const;

export const WAITLIST_LIMITS = {
  eglise: 200,
  ville: 120,
  nom: 160,
  email: 254,
  outil: 300,
} as const;

const FIELDS = ["eglise", "ville", "nom", "email", "role", "taille", "outil"] as const;

export type WaitlistField = (typeof FIELDS)[number];
export type WaitlistValues = Record<WaitlistField, string>;

/** Ligne insérée dans public.waitlist (statut et dates sont gérés par la base). */
export type WaitlistRow = {
  eglise: string;
  ville: string;
  nom: string;
  email: string;
  role: string | null;
  taille: string | null;
  outil: string | null;
  source: string | null;
};

export type WaitlistState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; values?: WaitlistValues; invalid?: WaitlistField[] };

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const contactTail = siteConfig.contactEmail ? ` ou écrivez-nous à ${siteConfig.contactEmail}.` : ".";

export const waitlistMessages = {
  invalid:
    "Merci d’indiquer au moins le nom de l’église, la ville, votre nom et un email valide.",
  success:
    "Merci, votre demande est bien arrivée. On revient vers vous très vite pour vous dire quand votre église peut entrer.",
  unavailable: `Les demandes d’accès ouvrent dans quelques jours. Revenez très vite${contactTail}`,
  failed: `L’envoi n’a pas abouti. Réessayez dans un instant${contactTail}`,
} as const;

export function readWaitlistValues(form: FormData): WaitlistValues {
  const read = (name: WaitlistField) => {
    const value = form.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  return Object.fromEntries(FIELDS.map((name) => [name, read(name)])) as WaitlistValues;
}

export function validateWaitlist(
  values: WaitlistValues,
): { ok: true; row: Omit<WaitlistRow, "source"> } | { ok: false; invalid: WaitlistField[] } {
  const invalid: WaitlistField[] = [];
  for (const name of ["eglise", "ville", "nom"] as const) {
    if (!values[name] || values[name].length > WAITLIST_LIMITS[name]) invalid.push(name);
  }
  if (values.email.length > WAITLIST_LIMITS.email || !EMAIL_PATTERN.test(values.email)) {
    invalid.push("email");
  }
  if (invalid.length > 0) return { ok: false, invalid };

  // Champs facultatifs : une valeur hors liste (formulaire trafiqué) est ignorée.
  const pick = (value: string, options: readonly string[]) =>
    options.includes(value) ? value : null;

  return {
    ok: true,
    row: {
      eglise: values.eglise,
      ville: values.ville,
      nom: values.nom,
      email: values.email,
      role: pick(values.role, ROLE_OPTIONS),
      taille: pick(values.taille, SIZE_OPTIONS),
      outil: values.outil.slice(0, WAITLIST_LIMITS.outil) || null,
    },
  };
}

/** Origine de la visite (?utm_source=…), conservée pour savoir d'où viennent les demandes. */
export function normalizeSource(value: FormDataEntryValue | null) {
  const source = typeof value === "string" ? value.trim().slice(0, 100) : "";
  return source || null;
}
