'use server'

import { churchOrNull } from '@/lib/auth/church'
import { daysFromNow, generateToken, hashToken } from '@/lib/tokens'

/*
 * Liens de partage d'une setlist (musiciens invités, sans compte).
 * Seule l'empreinte du jeton est stockée : le lien en clair n'est connu
 * qu'au moment de sa création.
 */

const SHARE_LINK_DAYS = 30

export type ShareLinkStatus = { expiresAt: string } | null

/** Contexte responsable + plan relu dans l'église courante, ou null. */
async function managedPlan(planId: string) {
  const ctx = await churchOrNull('responsable')
  if (!ctx || typeof planId !== 'string' || !planId) return null
  const { data: plan } = await ctx.supabase
    .from('plans')
    .select('id')
    .eq('id', planId)
    .eq('church_id', ctx.church.churchId)
    .maybeSingle()
  return plan ? ctx : null
}

/** Lien actif (non révoqué, non expiré) du plan, sans le jeton. */
export async function getShareLinkStatus(planId: string): Promise<ShareLinkStatus> {
  const ctx = await managedPlan(planId)
  if (!ctx) return null
  const { data } = await ctx.supabase
    .from('plan_share_links')
    .select('expires_at')
    .eq('plan_id', planId)
    .eq('church_id', ctx.church.churchId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? { expiresAt: data.expires_at } : null
}

/** Révoque tous les liens encore valides du plan. */
export async function revokeShareLinks(planId: string): Promise<{ ok: boolean }> {
  const ctx = await managedPlan(planId)
  if (!ctx) return { ok: false }
  const { error } = await ctx.supabase
    .from('plan_share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('plan_id', planId)
    .eq('church_id', ctx.church.churchId)
    .is('revoked_at', null)
  return { ok: !error }
}

/** Nouveau lien (l'ancien est révoqué). Renvoie le jeton en clair, une seule fois. */
export async function createShareLink(planId: string): Promise<{ token: string; expiresAt: string } | null> {
  const ctx = await managedPlan(planId)
  if (!ctx) return null

  const revoked = await revokeShareLinks(planId)
  if (!revoked.ok) return null

  const token = generateToken()
  const expiresAt = daysFromNow(SHARE_LINK_DAYS).toISOString()
  const { error } = await ctx.supabase.from('plan_share_links').insert({
    church_id:  ctx.church.churchId,
    plan_id:    planId,
    token_hash: hashToken(token),
    expires_at: expiresAt,
    created_by: ctx.userId,
  })
  if (error) return null
  return { token, expiresAt }
}
