import { cache } from 'react'
import { createAnonClient } from '@/lib/supabase/anon'
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

/** Réglages d'une ligne `church_settings` (ou de la partie « settings » du site public), nom de l'église en plus. */
export function toChurchSettings(
  row: Partial<Omit<ChurchSettings, 'church_name'>> | null | undefined,
  churchName: string,
): ChurchSettings {
  const base = emptyChurchSettings(churchName)
  if (!row) return base
  return {
    ...base,
    tagline: row.tagline ?? '',
    address_street: row.address_street ?? '',
    address_city: row.address_city ?? '',
    address_zip: row.address_zip ?? '',
    address_dept: row.address_dept ?? '',
    email: row.email ?? '',
    youtube_url: row.youtube_url ?? '',
    maps_url: row.maps_url ?? '',
    pastors_names: row.pastors_names ?? '',
    pastors_photo_url: row.pastors_photo_url ?? '',
    youtube_channel_id: row.youtube_channel_id ?? null,
  }
}

export type PublicChurchSite = { church: Church; settings: ChurchSettings; schedules: ChurchSchedule[] }

/**
 * Site public d'une église, par la fonction `public_church_site` : seule porte
 * d'entrée du rôle anonyme (aucune lecture directe des tables). Null si le slug est inconnu.
 */
export const getPublicChurchSite = cache(async (slug: string): Promise<PublicChurchSite | null> => {
  try {
    const supabase = createAnonClient()
    if (!supabase) return null
    const { data } = await supabase.rpc('public_church_site', { target_slug: slug })
    const site = data as {
      church?: Church
      settings?: Partial<Omit<ChurchSettings, 'church_name'>> | null
      schedules?: ChurchSchedule[] | null
    } | null
    if (!site?.church) return null
    return {
      church: site.church,
      settings: toChurchSettings(site.settings, site.church.name),
      schedules: site.schedules ?? [],
    }
  } catch {
    return null
  }
})
