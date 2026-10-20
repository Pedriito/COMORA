'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAdminIfAllowed() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: me } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
    if (!['admin', 'editor', 'super_admin'].includes(me?.permission ?? '')) return null
    return createAdminClient()
  } catch { return null }
}

/** Retourne le token de partage existant ou en génère un nouveau */
export async function getOrCreateShareToken(planId: string): Promise<string | null> {
  const admin = await getAdminIfAllowed()
  if (!admin) return null

  // Lire le token existant
  const { data: plan } = await admin
    .from('plans')
    .select('share_token')
    .eq('id', planId)
    .single()

  if (plan?.share_token) return plan.share_token as string

  // Générer via une fonction SQL (gen_random_uuid)
  const { data: updated } = await admin
    .from('plans')
    .update({ share_token: crypto.randomUUID() })
    .eq('id', planId)
    .select('share_token')
    .single()

  return (updated?.share_token as string) ?? null
}

/** Régénère un nouveau token (révoque l'ancien lien) */
export async function regenerateShareToken(planId: string): Promise<string | null> {
  const admin = await getAdminIfAllowed()
  if (!admin) return null

  const { data } = await admin
    .from('plans')
    .update({ share_token: crypto.randomUUID() })
    .eq('id', planId)
    .select('share_token')
    .single()

  return (data?.share_token as string) ?? null
}
