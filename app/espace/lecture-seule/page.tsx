import Link from 'next/link'
import { requireChurch } from '@/lib/auth/church'
import { isWritable } from '@/lib/billing/access'

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

export const metadata = { title: 'Espace en lecture seule' }

export default async function ReadOnlyPage() {
  const { church } = await requireChurch('membre')
  const isAdmin = church.role === 'admin'
  const reopened = !church.access || isWritable(church.access)

  return (
    <main className="min-h-screen bg-teal-50 px-6 py-16">
      <div className="max-w-xl mx-auto bg-white rounded-2xl border border-teal/20 p-8">
        <h1 className="font-display text-3xl text-dark font-light">
          {reopened ? 'Votre espace est ouvert' : 'Votre espace est en lecture seule'}
        </h1>
        {reopened ? (
          <p className="mt-4 font-sans text-dark/70">Tout fonctionne de nouveau : vous pouvez reprendre là où vous en étiez.</p>
        ) : (
          <div className="mt-4 space-y-4 font-sans text-dark/70">
            <p>
              L’essai gratuit de {church.churchName} est terminé. Vous pouvez toujours <strong>consulter</strong> vos membres,
              vos équipes et vos plannings, mais plus rien ne peut être ajouté ni modifié.
            </p>
            <p>
              Rien n’est perdu : vos données sont conservées
              {church.deletionScheduledAt ? <> jusqu’au <strong>{date(church.deletionScheduledAt)}</strong></> : ' plusieurs semaines'}.
              Dès qu’une offre est choisie, tout redevient possible immédiatement.
            </p>
            {!isAdmin && <p>Pour rouvrir l’espace, un administrateur de votre église doit choisir une offre.</p>}
          </div>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          {isAdmin && !reopened && (
            <Link href="/espace/abonnement" className="px-5 py-2.5 rounded-lg bg-teal text-white font-sans text-sm font-medium hover:bg-teal/90 transition-colors">
              Choisir une offre
            </Link>
          )}
          <Link href="/espace/dashboard" className="px-5 py-2.5 rounded-lg border border-teal/30 text-dark font-sans text-sm font-medium hover:bg-teal-50 transition-colors">
            Retour à mon espace
          </Link>
        </div>
      </div>
    </main>
  )
}
