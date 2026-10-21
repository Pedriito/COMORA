'use server'

import { churchOrNull } from '@/lib/auth/church'
import { revalidatePath } from 'next/cache'
import { PUBLIC_BUCKET, churchFilePath, extensionFor, isChurchPath } from '@/lib/storage'

export type MediaFile = { id: string; name: string; url: string; created_at: string }

const MAX_NAME = 160

/** Étape 1 du téléversement : chemin cloisonné par église, type d'image vérifié. */
export async function prepareMediaUpload(mimeType: string): Promise<{ path: string; bucket: string } | { error: string }> {
  const ctx = await churchOrNull('responsable')
  if (!ctx) return { error: 'Action réservée aux responsables.' }
  const ext = extensionFor('image', mimeType)
  if (!ext) return { error: 'Seules les images (JPEG, PNG, WebP, GIF, AVIF) sont acceptées.' }
  return { path: churchFilePath(ctx.church.churchId, 'mediatheque', ext), bucket: PUBLIC_BUCKET }
}

/** Étape 2 : enregistre le fichier téléversé (le chemin doit être dans le dossier de l'église). */
export async function registerMediaFile(path: string, name: string): Promise<MediaFile | { error: string }> {
  const ctx = await churchOrNull('responsable')
  if (!ctx) return { error: 'Action réservée aux responsables.' }
  if (typeof path !== 'string' || !isChurchPath(ctx.church.churchId, path)) return { error: 'Chemin de fichier invalide.' }

  const { data: urlData } = ctx.supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path)
  const { data, error } = await ctx.supabase
    .from('media_files')
    .insert({
      church_id: ctx.church.churchId,
      name: String(name ?? '').trim().slice(0, MAX_NAME) || 'Image',
      type: 'image',
      storage_path: path,
      url: urlData.publicUrl,
    })
    .select('id, name, url, created_at')
    .single()
  if (error || !data) return { error: error?.message ?? 'Erreur en base.' }
  revalidatePath('/espace/admin/mediatheque')
  return data
}

export async function deleteMediaFile(id: string): Promise<void> {
  const ctx = await churchOrNull('responsable')
  if (!ctx) return
  // Chemin relu en base (jamais celui du navigateur)
  const { data: file } = await ctx.supabase
    .from('media_files')
    .select('id, storage_path')
    .eq('id', id)
    .eq('church_id', ctx.church.churchId)
    .maybeSingle()
  if (!file) return

  if (file.storage_path && isChurchPath(ctx.church.churchId, file.storage_path)) {
    await ctx.supabase.storage.from(PUBLIC_BUCKET).remove([file.storage_path])
  }
  await ctx.supabase.from('media_files').delete().eq('id', id).eq('church_id', ctx.church.churchId)
  revalidatePath('/espace/admin/mediatheque')
}

// ── Unsplash ────────────────────────────────────────────────────────────────

export type UnsplashPhoto = {
  id: string
  description: string | null
  alt_description: string | null
  urls: { small: string; regular: string }
  user: { name: string }
}

const UNSPLASH_ID = /^[A-Za-z0-9_-]{6,32}$/

export async function searchUnsplash(query: string): Promise<UnsplashPhoto[]> {
  const ctx = await churchOrNull('responsable')
  if (!ctx) throw new Error('Action réservée aux responsables.')
  const q = String(query ?? '').trim().slice(0, 100)
  if (!q) return []

  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) throw new Error('UNSPLASH_ACCESS_KEY non définie dans .env.local')

  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=24&orientation=landscape`,
    { headers: { Authorization: `Client-ID ${key}` }, next: { revalidate: 60 } }
  )
  if (!res.ok) throw new Error(`Erreur Unsplash : ${res.status}`)
  const data = await res.json()
  // Seuls les champs d'affichage sont renvoyés au navigateur
  return (data.results as UnsplashPhoto[]).map(p => ({
    id: p.id,
    description: p.description,
    alt_description: p.alt_description,
    urls: { small: p.urls.small, regular: p.urls.regular },
    user: { name: p.user.name },
  }))
}

/** Importe une photo à partir de son seul identifiant : elle est relue côté serveur. */
export async function importUnsplashPhoto(photoId: string): Promise<MediaFile> {
  const ctx = await churchOrNull('responsable')
  if (!ctx) throw new Error('Action réservée aux responsables.')
  if (typeof photoId !== 'string' || !UNSPLASH_ID.test(photoId)) throw new Error('Photo invalide.')
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) throw new Error('UNSPLASH_ACCESS_KEY non définie dans .env.local')

  const infoRes = await fetch(`https://api.unsplash.com/photos/${photoId}`, {
    headers: { Authorization: `Client-ID ${key}` },
  })
  if (!infoRes.ok) throw new Error('Photo Unsplash introuvable.')
  const photo = await infoRes.json() as {
    description: string | null
    alt_description: string | null
    urls: { regular: string }
    user: { name: string }
    links: { download_location: string }
  }

  // Seule l'URL d'images Unsplash renvoyée par l'API est téléchargée
  let imageUrl: URL
  try { imageUrl = new URL(photo.urls.regular) } catch { throw new Error('Image Unsplash invalide.') }
  if (imageUrl.protocol !== 'https:' || imageUrl.hostname !== 'images.unsplash.com') {
    throw new Error('Image Unsplash invalide.')
  }

  // Notifier Unsplash du téléchargement (obligatoire selon leurs conditions d'utilisation)
  try {
    const dl = new URL(photo.links.download_location)
    if (dl.protocol === 'https:' && dl.hostname === 'api.unsplash.com') {
      await fetch(dl, { headers: { Authorization: `Client-ID ${key}` } }).catch(() => {})
    }
  } catch { /* ignoré */ }

  const imageRes = await fetch(imageUrl)
  if (!imageRes.ok) throw new Error('Impossible de télécharger l\'image Unsplash')
  const type = (imageRes.headers.get('content-type') ?? '').split(';')[0].trim()
  const ext = extensionFor('image', type)
  if (!ext) throw new Error('Type d\'image non pris en charge.')
  const buffer = await imageRes.arrayBuffer()
  if (buffer.byteLength > 5 * 1024 * 1024) throw new Error('Image trop volumineuse.')

  const path = churchFilePath(ctx.church.churchId, 'mediatheque', ext)
  const { error: storageError } = await ctx.supabase.storage
    .from(PUBLIC_BUCKET)
    .upload(path, Buffer.from(buffer), { contentType: type })
  if (storageError) throw new Error(storageError.message)

  const { data: urlData } = ctx.supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path)
  const label = photo.description ?? photo.alt_description ?? 'Photo'
  // Crédit du photographe conservé dans le nom du fichier
  const name = `${label} — ${photo.user.name} / Unsplash`.slice(0, MAX_NAME)

  const { data: inserted, error: dbError } = await ctx.supabase
    .from('media_files')
    .insert({ church_id: ctx.church.churchId, name, type: 'image', storage_path: path, url: urlData.publicUrl })
    .select('id, name, url, created_at')
    .single()
  if (dbError || !inserted) throw new Error(dbError?.message ?? 'Erreur en base.')

  revalidatePath('/espace/admin/mediatheque')
  return inserted
}
