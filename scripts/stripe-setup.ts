/*
 * Installe (ou met à jour) le catalogue Comora dans Stripe : produits, prix, portail client.
 *
 *   npm run stripe:setup             # mode test (par défaut)
 *   npm run stripe:setup -- --live   # production : demande les informations de la société
 *
 * Lit STRIPE_SECRET_KEY dans .env.local. Idempotent : peut être relancé sans risque.
 */
import Stripe from 'stripe'
import { ensureCatalog } from '../lib/billing/catalog-setup'
import { invoiceFooter, legalInfoComplete, stripeModeOf } from '../lib/billing/legal'

async function main() {
  const live = process.argv.includes('--live')
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) throw new Error('STRIPE_SECRET_KEY est vide : renseignez-la dans .env.local (clé du mode test).')

  const mode = stripeModeOf(key)
  if (!mode) throw new Error('STRIPE_SECRET_KEY invalide (attendu : sk_test_… ou sk_live_…).')
  if (live && mode !== 'live') throw new Error('--live demandé, mais la clé est une clé de test.')
  if (!live && mode === 'live') throw new Error('Clé de production détectée : relancez avec --live pour confirmer que c’est voulu.')
  if (live && !legalInfoComplete()) {
    throw new Error('Production refusée : renseignez COMORA_LEGAL_NAME, COMORA_LEGAL_ADDRESS et COMORA_LEGAL_SIREN.')
  }

  console.log(`Mode ${mode === 'live' ? 'PRODUCTION' : 'test'}\n`)
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://comora.fr').replace(/\/$/, '')
  const result = await ensureCatalog(new Stripe(key), message => console.log(`  ${message}`), { site })

  console.log('\nÀ ajouter dans .env.local (et dans Vercel pour la production) :\n')
  console.log(`STRIPE_PORTAL_CONFIG_STANDARD=${result.portal.standard}`)
  console.log(`STRIPE_PORTAL_CONFIG_FOUNDER=${result.portal.founder}`)
  console.log(`\nMention de facture appliquée aux nouveaux clients : « ${invoiceFooter()} »`)
  console.log('\nÀ vérifier dans le tableau de bord Stripe :')
  console.log('  • Paramètres > Moyens de paiement : carte bancaire et prélèvement SEPA activés')
  console.log('  • Paramètres > Facturation : nom, adresse et logo de la société')
  console.log('  • Webhook : endpoint /api/stripe/webhook avec checkout.session.completed, customer.subscription.*,')
  console.log('    invoice.paid et invoice.payment_failed (en local : « stripe listen --forward-to localhost:3000/api/stripe/webhook »)')
}

main().catch(error => {
  console.error(`\n${(error as Error).message}`)
  process.exit(1)
})
