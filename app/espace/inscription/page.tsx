import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/brand/logo'
import { LEGAL_DOCUMENTS } from '@/lib/legal'
import { founderDeadline, isFounderAt, TRIAL_DAYS } from '@/lib/church/founder'
import { createClient } from '@/lib/supabase/server'
import { SignupForm } from './SignupForm'

export const metadata: Metadata = {
  title: 'Créer mon compte',
  // Page d'entrée du parcours d'inscription : on laisse les moteurs la connaître
  robots: { index: true, follow: true },
}

const frDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })

export default async function InscriptionPage() {
  // Déjà connecté : on poursuit directement vers la création de l'espace
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/espace/creer')

  const deadline = founderDeadline()
  const founderOffer = deadline && isFounderAt(new Date(), deadline) ? frDate.format(deadline) : null

  return (
    <main className="flex min-h-svh items-center justify-center bg-ink px-5 py-16 text-sand">
      <div className="flex w-full max-w-[480px] flex-col gap-7">
        <div className="flex flex-col items-center gap-5 text-center">
          <Link href="/" aria-label="Accueil Comora"><Logo size={48} word="none" color="#efece3" /></Link>
          <h1 className="font-display text-[clamp(34px,5vw,46px)] leading-[1.05] font-semibold">
            Créez l’espace de votre église
          </h1>
          <p className="text-base leading-[1.6] text-mist">
            {TRIAL_DAYS} jours d’essai gratuit, sans carte bancaire. Première étape&nbsp;: votre compte.
          </p>
          {founderOffer && (
            <p className="rounded-full border border-teal-pale/40 px-4 py-1.5 text-[14px] text-teal-pale">
              Offre fondateurs&nbsp;: tarif bloqué à vie pour les inscriptions avant le {founderOffer}
            </p>
          )}
        </div>

        <div className="rounded-[28px] border border-moss-light bg-ink-card p-6 sm:p-8">
          <SignupForm />
        </div>

        <p className="text-center text-[15px] text-mist-dark">
          Vous avez déjà un compte&nbsp;?{' '}
          <Link href="/espace/login" className="font-semibold text-sand underline underline-offset-4 hover:text-white">
            Se connecter
          </Link>
        </p>
        <p className="text-center text-[13px] leading-[1.5] text-mist-dark">
          En continuant, vous allez pouvoir consulter les{' '}
          <Link href={LEGAL_DOCUMENTS.cgv.path} className="underline underline-offset-2">conditions générales de vente</Link> et la{' '}
          <Link href={LEGAL_DOCUMENTS.confidentialite.path} className="underline underline-offset-2">politique de confidentialité</Link>
          {' '}avant de créer votre espace.
        </p>
      </div>
    </main>
  )
}
