'use server'

import { requireChurch } from '@/lib/auth/church'
import { revalidatePath } from 'next/cache'
import { PUBLIC_BUCKET, churchFilePath, extensionFor, isChurchPath } from '@/lib/storage'

async function requireAdmin() {
  const ctx = await requireChurch('admin')
  return { db: ctx.supabase, church_id: ctx.church.churchId }
}

const clean = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim()

/** Racine du dossier public d'une église pour reconnaître ses propres fichiers dans une URL. */
function storagePathFromUrl(url: string): string | null {
  const marker = `/object/public/${PUBLIC_BUCKET}/`
  const i = url.indexOf(marker)
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length))
}

export async function saveChurchSettings(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const { db, church_id } = await requireAdmin()

  const name = clean(formData, 'church_name')
  if (!name || name.length > 160) return { ok: false, error: 'Le nom de l’église est obligatoire (160 caractères au maximum).' }

  // Photo des pasteurs : image vérifiée, nom aléatoire dans le dossier « site » de l'église
  let pastors_photo_url = clean(formData, 'pastors_photo_url')
  const photoFile = formData.get('pastors_photo_file')
  if (photoFile instanceof File && photoFile.size > 0) {
    const ext = extensionFor('image', photoFile.type)
    if (!ext) return { ok: false, error: 'Format d’image non accepté (JPEG, PNG, WebP, GIF ou AVIF).' }
    if (photoFile.size > 5 * 1024 * 1024) return { ok: false, error: 'L’image est trop lourde (5 Mo au maximum).' }

    const path = churchFilePath(church_id, 'site', ext)
    const { error: storageError } = await db.storage
      .from(PUBLIC_BUCKET)
      .upload(path, Buffer.from(await photoFile.arrayBuffer()), { contentType: photoFile.type })
    if (storageError) return { ok: false, error: 'La photo n’a pas pu être envoyée. Réessaie.' }

    // Ancienne photo supprimée seulement si elle est bien dans le dossier de cette église
    const previous = storagePathFromUrl(pastors_photo_url)
    if (previous && isChurchPath(church_id, previous)) await db.storage.from(PUBLIC_BUCKET).remove([previous])
    pastors_photo_url = db.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl
  }

  const { error: nameError } = await db.from('churches').update({ name }).eq('id', church_id)
  if (nameError) return { ok: false, error: 'Les modifications n’ont pas pu être enregistrées. Réessaie.' }

  const { error } = await db.from('church_settings').upsert({
    church_id,
    tagline:              clean(formData, 'tagline'),
    address_street:       clean(formData, 'address_street'),
    address_city:         clean(formData, 'address_city'),
    address_zip:          clean(formData, 'address_zip'),
    address_dept:         clean(formData, 'address_dept'),
    email:                clean(formData, 'email').toLowerCase(),
    youtube_url:          clean(formData, 'youtube_url'),
    youtube_channel_id:   clean(formData, 'youtube_channel_id') || null,
    maps_url:             clean(formData, 'maps_url'),
    pastors_names:        clean(formData, 'pastors_names'),
    pastors_photo_url,
    updated_at:           new Date().toISOString(),
  }, { onConflict: 'church_id' })

  if (error) return { ok: false, error: 'Les modifications n’ont pas pu être enregistrées. Réessaie.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function saveSchedule(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const { db, church_id } = await requireAdmin()
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
    ? await db.from('church_schedules').update(payload).eq('id', id).eq('church_id', church_id)
    : await db.from('church_schedules').insert(payload)

  if (error) return { ok: false, error: 'Le créneau n’a pas pu être enregistré. Réessaie.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function deleteSchedule(id: string): Promise<void> {
  const { db, church_id } = await requireAdmin()
  await db.from('church_schedules').delete().eq('id', id).eq('church_id', church_id)
  revalidatePath('/', 'layout')
}

export async function reorderSchedules(ids: string[]): Promise<void> {
  const { db, church_id } = await requireAdmin()
  await Promise.all(ids.map((id, i) =>
    db.from('church_schedules').update({ sort_order: i + 1 }).eq('id', id).eq('church_id', church_id)
  ))
  revalidatePath('/', 'layout')
}
