/**
 * Accès d'une église : essai, abonnement, grâce, lecture seule.
 * Reproduit à l'identique church_access() de la base (supabase/migrations/…essai_lecture_seule) ;
 * un test compare les deux sur les mêmes cas. La base fait foi pour les écritures (RLS),
 * ce module sert à informer la personne (bandeau, écran) et à refuser tôt côté serveur.
 */

export const TRIAL_DAYS = 30
export const GRACE_DAYS = 7
export const RETENTION_DAYS = 90

export type BillingStatus = 'trialing' | 'active' | 'past_due' | 'read_only' | 'canceled' | 'pending_deletion'
export type AccessState = 'trial' | 'active' | 'grace' | 'read_only' | 'pending_deletion'
export type Offer = 'essentiel' | 'communaute' | 'signature'

export type AccessInput = {
  billingStatus: BillingStatus
  trialEndsAt: string | Date | null
  graceEndsAt?: string | Date | null
}

const time = (value: string | Date | null | undefined) => (value ? new Date(value).getTime() : null)

export function accessState({ billingStatus, trialEndsAt, graceEndsAt }: AccessInput, now: Date = new Date()): AccessState {
  const t = now.getTime()
  switch (billingStatus) {
    case 'active':
      return 'active'
    case 'trialing': {
      const end = time(trialEndsAt)
      return end === null || end > t ? 'trial' : 'read_only'
    }
    case 'past_due': {
      const end = time(graceEndsAt)
      return end !== null && end > t ? 'grace' : 'read_only'
    }
    case 'pending_deletion':
      return 'pending_deletion'
    default:
      return 'read_only'
  }
}

export function isWritable(state: AccessState): boolean {
  return state === 'trial' || state === 'active' || state === 'grace'
}

/** Jours restants d'essai (arrondi au jour supérieur : « il reste 1 jour » jusqu'au bout), ou null hors essai. */
export function trialDaysLeft(state: AccessState, trialEndsAt: string | Date | null, now: Date = new Date()): number | null {
  const end = time(trialEndsAt)
  if (state !== 'trial' || end === null) return null
  return Math.max(0, Math.ceil((end - now.getTime()) / 864e5))
}

/** Offre qui s'applique : Communauté pendant l'essai, sinon l'offre choisie. */
export function effectiveOffer(state: AccessState, offer: Offer | null): Offer | null {
  return state === 'trial' ? offer ?? 'communaute' : offer
}

export type TrialTone = 'calm' | 'soon' | 'last'

/** Ton du bandeau : discret, puis orange à J-7, puis urgent à J-1. */
export function trialTone(daysLeft: number): TrialTone {
  return daysLeft <= 1 ? 'last' : daysLeft <= 7 ? 'soon' : 'calm'
}

export function trialMessage(daysLeft: number): string {
  if (daysLeft <= 0) return 'Votre essai gratuit se termine aujourd’hui.'
  if (daysLeft === 1) return 'Dernier jour de votre essai gratuit.'
  return `Il vous reste ${daysLeft} jours d’essai gratuit.`
}
