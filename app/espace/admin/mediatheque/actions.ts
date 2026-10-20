'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function requireEditorOrAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')
  const { data: profile } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  if (!['admin', 'editor', 'super_admin'].includes(profile?.permission ?? '')) redirect('/espace/dashboard')
  return createAdminClient()
}

export async function deleteMediaFile(id: string, storagePath: string): Promise<void> {
  const admin = await requireEditorOrAdmin()
  await Promise.all([
    admin.storage.from('media').remove([storagePath]),
    admin.from('media_files').delete().eq('id', id),
  ])
  revalidatePath('/espace/admin/mediatheque')
}

// ── Unsplash ────────────────────────────────────────────────────────────────

export type UnsplashPhoto = {
  id: string
  description: string | null
  alt_description: string | null
  urls: { small: string; regular: string }
  user: { name: string }
  links: { download_location: string }
}

export async function searchUnsplash(query: string): Promise<UnsplashPhoto[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) throw new Error('UNSPLASH_ACCESS_KEY non définie dans .env.local')

  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=24&orientation=landscape`,
    { headers: { Authorization: `Client-ID ${key}` }, next: { revalidate: 60 } }
  )
  if (!res.ok) throw new Error(`Erreur Unsplash : ${res.status}`)
  const data = await res.json()
  return data.results as UnsplashPhoto[]
}

export type MediaFile = { id: string; name: string; url: string; created_at: string }

export async function importUnsplashPhoto(photo: UnsplashPhoto): Promise<MediaFile> {
  const admin = await requireEditorOrAdmin()
  const key = process.env.UNSPLASH_ACCESS_KEY!

  // Notifier Unsplash du téléchargement (obligatoire selon leurs conditions d'utilisation)
  await fetch(`${photo.links.download_location}&client_id=${key}`).catch(() => {})

  // Télécharger l'image
  const imageRes = await fetch(photo.urls.regular)
  if (!imageRes.ok) throw new Error('Impossible de télécharger l\'image Unsplash')
  const buffer = await imageRes.arrayBuffer()

  // Uploader dans Supabase Storage
  const fileName = `unsplash-${photo.id}.jpg`
  const path = `${Date.now()}-${fileName}`

  const { error: storageError } = await admin.storage
    .from('media')
    .upload(path, Buffer.from(buffer), { contentType: 'image/jpeg' })

  if (storageError) throw new Error(storageError.message)

  const { data: urlData } = admin.storage.from('media').getPublicUrl(path)

  const label = photo.description ?? photo.alt_description ?? `Photo par ${photo.user.name}`

  const { data: inserted, error: dbError } = await admin
    .from('media_files')
    .insert({ name: label, type: 'image', storage_path: path, url: urlData.publicUrl })
    .select('id, name, url, created_at')
    .single()

  if (dbError) throw new Error(dbError.message)

  revalidatePath('/espace/admin/mediatheque')
  return inserted as MediaFile
}
