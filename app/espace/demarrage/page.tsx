import Link from 'next/link'
import { requireChurch } from '@/lib/auth/church'
import { getOnboarding, type StepKey } from '@/lib/onboarding/progress'
import { localDateString, resolveTimeZone } from '@/lib/timezone'
import { inviteBenevole } from '../admin/actions'
import { dismissOnboarding, skipStep } from './actions'
import { ImportStep, ServiceStep, TeamStep } from './Steps'

const TITLES: Record<StepKey, { title: string; intro: string }> = {
  import: { title: 'Ajouter vos membres', intro: 'Importez votre liste depuis Excel ou un fichier CSV. Personne ne reçoit d’e-mail à ce stade.' },
  team: { title: 'Créer une première équipe', intro: 'Une équipe regroupe des bénévoles : accueil, louange, technique, enfants…' },
  service: { title: 'Planifier un premier culte', intro: 'Choisissez la date : vous pourrez ensuite y placer vos équipes.' },
  invite: { title: 'Inviter un responsable', intro: 'Une personne de confiance vous aide à gérer l’espace. Elle reçoit une invitation par e-mail.' },
}

const ERRORS: Record<string, string> = {
  invalid: 'Indiquez au moins un prénom et une adresse e-mail valide.',
  already_member: 'Cette personne fait déjà partie de l’église.',
  failed: 'L’invitation n’a pas pu être créée. Réessayez dans un instant.',
  email_failed: 'La personne est ajoutée, mais l’e-mail n’a pas pu partir. Vous pourrez le renvoyer depuis l’administration.',
}

/** Prochain dimanche (aujourd'hui si c'en est un), dans le fuseau de l'église. */
function nextSunday(timeZone: string) {
  const [y, m, d] = localDateString(new Date(), timeZone).split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + ((7 - date.getUTCDay()) % 7))
  return date.toISOString().slice(0, 10)
}

export default async function DemarragePage({ searchParams }: { searchParams: Promise<{ invited?: string; error?: string }> }) {
  const ctx = await requireChurch('admin')
  const params = await searchParams
  const onboarding = await getOnboarding(ctx)
  const { data: church } = await ctx.supabase.from('churches').select('timezone').eq('id', ctx.church.churchId).maybeSingle()
  const defaultDate = nextSunday(resolveTimeZone(church?.timezone))
  const doneCount = onboarding.steps.filter(s => s.done).length

  const forms: Record<StepKey, React.ReactNode> = {
    import: <ImportStep />,
    team: <TeamStep />,
    service: <ServiceStep defaultDate={defaultDate} />,
    invite: (
      <form action={inviteBenevole} className="space-y-4">
        <input type="hidden" name="return_to" value="demarrage" />
        <input type="hidden" name="role" value="responsable" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="invite-first" className="block text-sm font-sans text-dark/70 mb-1.5">Prénom</label>
            <input id="invite-first" name="first_name" required maxLength={80} className="w-full px-4 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm" />
          </div>
          <div>
            <label htmlFor="invite-last" className="block text-sm font-sans text-dark/70 mb-1.5">Nom</label>
            <input id="invite-last" name="last_name" maxLength={80} className="w-full px-4 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm" />
          </div>
        </div>
        <div>
          <label htmlFor="invite-email" className="block text-sm font-sans text-dark/70 mb-1.5">Adresse e-mail</label>
          <input id="invite-email" name="email" type="email" required className="w-full px-4 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm" />
        </div>
        <p className="text-xs font-sans text-dark/40">Elle pourra gérer les équipes et les plannings, mais pas l’abonnement ni les réglages de l’église.</p>
        <button type="submit" className="px-5 py-2.5 rounded-lg bg-teal text-white font-sans text-sm font-medium hover:bg-teal/90 transition-colors">Envoyer l’invitation</button>
      </form>
    ),
  }

  return (
    <div className="min-h-screen bg-teal-50">
      <header className="bg-white border-b border-teal/20 px-6 py-4 flex items-center gap-4">
        <Link href="/espace/dashboard" className="text-dark/40 hover:text-dark transition-colors font-sans text-sm">← Tableau de bord</Link>
        <h1 className="font-display text-2xl text-dark font-light">Bien démarrer avec {ctx.church.churchName}</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-5">
        <div>
          <p className="font-sans text-dark/70">Quatre petites étapes pour que votre espace soit prêt. Vous pouvez en passer une et y revenir quand vous voulez.</p>
          <div className="mt-4 h-2 rounded-full bg-teal/15" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={doneCount} aria-label="Avancement du démarrage">
            <div className="h-2 rounded-full bg-teal transition-all" style={{ width: `${(doneCount / 4) * 100}%` }} />
          </div>
          <p className="mt-1.5 text-xs font-sans text-dark/40">{doneCount} étape{doneCount > 1 ? 's' : ''} sur 4</p>
        </div>

        {params.invited && <p role="status" className="text-sm font-sans text-teal-dark bg-white border border-teal/20 rounded-lg px-4 py-3">Invitation envoyée.</p>}
        {params.error && <p role="alert" className="text-sm font-sans text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{ERRORS[params.error] ?? ERRORS.failed}</p>}

        {onboarding.steps.map((step, index) => (
          <section key={step.key} className="bg-white rounded-2xl border border-teal/20 p-7" aria-labelledby={`step-${step.key}`}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 id={`step-${step.key}`} className="font-display text-xl text-dark font-light">
                  <span className="text-dark/30 mr-2">{index + 1}.</span>{TITLES[step.key].title}
                </h2>
                <p className="mt-1 text-sm font-sans text-dark/50">{TITLES[step.key].intro}</p>
              </div>
              <span className={`shrink-0 text-xs font-sans font-medium px-2.5 py-1 rounded-full ${step.done ? 'bg-teal/15 text-teal-dark' : step.skipped ? 'bg-dark/5 text-dark/50' : 'bg-orange-100 text-orange-800'}`}>
                {step.done ? 'Fait' : step.skipped ? 'Passée' : 'À faire'}
              </span>
            </div>

            {step.done && <p className="mb-4 text-sm font-sans text-dark/50">Cette étape est faite. Vous pouvez en ajouter d’autres ci-dessous.</p>}
            {forms[step.key]}
            {!step.done && !step.skipped && (
              <form action={skipStep} className="mt-4">
                <input type="hidden" name="step" value={step.key} />
                <button type="submit" className="text-sm font-sans text-dark/50 underline hover:text-dark">Passer cette étape</button>
              </form>
            )}
          </section>
        ))}

        <div className="flex items-center justify-between pt-2">
          <Link href="/espace/dashboard" className="px-5 py-2.5 rounded-lg bg-teal text-white font-sans text-sm font-medium hover:bg-teal/90 transition-colors">
            {onboarding.finished ? 'Aller au tableau de bord' : 'Continuer plus tard'}
          </Link>
          {!onboarding.finished && !onboarding.dismissed && (
            <form action={dismissOnboarding}>
              <button type="submit" className="text-sm font-sans text-dark/40 underline hover:text-dark">Ne plus me le rappeler</button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
