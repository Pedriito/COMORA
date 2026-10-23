import Link from 'next/link'
import { requireChurch } from '@/lib/auth/church'
import { effectiveOffer, trialDaysLeft, trialMessage } from '@/lib/billing/access'
import { siteConfig } from '@/lib/site'

export const metadata = { title: 'Choisir une offre' }

const OFFER_LABELS = { essentiel: 'Essentiel', communaute: 'Communauté', signature: 'Signature' } as const

export default async function SubscriptionPage() {
  const { church } = await requireChurch('admin')
  const access = church.access ?? 'trial'
  const days = trialDaysLeft(access, church.trialEndsAt ?? null)
  const offer = effectiveOffer(access, church.offer ?? null)

  return (
    <main className="min-h-screen bg-teal-50 px-6 py-12">
      <div className="max-w-xl mx-auto space-y-6">
        <Link href="/espace/dashboard" className="text-dark/40 hover:text-dark transition-colors font-sans text-sm">← Tableau de bord</Link>
        <div className="bg-white rounded-2xl border border-teal/20 p-8">
          <h1 className="font-display text-3xl text-dark font-light">Choisir une offre</h1>
          <p className="mt-3 font-sans text-dark/70">
            {days !== null ? trialMessage(days) : access === 'active' ? 'Votre abonnement est actif.' : 'Votre espace est en lecture seule.'}
            {offer && <> Offre actuelle : <strong>{OFFER_LABELS[offer]}</strong>{access === 'trial' && ' (pendant l’essai)'}.</>}
          </p>
          <div className="mt-6 rounded-xl bg-teal-50 p-5 font-sans text-sm text-dark/70 space-y-2">
            <p className="font-medium text-dark">Le paiement en ligne arrive très bientôt.</p>
            <p>
              En attendant, écrivez-nous à <a className="underline" href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a> en
              indiquant le nom de votre église : nous activons votre offre rapidement, et votre espace se rouvre aussitôt.
            </p>
          </div>
          <p className="mt-6 text-sm font-sans text-dark/50">
            Les offres et leurs tarifs sont présentés sur <a className="underline" href={`${siteConfig.url}/#tarifs`}>{siteConfig.url.replace('https://', '')}</a>.
          </p>
        </div>
      </div>
    </main>
  )
}
