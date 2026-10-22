/*
 * Calculs d'affichage des tarifs de la landing. Les montants de référence
 * (étape 6 : prix Stripe) sont : annuel = mensuel × 12 × 0,8, au centime près.
 */

/** Remise appliquée en facturation annuelle (−20 %). */
export const ANNUAL_RATE = 0.8;

/** Total facturé pour 12 mois, en euros, arrondi au centime. */
export function annualTotal(monthly: number): number {
  return Math.round(monthly * 12 * ANNUAL_RATE * 100) / 100;
}

/** Prix affiché par mois : le mensuel, ou le total annuel réparti sur 12 mois. */
export function displayedMonthly(monthly: number, annual: boolean): number {
  return annual ? annualTotal(monthly) / 12 : monthly;
}

/** « 15,20 » ou « 19 » : deux décimales seulement quand le montant n'est pas entier. */
export function formatEuros(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}
