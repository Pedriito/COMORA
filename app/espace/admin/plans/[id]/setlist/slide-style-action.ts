'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SlideStyle } from '@/lib/slidePresets'

export async function saveArrangementSlideStyle(
  arrangementId: string,
  slideStyle: SlideStyle | null,
  planId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié' }

  const { error } = await supabase
    .from('arrangements')
    .update({ slide_style: slideStyle })
    .eq('id', arrangementId)

  if (error) return { ok: false, error: error.message }
  revalidatePath(`/espace/admin/plans/${planId}/setlist`)
  return { ok: true }
}
