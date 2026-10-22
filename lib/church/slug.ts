import { RESERVED_SUBDOMAINS } from "@/lib/routing/hosts";

/*
 * Adresse d'une église : <slug>.comora.fr. Minuscules, chiffres et tirets,
 * sans accents. Les mots qui servent à Comora ou prêtent à confusion sont réservés.
 */

export const SLUG_MIN = 3;
export const SLUG_MAX = 40;

/** Mots réservés en plus des sous-domaines techniques déjà utilisés par le routage. */
const RESERVED_EXTRA = [
  "demo", "test", "staging", "dev", "preview", "prod", "production", "comora", "espace", "sites",
  "partage", "login", "connexion", "inscription", "creer", "cgv", "cgu", "confidentialite", "tarifs",
  "contact", "smtp", "ftp", "ns1", "ns2", "webmail", "noreply", "postmaster", "root", "church", "eglise",
];

const RESERVED = new Set<string>([...RESERVED_SUBDOMAINS, ...RESERVED_EXTRA]);

export type SlugError = "too_short" | "too_long" | "invalid" | "reserved";

export const SLUG_MESSAGES: Record<SlugError, string> = {
  too_short: `L’adresse doit faire au moins ${SLUG_MIN} caractères.`,
  too_long: `L’adresse ne peut pas dépasser ${SLUG_MAX} caractères.`,
  invalid: "Utilisez seulement des lettres sans accent, des chiffres et des tirets (pas au début ni à la fin).",
  reserved: "Cette adresse est réservée. Choisissez-en une autre.",
};

/** Propose une adresse à partir du nom de l'église. */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
  return slug;
}

export function validateSlug(slug: string): SlugError | null {
  if (slug.length < SLUG_MIN) return "too_short";
  if (slug.length > SLUG_MAX) return "too_long";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return "invalid";
  if (RESERVED.has(slug)) return "reserved";
  return null;
}
