'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { sendPushToUser } from '@/lib/pushNotifications'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')
  const { data: profile } = await supabase.from('profiles').select('permission, church_id').eq('id', user.id).single()
  if (!profile || !['admin', 'editor', 'super_admin'].includes(profile.permission)) redirect('/espace/dashboard')
  return { admin: createAdminClient(), church_id: profile.church_id as string }
}

export type CommitRow = {
  planId: string
  serviceDate: string
  teamId: string
  positionId: string
  positionName: string
  allowMultiple: boolean
  userId: string
}

type Result =
  | { ok: true; inserted: number; skipped: number }
  | { ok: false; error: string }

/** Persiste la proposition d'auto-remplissage éditée par l'admin dans la modale d'aperçu.
 *  Re-vérifie que chaque poste (non `allow_multiple`) ciblé est toujours libre avant d'insérer,
 *  au cas où il aurait été rempli manuellement pendant que la modale était ouverte. */
export async function commitAutoFillProposal(rows: CommitRow[]): Promise<Result> {
  const { admin } = await requireAdmin()

  if (rows.length === 0) return { ok: true, inserted: 0, skipped: 0 }

  const planIds = [...new Set(rows.map(r => r.planId))]
  const { data: existing } = await admin
    .from('plan_assignments')
    .select('plan_id, position_id')
    .in('plan_id', planIds)
    .not('position_id', 'is', null)

  const takenKeys = new Set((existing ?? []).map(a => `${a.plan_id}:${a.position_id}`))
  const toInsert = rows.filter(r => r.allowMultiple || !takenKeys.has(`${r.planId}:${r.positionId}`))
  const skipped = rows.length - toInsert.length

  if (toInsert.length === 0) return { ok: true, inserted: 0, skipped }

  const { error } = await admin
    .from('plan_assignments')
    .insert(toInsert.map(r => ({
      plan_id: r.planId,
      user_id: r.userId,
      position_id: r.positionId,
      team_id: r.teamId,
      status: 'pending',
    })))

  if (error) return { ok: false, error: error.message }

  // Notifications push — bonus non-bloquant, envoyées en parallèle.
  await Promise.allSettled(
    toInsert.map(r => {
      const date = new Date(r.serviceDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      return sendPushToUser(r.userId, {
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
