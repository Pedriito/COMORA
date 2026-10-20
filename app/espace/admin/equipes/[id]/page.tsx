import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MemberSearch } from './MemberSearch'
import { MemberList } from './MemberList'

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const { data: me } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  const isAdmin = ['admin', 'super_admin'].includes(me?.permission ?? '')
  const isEditor = me?.permission === 'editor'

  // Tous les membres de l'équipe peuvent voir la page en lecture seule
  const { data: myMembership } = await supabase
    .from('team_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('team_id', id)
    .single()

  const isMember = !!myMembership
  const isLeader = myMembership?.role === 'leader'
  const canEdit = isAdmin || (isEditor && isLeader)

  if (!isAdmin && !isEditor && !isMember) redirect('/espace/dashboard')

  const [{ data: team }, { data: positions }, { data: members }, { data: allProfiles }] = await Promise.all([
    supabase.from('teams').select('id, name').eq('id', id).single(),
    supabase.from('positions').select('id, name').eq('team_id', id).order('name'),
    supabase
      .from('team_members')
      .select('user_id, role, frequency, profiles(id, first_name, last_name)')
      .eq('team_id', id)
      .order('role'),
    supabase.from('profiles').select('id, first_name, last_name').order('first_name'),
  ])

  if (!team) redirect('/espace/admin/equipes')

  // Tri alphabétique par nom à l'intérieur de chaque rôle
  const sortedMembers = (members ?? []).sort((a, b) => {
    if (a.role !== b.role) return a.role.localeCompare(b.role)
    const pa = a.profiles as { last_name?: string; first_name?: string } | null
    const pb = b.profiles as { last_name?: string; first_name?: string } | null
    return (pa?.last_name ?? '').localeCompare(pb?.last_name ?? '', 'fr') ||
           (pa?.first_name ?? '').localeCompare(pb?.first_name ?? '', 'fr')
  })

  const memberIds = new Set(sortedMembers.map(m => m.user_id))
  const nonMembers = allProfiles?.filter(p => !memberIds.has(p.id)) ?? []

  // Positions par membre
  const memberPositions: Record<string, Set<string>> = {}
  if (sortedMembers.length) {
    const { data: mp } = await supabase
      .from('member_positions')
      .select('user_id, position_id')
      .in('user_id', sortedMembers.map(m => m.user_id))
    mp?.forEach(p => {
      if (!memberPositions[p.user_id]) memberPositions[p.user_id] = new Set()
      memberPositions[p.user_id].add(p.position_id)
    })
  }

  return (
    <div className="min-h-screen bg-teal-50">
      <header className="bg-white border-b border-teal/20 px-6 pb-4 flex items-center gap-4" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 16px)' }}>
        <Link
          href={canEdit ? '/espace/admin/equipes' : '/espace/dashboard'}
          className="text-dark/40 hover:text-dark transition-colors font-sans text-sm"
        >
          ←
        </Link>
        <h1 className="font-display text-2xl text-dark font-light">{team.name}</h1>
        <span className="text-dark/40 font-sans text-sm">{members?.length ?? 0} membre{(members?.length ?? 0) > 1 ? 's' : ''}</span>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Membres actuels */}
        <section>
          <h2 className="font-display text-xl text-dark font-light mb-3">Membres</h2>
          <MemberList
            teamId={id}
            members={sortedMembers as any}
            positions={positions ?? []}
            memberPositions={memberPositions}
            readOnly={!canEdit}
            canEditRoles={isAdmin}
          />
        </section>

        {/* Ajouter un membre — uniquement pour les éditeurs/admins */}
        {canEdit && nonMembers.length > 0 && (
          <section>
            <h2 className="font-display text-xl text-dark font-light mb-3">Ajouter un membre</h2>
            <MemberSearch teamId={id} profiles={nonMembers} />
          </section>
        )}
      </main>
    </div>
  )
}
