import { requirePlatformAdmin } from '@/lib/auth/platform'
import { OFFER_CATALOG, OFFERS } from '@/lib/offers'
import { monthlyRecurringRevenueCents, parseOverview, payingChurchesByOffer } from '@/lib/platform/metrics'
import { formatEuros } from '@/lib/pricing'
import { approveSolidarity, extendTrial, revokeSolidarity } from './actions'
import { ConfirmButton } from './ConfirmButton'

export const metadata = { title: 'Back-office Comora' }

const RESULTS: Record<string, { tone: 'ok' | 'error'; text: string }> = {
  'essai-prolonge': { tone: 'ok', text: 'Essai prolongé.' },
  'solidaire-valide': { tone: 'ok', text: 'Tarif solidaire validé.' },
  'solidaire-retire': { tone: 'ok', text: 'Tarif solidaire retiré : l’église retrouve son état selon ses dates.' },
  invalide: { tone: 'error', text: 'Demande invalide.' },
  introuvable: { tone: 'error', text: 'Église introuvable.' },
  'non-prolongeable': { tone: 'error', text: 'Seul un essai (en cours ou terminé) d’une église non solidaire peut être prolongé.' },
  'non-demandee': { tone: 'error', text: 'Cette église n’a pas demandé le tarif solidaire.' },
  'trop-grande': { tone: 'error', text: 'Cette église a 30 membres ou plus : le tarif solidaire ne peut pas être validé.' },
  'non-solidaire': { tone: 'error', text: 'Cette église n’a pas le tarif solidaire.' },
  refuse: { tone: 'error', text: 'Action refusée.' },
  erreur: { tone: 'error', text: 'Une erreur est survenue. Réessayez.' },
}
const TONES = { ok: 'bg-teal/10 text-teal-dark border-teal/30', error: 'bg-red-50 text-red-800 border-red-200' }

const STATUS_LABELS: Record<string, string> = {
  trial: 'Essai', active: 'Actif', grace: 'Impayé (grâce)', read_only: 'Lecture seule', pending_deletion: 'Suppression programmée',
}
const ACTION_LABELS: Record<string, string> = {
  extend_trial: 'Essai prolongé', approve_solidarity: 'Solidaire validé', revoke_solidarity: 'Solidaire retiré',
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const dateTime = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

type ChurchRow = {
  id: string; name: string; slug: string; created_at: string; offer: string | null; billing_status: string; access: string
  is_founder: boolean; is_solidarity: boolean; solidarity_requested_at: string | null; trial_ends_at: string | null
  billing_interval: string | null; founder_price: boolean; subscription_status: string | null; member_count: number; last_activity_at: string
}
type AuditRow = { id: string; created_at: string; action: string; church_slug: string; details: Record<string, unknown>; admin_first_name: string }

export default async function PlatformPage({ searchParams }: { searchParams: Promise<{ resultat?: string }> }) {
  const { supabase } = await requirePlatformAdmin()
  const { resultat } = await searchParams
  const message = resultat ? RESULTS[resultat] : undefined

  const [overviewResult, churchesResult, auditResult] = await Promise.all([
    supabase.rpc('platform_overview'),
    supabase.rpc('platform_list_churches', { p_limit: 500 }),
    supabase.rpc('platform_audit_recent', { p_limit: 20 }),
  ])
  const overview = parseOverview(overviewResult.data)
  const churches = (churchesResult.data ?? []) as ChurchRow[]
  const audit = (auditResult.data ?? []) as AuditRow[]
  const mrr = monthlyRecurringRevenueCents(overview.subscriptions)
  const paying = payingChurchesByOffer(overview.subscriptions)
  const failed = !!(overviewResult.error || churchesResult.error || auditResult.error)

  return (
    <main className="min-h-screen bg-teal-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header>
          <p className="font-sans text-xs tracking-[0.3em] uppercase text-teal mb-1">Comora</p>
          <h1 className="font-display text-3xl text-dark font-light">Back-office des fondateurs</h1>
          <p className="font-sans text-sm text-dark/60 mt-1">Compteurs et dates uniquement : aucun nom ni contenu de membre n’est accessible ici.</p>
        </header>

        {message && <p className={`rounded-xl border px-4 py-3 font-sans text-sm ${TONES[message.tone]}`}>{message.text}</p>}
        {failed && <p className={`rounded-xl border px-4 py-3 font-sans text-sm ${TONES.error}`}>Certaines données n’ont pas pu être chargées.</p>}

        <section aria-label="Indicateurs" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Revenu mensuel récurrent" value={formatEuros(mrr / 100)} hint="Abonnements actifs, annuel ÷ 12" />
          <Stat label="Églises" value={String(overview.churches)} hint={`${overview.byStatus.trialing ?? 0} en essai`} />
          <Stat label="Tarif solidaire" value={String(overview.solidarity)} hint={`${overview.solidarityRequests} demande(s) à examiner`} />
          <Stat label="Églises payantes" value={String(OFFERS.reduce((n, o) => n + paying[o], 0))} hint={OFFERS.map((o) => `${OFFER_CATALOG[o].name} ${paying[o]}`).join(' · ')} />
        </section>

        <section aria-label="Églises" className="rounded-2xl border border-teal/20 bg-white">
          <h2 className="px-5 pt-5 font-display text-xl text-dark">Églises <span className="font-sans text-sm text-dark/50">({churches.length < overview.churches ? `${churches.length} les plus récentes sur ${overview.churches}` : churches.length})</span></h2>
          <div className="overflow-x-auto">
            <table className="mt-3 w-full text-left font-sans text-sm">
              <thead className="text-xs uppercase tracking-wide text-dark/50">
                <tr>
                  <th className="px-5 py-2">Église</th><th className="px-3 py-2">Offre</th><th className="px-3 py-2">Statut</th>
                  <th className="px-3 py-2">Fin d’essai</th><th className="px-3 py-2 text-right">Membres</th><th className="px-3 py-2">Dernière activité</th><th className="px-5 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal/10">
                {churches.map((c) => (
                  <tr key={c.id} className="align-top">
                    <td className="px-5 py-3"><span className="font-semibold text-dark">{c.name}</span><br /><span className="text-xs text-dark/50">{c.slug} · inscrite le {date(c.created_at)}{c.is_founder ? ' · fondatrice' : ''}</span></td>
                    <td className="px-3 py-3">
                      {c.is_solidarity ? 'Essentiel (solidaire)' : c.offer && OFFERS.includes(c.offer as never) ? OFFER_CATALOG[c.offer as keyof typeof OFFER_CATALOG].name : '—'}
                      {c.billing_interval && !c.is_solidarity ? <><br /><span className="text-xs text-dark/50">{c.billing_interval === 'year' ? 'annuel' : 'mensuel'}{c.founder_price ? ' · tarif fondateur' : ''}</span></> : null}
                    </td>
                    <td className="px-3 py-3">{STATUS_LABELS[c.access] ?? c.access}{c.solidarity_requested_at && !c.is_solidarity ? <><br /><span className="text-xs text-coral">demande solidaire</span></> : null}</td>
                    <td className="px-3 py-3">{c.access === 'trial' || c.access === 'read_only' ? date(c.trial_ends_at) : '—'}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{c.member_count}</td>
                    <td className="px-3 py-3">{date(c.last_activity_at)}</td>
                    <td className="px-5 py-3"><Actions church={c} /></td>
                  </tr>
                ))}
                {churches.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-dark/50">Aucune église pour le moment.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-label="Journal" className="rounded-2xl border border-teal/20 bg-white p-5">
          <h2 className="font-display text-xl text-dark">Journal des actions</h2>
          <ul className="mt-3 divide-y divide-teal/10 font-sans text-sm">
            {audit.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span><strong>{ACTION_LABELS[a.action] ?? a.action}</strong> · {a.church_slug}{a.action === 'extend_trial' && typeof a.details.days === 'number' ? ` · +${a.details.days} j` : ''}</span>
                <span className="text-xs text-dark/50">{a.admin_first_name || 'équipe'} · {dateTime(a.created_at)}</span>
              </li>
            ))}
            {audit.length === 0 && <li className="py-2 text-dark/50">Aucune action pour le moment.</li>}
          </ul>
        </section>
      </div>
    </main>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-teal/20 bg-white p-5">
      <p className="font-sans text-xs uppercase tracking-wide text-dark/50">{label}</p>
      <p className="mt-1 font-display text-3xl text-dark">{value}</p>
      <p className="mt-1 font-sans text-xs text-dark/50">{hint}</p>
    </div>
  )
}

const BUTTON = 'rounded-lg border border-teal/30 px-3 py-1.5 text-xs font-semibold text-dark hover:bg-teal/10'

function Actions({ church: c }: { church: ChurchRow }) {
  const canExtend = (c.billing_status === 'trialing' || c.billing_status === 'read_only') && !c.is_solidarity
  return (
    <div className="flex flex-col gap-2">
      {canExtend && (
        <form action={extendTrial} className="flex items-center gap-1">
          <input type="hidden" name="churchId" value={c.id} />
          <select name="days" defaultValue="14" aria-label={`Jours à ajouter pour ${c.name}`} className="rounded-lg border border-teal/30 bg-white px-2 py-1.5 text-xs">
            <option value="7">+7 j</option><option value="14">+14 j</option><option value="30">+30 j</option>
          </select>
          <button type="submit" className={BUTTON}>Prolonger l’essai</button>
        </form>
      )}
      {c.solidarity_requested_at && !c.is_solidarity && (
        <form action={approveSolidarity}>
          <input type="hidden" name="churchId" value={c.id} />
          <ConfirmButton message={`Valider le tarif solidaire pour ${c.name} ?`} className={BUTTON}>Valider le tarif solidaire</ConfirmButton>
        </form>
      )}
      {c.is_solidarity && (
        <form action={revokeSolidarity}>
          <input type="hidden" name="churchId" value={c.id} />
          <ConfirmButton message={`Retirer le tarif solidaire à ${c.name} ?`} className={BUTTON}>Retirer le solidaire</ConfirmButton>
        </form>
      )}
    </div>
  )
}
