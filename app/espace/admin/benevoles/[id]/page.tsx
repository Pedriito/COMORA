import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { permissionLabels, statusLabels, roleLabels, frequencyLabels } from '@/lib/labels'
import { IconEnvelope } from '@/app/espace/_components/Icons'
import { resendInvite } from '../../actions'
import { FlashMessage } from '../../../_components/FlashMessage'

export default async function BenevoleProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; sent?: string; updated?: string }>
}) {
  const { id } = await params
  const { error: flashError, sent: flashSent, updated: flashUpdated } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const { data: me } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(me?.permission ?? '')) redirect('/espace/dashboard')

  const admin = createAdminClient()

  const [
    { data: profile },
    { data: authUser },
    { data: teamMemberships },
    { data: memberPositions },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, first_name, last_name, phone, permission, status, created_at, email, birthdate, city')
      .eq('id', id)
      .single()
      .then(res => {
        // Si les nouvelles colonnes n'existent pas encore, on retente sans elles
        if (res.error?.code === '42703') {
          return supabase
            .from('profiles')
            .select('id, first_name, last_name, phone, permission, status, created_at')
            .eq('id', id)
            .single()
        }
        return res
      }),
    admin.auth.admin.getUserById(id),
    supabase
      .from('team_members')
      .select('role, frequency, team_id, teams(id, name)')
      .eq('user_id', id),
    supabase
      .from('member_positions')
      .select('position_id, positions(id, name, team_id)')
      .eq('user_id', id),
  ])

  if (!profile) redirect('/espace/admin')

  const p = profile as any
  const email = p.email || authUser?.user?.email

  // Regroupe les positions par équipe
  const positionsByTeam: Record<string, string[]> = {}
  memberPositions?.forEach(mp => {
    const pos = mp.positions as unknown as { id: string; name: string; team_id: string } | null
    if (!pos) return
    if (!positionsByTeam[pos.team_id]) positionsByTeam[pos.team_id] = []
    positionsByTeam[pos.team_id].push(pos.name)
  })

  const st = statusLabels[p.status] ?? statusLabels.inactive

  return (
    <div className="min-h-screen bg-teal-50">
      <header className="bg-white border-b border-teal/20 px-4 md:px-6 pb-4" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 16px)' }}>
        {/* Ligne 1 : retour + nom + badge */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/espace/admin"
            className="text-dark/40 hover:text-dark transition-colors font-sans text-sm shrink-0"
          >
            ←
          </Link>
          <h1 className="font-display text-xl md:text-2xl text-dark font-light truncate min-w-0">
            {p.first_name} {p.last_name}
          </h1>
          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-sans font-medium shrink-0 ${st.color}`}>
            {st.label}
          </span>
        </div>
        {/* Ligne 2 : actions */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Link
            href={`/espace/admin/benevoles/${id}/modifier`}
            className="px-3 py-1.5 rounded-lg bg-teal text-white font-sans text-xs font-medium hover:bg-teal-dark transition-colors"
          >
            Modifier
          </Link>
          <form action={resendInvite}>
            <input type="hidden" name="user_id" value={id} />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg border border-teal/30 text-teal font-sans text-xs font-medium hover:bg-teal-50 transition-colors"
            >
              <span className="inline-flex items-center gap-1.5"><IconEnvelope className="w-3.5 h-3.5" /> Renvoyer l'invitation</span>
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {flashError && <FlashMessage message={`Erreur : ${flashError}`} type="error" />}
        {flashSent && <FlashMessage message={`Invitation envoyée à ${email}.`} type="success" />}
        {flashUpdated && <FlashMessage message="Fiche mise à jour." type="success" />}

        {/* Coordonnées */}
        <section className="bg-white rounded-2xl border border-teal/20 p-6">
          <h2 className="font-display text-xl text-dark font-light mb-4">Coordonnées</h2>
          <dl className="space-y-3">
            <Row label="Email" value={email ?? '—'} />
            <Row label="Téléphone" value={p.phone ?? '—'} />
            <Row label="Ville" value={p.city ?? '—'} />
            <Row
              label="Date de naissance"
              value={p.birthdate
                ? new Date(p.birthdate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                : '—'}
            />
            <Row label="Niveau d'accès" value={permissionLabels[p.permission] ?? p.permission} />
            <Row
              label="Membre depuis"
              value={new Date(p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            />
          </dl>
        </section>

        {/* Équipes & postes */}
        <section className="bg-white rounded-2xl border border-teal/20 p-6">
          <h2 className="font-display text-xl text-dark font-light mb-4">Équipes & rôles</h2>
          {teamMemberships && teamMemberships.length > 0 ? (
            <div className="space-y-3">
              {teamMemberships.map(tm => {
                const team = tm.teams as unknown as { id: string; name: string } | null
                if (!team) return null
                const positions = positionsByTeam[team.id] ?? []
                return (
                  <div key={team.id} className="flex items-start gap-3 py-3 border-b border-teal/10 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-sans text-sm text-dark font-medium">{team.name}</span>
                        {tm.role === 'leader' && (
                          <span className="text-xs bg-teal/10 text-teal px-2 py-0.5 rounded-full font-sans">
                            {roleLabels.leader}
                          </span>
                        )}
                        {tm.frequency && (
                          <span className="text-xs text-dark/40 font-sans">
                            {frequencyLabels[tm.frequency] ?? tm.frequency}
                          </span>
                        )}
                      </div>
                      {positions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {positions.map(name => (
                            <span key={name} className="px-2.5 py-1 bg-teal text-white rounded-full text-xs font-sans">
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <Link
                      href={`/espace/admin/equipes/${team.id}`}
                      className="text-xs text-teal hover:underline font-sans shrink-0"
                    >
                      Voir l'équipe →
                    </Link>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-dark/40 font-sans">Aucune équipe assignée.</p>
          )}
        </section>

      </main>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 md:w-40 shrink-0 text-xs text-dark/40 font-sans uppercase tracking-widest pt-0.5 leading-snug">{label}</dt>
      <dd className="font-sans text-sm text-dark min-w-0 break-all">{value}</dd>
    </div>
  )
}
