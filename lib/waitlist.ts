import { siteConfig } from "@/lib/site";

/*
 * Formulaire « Demander mon accès » : règles partagées entre le navigateur
 * (retour immédiat) et la Server Action (seule source de vérité).
 * Les limites reprennent les contraintes de la table public.waitlist.
 * Les questions sur l'église servent à repérer celles qui ressemblent à la nôtre.
 */

export const ROLE_OPTIONS = [
  "Pasteur",
  "Responsable de ministère",
  "Membre du conseil",
  "Autre",
] as const;

export const COUNTRY_OPTIONS = [
  "France",
  "Belgique",
  "Suisse",
  "Canada",
  "Afrique francophone",
  "Autre",
] as const;

/** Tranches alignées sur les offres (solidaire < 30, Essentiel ≤ 100, Communauté ≤ 500). */
export const SIZE_OPTIONS = ["Moins de 30", "30 à 100", "100 à 500", "Plus de 500"] as const;

export const VOLUNTEER_OPTIONS = ["Moins de 10", "10 à 30", "30 à 80", "Plus de 80"] as const;

export const SERVICE_OPTIONS = ["1", "2", "3 ou plus"] as const;

export const MINISTRY_OPTIONS = [
  "Louange",
  "Technique",
  "Enfants",
  "Jeunesse",
  "Accueil",
  "Groupes de maison",
] as const;

export const PRIORITY_OPTIONS = [
  "Plannings des bénévoles",
  "Communication",
  "Chants et louange",
  "Événements",
  "Dons en ligne",
] as const;

export const WAITLIST_LIMITS = {
  eglise: 200,
  ville: 120,
  nom: 160,
  email: 254,
  outil: 300,
} as const;

const TEXT_FIELDS = [
  "eglise",
  "ville",
  "pays",
  "nom",
  "email",
  "role",
  "taille",
  "benevoles",
  "cultes",
  "priorite",
  "outil",
] as const;

export type WaitlistTextField = (typeof TEXT_FIELDS)[number];
export type WaitlistField = WaitlistTextField | "multi_sites" | "visio" | "ministeres";

export type WaitlistValues = Record<WaitlistTextField, string> & {
  multi_sites: boolean;
  visio: boolean;
  ministeres: string[];
};

/** Ligne insérée dans public.waitlist (statut et dates sont gérés par la base). */
export type WaitlistRow = {
  eglise: string;
  ville: string;
  pays: string;
  nom: string;
  email: string;
  role: string | null;
  taille: string;
  benevoles: string | null;
  cultes: string | null;
  multi_sites: boolean;
  ministeres: string[];
  priorite: string | null;
  visio: boolean;
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
    "Merci d’indiquer au moins le nom de l’église, la ville, le pays, le nombre de membres, votre nom et un e-mail valide.",
  success:
    "Merci, votre demande est bien arrivée. On revient vers vous très vite pour vous dire quand votre église peut entrer.",
  unavailable: `Les demandes d’accès ouvrent dans quelques jours. Revenez très vite${contactTail}`,
  failed: `L’envoi n’a pas abouti. Réessayez dans un instant${contactTail}`,
} as const;

export function readWaitlistValues(form: FormData): WaitlistValues {
  const read = (name: WaitlistTextField) => {
    const value = form.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const text = Object.fromEntries(TEXT_FIELDS.map((name) => [name, read(name)])) as Record<
    WaitlistTextField,
    string
  >;
  return {
    ...text,
    multi_sites: form.get("multi_sites") !== null,
    visio: form.get("visio") !== null,
    ministeres: form.getAll("ministeres").filter((value): value is string => typeof value === "string"),
  };
}

export function validateWaitlist(
  values: WaitlistValues,
): { ok: true; row: Omit<WaitlistRow, "source"> } | { ok: false; invalid: WaitlistField[] } {
  const invalid: WaitlistField[] = [];
  for (const name of ["eglise", "ville", "nom"] as const) {
    if (!values[name] || values[name].length > WAITLIST_LIMITS[name]) invalid.push(name);
  }
  if (!isOption(COUNTRY_OPTIONS, values.pays)) invalid.push("pays");
  if (values.email.length > WAITLIST_LIMITS.email || !EMAIL_PATTERN.test(values.email)) {
    invalid.push("email");
  }
  if (!isOption(SIZE_OPTIONS, values.taille)) invalid.push("taille");
  if (invalid.length > 0) return { ok: false, invalid };

  // Champs facultatifs : une valeur hors liste (formulaire trafiqué) est ignorée.
  const pick = (value: string, options: readonly string[]) => (isOption(options, value) ? value : null);

  return {
    ok: true,
    row: {
      eglise: values.eglise,
      ville: values.ville,
      pays: values.pays,
      nom: values.nom,
      email: values.email,
      role: pick(values.role, ROLE_OPTIONS),
      taille: values.taille,
      benevoles: pick(values.benevoles, VOLUNTEER_OPTIONS),
      cultes: pick(values.cultes, SERVICE_OPTIONS),
      multi_sites: values.multi_sites,
      ministeres: MINISTRY_OPTIONS.filter((option) => values.ministeres.includes(option)),
      priorite: pick(values.priorite, PRIORITY_OPTIONS),
      visio: values.visio,
      outil: values.outil.slice(0, WAITLIST_LIMITS.outil) || null,
    },
  };
}

function isOption(options: readonly string[], value: string) {
  return options.includes(value);
}

/** Origine de la visite (?utm_source=…), conservée pour savoir d'où viennent les demandes. */
export function normalizeSource(value: FormDataEntryValue | null) {
  const source = typeof value === "string" ? value.trim().slice(0, 100) : "";
  return source || null;
}
