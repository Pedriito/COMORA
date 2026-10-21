'use server'

import { churchOrNull } from '@/lib/auth/church'
import { generateToken, hashToken } from '@/lib/tokens'

export type InviteToken = {
  id: string
  label: string | null
  expires_at: string | null
  max_uses: number | null
  uses_count: number
  created_at: string
  revoked_at: string | null
}

/**
 * Nouveau lien d'inscription. Le jeton en clair n'est renvoyé qu'ici, une
 * seule fois : seule son empreinte est enregistrée.
 */
export async function createInviteToken(formData: FormData): Promise<{ ok: true; token: string; invite: InviteToken } | { ok: false; error: string }> {
  const ctx = await churchOrNull('admin')
  if (!ctx) return { ok: false, error: 'Accès refusé' }

  const label      = ((formData.get('label') as string | null) ?? '').trim().slice(0, 120) || null
  const expiryDays = Number(formData.get('expiry_days') || 0)
  const maxUses    = Math.floor(Number(formData.get('max_uses') || 0))

  const expires_at = Number.isFinite(expiryDays) && expiryDays > 0
    ? new Date(Date.now() + Math.min(expiryDays, 365) * 86400000).toISOString()
    : null

  const token = generateToken()
  const { data, error } = await ctx.supabase
    .from('invite_tokens')
    .insert({
      church_id: ctx.church.churchId,
      token_hash: hashToken(token),
      created_by: ctx.userId,
      label,
      expires_at,
      max_uses: Number.isFinite(maxUses) && maxUses > 0 ? maxUses : null,
    })
    .select('id, label, expires_at, max_uses, uses_count, created_at, revoked_at')
    .single()

  if (error || !data) return { ok: false, error: 'Le lien n’a pas pu être créé. Réessaie.' }
  return { ok: true, token, invite: data }
}

export async function revokeInviteToken(tokenId: string): Promise<void> {
  const ctx = await churchOrNull('admin')
  if (!ctx) return
  await ctx.supabase
    .from('invite_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('church_id', ctx.church.churchId)
    .eq('id', tokenId)
}

export async function resetInviteTokenUses(tokenId: string, newMaxUses: number | null): Promise<void> {
  const ctx = await churchOrNull('admin')
  if (!ctx) return
  const max = newMaxUses != null && Number.isInteger(newMaxUses) && newMaxUses > 0 ? newMaxUses : null
  await ctx.supabase
    .from('invite_tokens')
    .update({ uses_count: 0, max_uses: max })
    .eq('church_id', ctx.church.churchId)
    .eq('id', tokenId)
}
