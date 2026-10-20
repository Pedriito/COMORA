'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')
  const { data: profile } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  if (!['admin', 'editor', 'super_admin'].includes(profile?.permission ?? '')) redirect('/espace/dashboard')
  return createAdminClient()
}

export async function createSong(formData: FormData) {
  const admin = await requireAdmin()

  const title      = (formData.get('title') as string).trim()
  const chartKey   = (formData.get('chord_chart_key') as string).trim() || null
  const chart      = (formData.get('chord_chart') as string).trim() || null
  const arrName    = (formData.get('arrangement_name') as string).trim() || 'Principal'
  const youtubeUrl = (formData.get('youtube_url') as string)?.trim() || null
  const audioUrl   = (formData.get('audio_url') as string)?.trim() || null

  if (!title) redirect('/espace/admin/chants/nouveau?error=titre_manquant')

  // 1. Créer le chant
  const { data: song, error: songErr } = await admin
    .from('songs')
    .insert({ title })
    .select('id')
    .single()

  if (songErr || !song) redirect(`/espace/admin/chants/nouveau?error=${encodeURIComponent(songErr?.message ?? 'erreur')}`)

  // 2. Créer l'arrangement
  await admin.from('arrangements').insert({
    song_id:         song.id,
    name:            arrName,
    chord_chart:     chart,
    chord_chart_key: chartKey,
    youtube_url:     youtubeUrl,
    audio_url:       audioUrl,
  })

  revalidatePath('/espace/admin/chants')
  revalidatePath('/espace/chants')
  revalidateTag('songs', 'max')
  redirect(`/espace/admin/chants/${song.id}/modifier?created=1`)
}

export async function updateSong(formData: FormData) {
  const admin = await requireAdmin()

  const songId        = parseInt(formData.get('song_id') as string, 10)
  const arrangementId = formData.get('arrangement_id') as string
  const title         = (formData.get('title') as string).trim()
  const chartKey      = (formData.get('chord_chart_key') as string).trim() || null
  const chart         = (formData.get('chord_chart') as string).trim() || null
  const arrName       = (formData.get('arrangement_name') as string).trim() || 'Principal'
  const youtubeUrl    = (formData.get('youtube_url') as string)?.trim() || null
  const audioUrl      = (formData.get('audio_url') as string)?.trim() || null

  if (!title) redirect(`/espace/admin/chants/${songId}/modifier?error=titre_manquant`)

  await Promise.all([
    admin.from('songs').update({ title }).eq('id', songId),
    admin.from('arrangements').update({
      name:            arrName,
      chord_chart:     chart,
      chord_chart_key: chartKey,
      youtube_url:     youtubeUrl,
      audio_url:       audioUrl,
    }).eq('id', arrangementId),
  ])

  revalidatePath('/espace/admin/chants')
  revalidatePath('/espace/chants')
  revalidatePath(`/espace/chants/${songId}`)
  revalidateTag('songs', 'max')
  redirect(`/espace/admin/chants/${songId}/modifier?saved=1`)
}

export async function deleteSong(formData: FormData) {
  const admin = await requireAdmin()
  const songId = parseInt(formData.get('song_id') as string, 10)

  // Les arrangements sont supprimés en cascade (FK)
  await admin.from('songs').delete().eq('id', songId)

  revalidatePath('/espace/admin/chants')
  revalidatePath('/espace/chants')
  revalidateTag('songs', 'max')
  redirect('/espace/admin/chants?deleted=1')
}
