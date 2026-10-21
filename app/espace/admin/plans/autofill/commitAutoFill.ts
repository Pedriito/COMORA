'use server'

import { revalidatePath } from 'next/cache'
import { requireChurch } from '@/lib/auth/church'
import { sendPushToUser } from '@/lib/pushNotifications'
import { resolveTimeZone } from '@/lib/timezone'

export type CommitRow = {
  planId: string
  serviceDate: string
  teamId: string
  positionId: string
  positionName: string
  allowMultiple: boolean
  /** Id de la personne (`members.id`) */
  userId: string
}

type Result =
  | { ok: true; inserted: number; skipped: number }
  | { ok: false; error: string }

/** Persiste la proposition d'auto-remplissage éditée par le responsable dans la modale d'aperçu.
 *  Re-vérifie que chaque poste (non `allow_multiple`) ciblé est toujours libre avant d'insérer,
 *  au cas où il aurait été rempli manuellement pendant que la modale était ouverte.
 *  Les clés étrangères composites (plan, personne, équipe, poste → même église) refusent toute
 *  ligne qui mélangerait deux églises. */
export async function commitAutoFillProposal(rows: CommitRow[]): Promise<Result> {
  const ctx = await requireChurch('responsable')
  const { supabase } = ctx
  const churchId = ctx.church.churchId

  if (rows.length === 0) return { ok: true, inserted: 0, skipped: 0 }

  const planIds = [...new Set(rows.map(r => r.planId))]
  const { data: existing } = await supabase
    .from('plan_assignments')
    .select('plan_id, position_id')
    .eq('church_id', churchId)
    .in('plan_id', planIds)
    .not('position_id', 'is', null)

  const takenKeys = new Set((existing ?? []).map(a => `${a.plan_id}:${a.position_id}`))
  const toInsert = rows.filter(r => r.allowMultiple || !takenKeys.has(`${r.planId}:${r.positionId}`))
  const skipped = rows.length - toInsert.length

  if (toInsert.length === 0) return { ok: true, inserted: 0, skipped }

  const { error } = await supabase
    .from('plan_assignments')
    .insert(toInsert.map(r => ({
      church_id: churchId,
      plan_id: r.planId,
      member_id: r.userId,
      position_id: r.positionId,
      team_id: r.teamId,
      status: 'pending',
    })))

  if (error) return { ok: false, error: error.message }

  // Notifications push — bonus non bloquant, envoyées en parallèle.
  const [{ data: members }, { data: church }] = await Promise.all([
    supabase.from('members').select('id, user_id').eq('church_id', churchId).in('id', [...new Set(toInsert.map(r => r.userId))]),
    supabase.from('churches').select('timezone').eq('id', churchId).maybeSingle(),
  ])
  const accountOf = new Map((members ?? []).map(m => [m.id, m.user_id]))
  const timeZone = resolveTimeZone(church?.timezone)
  await Promise.allSettled(
    toInsert.map(r => {
      const accountId = accountOf.get(r.userId)
      if (!accountId) return Promise.resolve()
      const date = new Date(r.serviceDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone })
      return sendPushToUser(accountId, {
        title: '📋 Tu as été planifié·e',
        body: `${r.positionName} · ${date} — confirme ta présence !`,
        url: '/espace/historique',
        tag: `assignment-${r.planId}`,
      })
    })
  )

  revalidatePath('/espace/admin/plans')
  for (const planId of planIds) revalidatePath(`/espace/admin/plans/${planId}`)

  return { ok: true, inserted: toInsert.length, skipped }
}
