import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

let vapidConfigured = false

/**
 * Configure web-push au premier envoi (et non au chargement du module, pour que
 * le build fonctionne sans les clés). Renvoie false si les clés VAPID manquent.
 */
export function isPushConfigured(): boolean {
  if (vapidConfigured) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false
  // Sujet VAPID : adresse de contact transmise aux services de push (mailto: ou https:)
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:bonjour@comora.fr', publicKey, privateKey)
  vapidConfigured = true
  return true
}

export type PushPayload = {
  title: string
  body:  string
  url?:  string
  tag?:  string
}

type Subscription = { endpoint: string; p256dh: string; auth: string }

/** Envoie une notification à un abonnement. Retourne false si l'abonnement est expiré. */
export async function sendPush(sub: Subscription, payload: PushPayload): Promise<boolean> {
  if (!isPushConfigured()) {
    // Abonnement conservé : c'est la configuration du serveur qui manque, pas l'abonnement.
    console.warn('[push] clés VAPID absentes : notification non envoyée')
    return true
  }
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    )
    return true
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode
    // 400 VapidPkHashMismatch, 403 VAPID mismatch, 404 Not Found, 410 Gone = subscription invalide à supprimer
    if (status === 400 || status === 403 || status === 404 || status === 410) {
      console.warn(`[push] subscription invalide (${status}), suppression — endpoint: ${sub.endpoint.slice(0, 60)}`)
      return false
    }
    console.error('[push] sendPush error:', (err as Error).message)
    return false
  }
}

/** Envoie une notification à tous les abonnements d'un utilisateur.
 *  Supprime automatiquement les abonnements expirés. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!isPushConfigured()) return
  const admin = createAdminClient()
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs || subs.length === 0) return

  const expired: string[] = []
  await Promise.all(subs.map(async (s) => {
    const ok = await sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload)
    if (!ok) expired.push(s.id)
  }))

  if (expired.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', expired)
  }
}

/** Envoie une notification à une liste d'utilisateurs */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  await Promise.all(userIds.map(id => sendPushToUser(id, payload)))
}
