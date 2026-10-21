'use server'

import { revalidatePath } from 'next/cache'
import { churchOrNull } from '@/lib/auth/church'
import { PRIVATE_BUCKET, churchFilePath, extensionFor, isChurchPath } from '@/lib/storage'
import { signedSermonUrl } from '../sermonUrls'

export type SermonItem = { id: string; title: string; url: string; storage_path: string; created_at: string }

/** Chemin d'un nouveau PDF, choisi par le serveur (dossier de l'église, nom aléatoire).
 *  Le navigateur dépose le fichier à ce chemin : les policies de stockage vérifient le rôle. */
export async function prepareSermonUpload(mimeType: string): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const ctx = await churchOrNull('responsable')
  if (!ctx) return { ok: false, error: 'Accès refusé.' }
  const ext = extensionFor('document', mimeType)
  if (!ext) return { ok: false, error: 'Seuls les fichiers PDF sont acceptés.' }
  return { ok: true, path: churchFilePath(ctx.church.churchId, 'sermons', ext) }
}

export async function saveSermonRecord(
  planId: string,
  title: string,
  storagePath: string,
): Promise<{ ok: true; sermon: SermonItem } | { ok: false; error: string }> {
  const ctx = await churchOrNull('responsable')
  if (!ctx) return { ok: false, error: 'Accès refusé.' }
  const churchId = ctx.church.churchId
  if (!isChurchPath(churchId, storagePath) || !storagePath.endsWith('.pdf')) return { ok: false, error: 'Fichier invalide.' }

  const { data: inserted, error: dbError } = await ctx.supabase
    .from('plan_sermons')
    // `url` est obligatoire en base : l'adresse affichée est une URL signée générée au rendu
    .insert({ church_id: churchId, plan_id: planId, title: title.trim().slice(0, 160) || 'Prédication', storage_path: storagePath, url: '' })
    .select('id, title, storage_path, created_at')
    .single()
  if (dbError || !inserted) return { ok: false, error: dbError?.message ?? 'Erreur.' }

  const url = (await signedSermonUrl(ctx.supabase, churchId, storagePath)) ?? ''
  revalidatePath(`/espace/admin/plans/${planId}`)
  return { ok: true, sermon: { id: inserted.id, title: inserted.title, storage_path: storagePath, created_at: inserted.created_at, url } }
}

export async function deleteSermon(id: string, planId: string) {
  const ctx = await churchOrNull('responsable')
  if (!ctx) return
  const churchId = ctx.church.churchId
  // Le chemin vient de la base (église courante), jamais du navigateur
  const { data: sermon } = await ctx.supabase
    .from('plan_sermons')
    .select('storage_path')
    .eq('id', id)
    .eq('church_id', churchId)
    .maybeSingle()
  if (!sermon) return
  if (sermon.storage_path && isChurchPath(churchId, sermon.storage_path)) {
    await ctx.supabase.storage.from(PRIVATE_BUCKET).remove([sermon.storage_path])
  }
  await ctx.supabase.from('plan_sermons').delete().eq('id', id).eq('church_id', churchId)
  revalidatePath(`/espace/admin/plans/${planId}`)
}
