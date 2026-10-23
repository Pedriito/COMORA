import Link from 'next/link'
import { isWritable, trialDaysLeft, trialMessage, trialTone } from '@/lib/billing/access'
import type { Membership } from '@/lib/auth/church'

const TONES = {
  calm: 'bg-white text-dark/70 border-b border-teal/20',
  soon: 'bg-orange-50 text-orange-900 border-b border-orange-200',
  last: 'bg-orange-100 text-orange-950 border-b border-orange-300',
  readonly: 'bg-dark text-white',
} as const

/** Bandeau d'état de l'abonnement : discret pendant l'essai, net en lecture seule. */
export function AccessBanner({ church }: { church: Membership }) {
  const { access } = church
  if (!access || access === 'active') return null
  const isAdmin = church.role === 'admin'

  if (access === 'trial') {
    // L'essai n'intéresse que ceux qui choisissent l'offre
    if (!isAdmin) return null
    const days = trialDaysLeft(access, church.trialEndsAt ?? null)
    if (days === null) return null
    return (
      <div className={`${TONES[trialTone(days)]} px-5 py-2.5 text-sm font-sans flex flex-wrap items-center justify-between gap-2`}>
        <span>{trialMessage(days)}</span>
        <Link href="/espace/abonnement" className="font-medium underline underline-offset-2">Choisir une offre</Link>
      </div>
    )
  }

  if (access === 'grace') {
    return (
      <div className={`${TONES.soon} px-5 py-2.5 text-sm font-sans flex flex-wrap items-center justify-between gap-2`}>
        <span>Le dernier paiement n’a pas abouti. L’espace reste ouvert quelques jours.</span>
        {isAdmin && <Link href="/espace/abonnement" className="font-medium underline underline-offset-2">Régler maintenant</Link>}
      </div>
    )
  }

  if (isWritable(access)) return null
  return (
    <div className={`${TONES.readonly} px-5 py-2.5 text-sm font-sans flex flex-wrap items-center justify-between gap-2`}>
      <span>Votre espace est en lecture seule : vous pouvez tout consulter, mais plus rien modifier.</span>
      <Link href={isAdmin ? '/espace/abonnement' : '/espace/lecture-seule'} className="font-medium underline underline-offset-2">
        {isAdmin ? 'Choisir une offre' : 'Pourquoi ?'}
      </Link>
    </div>
  )
}
