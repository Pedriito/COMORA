'use server'

import { churchOrNull } from '@/lib/auth/church'
import { revalidatePath } from 'next/cache'
import type { SlideStyle } from '@/lib/slidePresets'

export async function saveArrangementSlideStyle(
  arrangementId: string,
  slideStyle: SlideStyle | null,
  planId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await churchOrNull('responsable')
  if (!ctx) return { ok: false, error: 'Action réservée aux responsables.' }

  const { error } = await ctx.supabase
    .from('arrangements')
    .update({ slide_style: slideStyle })
    .eq('id', arrangementId)
    .eq('church_id', ctx.church.churchId)

  if (error) return { ok: false, error: error.message }
  revalidatePath(`/espace/admin/plans/${planId}/setlist`)
  return { ok: true }
}
