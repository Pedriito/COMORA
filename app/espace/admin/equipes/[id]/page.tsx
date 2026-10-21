import { requireChurch } from '@/lib/auth/church'
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
  const ctx = await requireChurch('membre')
  const supabase = ctx.supabase
  const churchId = ctx.church.churchId
  const isCoordinator = ctx.church.role === 'admin' || ctx.church.role === 'responsable'

  // Tous les membres de l'équipe peuvent voir la page en lecture seule
  const { data: myMembership } = ctx.memberId
    ? await supabase
        .from('team_members')
        .select('role')
        .eq('church_id', churchId)
        .eq('member_id', ctx.memberId)
        .eq('team_id', id)
        .maybeSingle()
    : { data: null }

  const isMember = !!myMembership
  const isLeader = myMembership?.role === 'leader'
  const canEdit = isCoordinator || isLeader

  if (!isCoordinator && !isMember) redirect('/espace/dashboard')

  const [{ data: team }, { data: positions }, { data: members }, { data: allMembers }] = await Promise.all([
    supabase.from('teams').select('id, name').eq('church_id', churchId).eq('id', id).maybeSingle(),
    supabase.from('positions').select('id, name').eq('church_id', churchId).eq('team_id', id).order('name'),
    supabase
      .from('team_members')
      .select('member_id, role, frequency, members(id, first_name, last_name)')
      .eq('church_id', churchId)
      .eq('team_id', id)
      .order('role'),
    supabase.from('members').select('id, first_name, last_name').eq('church_id', churchId).order('first_name'),
  ])

  if (!team) redirect(canEdit && isCoordinator ? '/espace/admin/equipes' : '/espace/dashboard')

  // Tri alphabétique par nom à l'intérieur de chaque rôle
  const sortedMembers = (members ?? []).sort((a, b) => {
    if (a.role !== b.role) return a.role.localeCompare(b.role)
    const pa = a.members as unknown as { last_name?: string; first_name?: string } | null
    const pb = b.members as unknown as { last_name?: string; first_name?: string } | null
    return (pa?.last_name ?? '').localeCompare(pb?.last_name ?? '', 'fr') ||
           (pa?.first_name ?? '').localeCompare(pb?.first_name ?? '', 'fr')
  })

  const memberIds = new Set(sortedMembers.map(m => m.member_id))
  const nonMembers = allMembers?.filter(p => !memberIds.has(p.id)) ?? []

  // Positions par membre
  const memberPositions: Record<string, Set<string>> = {}
  if (sortedMembers.length) {
    const { data: mp } = await supabase
      .from('member_positions')
      .select('member_id, position_id')
      .eq('church_id', churchId)
      .in('member_id', sortedMembers.map(m => m.member_id))
    mp?.forEach(p => {
      if (!memberPositions[p.member_id]) memberPositions[p.member_id] = new Set()
      memberPositions[p.member_id].add(p.position_id)
    })
  }

  return (
    <div className="min-h-screen bg-teal-50">
      <header className="bg-white border-b border-teal/20 px-6 pb-4 flex items-center gap-4" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 16px)' }}>
        <Link
          href={isCoordinator ? '/espace/admin/equipes' : '/espace/dashboard'}
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
            members={sortedMembers as unknown as Parameters<typeof MemberList>[0]['members']}
            positions={positions ?? []}
            memberPositions={memberPositions}
            readOnly={!canEdit}
            canEditRoles={isCoordinator}
          />
        </section>

        {/* Ajouter un membre — uniquement pour les éditeurs/admins */}
        {canEdit && nonMembers.length > 0 && (
          <section>
            <h2 className="font-display text-xl text-dark font-light mb-3">Ajouter un membre</h2>
            <MemberSearch teamId={id} members={nonMembers} />
          </section>
        )}
      </main>
    </div>
  )
}
