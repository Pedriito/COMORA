'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { ProjectionSettings } from '@/lib/projectionSettings'
import { SETTINGS_ID } from '@/lib/projectionSettings'

async function requireEditorOrAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')
  const { data: profile } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  if (!['admin', 'editor', 'super_admin'].includes(profile?.permission ?? '')) redirect('/espace/dashboard')
  return supabase
}

export async function saveProjectionSettings(
  s: Omit<ProjectionSettings, 'id'>
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await requireEditorOrAdmin()
  const { error } = await supabase
    .from('projection_settings')
    .upsert({
      id: SETTINGS_ID,
      // fond chants
      bg_type:             s.bg_type,
      bg_color:            s.bg_color,
      bg_gradient:         s.bg_gradient,
      bg_image_url:        s.bg_image_url,
      bg_blur:             s.bg_blur,
      overlay_opacity:     s.overlay_opacity,
      // texte chants
      font_family:         s.font_family,
      text_color:          s.text_color,
      text_shadow:         s.text_shadow,
      text_transform:      s.text_transform,
      font_size_scale:     s.font_size_scale,
      text_max_width:      s.text_max_width,
      // fond annonces
      ann_bg_type:             s.ann_bg_type,
      ann_bg_color:            s.ann_bg_color,
      ann_bg_gradient:         s.ann_bg_gradient,
      ann_bg_image_url:        s.ann_bg_image_url,
      ann_bg_blur:             s.ann_bg_blur,
      ann_bg_overlay_opacity:  s.ann_bg_overlay_opacity,
      // texte annonces
      ann_font_family:             s.ann_font_family,
      ann_text_color:              s.ann_text_color,
      ann_text_shadow:             s.ann_text_shadow,
      ann_text_transform:          s.ann_text_transform,
      ann_title_font_size_scale:   s.ann_title_font_size_scale,
      ann_font_size_scale:         s.ann_font_size_scale,
      ann_text_max_width:          s.ann_text_max_width,
      updated_at: new Date().toISOString(),
    })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/espace/admin/parametres/projection')
  return { ok: true }
}
