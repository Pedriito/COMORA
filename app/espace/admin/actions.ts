'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidateTag } from 'next/cache'
import { sendInviteEmail } from '@/lib/email/espace'
import { siteUrl as getSiteUrl } from '@/lib/site'

export async function inviteBenevole(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('permission')
    .eq('id', user.id)
    .single()

  if (!['admin', 'super_admin'].includes(profile?.permission ?? '')) redirect('/espace/dashboard')

  const firstName  = formData.get('first_name') as string
  const lastName   = formData.get('last_name') as string
  const email      = formData.get('email') as string
  const permission = formData.get('permission') as string
  const teamIds = formData.getAll('team_ids') as string[]

  const admin = createAdminClient()

  const siteUrl = getSiteUrl()

  // Crée l'utilisateur sans envoyer l'email Supabase (plan gratuit limité)
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: false,
    user_metadata: { first_name: firstName, last_name: lastName },
  })

  if (error) {
    redirect(`/espace/admin/inviter?error=${encodeURIComponent(error.message)}`)
  }

  const userId = data.user.id

  const { error: upsertError } = await admin
    .from('profiles')
    .upsert({ id: userId, permission, first_name: firstName, last_name: lastName, email, status: 'invited' })

  if (upsertError) {
    redirect(`/espace/admin/inviter?error=${encodeURIComponent(upsertError.message)}`)
  }

  revalidateTag('profiles', 'max')

  if (teamIds.length > 0) {
    await admin.from('team_members').insert(
      teamIds.map(teamId => ({
        user_id: userId,
        team_id: teamId,
        role: (formData.get(`role_${teamId}`) as string) || 'member',
        frequency: (formData.get(`frequency_${teamId}`) as string) || null,
      }))
    )
    revalidateTag('team-members', 'max')
  }

  // Génère un lien d'invitation et envoie via Resend
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${siteUrl}/espace/auth/confirm` },
  })

  if (linkError) {
    console.error('[inviteBenevole] generateLink error:', linkError.message, { email, userId })
  }

  if (linkData?.properties?.action_link) {
    console.log('[inviteBenevole] storing pending invite for', email, 'userId:', userId)
    const { data: invite, error: inviteError } = await admin
      .from('pending_invites')
      .insert({ action_link: linkData.properties.action_link, email, user_id: userId })
      .select('token')
      .single()

    if (inviteError || !invite) {
      console.error('[inviteBenevole] pending_invites insert error:', inviteError?.message)
    } else {
      const activateUrl = `${siteUrl}/espace/activer/${invite.token}`
      try {
        await sendInviteEmail({ to: email, firstName, inviteLink: activateUrl })
        console.log('[inviteBenevole] email sent OK to', email)
      } catch (err: any) {
        console.error('[inviteBenevole] Resend error:', err?.message, { email, userId })
      }
    }
  } else {
    console.error('[inviteBenevole] no action_link generated for', email)
  }

  redirect('/espace/admin?success=invited')
}

export async function resendInviteFromList(_: unknown, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié' }
  const { data: me } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(me?.permission ?? '')) return { ok: false, error: 'Accès refusé' }

  const targetId = formData.get('user_id') as string
  const admin = createAdminClient()
  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(targetId)
  const email = authUser?.user?.email
  console.log('[resendInviteFromList] targetId:', targetId, 'email:', email ?? 'INTROUVABLE', authErr?.message ?? '')
  if (!email) return { ok: false, error: 'Email introuvable' }

  const { data: profile } = await supabase.from('profiles').select('first_name').eq('id', targetId).single()
  const siteUrl = getSiteUrl()

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${siteUrl}/espace/auth/confirm` },
  })

  if (!linkData?.properties?.action_link) {
    console.error('[resendInviteFromList] generateLink failed:', linkErr?.message, { email, targetId })
    return { ok: false, error: 'Lien non généré' }
  }

  const { data: invite, error: inviteError } = await admin
    .from('pending_invites')
    .insert({ action_link: linkData.properties.action_link, email, user_id: targetId })
    .select('token')
    .single()

  if (inviteError || !invite) {
    console.error('[resendInviteFromList] pending_invites error:', inviteError?.message)
    return { ok: false, error: 'Erreur serveur' }
  }

  const activateUrl = `${siteUrl}/espace/activer/${invite.token}`

  try {
    console.log('[resendInviteFromList] sending email to', email)
    await sendInviteEmail({ to: email, firstName: profile?.first_name ?? '', inviteLink: activateUrl })
    console.log('[resendInviteFromList] email sent OK to', email)
  } catch (err: any) {
    console.error('[resendInviteFromList] Resend error:', err?.message, { email, targetId })
    return { ok: false, error: err?.message ?? 'Erreur envoi email' }
  }

  return { ok: true }
}

export async function resendInvite(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const { data: me } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(me?.permission ?? '')) redirect('/espace/dashboard')

  const targetId = formData.get('user_id') as string
  const admin = createAdminClient()

  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(targetId)
  const email = authUser?.user?.email
  console.log('[resendInvite] targetId:', targetId, 'email:', email ?? 'INTROUVABLE', authErr?.message ?? '')
  if (!email) redirect(`/espace/admin/benevoles/${targetId}?error=Email+introuvable`)

  const { data: profile } = await supabase.from('profiles').select('first_name').eq('id', targetId).single()

  const siteUrl = getSiteUrl()

  const { data: linkData, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: {
      redirectTo: `${siteUrl}/espace/auth/confirm`,
    },
  })

  if (error || !linkData) {
    console.error('[resendInvite] generateLink failed:', error?.message, { email, targetId })
    redirect(`/espace/admin/benevoles/${targetId}?error=${encodeURIComponent(error?.message ?? 'Lien non généré')}`)
  }

  const { data: invite, error: inviteError } = await admin
    .from('pending_invites')
    .insert({ action_link: linkData.properties.action_link, email, user_id: targetId })
    .select('token')
    .single()

  if (inviteError || !invite) {
    console.error('[resendInvite] pending_invites error:', inviteError?.message, { email, targetId })
    redirect(`/espace/admin/benevoles/${targetId}?error=Erreur+serveur`)
  }

  const activateUrl = `${siteUrl}/espace/activer/${invite.token}`

  try {
    console.log('[resendInvite] sending email to', email)
    await sendInviteEmail({
      to: email,
      firstName: profile?.first_name ?? '',
      inviteLink: activateUrl,
    })
    console.log('[resendInvite] email sent OK to', email)
  } catch (err: any) {
    console.error('[resendInvite] Resend error:', err?.message, { email, targetId })
    redirect(`/espace/admin/benevoles/${targetId}?error=${encodeURIComponent(err?.message ?? 'Erreur envoi email')}`)
  }

  redirect(`/espace/admin/benevoles/${targetId}?sent=1`)
}

export async function updateBenevoleAdmin(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const { data: me } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(me?.permission ?? '')) redirect('/espace/dashboard')

  const userId     = formData.get('user_id') as string
  const firstName  = (formData.get('first_name') as string)?.trim()
  const lastName   = (formData.get('last_name') as string)?.trim()
  const email      = (formData.get('email') as string)?.trim()
  const phone      = (formData.get('phone') as string)?.trim() || null
  const city       = (formData.get('city') as string)?.trim() || null
  const birthdate  = (formData.get('birthdate') as string) || null
  const permission = formData.get('permission') as string
  const status     = formData.get('status') as string

  const admin = createAdminClient()

  const { error: authError } = await admin.auth.admin.updateUserById(userId, { email })
  if (authError) {
    redirect(`/espace/admin/benevoles/${userId}/modifier?error=${encodeURIComponent(authError.message)}`)
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ first_name: firstName, last_name: lastName, phone, city, birthdate, permission, status, email })
    .eq('id', userId)

  if (profileError) {
    redirect(`/espace/admin/benevoles/${userId}/modifier?error=${encodeURIComponent(profileError.message)}`)
  }

  revalidateTag('profiles', 'max')

  redirect(`/espace/admin/benevoles/${userId}?updated=1`)
}

export async function deleteBenevole(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const { data: me } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(me?.permission ?? '')) redirect('/espace/dashboard')

  const userId = formData.get('user_id') as string
  if (userId === user.id) redirect('/espace/admin?error=self')

  const admin = createAdminClient()
  await admin.auth.admin.deleteUser(userId)

  revalidateTag('profiles', 'max')
  revalidateTag('team-members', 'max')
  revalidateTag('member-positions', 'max')

  redirect('/espace/admin')
}
