import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const TEAM_EMOJIS: Record<string, string> = {
  accueil:                        '👋',
  café:                           '☕',
  cafe:                           '☕',
  'coordination des célébrations':'🎉',
  'dimes & offrandes':            '💛',
  'dîmes & offrandes':            '💛',
  'enfance flèches':              '🏹',
  'équipiers de prière':          '🙏',
  'equipiers de priere':          '🙏',
  évènementiel:                   '📅',
  evenementiel:                   '📅',
  louange:                        '🎵',
  'médias et communication':      '📷',
  'medias et communication':      '📷',
  ménage:                         '🧹',
  menage:                         '🧹',
  prédicateurs:                   '🎤',
  predicateurs:                   '🎤',
  présidence:                     '👑',
  presidence:                     '👑',
  production:                     '🎬',
  sécurité:                       '🛡️',
  securite:                       '🛡️',
}

const FALLBACK_EMOJIS = ['🌱','✨','🤝','💼','📌','🔑','🌿','⚡','🎯','🕊️']

function teamEmoji(name: string): string {
  const key = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const keyRaw = name.toLowerCase()
  return TEAM_EMOJIS[keyRaw] ?? TEAM_EMOJIS[key] ?? FALLBACK_EMOJIS[name.charCodeAt(0) % FALLBACK_EMOJIS.length]
}

export default async function EquipesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const { data: me } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  const isAdmin = ['admin', 'super_admin'].includes(me?.permission ?? '')
  const isEditor = me?.permission === 'editor'
  if (!isAdmin && !isEditor) redirect('/espace/dashboard')

  const { q } = await searchParams
  const search = q?.trim().toLowerCase() ?? ''

  // Admin voit toutes les équipes ; éditeur voit uniquement celles où il est responsable
  let teams: { id: string; name: string }[] = []
  if (isAdmin) {
    const { data } = await supabase.from('teams').select('id, name').order('name')
    teams = data ?? []
  } else {
    const { data } = await supabase
      .from('team_members')
      .select('team_id, teams(id, name)')
      .eq('user_id', user.id)
      .eq('role', 'leader')
    teams = (data ?? [])
      .map(r => r.teams as unknown as { id: string; name: string } | null)
      .filter((t): t is { id: string; name: string } => !!t)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  const { data: memberCounts } = await supabase.from('team_members').select('team_id')
  const countByTeam: Record<string, number> = {}
  memberCounts?.forEach(m => { countByTeam[m.team_id] = (countByTeam[m.team_id] ?? 0) + 1 })

  const filteredTeams = search
    ? teams.filter(t => t.name.toLowerCase().includes(search))
    : teams

  const totalAffectations = Object.values(countByTeam).reduce((s, v) => s + v, 0)
  const teamsWithoutMembers = teams.filter(t => !countByTeam[t.id]).length

  return (
    <div className="min-h-screen bg-teal-50">
      <header className="bg-white border-b border-teal/20 px-4 md:px-6 pb-4 flex items-center gap-4" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 16px)' }}>
        <div className="flex-1 min-w-0">
          <p className="font-sans text-xs text-dark/40 uppercase tracking-widest font-medium">Communauté</p>
          <div className="flex items-center gap-2 mt-0.5">
            <h1 className="font-display text-2xl text-dark font-light">Équipes</h1>
            {isEditor && (
              <span className="text-xs text-dark/40 font-sans bg-teal/10 px-2 py-0.5 rounded-full">Mes équipes</span>
            )}
          </div>
        </div>
        <form method="GET" className="hidden md:block">
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Rechercher une équipe…"
            autoComplete="off"
            className="border border-teal/20 bg-teal-50 rounded-xl px-4 py-2 font-sans text-sm text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/30 w-56"
          />
        </form>
        {isAdmin && (
          <Link
            href="/espace/admin/equipes/nouveau"
            className="shrink-0 px-3 md:px-4 py-2 bg-coral text-white rounded-lg font-sans text-sm font-medium hover:bg-coral/90 transition-colors"
          >
            + Nouvelle équipe
          </Link>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">

        {/* Mobile search */}
        <form method="GET" className="md:hidden">
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Rechercher une équipe…"
            autoComplete="off"
            className="w-full border border-teal/20 bg-white rounded-xl px-4 py-2.5 font-sans text-sm text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
        </form>

        {/* Stats (admin only) */}
        {isAdmin && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-teal/20 p-5">
              <p className="font-display text-4xl text-dark font-light">{teams.length}</p>
              <p className="text-xs font-sans uppercase tracking-widest text-dark/50 mt-1">Équipes</p>
            </div>
            <div className="bg-white rounded-xl border border-teal/20 p-5">
              <p className="font-display text-4xl text-teal font-light">{totalAffectations}</p>
              <p className="text-xs font-sans uppercase tracking-widest text-dark/50 mt-1">Affectations</p>
            </div>
            <div className="bg-amber-50/60 rounded-xl border border-amber-100 p-5">
              <p className="font-display text-4xl text-amber-600 font-light">{teamsWithoutMembers}</p>
              <p className="text-xs font-sans uppercase tracking-widest text-dark/50 mt-1">Sans membre</p>
            </div>
          </div>
        )}

        {/* Grid */}
        {filteredTeams.length === 0 ? (
          <div className="bg-white rounded-2xl border border-teal/20 px-6 py-10 text-center">
            <p className="font-sans text-sm text-dark/40">
              {search
                ? `Aucun résultat pour "${q}".`
                : isEditor
                  ? "Vous n'êtes responsable d'aucune équipe."
                  : 'Aucune équipe.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTeams.map(t => {
              const count = countByTeam[t.id] ?? 0
              return (
                <Link
                  key={t.id}
                  href={`/espace/admin/equipes/${t.id}`}
                  className="bg-white rounded-2xl border border-teal/20 p-5 hover:border-teal/40 hover:shadow-sm transition-all flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center text-xl">
                      {teamEmoji(t.name)}
                    </div>
                    {count === 0 ? (
                      <span className="font-sans text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">À compléter</span>
                    ) : (
                      <span className="font-sans text-xs bg-teal/10 text-teal px-2 py-0.5 rounded-full">{count} membre{count > 1 ? 's' : ''}</span>
                    )}
                  </div>
                  <p className="font-sans text-sm text-dark font-medium leading-snug">{t.name}</p>
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-teal/10">
                    <p className="font-sans text-xs text-dark/50">
                      {count === 0 ? 'Aucun bénévole' : `${count} bénévole${count > 1 ? 's' : ''} affecté${count > 1 ? 's' : ''}`}
                    </p>
                    <span className="font-sans text-xs text-teal font-medium">Gérer →</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
