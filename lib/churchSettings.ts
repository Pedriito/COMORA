import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { ChurchBranding } from '@/lib/brand/theme'

export type ChurchSettings = {
  church_name: string
  tagline: string
  address_street: string
  address_city: string
  address_zip: string
  address_dept: string
  email: string
  youtube_url: string
  maps_url: string
  pastors_names: string
  pastors_photo_url: string
  youtube_channel_id: string | null
}

export type ChurchSchedule = {
  id: string
  sort_order: number
  day_of_week: string
  event_name: string
  start_time: string
  end_time: string | null
  subtitle: string | null
  active: boolean
}

/** Réglages neutres d'une église qui n'a encore rien renseigné. */
export function emptyChurchSettings(churchName = ''): ChurchSettings {
  return {
    church_name: churchName,
    tagline: '',
    address_street: '',
    address_city: '',
    address_zip: '',
    address_dept: '',
    email: '',
    youtube_url: '',
    maps_url: '',
    pastors_names: '',
    pastors_photo_url: '',
    youtube_channel_id: null,
  }
}

export type Church = { id: string; name: string; slug: string; branding?: ChurchBranding | null }

/** Église publiée sous ce slug, ou null. */
export const getChurchBySlug = cache(async (slug: string): Promise<Church | null> => {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('churches')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
    return data ?? null
  } catch {
    return null
  }
})

export const getChurchSettings = cache(async (churchId: string, churchName = ''): Promise<ChurchSettings> => {
  const fallback = emptyChurchSettings(churchName)
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('church_settings')
      .select('*')
      .eq('church_id', churchId)
      .maybeSingle()
    return data ? { ...fallback, ...data } : fallback
  } catch {
    return fallback
  }
})

export const getChurchSchedules = cache(async (churchId: string): Promise<ChurchSchedule[]> => {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('church_schedules')
      .select('*')
      .eq('church_id', churchId)
      .eq('active', true)
      .order('sort_order')
    return data ?? []
  } catch {
    return []
  }
})
