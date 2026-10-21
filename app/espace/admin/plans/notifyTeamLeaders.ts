import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUsers } from '@/lib/pushNotifications'
import { resolveTimeZone } from '@/lib/timezone'

/**
 * Notifie par push les responsables (leaders) de l'équipe concernée qu'une personne a confirmé
 * ou décliné une affectation. Non bloquant : une erreur ici ne doit jamais faire échouer la
 * réponse, déjà enregistrée à ce stade.
 *
 * `assignmentId` et `churchId` doivent avoir été vérifiés par l'appelant (session + RLS, ou
 * jeton signé) : la fonction ne fait que relire l'affectation dans cette église.
 */
export async function notifyTeamLeadersOfResponse(
  churchId: string,
  assignmentId: string,
  status: string,
  timeZone: string,
) {
  if (status !== 'confirmed' && status !== 'declined') return
  try {
    // Clé secrète : les comptes des responsables et leurs abonnements push ne sont pas lisibles
    // par un membre ni par un invité externe ; chaque requête est filtrée par église.
    const admin = createAdminClient()
    const { data: assignment } = await admin
      .from('plan_assignments')
      .select('member_id, team_id, external_name, plans(id, title, service_date), positions(name, team_id), members(first_name, last_name)')
      .eq('id', assignmentId)
      .eq('church_id', churchId)
      .maybeSingle()
    if (!assignment) return

    const position = assignment.positions as unknown as { name: string; team_id: string } | null
    const teamId = assignment.team_id ?? position?.team_id ?? null
    if (!teamId) return

    const { data: leaders } = await admin
      .from('team_members')
      .select('member_id, members(user_id)')
      .eq('church_id', churchId)
      .eq('team_id', teamId)
      .eq('role', 'leader')

    const leaderUserIds = [...new Set(
      ((leaders ?? []) as unknown as { member_id: string; members: { user_id: string | null } | null }[])
        .filter(l => l.member_id !== assignment.member_id)
        .map(l => l.members?.user_id)
        .filter((id): id is string => !!id)
    )]
    if (leaderUserIds.length === 0) return

    const plan = assignment.plans as unknown as { id: string; title: string; service_date: string } | null
    const member = assignment.members as unknown as { first_name: string; last_name: string } | null
    const name = member
      ? `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim()
      : (assignment.external_name ?? '')
    const date = plan
      ? new Date(plan.service_date).toLocaleDateString('fr-FR', {
          weekday: 'long', day: 'numeric', month: 'long', timeZone: resolveTimeZone(timeZone),
        })
      : ''
    const verb = status === 'confirmed' ? 'a confirmé sa présence' : 'a décliné'

    await sendPushToUsers(leaderUserIds, {
      title: status === 'confirmed' ? '✅ Réponse reçue' : '❌ Réponse reçue',
      body: `${name || 'Un·e bénévole'} ${verb}${position ? ` · ${position.name}` : ''}${plan ? ` · ${plan.title} (${date})` : ''}`,
      url: plan ? `/espace/admin/plans/${plan.id}` : '/espace/dashboard',
      tag: `response-${assignmentId}`,
    })
  } catch (err) {
    console.error('[notifyTeamLeadersOfResponse] échec (non bloquant) :', (err as Error)?.message)
  }
}

/** Fuseau de l'église (`churches.timezone`), lu avec le client fourni. */
export async function churchTimeZone(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: 'churches') => any },
  churchId: string,
): Promise<string> {
  const { data } = await supabase.from('churches').select('timezone').eq('id', churchId).maybeSingle()
  return resolveTimeZone((data as { timezone?: string } | null)?.timezone)
}
