'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function requireEditor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')
  const { data: me } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  if (!['admin', 'editor', 'super_admin'].includes(me?.permission ?? '')) redirect('/espace/dashboard')
  return createAdminClient()
}

export async function saveSermonRecord(
  planId: string,
  title: string,
  storagePath: string,
  publicUrl: string,
): Promise<{ ok: true; sermon: { id: string; title: string; url: string; storage_path: string; created_at: string } } | { ok: false; error: string }> {
  const admin = await requireEditor()

  const { data: inserted, error: dbError } = await admin
    .from('plan_sermons')
    .insert({ plan_id: planId, title: title || 'Prédication', storage_path: storagePath, url: publicUrl })
    .select('id, title, url, storage_path, created_at')
    .single()
  if (dbError) return { ok: false, error: dbError.message }

  revalidatePath(`/espace/admin/plans/${planId}`)
  return { ok: true, sermon: inserted as { id: string; title: string; url: string; storage_path: string; created_at: string } }
}

export async function deleteSermon(id: string, planId: string, storagePath: string) {
  const admin = await requireEditor()
  await Promise.all([
    admin.storage.from('media').remove([storagePath]),
    admin.from('plan_sermons').delete().eq('id', id),
  ])
  revalidatePath(`/espace/admin/plans/${planId}`)
}
