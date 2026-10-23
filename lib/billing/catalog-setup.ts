import type Stripe from 'stripe'
import { OFFER_CATALOG, OFFERS, allPrices, type OfferId } from '@/lib/offers'

/*
 * Installation du catalogue dans Stripe : 3 produits, 12 prix, 2 configurations du portail client.
 * Idempotent : chaque produit est retrouvé par metadata.comora_offer, chaque prix par sa lookup_key,
 * chaque configuration par metadata.comora_config. Relancer le script ne crée rien en double ;
 * un montant modifié crée un nouveau prix qui reprend la clé (les prix Stripe sont immuables).
 */

export type SetupLog = (message: string) => void

export type CatalogResult = {
  products: Record<OfferId, string>
  prices: Record<string, string>
  portal: { standard: string; founder: string }
}

export async function ensureCatalog(stripe: Stripe, log: SetupLog = () => {}, urls: { site: string }): Promise<CatalogResult> {
  // ── Produits
  const existingProducts = await stripe.products.list({ active: true, limit: 100 })
  const products = {} as Record<OfferId, string>
  for (const offer of OFFERS) {
    const found = existingProducts.data.find(p => p.metadata?.comora_offer === offer)
    if (found) {
      products[offer] = found.id
      log(`produit ${offer} : déjà présent (${found.id})`)
    } else {
      const created = await stripe.products.create({
        name: `Comora ${OFFER_CATALOG[offer].name}`,
        description: OFFER_CATALOG[offer].summary,
        metadata: { comora_offer: offer },
      })
      products[offer] = created.id
      log(`produit ${offer} : créé (${created.id})`)
    }
  }

  // ── Prix
  const prices: Record<string, string> = {}
  for (const p of allPrices()) {
    const found = (await stripe.prices.list({ lookup_keys: [p.lookupKey], active: true, limit: 1 })).data[0]
    const same = found && found.unit_amount === p.cents && found.currency === 'eur' && found.recurring?.interval === p.interval && found.product === products[p.offer]
    if (same) {
      prices[p.lookupKey] = found.id
      log(`prix ${p.lookupKey} : déjà présent (${p.cents / 100} €)`)
      continue
    }
    const created = await stripe.prices.create({
      product: products[p.offer],
      currency: 'eur',
      unit_amount: p.cents,
      recurring: { interval: p.interval },
      lookup_key: p.lookupKey,
      transfer_lookup_key: true,
      nickname: `${OFFER_CATALOG[p.offer].name}${p.founder ? ' fondateur' : ''} ${p.interval === 'year' ? 'annuel' : 'mensuel'}`,
    })
    prices[p.lookupKey] = created.id
    log(`prix ${p.lookupKey} : ${found ? 'remplacé' : 'créé'} (${p.cents / 100} €)`)
    if (found) await stripe.prices.update(found.id, { active: false })
  }

  // ── Portail client : une configuration pour les églises fondatrices, une pour les autres
  const portal = { standard: '', founder: '' }
  const configurations = await stripe.billingPortal.configurations.list({ limit: 100 })
  for (const kind of ['standard', 'founder'] as const) {
    const wantFounder = kind === 'founder'
    const allowed = allPrices().filter(p => p.founder === wantFounder)
    const params = {
      business_profile: {
        headline: 'Comora : gérez votre abonnement',
        privacy_policy_url: `${urls.site}/confidentialite`,
        terms_of_service_url: `${urls.site}/cgv`,
      },
      features: {
        customer_update: { enabled: true, allowed_updates: ['email', 'name', 'address', 'phone'] as Array<'email' | 'name' | 'address' | 'phone'> },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: { enabled: true, mode: 'at_period_end' as const },
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price' as const],
          proration_behavior: 'create_prorations' as const,
          products: OFFERS.map(offer => ({ product: products[offer], prices: allowed.filter(p => p.offer === offer).map(p => prices[p.lookupKey]) })),
        },
      },
      metadata: { comora_config: kind },
    }
    const found = configurations.data.find(c => c.metadata?.comora_config === kind)
    if (found) {
      await stripe.billingPortal.configurations.update(found.id, params)
      portal[kind] = found.id
      log(`portail ${kind} : mis à jour (${found.id})`)
    } else {
      const created = await stripe.billingPortal.configurations.create(params)
      portal[kind] = created.id
      log(`portail ${kind} : créé (${created.id})`)
    }
  }

  return { products, prices, portal }
}
