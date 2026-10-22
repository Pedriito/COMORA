/** Choix proposés à la création d'un espace. Les valeurs sont celles stockées en base. */

export const COUNTRIES = [
  { code: "FR", label: "France" },
  { code: "BE", label: "Belgique" },
  { code: "CH", label: "Suisse" },
  { code: "CA", label: "Canada" },
  { code: "LU", label: "Luxembourg" },
  { code: "MC", label: "Monaco" },
  { code: "CI", label: "Côte d’Ivoire" },
  { code: "CM", label: "Cameroun" },
  { code: "CD", label: "RD Congo" },
  { code: "CG", label: "Congo" },
  { code: "SN", label: "Sénégal" },
  { code: "BJ", label: "Bénin" },
  { code: "TG", label: "Togo" },
  { code: "GA", label: "Gabon" },
  { code: "BF", label: "Burkina Faso" },
  { code: "ML", label: "Mali" },
  { code: "BI", label: "Burundi" },
  { code: "RW", label: "Rwanda" },
  { code: "MG", label: "Madagascar" },
  { code: "HT", label: "Haïti" },
  { code: "XX", label: "Autre pays" },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]["code"];

/** Tranches alignées sur les offres (solidaire < 30, Essentiel ≤ 100, Communauté ≤ 500). */
export const SIZE_BRACKETS = [
  { value: "lt30", label: "Moins de 30 membres" },
  { value: "30_100", label: "De 30 à 100 membres" },
  { value: "100_500", label: "De 100 à 500 membres" },
  { value: "gt500", label: "Plus de 500 membres" },
] as const;

export type SizeBracket = (typeof SIZE_BRACKETS)[number]["value"];
