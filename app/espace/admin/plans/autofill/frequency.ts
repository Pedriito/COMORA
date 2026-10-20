/** Nombre minimum de jours entre deux services pour respecter le rythme souhaité par un
 *  bénévole (`profiles.desired_frequency`). Réutilisé par l'algorithme d'auto-remplissage
 *  (contrainte d'espacement) et par l'affichage du décompte mensuel dans les pickers manuels. */
export const FREQUENCY_MIN_GAP_DAYS: Record<string, number> = {
  as_needed: 0,
  twice_month: 14,
  every_6_weeks: 42,
  monthly: 30,
  weekly: 7,
}

export function minGapDays(freq: string | null): number {
  return freq ? (FREQUENCY_MIN_GAP_DAYS[freq] ?? 0) : 0
}

export function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / msPerDay
}

/** Lendemain d'une date "YYYY-MM-DD", pour filtrer `service_date` (timestamptz) avec une borne
 *  de fin EXCLUSIVE. Comparer directement `service_date <= '2026-12-06'` exclurait tout service
 *  ayant une heure après minuit ce jour-là (ex : culte à 11h) — d'où le passage par le lendemain. */
export function exclusiveEndDate(endDate: string): string {
  const d = new Date(endDate)
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}
