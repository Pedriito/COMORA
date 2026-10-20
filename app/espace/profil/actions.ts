'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { frequencyLabels } from '@/lib/labels'

export async function changePassword(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const currentPassword = formData.get('current_password') as string
  const newPassword     = formData.get('new_password') as string
  const confirmPassword = formData.get('confirm_password') as string

  if (newPassword.length < 8) redirect('/espace/profil?pwd_error=short')
  if (newPassword !== confirmPassword) redirect('/espace/profil?pwd_error=mismatch')

  // Vérifie le mot de passe actuel
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  })
  if (signInError) redirect('/espace/profil?pwd_error=wrong_current')

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) redirect('/espace/profil?pwd_error=failed')

  redirect('/espace/profil?pwd_success=1')
}

export async function saveProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const firstName = (formData.get('first_name') as string)?.trim()
  const lastName  = (formData.get('last_name') as string)?.trim()
  const newEmail  = (formData.get('email') as string)?.trim()
  const phone     = (formData.get('phone') as string)?.trim() || null
  const birthdate = (formData.get('birthdate') as string) || null
  const city      = (formData.get('city') as string)?.trim() || null
  // Validé ici plutôt que laissé filer jusqu'à la contrainte CHECK : l'écriture du profil a lieu
  // APRÈS la demande de changement d'e-mail, donc un rejet en base laisserait l'e-mail engagé
  // sans que le reste du profil soit enregistré.
  const rawFrequency = (formData.get('desired_frequency') as string)?.trim() || null
  const desiredFrequency = rawFrequency && rawFrequency in frequencyLabels ? rawFrequency : null

  const emailChanged = newEmail && newEmail !== user.email
  let emailSent = false

  if (emailChanged) {
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    if (error) {
      const key = error.message.toLowerCase().includes('already') ? 'email_taken' : 'failed'
      redirect(`/espace/profil?error=${key}`)
    }
    emailSent = true
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: firstName,
      last_name: lastName,
      phone,
      birthdate,
      city,
      desired_frequency: desiredFrequency,
      email: emailChanged ? newEmail : user.email,
      profile_complete: true,
    })
    .eq('id', user.id)

  if (error) redirect('/espace/profil?error=failed')

  redirect(emailSent ? '/espace/profil?email_sent=1' : '/espace/dashboard')
}
