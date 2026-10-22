/** Durée de l'essai gratuit, sans carte bancaire. */
export const TRIAL_DAYS = 30;

/**
 * Date limite de l'offre fondateurs (variable FOUNDER_DEADLINE, ISO 8601).
 * Absente ou illisible : personne n'est fondateur (on n'accorde jamais un tarif par erreur).
 */
export function founderDeadline(value: string | undefined = process.env.FOUNDER_DEADLINE): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Une église inscrite avant la date limite est fondatrice. */
export function isFounderAt(now: Date, deadline: Date | null = founderDeadline()): boolean {
  return deadline !== null && now.getTime() <= deadline.getTime();
}

export function trialEndsAt(now: Date): Date {
  return new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}
