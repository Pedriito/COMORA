'use server'

import { churchOrNull } from '@/lib/auth/church'
import { revalidatePath } from 'next/cache'
import { mergeSettings, type ProjectionSettings } from '@/lib/projectionSettings'

export async function saveProjectionSettings(
  input: ProjectionSettings
): Promise<{ ok: boolean; error?: string; settings?: ProjectionSettings }> {
  const ctx = await churchOrNull('responsable')
  if (!ctx) return { ok: false, error: 'Action réservée aux responsables.' }

  // Valeurs revalidées une à une (listes fermées, bornes, couleurs, URL)
  const settings = mergeSettings(input)
  const { error } = await ctx.supabase
    .from('projection_settings')
    .upsert(
      { ...settings, church_id: ctx.church.churchId, updated_at: new Date().toISOString() },
      { onConflict: 'church_id' },
    )
  if (error) return { ok: false, error: error.message }
  revalidatePath('/espace/admin/parametres/projection')
  return { ok: true, settings }
}
