'use server'

import { requireChurch } from '@/lib/auth/church'
import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'

export async function createSong(formData: FormData) {
  const { supabase, church } = await requireChurch('responsable')

  const title      = (formData.get('title') as string).trim()
  const chartKey   = (formData.get('chord_chart_key') as string).trim() || null
  const chart      = (formData.get('chord_chart') as string).trim() || null
  const arrName    = (formData.get('arrangement_name') as string).trim() || 'Principal'
  const youtubeUrl = (formData.get('youtube_url') as string)?.trim() || null
  const audioUrl   = (formData.get('audio_url') as string)?.trim() || null

  if (!title) redirect('/espace/admin/chants/nouveau?error=titre_manquant')

  // 1. Créer le chant
  const { data: song, error: songErr } = await supabase
    .from('songs')
    .insert({ church_id: church.churchId, title })
    .select('id')
    .single()

  if (songErr || !song) redirect(`/espace/admin/chants/nouveau?error=${encodeURIComponent(songErr?.message ?? 'erreur')}`)

  // 2. Créer l'arrangement
  await supabase.from('arrangements').insert({
    church_id:       church.churchId,
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
  const { supabase, church } = await requireChurch('responsable')

  const songId        = formData.get('song_id') as string
  const arrangementId = formData.get('arrangement_id') as string
  const title         = (formData.get('title') as string).trim()
  const chartKey      = (formData.get('chord_chart_key') as string).trim() || null
  const chart         = (formData.get('chord_chart') as string).trim() || null
  const arrName       = (formData.get('arrangement_name') as string).trim() || 'Principal'
  const youtubeUrl    = (formData.get('youtube_url') as string)?.trim() || null
  const audioUrl      = (formData.get('audio_url') as string)?.trim() || null

  if (!songId) redirect('/espace/admin/chants')
  if (!title) redirect(`/espace/admin/chants/${songId}/modifier?error=titre_manquant`)

  await Promise.all([
    supabase.from('songs').update({ title }).eq('id', songId).eq('church_id', church.churchId),
    arrangementId
      ? supabase.from('arrangements').update({
          name:            arrName,
          chord_chart:     chart,
          chord_chart_key: chartKey,
          youtube_url:     youtubeUrl,
          audio_url:       audioUrl,
        }).eq('id', arrangementId).eq('song_id', songId).eq('church_id', church.churchId)
      : Promise.resolve(),
  ])

  revalidatePath('/espace/admin/chants')
  revalidatePath('/espace/chants')
  revalidatePath(`/espace/chants/${songId}`)
  revalidateTag('songs', 'max')
  redirect(`/espace/admin/chants/${songId}/modifier?saved=1`)
}

export async function deleteSong(formData: FormData) {
  const { supabase, church } = await requireChurch('responsable')
  const songId = formData.get('song_id') as string
  if (!songId) redirect('/espace/admin/chants')

  // Les arrangements sont supprimés en cascade (FK)
  await supabase.from('songs').delete().eq('id', songId).eq('church_id', church.churchId)

  revalidatePath('/espace/admin/chants')
  revalidatePath('/espace/chants')
  revalidateTag('songs', 'max')
  redirect('/espace/admin/chants?deleted=1')
}
