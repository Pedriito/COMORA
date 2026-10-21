import { requireChurch } from '@/lib/auth/church'
import { NouveauPlanForm } from '../NouveauPlanForm'

export default async function NouveauPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const ctx = await requireChurch('responsable')

  const { data: teams } = await ctx.supabase
    .from('teams')
    .select('id, name')
    .eq('church_id', ctx.church.churchId)
    .order('name')
  const params = await searchParams

  return <NouveauPlanForm teams={teams ?? []} error={params.error} />
}
