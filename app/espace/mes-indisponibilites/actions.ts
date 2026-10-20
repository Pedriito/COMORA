'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function addBlockout(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const startDate = formData.get('start_date') as string
  const endDate   = formData.get('end_date') as string || startDate
  const reason    = (formData.get('reason') as string) || null

  if (endDate < startDate) {
    redirect('/espace/mes-indisponibilites?error=dates')
  }

  const { error } = await supabase.from('blockout_dates').insert({
    user_id: user.id,
    start_date: startDate,
    end_date: endDate,
    reason,
  })

  if (error) {
    redirect('/espace/mes-indisponibilites?error=insert')
  }

  redirect('/espace/mes-indisponibilites?success=added')
}

export async function removeBlockout(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const id = formData.get('id') as string
  await supabase.from('blockout_dates').delete().eq('id', id).eq('user_id', user.id)
  redirect('/espace/mes-indisponibilites')
}
