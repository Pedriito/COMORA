import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NouveauPlanForm } from '../NouveauPlanForm'

export default async function NouveauPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const { data: me } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  if (!['admin', 'editor', 'super_admin'].includes(me?.permission ?? '')) redirect('/espace/dashboard')

  const { data: teams } = await supabase.from('teams').select('id, name').order('name')
  const params = await searchParams

  return <NouveauPlanForm teams={teams ?? []} error={params.error} />
}
