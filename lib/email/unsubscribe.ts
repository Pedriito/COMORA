import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { appAbsoluteUrl, siteUrl } from '@/lib/site'
import { daysFromNow, signToken, verifyToken } from '@/lib/tokens'

/*
 * Désinscription des e-mails de rappel, sans connexion : un lien signé dans chaque message.
 *
 *   - le lien ouvre une page de confirmation (une simple ouverture, par exemple par l'antivirus
 *     d'une messagerie, ne désinscrit personne) ;
 *   - l'en-tête List-Unsubscribe (RFC 8058) permet le bouton « Se désabonner » de Gmail et Apple Mail,
 *     qui envoie un POST sur /api/desinscription/<jeton> ;
 *   - seuls les messages de rappel sont concernés (voir isOptionalKind) ;
 *   - le jeton ne porte que l'identifiant de la personne : aucune adresse dans le lien.
 */

export const UNSUBSCRIBE_PURPOSE = 'email-unsubscribe'
export const UNSUBSCRIBE_CATEGORY = 'rappels'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Admin = SupabaseClient

/** Jeton valable deux ans : un vieux message doit encore permettre de se désinscrire. */
export function unsubscribeToken(userId: string): string {
  return signToken(UNSUBSCRIBE_PURPOSE, userId, daysFromNow(730))
}

/** Identifiant de la personne d'un jeton valide, sinon null. */
export function verifyUnsubscribeToken(token: string): string | null {
  const id = verifyToken(UNSUBSCRIBE_PURPOSE, token)
  return id && UUID.test(id) ? id : null
}

/** Page de confirmation (lien du pied de page) et adresse du « un clic » (en-tête List-Unsubscribe). */
export function unsubscribeLinks(userId: string): { page: string; oneClick: string } {
  const token = encodeURIComponent(unsubscribeToken(userId))
  return { page: appAbsoluteUrl(`/espace/desinscription/${token}`), oneClick: `${siteUrl()}/api/desinscription/${token}` }
}

export function unsubscribeHeaders(oneClickUrl: string): Record<string, string> {
  return { 'List-Unsubscribe': `<${oneClickUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
}

export async function isUnsubscribed(admin: Admin, userId: string): Promise<boolean> {
  const { data, error } = await admin.from('email_unsubscribes').select('user_id').eq('user_id', userId).eq('category', UNSUBSCRIBE_CATEGORY).maybeSingle()
  if (error) throw new Error(`désinscriptions : ${error.message}`)
  return !!data
}

/** Parmi ces personnes, celles qui ne veulent plus recevoir de rappels. Lève une erreur si la base échoue. */
export async function unsubscribedAmong(admin: Admin, userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set()
  const { data, error } = await admin.from('email_unsubscribes').select('user_id').eq('category', UNSUBSCRIBE_CATEGORY).in('user_id', userIds)
  if (error) throw new Error(`désinscriptions : ${error.message}`)
  return new Set((data ?? []).map((r: { user_id: string }) => r.user_id))
}

export async function setUnsubscribed(admin: Admin, userId: string, unsubscribed: boolean): Promise<void> {
  const query = unsubscribed
    ? admin.from('email_unsubscribes').upsert({ user_id: userId, category: UNSUBSCRIBE_CATEGORY }, { onConflict: 'user_id,category' })
    : admin.from('email_unsubscribes').delete().eq('user_id', userId).eq('category', UNSUBSCRIBE_CATEGORY)
  const { error } = await query
  if (error) throw new Error(`désinscriptions : ${error.message}`)
}
