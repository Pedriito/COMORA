'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')
  const { data: me } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(me?.permission ?? '')) redirect('/espace/dashboard')
  return { admin: createAdminClient(), userId: user.id }
}

export type InviteToken = {
  id: string
  token: string
  label: string | null
  expires_at: string | null
  max_uses: number | null
  uses_count: number
  created_at: string
  revoked_at: string | null
}

export async function createInviteToken(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const { admin, userId } = await requireAdmin()
  const label    = (formData.get('label') as string)?.trim() || null
  const expiryDays = Number(formData.get('expiry_days') || 0)
  const maxUses  = Number(formData.get('max_uses') || 0)

  const expires_at = expiryDays > 0
    ? new Date(Date.now() + expiryDays * 86400000).toISOString()
    : null

  const { error } = await admin.from('invite_tokens').insert({
    created_by: userId,
    label,
    expires_at,
    max_uses: maxUses > 0 ? maxUses : null,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function revokeInviteToken(tokenId: string): Promise<void> {
  const { admin } = await requireAdmin()
  await admin.from('invite_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
}

export async function resetInviteTokenUses(tokenId: string, newMaxUses: number | null): Promise<void> {
  const { admin } = await requireAdmin()
  await admin.from('invite_tokens')
    .update({ uses_count: 0, max_uses: newMaxUses })
    .eq('id', tokenId)
}
