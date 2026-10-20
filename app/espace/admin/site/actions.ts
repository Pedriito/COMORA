'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')
  const { data: me } = await supabase
    .from('profiles')
    .select('permission, church_id')
    .eq('id', user.id)
    .single()
  if (!me || !['admin', 'super_admin'].includes(me.permission ?? '')) redirect('/espace/dashboard')
  const church_id = me.church_id as string
  return { admin: createAdminClient(), church_id }
}

export async function saveChurchSettings(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const { admin, church_id } = await requireAdmin()

  // Upload photo des pasteurs si un fichier est fourni
  let pastors_photo_url = (formData.get('pastors_photo_url') as string) || ''
  const photoFile = formData.get('pastors_photo_file') as File | null
  if (photoFile && photoFile.size > 0) {
    const ext = photoFile.name.split('.').pop() ?? 'jpg'
    const path = `site/${church_id}/pastors-${Date.now()}.${ext}`
    const buffer = Buffer.from(await photoFile.arrayBuffer())
    const { error: storageError } = await admin.storage
      .from('media')
      .upload(path, buffer, { contentType: photoFile.type, upsert: true })
    if (!storageError) {
      const { data: urlData } = admin.storage.from('media').getPublicUrl(path)
      pastors_photo_url = urlData.publicUrl
    }
  }

  const { error } = await admin.from('church_settings').upsert({
    church_id,
    church_name:          (formData.get('church_name') as string)?.trim(),
    tagline:              (formData.get('tagline') as string)?.trim(),
    address_street:       (formData.get('address_street') as string)?.trim(),
    address_city:         (formData.get('address_city') as string)?.trim(),
    address_zip:          (formData.get('address_zip') as string)?.trim(),
    address_dept:         (formData.get('address_dept') as string)?.trim(),
    email:                (formData.get('email') as string)?.trim().toLowerCase(),
    youtube_url:          (formData.get('youtube_url') as string)?.trim(),
    youtube_channel_id:   (formData.get('youtube_channel_id') as string)?.trim() || null,
    maps_url:             (formData.get('maps_url') as string)?.trim(),
    pastors_names:        (formData.get('pastors_names') as string)?.trim(),
    pastors_photo_url,
    updated_at:           new Date().toISOString(),
  }, { onConflict: 'church_id' })

  if (error) return { ok: false, error: error.message }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function saveSchedule(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const { admin, church_id } = await requireAdmin()
  const id = formData.get('id') as string | null

  const payload = {
    church_id,
    sort_order:   Number(formData.get('sort_order') || 0),
    day_of_week:  (formData.get('day_of_week') as string)?.trim(),
    event_name:   (formData.get('event_name') as string)?.trim(),
    start_time:   (formData.get('start_time') as string)?.trim(),
    end_time:     (formData.get('end_time') as string)?.trim() || null,
    subtitle:     (formData.get('subtitle') as string)?.trim() || null,
  }

  const { error } = id
    ? await admin.from('church_schedules').update(payload).eq('id', id).eq('church_id', church_id)
    : await admin.from('church_schedules').insert(payload)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function deleteSchedule(id: string): Promise<void> {
  const { admin, church_id } = await requireAdmin()
  await admin.from('church_schedules').delete().eq('id', id).eq('church_id', church_id)
  revalidatePath('/', 'layout')
}

export async function reorderSchedules(ids: string[]): Promise<void> {
  const { admin, church_id } = await requireAdmin()
  await Promise.all(ids.map((id, i) =>
    admin.from('church_schedules').update({ sort_order: i + 1 }).eq('id', id).eq('church_id', church_id)
  ))
  revalidatePath('/', 'layout')
}
