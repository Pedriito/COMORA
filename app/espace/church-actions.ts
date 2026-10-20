'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Change l'église ouverte dans l'espace. La base refuse une église dont le
 * compte n'est pas membre (trigger profiles_check_active_church).
 */
export async function setActiveChurch(formData: FormData) {
  const churchId = String(formData.get('church_id') ?? '')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const { error } = await supabase.from('profiles').update({ active_church_id: churchId }).eq('id', user.id)
  if (error) redirect('/espace/dashboard?erreur=eglise')

  revalidatePath('/espace', 'layout')
  redirect('/espace/dashboard')
}
