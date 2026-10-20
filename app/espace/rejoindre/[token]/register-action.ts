'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendInviteEmail } from '@/lib/email/espace'
import { siteUrl as getSiteUrl } from '@/lib/site'

export type RegisterResult =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: false; error: string; debug?: string }

export async function registerViaToken(formData: FormData): Promise<RegisterResult> {
  const token     = formData.get('token') as string
  const firstName = (formData.get('first_name') as string)?.trim()
  const lastName  = (formData.get('last_name') as string)?.trim()
  const email     = (formData.get('email') as string)?.trim().toLowerCase()
  const phone     = (formData.get('phone') as string)?.trim() || null

  if (!firstName || !lastName || !email || !token) {
    return { ok: false, error: 'Tous les champs obligatoires doivent être remplis.' }
  }

  const admin = createAdminClient()

  // Vérifier le token
  const { data: tk } = await admin
    .from('invite_tokens')
    .select('id, expires_at, max_uses, uses_count, revoked_at')
    .eq('token', token)
    .single()

  if (!tk) return { ok: false, error: 'Lien invalide ou introuvable.' }
  if (tk.revoked_at) return { ok: false, error: 'Ce lien a été désactivé.' }
  if (tk.expires_at && new Date(tk.expires_at) < new Date()) return { ok: false, error: 'Ce lien a expiré.' }
  if (tk.max_uses && tk.uses_count >= tk.max_uses) return { ok: false, error: 'Ce lien a atteint son nombre maximum d\'inscriptions.' }

  // Vérifier si l'email existe déjà dans les profils
  const { data: existing } = await admin
    .from('profiles')
    .select('id, status')
    .eq('email', email)
    .maybeSingle()

  let userId: string

  if (existing) {
    // Compte déjà créé (invité manuellement mais jamais activé)
    if (existing.status === 'active') {
      return { ok: false, error: 'Un compte actif existe déjà avec cette adresse email. Utilise la page de connexion.' }
    }
    // Status 'invited' → renvoyer le lien d'activation
    userId = existing.id

    // Vérifier que le compte auth existe (peut manquer si profil créé manuellement sans compte Supabase)
    const { data: authUserData } = await admin.auth.admin.getUserById(existing.id)
    if (!authUserData?.user) {
      console.error('[register] profil sans compte auth trouvé, création du compte auth avec le même UUID', { email, userId })
      const { error: createAuthError } = await admin.auth.admin.createUser({
        id: existing.id, // même UUID que le profil pour éviter tout décalage
        email,
        email_confirm: false,
        user_metadata: { first_name: firstName, last_name: lastName },
      })
      if (createAuthError) {
        console.error('[register] createUser pour profil orphelin échoué:', createAuthError.message, { email, userId })
        // On continue malgré tout — generateLink peut parfois réussir
      }
    }

    // Mettre à jour le prénom/nom si renseignés via ce formulaire
    await admin.from('profiles').update({ first_name: firstName, last_name: lastName, phone: phone ?? undefined }).eq('id', userId)
  } else {
    // Créer le compte Supabase Auth
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { first_name: firstName, last_name: lastName },
    })

    if (authError) {
      if (authError.message.toLowerCase().includes('already')) {
        // Compte auth existant mais pas dans profiles → récupérer l'id
        const { data: authList } = await admin.auth.admin.listUsers()
        const existingAuthUser = authList?.users?.find(u => u.email?.toLowerCase() === email)
        if (existingAuthUser) {
          userId = existingAuthUser.id
        } else {
          return { ok: false, error: 'Un compte existe déjà avec cette adresse email.' }
        }
      } else {
        return { ok: false, error: 'Erreur lors de la création du compte. Réessaie.' }
      }
    } else {
      userId = authData.user.id
    }

    // Créer le profil (le trigger handle_new_user le crée aussi, upsert pour compléter)
    await admin.from('profiles').upsert({
      id: userId,
      permission: 'viewer',
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      status: 'invited',
    })
  }

  // Incrémenter le compteur du token (seulement pour les nouvelles inscriptions)
  if (!existing) {
    await admin.from('invite_tokens')
      .update({ uses_count: tk.uses_count + 1 })
      .eq('id', tk.id)
  }

  // Générer le lien d'activation et envoyer l'email
  const siteUrl = getSiteUrl()
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${siteUrl}/espace/auth/confirm` },
  })

  if (!linkData?.properties?.action_link) {
    console.error('[register] generateLink failed:', linkError?.message, { email, userId })
    return { ok: false, error: `Erreur lors de la création du lien d'activation. Réessaie ou contacte l'équipe. (generateLink: ${linkError?.message ?? 'no action_link'})` }
  }

  const actionLink = linkData.properties.action_link

  // Supprimer un éventuel ancien pending_invite pour éviter les conflits de clé unique
  await admin.from('pending_invites').delete().eq('user_id', userId)

  const { data: invite, error: inviteError } = await admin
    .from('pending_invites')
    .insert({ action_link: actionLink, email, user_id: userId })
    .select('token')
    .single()

  if (!invite) {
    // pending_invites a échoué → envoyer le lien directement (expire dans 1h)
    console.error('[register] pending_invites insert failed:', inviteError?.message, { email, userId })
    try {
      await sendInviteEmail({ to: email, firstName, inviteLink: actionLink })
    } catch (emailErr: unknown) {
      const msg = emailErr instanceof Error ? emailErr.message : String(emailErr)
      console.error('[register] sendInviteEmail fallback failed:', msg, { email })
      return { ok: false, error: `Compte créé mais l'email d'activation n'a pas pu être envoyé. Contacte l'équipe. (${msg})` }
    }
  } else {
    const activateUrl = `${siteUrl}/espace/activer/${invite.token}`
    try {
      await sendInviteEmail({ to: email, firstName, inviteLink: activateUrl })
    } catch (emailErr: unknown) {
      const msg = emailErr instanceof Error ? emailErr.message : String(emailErr)
      console.error('[register] sendInviteEmail failed:', msg, { email })
      return { ok: false, error: `Compte créé mais l'email d'activation n'a pas pu être envoyé. Contacte l'équipe. (${msg})` }
    }
  }

  return { ok: true }
}
