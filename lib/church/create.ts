import { LEGAL_DOCUMENTS } from "@/lib/legal";
import { COUNTRIES, SIZE_BRACKETS, type CountryCode, type SizeBracket } from "./options";
import { SLUG_MESSAGES, validateSlug } from "./slug";

/** Saisie du formulaire « Créer l'espace de mon église », telle que lue. */
export type CreateChurchInput = {
  name: string;
  city: string;
  country: string;
  size: string;
  slug: string;
  accept: boolean;
};

export type CreateChurchField = keyof CreateChurchInput;

export type CreateChurchValues = {
  name: string;
  city: string;
  country: CountryCode;
  size: SizeBracket;
  slug: string;
};

export type CreateChurchValidation =
  | { ok: true; values: CreateChurchValues }
  | { ok: false; errors: Partial<Record<CreateChurchField, string>> };

export const NAME_MAX = 160;
export const CITY_MAX = 100;

export function readCreateChurchForm(formData: FormData): CreateChurchInput {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  return {
    name: text("name").replace(/\s+/g, " "),
    city: text("city").replace(/\s+/g, " "),
    country: text("country"),
    size: text("size"),
    slug: text("slug").toLowerCase(),
    accept: formData.get("accept") === "on",
  };
}

export function validateCreateChurch(input: CreateChurchInput): CreateChurchValidation {
  const errors: Partial<Record<CreateChurchField, string>> = {};

  if (!input.name) errors.name = "Indiquez le nom de votre église.";
  else if (input.name.length > NAME_MAX) errors.name = `Le nom ne peut pas dépasser ${NAME_MAX} caractères.`;

  if (!input.city) errors.city = "Indiquez votre ville.";
  else if (input.city.length > CITY_MAX) errors.city = `La ville ne peut pas dépasser ${CITY_MAX} caractères.`;

  const country = COUNTRIES.find((c) => c.code === input.country);
  if (!country) errors.country = "Choisissez un pays dans la liste.";

  const size = SIZE_BRACKETS.find((s) => s.value === input.size);
  if (!size) errors.size = "Choisissez la taille de votre église.";

  const slugError = validateSlug(input.slug);
  if (slugError) errors.slug = SLUG_MESSAGES[slugError];

  if (!input.accept) {
    errors.accept = `Acceptez les ${LEGAL_DOCUMENTS.cgv.label} et la ${LEGAL_DOCUMENTS.confidentialite.label} pour continuer.`;
  }

  if (Object.keys(errors).length > 0 || !country || !size) return { ok: false, errors };
  return {
    ok: true,
    values: { name: input.name, city: input.city, country: country.code, size: size.value, slug: input.slug },
  };
}
