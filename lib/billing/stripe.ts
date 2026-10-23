import 'server-only'
import Stripe from 'stripe'
import { legalInfoComplete, stripeModeOf } from '@/lib/billing/legal'

/**
 * Client Stripe côté serveur. Refuse une clé inconnue, et une clé de production tant que
 * les informations de la société ne sont pas renseignées (factures sans raison sociale).
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) throw new Error('STRIPE_SECRET_KEY manquante')
  const mode = stripeModeOf(key)
  if (!mode) throw new Error('STRIPE_SECRET_KEY invalide (attendu : sk_test_… ou sk_live_…)')
  if (mode === 'live' && !legalInfoComplete()) {
    throw new Error('Clé Stripe de production refusée : renseignez COMORA_LEGAL_NAME, COMORA_LEGAL_ADDRESS et COMORA_LEGAL_SIREN')
  }
  return new Stripe(key)
}

export function isBillingConfigured(): boolean {
  try {
    getStripe()
    return true
  } catch {
    return false
  }
}
