/**
 * Catalogue des offres Comora : noms, prix et clés de recherche Stripe.
 * Vocabulaire : « offre » (offer), jamais « plan » (qui désigne les plans de culte).
 * Les limites par offre vivent ici ; la table SQL `offer_limits` en est la copie (un test les compare).
 */
import { annualTotal } from '@/lib/pricing'

export const OFFERS = ['essentiel', 'communaute', 'signature'] as const
export type OfferId = (typeof OFFERS)[number]

export const INTERVALS = ['month', 'year'] as const
export type BillingInterval = (typeof INTERVALS)[number]

export type OfferInfo = {
  id: OfferId
  name: string
  /** Prix mensuel standard et prix fondateur, en euros. */
  monthly: number
  founderMonthly: number
  /** Texte court affiché au choix de l'offre. */
  summary: string
}

export const OFFER_CATALOG: Record<OfferId, OfferInfo> = {
  essentiel: { id: 'essentiel', name: 'Essentiel', monthly: 19, founderMonthly: 12, summary: 'Pour démarrer : jusqu’à 100 membres.' },
  communaute: { id: 'communaute', name: 'Communauté', monthly: 49, founderMonthly: 29, summary: 'Jusqu’à 500 membres, site public de l’église.' },
  signature: { id: 'signature', name: 'Signature', monthly: 119, founderMonthly: 69, summary: 'Membres illimités, accompagnement et personnalisation.' },
}

/** Ce que chaque offre permet. `null` = illimité. */
export type OfferLimits = {
  maxMembers: number | null
  maxAdmins: number | null
  publicSite: boolean
  customBranding: boolean
  customDomain: boolean
  multiSite: boolean
  advancedRoles: boolean
}

export const OFFER_LIMITS: Record<OfferId, OfferLimits> = {
  essentiel:  { maxMembers: 100,  maxAdmins: 3,    publicSite: false, customBranding: false, customDomain: false, multiSite: false, advancedRoles: false },
  communaute: { maxMembers: 500,  maxAdmins: null, publicSite: true,  customBranding: false, customDomain: false, multiSite: false, advancedRoles: false },
  signature:  { maxMembers: null, maxAdmins: null, publicSite: true,  customBranding: true,  customDomain: true,  multiSite: true,  advancedRoles: true },
}

/** Tarif solidaire : Essentiel gratuit tant que l'église a moins de 30 membres, puis 30 jours pour choisir une offre. */
export const SOLIDARITY_MEMBER_THRESHOLD = 30

/** Plus petite offre qui accepte `count` membres, ou null si aucune (jamais : Signature est illimitée). */
export function offerForMembers(count: number): OfferId {
  return OFFERS.find(o => { const max = OFFER_LIMITS[o].maxMembers; return max === null || count <= max }) ?? 'signature'
}

/** Offre immédiatement supérieure à celle indiquée (celle proposée quand une limite est atteinte). */
export function nextOffer(offer: OfferId): OfferId | null {
  return OFFERS[OFFERS.indexOf(offer) + 1] ?? null
}

export function isOfferId(value: unknown): value is OfferId {
  return typeof value === 'string' && (OFFERS as readonly string[]).includes(value)
}

export function isInterval(value: unknown): value is BillingInterval {
  return value === 'month' || value === 'year'
}

/** Montant facturé par période, en centimes. Annuel = mensuel × 12 × 0,8. */
export function priceCents(offer: OfferId, interval: BillingInterval, founder: boolean): number {
  const info = OFFER_CATALOG[offer]
  const monthly = founder ? info.founderMonthly : info.monthly
  return Math.round((interval === 'year' ? annualTotal(monthly) : monthly) * 100)
}

/** Clé de recherche du prix Stripe : essentiel_month, essentiel_founder_year… */
export function priceLookupKey(offer: OfferId, interval: BillingInterval, founder: boolean): string {
  return `${offer}${founder ? '_founder' : ''}_${interval}`
}

/** Opération inverse : lit une clé de recherche. Renvoie null si elle n'est pas de Comora. */
export function parseLookupKey(key: string | null | undefined): { offer: OfferId; interval: BillingInterval; founder: boolean } | null {
  const match = key?.match(/^(essentiel|communaute|signature)(_founder)?_(month|year)$/)
  return match ? { offer: match[1] as OfferId, founder: !!match[2], interval: match[3] as BillingInterval } : null
}

/** Les 12 prix du catalogue. */
export function allPrices() {
  return OFFERS.flatMap(offer =>
    INTERVALS.flatMap(interval =>
      [false, true].map(founder => ({
        offer,
        interval,
        founder,
        lookupKey: priceLookupKey(offer, interval, founder),
        cents: priceCents(offer, interval, founder),
      })),
    ),
  )
}

/**
 * Prix proposé à une église. Le tarif fondateur n'est accordé que si l'église l'est
 * en base : aucune demande venue du navigateur n'entre dans ce calcul.
 */
export function checkoutPriceKey(offer: OfferId, interval: BillingInterval, churchIsFounder: boolean): string {
  return priceLookupKey(offer, interval, churchIsFounder === true)
}
