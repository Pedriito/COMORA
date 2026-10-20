'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isPushConfigured, sendPush, sendPushToUser } from '@/lib/pushNotifications'

export async function savePushSubscription(sub: {
  endpoint: string
  p256dh: string
  auth: string
}): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user) {
    console.error('[push] savePushSubscription — utilisateur non authentifié', authError)
    return { ok: false }
  }

  console.log('[push] savePushSubscription — user:', user.id, '| endpoint:', sub.endpoint.slice(0, 60) + '…')

  const admin = createAdminClient()
  const { error } = await admin.from('push_subscriptions').upsert({
    user_id:  user.id,
    endpoint: sub.endpoint,
    p256dh:   sub.p256dh,
    auth:     sub.auth,
  }, { onConflict: 'user_id,endpoint' })

  if (error) {
    console.error('[push] savePushSubscription — erreur DB:', error.message, error.code)
    return { ok: false }
  }

  // Supprimer les anciennes subscriptions du même utilisateur (VAPID key différente, autre appareil…)
  await admin.from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .neq('endpoint', sub.endpoint)

  console.log('[push] savePushSubscription — OK')
  return { ok: true }
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const admin = createAdminClient()
  await admin.from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)
}

/** Vérifie si l'utilisateur courant a au moins un abonnement push */
export async function hasPushSubscription(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const admin = createAdminClient()
  const { count } = await admin
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  return (count ?? 0) > 0
}

/** Test : envoie une notif de test à l'utilisateur courant */
export async function sendTestPush(): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('[push] sendTestPush — utilisateur non authentifié')
    return { ok: false }
  }

  console.log('[push] sendTestPush — envoi pour user:', user.id)

  const admin = createAdminClient()
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint')
    .eq('user_id', user.id)

  if (error) {
    console.error('[push] sendTestPush — erreur lecture subscriptions:', error.message, error.code)
    return { ok: false }
  }

  const { data: allSubs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', user.id)

  console.log('[push] sendTestPush — subscriptions trouvées:', allSubs?.length ?? 0)

  if (!allSubs || allSubs.length === 0) {
    console.warn('[push] sendTestPush — aucune subscription en base pour cet utilisateur')
    return { ok: false }
  }

  if (!isPushConfigured()) return { ok: false }

  const payload = {
    title: '🔔 Comora',
    body:  'Les notifications push fonctionnent !',
    url:   '/espace/dashboard',
    tag:   'test',
  }

  let sent = 0
  const expired: string[] = []
  await Promise.all(allSubs.map(async (s) => {
    const ok = await sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload)
    if (ok) {
      sent++
      console.log('[push] sendTestPush — OK →', s.endpoint.slice(0, 60))
    } else {
      expired.push(s.id)
      console.warn('[push] sendTestPush — FAIL →', s.endpoint.slice(0, 60))
    }
  }))

  if (expired.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', expired)
    console.log('[push] sendTestPush — supprimé', expired.length, 'subscriptions invalides')
  }

  console.log(`[push] sendTestPush — ${sent}/${allSubs.length} notifications envoyées`)
  return { ok: sent > 0 }
}
