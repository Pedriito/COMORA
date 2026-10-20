import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { InboxCard } from './InboxAssignForm'

type InboxDecision = {
  id: string
  title: string
  context: string | null
  source: string | null
  created_at: string
}

const AVATAR_COLORS = [
  { bg: 'var(--color-teal-light)', color: 'var(--color-teal-dark)' },
  { bg: '#FDE8DC', color: 'var(--color-coral)' },
  { bg: '#EDE9FE', color: '#7C3AED' },
  { bg: '#D1FAE5', color: '#059669' },
  { bg: '#DBEAFE', color: '#2563EB' },
  { bg: '#FCE7F3', color: '#DB2777' },
  { bg: '#FEF3C7', color: '#D97706' },
]

function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}

export default async function GestionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('permission')
    .eq('id', user.id)
    .single()

  const isAdmin = ['admin', 'editor', 'super_admin'].includes(profile?.permission ?? '')

  let teams: { id: string; name: string }[] = []

  if (isAdmin) {
    const { data } = await supabase.from('teams').select('id, name').order('name')
    teams = data ?? []
  } else {
    const { data: memberships } = await supabase
      .from('team_members')
      .select('teams(id, name)')
      .eq('user_id', user.id)
    teams = (memberships ?? [])
      .map(m => m.teams as unknown as { id: string; name: string })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  if (teams.length === 0) {
    return (
      <div className="min-h-screen bg-sand flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="font-sans text-sm text-dark/40">Vous n'êtes membre d'aucune équipe.</p>
          <Link href="/espace/dashboard" className="text-teal font-sans text-sm hover:underline">
            ← Tableau de bord
          </Link>
        </div>
      </div>
    )
  }

  const teamIds = teams.map(t => t.id)

  const [
    { data: pendingDecisions },
    { data: todoTasks },
    { data: rawInbox },
  ] = await Promise.all([
    supabase.from('decisions').select('id, team_id').eq('status', 'pending').in('team_id', teamIds),
    supabase.from('tasks').select('id, team_id').eq('status', 'todo').in('team_id', teamIds),
    isAdmin
      ? supabase
          .from('decisions')
          .select('id, title, context, source, created_at')
          .is('team_id', null)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const inbox = (rawInbox ?? []) as InboxDecision[]

  const decisionsByTeam: Record<string, number> = {}
  pendingDecisions?.forEach(d => {
    if (d.team_id) decisionsByTeam[d.team_id] = (decisionsByTeam[d.team_id] ?? 0) + 1
  })

  const tasksByTeam: Record<string, number> = {}
  todoTasks?.forEach(t => {
    if (t.team_id) tasksByTeam[t.team_id] = (tasksByTeam[t.team_id] ?? 0) + 1
  })

  return (
    <div className="min-h-screen bg-sand">

      {/* Header */}
      <header className="bg-white border-b border-teal/20 px-4 md:px-6 py-4 flex items-center gap-4">
        <Link
          href="/espace/dashboard"
          className="text-dark/40 hover:text-dark transition-colors font-sans text-sm shrink-0"
        >
          ←
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-sans text-xs text-dark/40 uppercase tracking-widest font-medium">Planifier</p>
          <h1 className="font-display text-2xl text-dark font-light">Tâches &amp; décisions</h1>
        </div>
        <span className="shrink-0 font-sans text-xs text-dark/40 border border-dark/15 rounded-full px-3 py-1.5">
          {teams.length} équipe{teams.length > 1 ? 's' : ''}
        </span>
      </header>

      <main className="max-w-4xl mx-auto px-6 md:px-10 pb-12 space-y-8">

        {/* Décisions sans équipe */}
        {isAdmin && inbox.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl text-dark font-light">Décisions à classer</h2>
              <span className="w-5 h-5 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center font-sans leading-none">
                {inbox.length}
              </span>
            </div>
            <div className="space-y-2">
              {inbox.map(d => (
                <InboxCard key={d.id} decision={d} teams={teams} />
              ))}
            </div>
          </section>
        )}

        {/* Grille équipes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {teams.map(team => {
            const nDecisions = decisionsByTeam[team.id] ?? 0
            const nTasks = tasksByTeam[team.id] ?? 0
            const colors = avatarColor(team.name)
            const initial = [...team.name][0].toUpperCase()
            const hasPending = nDecisions > 0

            return (
              <Link
                key={team.id}
                href={`/espace/gestion/${team.id}`}
                className={`flex items-center gap-4 bg-white rounded-2xl border px-5 py-4 transition-colors group ${
                  hasPending
                    ? 'border-amber-400 hover:border-amber-500'
                    : 'border-dark/8 hover:border-dark/15'
                }`}
              >
                {/* Avatar */}
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-sans text-sm font-semibold shrink-0"
                  style={{ backgroundColor: colors.bg, color: colors.color }}
                >
                  {initial}
                </span>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-sm font-semibold text-dark truncate">{team.name}</p>
                  <p className="font-sans text-xs text-dark/40 mt-0.5">
                    {nTasks > 0
                      ? `${nTasks} tâche${nTasks > 1 ? 's' : ''} à faire`
                      : 'Aucune tâche en cours'}
                  </p>
                </div>

                {/* Badges + flèche */}
                <div className="flex items-center gap-2 shrink-0">
                  {nDecisions > 0 && (
                    <span className="bg-amber-100 text-amber-700 font-sans text-xs font-semibold px-2 py-0.5 rounded-full">
                      {nDecisions} à décider
                    </span>
                  )}
                  <span className="text-dark/25 font-sans text-sm group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
              </Link>
            )
          })}
        </div>

      </main>
    </div>
  )
}
