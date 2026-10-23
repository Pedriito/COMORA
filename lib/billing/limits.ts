/**
 * Limites de l'offre côté application : messages en français quand la base refuse un ajout,
 * et vérification avant de choisir une offre plus petite que l'église.
 * La base fait foi (déclencheurs sur members et church_memberships) ; ce module explique.
 */
import { effectiveOffer, type AccessState, type Offer } from '@/lib/billing/access'
import { OFFER_CATALOG, OFFER_LIMITS, nextOffer, type OfferId } from '@/lib/offers'

export type LimitKind = 'members' | 'admins'

/** Code d'erreur dans l'adresse : `?error=limit_members`. */
export const LIMIT_ERROR = { members: 'limit_members', admins: 'limit_admins' } as const

/** La base refuse un ajout au-delà de la limite avec un message reconnaissable. */
export function limitKind(error: { message?: string | null } | null | undefined): LimitKind | null {
  const message = error?.message ?? ''
  if (message.includes('limite_membres')) return 'members'
  if (message.includes('limite_administrateurs')) return 'admins'
  return null
}

/** Code `limit_members` / `limit_admins` reçu dans l'adresse → type de limite. */
export function limitKindFromCode(code: string | null | undefined): LimitKind | null {
  return code === LIMIT_ERROR.members ? 'members' : code === LIMIT_ERROR.admins ? 'admins' : null
}

function upgrade(offer: OfferId | null): string {
  const next = offer ? nextOffer(offer) : null
  if (!next) return 'Écrivez-nous et nous trouverons une solution.'
  const max = OFFER_LIMITS[next].maxMembers
  return `Passez à l’offre ${OFFER_CATALOG[next].name}${max ? ` (jusqu’à ${max} membres)` : ' (membres illimités)'} depuis « Mon abonnement ».`
}

/** Message affiché quand la limite est atteinte, avec l'offre à choisir pour continuer. */
export function limitMessage(kind: LimitKind, offer: OfferId | null): string {
  const limits = OFFER_LIMITS[offer ?? 'essentiel']
  const name = OFFER_CATALOG[offer ?? 'essentiel'].name
  if (kind === 'members') {
    return `Votre offre ${name} est limitée à ${limits.maxMembers} membres : la limite est atteinte. ${upgrade(offer)}`
  }
  return `Votre offre ${name} permet ${limits.maxAdmins} administrateurs : la limite est atteinte. ${offer === 'essentiel' ? 'Passez à l’offre Communauté (administrateurs illimités) depuis « Mon abonnement ».' : 'Écrivez-nous et nous trouverons une solution.'}`
}

export type Usage = { members: number; admins: number }

/**
 * Une église peut-elle choisir cette offre ? Non si elle compte déjà plus de membres (ou
 * d'administrateurs) que l'offre n'en permet : on lui dit laquelle prendre plutôt que de la laisser
 * payer une offre qui la bloquerait aussitôt.
 */
export function offerFits(offer: OfferId, usage: Usage): { ok: true } | { ok: false; reason: LimitKind } {
  const { maxMembers, maxAdmins } = OFFER_LIMITS[offer]
  if (maxMembers !== null && usage.members > maxMembers) return { ok: false, reason: 'members' }
  if (maxAdmins !== null && usage.admins > maxAdmins) return { ok: false, reason: 'admins' }
  return { ok: true }
}

type ChurchOfferState = { access?: AccessState; offer?: Offer | null; isSolidarity?: boolean }

/** Offre qui s'applique à l'église courante (solidaire = Essentiel, essai = Communauté). */
export function churchOffer(church: ChurchOfferState): OfferId {
  return effectiveOffer(church.access ?? 'trial', church.offer ?? null, church.isSolidarity) ?? 'essentiel'
}

/** Message d'une erreur `limit_*` reçue dans l'adresse, ou null si ce n'en est pas une. */
export function limitMessageFor(code: string | null | undefined, church: ChurchOfferState): string | null {
  const kind = limitKindFromCode(code)
  return kind ? limitMessage(kind, churchOffer(church)) : null
}
