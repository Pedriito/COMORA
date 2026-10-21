'use server'

import { churchOrNull } from '@/lib/auth/church'
import { generateToken, hashToken } from '@/lib/tokens'
import { siteUrl } from '@/lib/site'

type Result = { ok: true; url: string } | { ok: false; error: string }

/**
 * Crée le lien d'abonnement au calendrier (ICS) du compte connecté pour l'église courante.
 * Les liens précédents du compte dans cette église sont révoqués : « régénérer » et « créer »
 * sont la même opération. Le jeton en clair n'est renvoyé qu'ici, une seule fois ; seule son
 * empreinte est stockée.
 */
export async function createCalendarFeed(): Promise<Result> {
  const ctx = await churchOrNull('membre')
  if (!ctx) return { ok: false, error: 'Accès refusé.' }
  const churchId = ctx.church.churchId

  const { error: revokeError } = await ctx.supabase
    .from('calendar_feeds')
    .update({ revoked_at: new Date().toISOString() })
    .eq('church_id', churchId)
    .eq('user_id', ctx.userId)
    .is('revoked_at', null)
  if (revokeError) return { ok: false, error: "Impossible de révoquer l'ancien lien." }

  const token = generateToken()
  const { error } = await ctx.supabase
    .from('calendar_feeds')
    .insert({ church_id: churchId, user_id: ctx.userId, token_hash: hashToken(token) })
  if (error) return { ok: false, error: 'Impossible de créer le lien.' }

  return { ok: true, url: `${siteUrl()}/api/calendar/${token}.ics` }
}

/** Révoque le lien d'abonnement du compte connecté pour l'église courante. */
export async function revokeCalendarFeed(): Promise<{ ok: boolean }> {
  const ctx = await churchOrNull('membre')
  if (!ctx) return { ok: false }
  const { error } = await ctx.supabase
    .from('calendar_feeds')
    .update({ revoked_at: new Date().toISOString() })
    .eq('church_id', ctx.church.churchId)
    .eq('user_id', ctx.userId)
    .is('revoked_at', null)
  return { ok: !error }
}
