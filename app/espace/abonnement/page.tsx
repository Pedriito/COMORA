import Link from 'next/link'
import { requireChurch } from '@/lib/auth/church'
import { effectiveOffer, trialDaysLeft, trialMessage } from '@/lib/billing/access'
import { isBillingConfigured } from '@/lib/billing/stripe'
import { OFFERS, OFFER_CATALOG, priceCents } from '@/lib/offers'
import { formatEuros } from '@/lib/pricing'
import { siteConfig } from '@/lib/site'
import { openBillingPortal, startCheckout } from './actions'

export const metadata = { title: 'Mon abonnement' }

const MESSAGES: Record<string, { tone: 'ok' | 'info' | 'error'; text: string }> = {
  'paiement:ok': { tone: 'ok', text: 'Merci ! Votre paiement est en cours de confirmation. Votre espace se rouvre dans quelques instants.' },
  'paiement:annule': { tone: 'info', text: 'Le paiement a été annulé : rien n’a été débité.' },
  'erreur:choix': { tone: 'error', text: 'Cette offre n’existe pas. Choisissez-en une ci-dessous.' },
  'erreur:deja': { tone: 'error', text: 'Votre église a déjà un abonnement. Utilisez « Gérer mon abonnement » pour le modifier.' },
  'erreur:aucun': { tone: 'error', text: 'Aucun abonnement à gérer pour le moment.' },
  'erreur:indisponible': { tone: 'error', text: 'Le paiement n’est pas disponible pour le moment. Réessayez dans un instant, ou écrivez-nous.' },
}

const TONES = { ok: 'bg-teal/10 text-teal-dark border-teal/30', info: 'bg-white text-dark/70 border-teal/20', error: 'bg-red-50 text-red-800 border-red-200' }
const longDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ paiement?: string; erreur?: string }> }) {
  const { church, supabase } = await requireChurch('admin')
  const params = await searchParams
  const message = MESSAGES[params.paiement ? `paiement:${params.paiement}` : params.erreur ? `erreur:${params.erreur}` : '']

  const [{ data: row }, { data: details }] = await Promise.all([
    supabase.from('subscriptions').select('offer, billing_interval, founder_price, status, current_period_end, cancel_at_period_end').eq('church_id', church.churchId).maybeSingle(),
    supabase.from('churches').select('is_founder').eq('id', church.churchId).single(),
  ])
  const founder = details?.is_founder === true
  const access = church.access ?? 'trial'
  const days = trialDaysLeft(access, church.trialEndsAt ?? null)
  const offer = effectiveOffer(access, church.offer ?? null)
  const subscribed = !!row && ['active', 'past_due', 'trialing'].includes(row.status ?? '')
  const canPay = isBillingConfigured()

  return (
    <main className="min-h-screen bg-teal-50 px-6 py-12">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/espace/dashboard" className="text-dark/40 hover:text-dark transition-colors font-sans text-sm">← Tableau de bord</Link>

        <div className="bg-white rounded-2xl border border-teal/20 p-8">
          <h1 className="font-display text-3xl text-dark font-light">Mon abonnement</h1>
          <p className="mt-3 font-sans text-dark/70">
            {days !== null ? trialMessage(days) : access === 'active' ? 'Votre abonnement est actif.' : access === 'grace' ? 'Le dernier paiement n’a pas abouti : réglez-le pour garder l’accès.' : 'Votre espace est en lecture seule.'}
            {offer && <> Offre : <strong>{OFFER_CATALOG[offer].name}</strong>{access === 'trial' && ' (pendant l’essai)'}.</>}
          </p>
          {subscribed && row?.current_period_end && (
            <p className="mt-2 font-sans text-sm text-dark/60">
              {row.cancel_at_period_end ? <>Résiliation programmée : l’accès reste ouvert jusqu’au <strong>{longDate(row.current_period_end)}</strong>.</> : <>Prochain renouvellement le <strong>{longDate(row.current_period_end)}</strong>.</>}
            </p>
          )}
        </div>

        {message && <p role={message.tone === 'error' ? 'alert' : 'status'} className={`text-sm font-sans rounded-lg border px-4 py-3 ${TONES[message.tone]}`}>{message.text}</p>}

        {subscribed ? (
          <form action={openBillingPortal} className="bg-white rounded-2xl border border-teal/20 p-8 space-y-3">
            <p className="font-sans text-dark/70">Changez d’offre, de périodicité ou de moyen de paiement, téléchargez vos factures, ou résiliez.</p>
            <button type="submit" disabled={!canPay} className="px-5 py-2.5 rounded-lg bg-teal text-white font-sans text-sm font-medium hover:bg-teal/90 transition-colors disabled:opacity-60">Gérer mon abonnement</button>
          </form>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {OFFERS.map(id => {
              const info = OFFER_CATALOG[id]
              const month = priceCents(id, 'month', founder) / 100
              const year = priceCents(id, 'year', founder) / 100
              return (
                <form key={id} action={startCheckout} className="bg-white rounded-2xl border border-teal/20 p-6 flex flex-col">
                  <input type="hidden" name="offer" value={id} />
                  <h2 className="font-display text-2xl text-dark font-light">{info.name}</h2>
                  <p className="mt-1 font-sans text-sm text-dark/60 min-h-[3.75rem]">{info.summary}</p>
                  <p className="mt-4 font-display text-3xl text-dark">{formatEuros(month)} €<span className="font-sans text-sm text-dark/50"> / mois</span></p>
                  {founder && <p className="font-sans text-xs text-teal-dark">Tarif fondateur, gardé à vie tant que vous ne résiliez pas (au lieu de {formatEuros(OFFER_CATALOG[id].monthly)} €)</p>}
                  <div className="mt-5 space-y-2">
                    <button type="submit" name="interval" value="month" disabled={!canPay} className="w-full px-4 py-2.5 rounded-lg bg-teal text-white font-sans text-sm font-medium hover:bg-teal/90 transition-colors disabled:opacity-60">
                      Payer {formatEuros(month)} € par mois
                    </button>
                    <button type="submit" name="interval" value="year" disabled={!canPay} className="w-full px-4 py-2.5 rounded-lg border border-teal/30 text-dark font-sans text-sm font-medium hover:bg-teal-50 transition-colors disabled:opacity-60">
                      Payer {formatEuros(year)} € par an <span className="text-dark/50 whitespace-nowrap">(−20 %)</span>
                    </button>
                  </div>
                  {id === 'signature' && <p className="mt-3 font-sans text-xs text-dark/50">Notre équipe vous contacte pour lancer l’accompagnement.</p>}
                </form>
              )
            })}
          </div>
        )}

        {!canPay && !subscribed && (
          <p className="font-sans text-sm text-dark/60 bg-white rounded-lg border border-teal/20 px-4 py-3">
            Le paiement en ligne n’est pas encore ouvert. Écrivez-nous à <a className="underline" href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a> et nous activons votre offre.
          </p>
        )}
        <p className="font-sans text-xs text-dark/40">
          Paiement sécurisé par Stripe, par carte ou prélèvement SEPA. TVA non applicable, art. 293 B du CGI. Résiliable à tout moment : l’accès reste ouvert jusqu’à la fin de la période payée.
        </p>
      </div>
    </main>
  )
}
