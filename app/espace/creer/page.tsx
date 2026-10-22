import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/brand/logo'
import { founderDeadline, isFounderAt, TRIAL_DAYS } from '@/lib/church/founder'
import { rootDomain } from '@/lib/routing/hosts'
import { createClient } from '@/lib/supabase/server'
import { logout } from '../login/actions'
import { CreateChurchForm } from './CreateChurchForm'

export const metadata: Metadata = { title: 'Créer l’espace de mon église' }

const frDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })

export default async function CreerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const deadline = founderDeadline()
  const founderOffer = deadline && isFounderAt(new Date(), deadline) ? frDate.format(deadline) : null

  return (
    <main className="flex min-h-svh items-center justify-center bg-ink px-5 py-16 text-sand">
      <div className="flex w-full max-w-[540px] flex-col gap-7">
        <div className="flex flex-col items-center gap-5 text-center">
          <Link href="/" aria-label="Accueil Comora"><Logo size={48} word="none" color="#efece3" /></Link>
          <h1 className="font-display text-[clamp(34px,5vw,46px)] leading-[1.05] font-semibold">
            Créer l’espace de mon église
          </h1>
          <p className="text-base leading-[1.6] text-mist">
            Quelques informations suffisent. Vous commencez par {TRIAL_DAYS} jours d’essai gratuit, avec toutes les
            fonctions, sans carte bancaire.
          </p>
          {founderOffer && (
            <p className="rounded-full border border-teal-pale/40 px-4 py-1.5 text-[14px] text-teal-pale">
              Offre fondateurs&nbsp;: tarif bloqué à vie pour les inscriptions avant le {founderOffer}
            </p>
          )}
        </div>

        {user.email_confirmed_at ? (
          <div className="rounded-[28px] border border-moss-light bg-ink-card p-6 sm:p-8">
            <CreateChurchForm rootDomain={rootDomain()} />
          </div>
        ) : (
          <div role="alert" className="rounded-[28px] border border-coral-light/50 bg-ink-card p-6 text-center sm:p-8">
            <p className="text-[17px] font-semibold text-coral-light">Votre adresse e-mail n’est pas encore confirmée</p>
            <p className="mt-2 text-base leading-[1.6] text-mist">
              Cliquez sur le lien que nous avons envoyé à {user.email}, puis revenez ici.
            </p>
          </div>
        )}

        <form action={logout} className="text-center text-[14px] text-mist-dark">
          Connecté en tant que {user.email}.{' '}
          <button type="submit" className="cursor-pointer underline underline-offset-2 hover:text-sand">Ce n’est pas vous&nbsp;?</button>
        </form>
      </div>
    </main>
  )
}
