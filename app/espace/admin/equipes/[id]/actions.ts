'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'

async function requireAdminOrLeader(teamId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')
  const { data: profile } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  if (['admin', 'super_admin'].includes(profile?.permission ?? '')) return createAdminClient()
  if (profile?.permission === 'editor') {
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('team_id', teamId)
      .single()
    if (membership?.role === 'leader') return createAdminClient()
  }
  redirect('/espace/dashboard')
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')
  const { data: profile } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.permission ?? '')) redirect('/espace/dashboard')
  return createAdminClient()
}

export async function addTeamMember(_prevState: { error?: string } | null, formData: FormData) {
  const teamId = formData.get('team_id') as string
  const admin = await requireAdminOrLeader(teamId)
  const userId = formData.get('user_id') as string
  const role = formData.get('role') as string
  const frequency = (formData.get('frequency') as string) || null

  const { error } = await admin
    .from('team_members')
    .upsert({ user_id: userId, team_id: teamId, role, frequency }, { onConflict: 'user_id,team_id' })
  if (error) return { error: error.message }

  revalidatePath(`/espace/admin/equipes/${teamId}`)
  revalidateTag('team-members', 'max')
  return null
}

export async function removeTeamMember(formData: FormData) {
  const teamId = formData.get('team_id') as string
  const admin = await requireAdminOrLeader(teamId)
  const userId = formData.get('user_id') as string

  await admin.from('team_members').delete().eq('user_id', userId).eq('team_id', teamId)

  const { data: positions } = await admin.from('positions').select('id').eq('team_id', teamId)
  if (positions?.length) {
    await admin.from('member_positions').delete().eq('user_id', userId).in('position_id', positions.map(p => p.id))
    revalidateTag('member-positions', 'max')
  }
  revalidatePath(`/espace/admin/equipes/${teamId}`)
  revalidateTag('team-members', 'max')
}

export async function updateMemberRole(formData: FormData) {
  const teamId = formData.get('team_id') as string
  const admin = await requireAdmin()
  const userId = formData.get('user_id') as string
  const role = formData.get('role') as string

  await admin
    .from('team_members')
    .update({ role })
    .eq('user_id', userId)
    .eq('team_id', teamId)

  revalidatePath(`/espace/admin/equipes/${teamId}`)
}

export async function toggleMemberPosition(formData: FormData) {
  const teamId = formData.get('team_id') as string
  const admin = await requireAdminOrLeader(teamId)
  const userId = formData.get('user_id') as string
  const positionId = formData.get('position_id') as string
  const action = formData.get('action') as string

  if (action === 'add') {
    await admin.from('member_positions').upsert({ user_id: userId, position_id: positionId })
  } else {
    await admin.from('member_positions').delete().eq('user_id', userId).eq('position_id', positionId)
  }
  revalidatePath(`/espace/admin/equipes/${teamId}`)
  revalidateTag('member-positions', 'max')
}
