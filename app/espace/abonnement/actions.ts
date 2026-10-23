'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireChurch } from '@/lib/auth/church'
import { invoiceFooter } from '@/lib/billing/legal'
import { getStripe } from '@/lib/billing/stripe'
import { checkoutPriceKey, isInterval, isOfferId } from '@/lib/offers'
import { appUrl, siteUrl } from '@/lib/site'

const BACK = '/espace/abonnement'

/** Adresse absolue (Stripe renvoie la personne ici) : l'espace en production, le site en local. */
function absolute(path: string) {
  const url = appUrl(path)
  return url.startsWith('http') ? url : `${siteUrl()}${path}`
}

/**
 * Ouvre le paiement Stripe pour l'offre choisie. Seul un administrateur peut le faire, y compris
 * en lecture seule (c'est le moyen d'en sortir). Le tarif fondateur vient de la base, jamais du formulaire.
 */
export async function startCheckout(formData: FormData) {
  const ctx = await requireChurch('admin', { allowReadOnly: true })
  const offer = formData.get('offer')
  const interval = formData.get('interval')
  if (!isOfferId(offer) || !isInterval(interval)) redirect(`${BACK}?erreur=choix`)

  const churchId = ctx.church.churchId
  const { data: church } = await ctx.supabase.from('churches').select('name, is_founder').eq('id', churchId).single()
  if (!church) redirect(`${BACK}?erreur=indisponible`)

  // Clé secrète : l'abonnement et le client Stripe de l'église courante, jamais ceux d'une autre.
  const admin = createAdminClient()
  const { data: existing } = await admin.from('subscriptions').select('stripe_customer_id, status').eq('church_id', churchId).maybeSingle()
  // Déjà abonnée : le changement d'offre passe par le portail, pas par un second abonnement
  if (existing && ['active', 'past_due', 'trialing'].includes(existing.status ?? '')) redirect(`${BACK}?erreur=deja`)

  let url: string | null = null
  try {
    const stripe = getStripe()
    let customerId = existing?.stripe_customer_id ?? null
    if (!customerId) {
      const { data: { user } } = await ctx.supabase.auth.getUser()
      const customer = await stripe.customers.create({
        name: church.name,
        email: user?.email ?? undefined,
        preferred_locales: ['fr'],
        metadata: { church_id: churchId },
        invoice_settings: { footer: invoiceFooter() },
      })
      const { error } = await admin.from('subscriptions').insert({ church_id: churchId, stripe_customer_id: customer.id })
      if (error) {
        // Deux clics en même temps : on reprend le client déjà enregistré
        const { data: again } = await admin.from('subscriptions').select('stripe_customer_id').eq('church_id', churchId).single()
        customerId = again?.stripe_customer_id ?? null
      } else {
        customerId = customer.id
      }
    }
    if (!customerId) throw new Error('client Stripe introuvable')

    const lookupKey = checkoutPriceKey(offer, interval, church.is_founder === true)
    const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })
    const price = prices.data[0]
    if (!price) throw new Error(`prix Stripe introuvable : ${lookupKey}`)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: churchId,
      line_items: [{ price: price.id, quantity: 1 }],
      // Moyens de paiement : carte et prélèvement SEPA, activés dans Stripe > Paramètres > Moyens de paiement
      locale: 'fr',
      billing_address_collection: 'required',
      customer_update: { address: 'auto', name: 'auto' },
      subscription_data: { metadata: { church_id: churchId, offer, interval } },
      success_url: absolute(`${BACK}?paiement=ok`),
      cancel_url: absolute(`${BACK}?paiement=annule`),
    })
    url = session.url
  } catch (error) {
    console.error('[abonnement] paiement indisponible :', (error as Error).message)
  }
  redirect(url ?? `${BACK}?erreur=indisponible`)
}

/** Portail Stripe : moyen de paiement, factures, changement d'offre, résiliation. */
export async function openBillingPortal() {
  const ctx = await requireChurch('admin', { allowReadOnly: true })
  const churchId = ctx.church.churchId
  const { data: church } = await ctx.supabase.from('churches').select('is_founder').eq('id', churchId).single()

  // Clé secrète : le client Stripe de l'église courante uniquement.
  const { data: subscription } = await createAdminClient().from('subscriptions').select('stripe_customer_id').eq('church_id', churchId).maybeSingle()
  if (!subscription) redirect(`${BACK}?erreur=aucun`)

  const configuration = (church?.is_founder ? process.env.STRIPE_PORTAL_CONFIG_FOUNDER : process.env.STRIPE_PORTAL_CONFIG_STANDARD)?.trim() || undefined
  let url: string | null = null
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: absolute(BACK),
      configuration,
    })
    url = session.url
  } catch (error) {
    console.error('[abonnement] portail indisponible :', (error as Error).message)
  }
  redirect(url ?? `${BACK}?erreur=indisponible`)
}
