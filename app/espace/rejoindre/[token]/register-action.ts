'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendInviteEmail } from '@/lib/email/espace'
import { hashToken, isWellFormedToken } from '@/lib/tokens'
import { activationUrl, createActivation, findOrCreateAccount, isEmail } from '../../activer/activation'

export type RegisterResult =
  | { ok: true }
  | { ok: false; error: string }

const GENERIC_ERROR = 'L’inscription n’a pas pu aboutir. Réessaie dans quelques instants.'

/**
 * Inscription par un lien d'inscription : crée (ou retrouve) le compte, la
 * personne et l'appartenance (« membre », en attente d'activation) dans
 * l'église du lien, puis envoie le lien d'activation par e-mail.
 * La réponse est la même que l'adresse ait déjà un compte ou non.
 */
export async function registerViaToken(formData: FormData): Promise<RegisterResult> {
  const token     = String(formData.get('token') ?? '')
  const firstName = String(formData.get('first_name') ?? '').trim().slice(0, 80)
  const lastName  = String(formData.get('last_name') ?? '').trim().slice(0, 80)
  const email     = String(formData.get('email') ?? '').trim().toLowerCase()
  const phone     = String(formData.get('phone') ?? '').trim().slice(0, 40) || null

  if (!firstName || !lastName || !email) {
    return { ok: false, error: 'Tous les champs obligatoires doivent être remplis.' }
  }
  if (!isEmail(email)) return { ok: false, error: 'Adresse e-mail invalide.' }
  if (!isWellFormedToken(token)) return { ok: false, error: 'Ce lien d’inscription n’est plus valide.' }

  // Clé secrète : consommation d'un lien d'inscription (compte, personne et appartenance
  // créés hors session). Toutes les écritures portent l'église renvoyée par le lien.
  const admin = createAdminClient()

  // Consommation atomique (expiration, révocation, nombre d'utilisations)
  const { data: churchId } = await admin.rpc('consume_invite_token', { target_hash: hashToken(token) })
  if (!churchId) return { ok: false, error: 'Ce lien d’inscription n’est plus valide.' }

  const account = await findOrCreateAccount(admin, { email, firstName, lastName })
  if (!account) return { ok: false, error: GENERIC_ERROR }
  const userId = account.userId

  const { data: membership } = await admin
    .from('church_memberships')
    .select('status')
    .eq('church_id', churchId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) {
    // Personne de l'église pour ce compte (déjà présente : on n'écrase rien)
    const { data: existingMember } = await admin
      .from('members')
      .select('id')
      .eq('church_id', churchId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!existingMember) {
      const { data: member, error } = await admin
        .from('members')
        .insert({ church_id: churchId, user_id: userId, first_name: firstName, last_name: lastName, status: 'invited' })
        .select('id')
        .single()
      if (error || !member) return { ok: false, error: GENERIC_ERROR }
      await admin.from('member_contacts').insert({ member_id: member.id, church_id: churchId, email, phone })
    }

    const { error } = await admin
      .from('church_memberships')
      .insert({ church_id: churchId, user_id: userId, role: 'membre', status: 'invited' })
    if (error) return { ok: false, error: GENERIC_ERROR }
  } else if (membership.status !== 'invited') {
    // Déjà membre (actif ou désactivé) : rien à envoyer, même réponse
    return { ok: true }
  }

  const activation = await createActivation(admin, churchId, userId)
  if (!activation) return { ok: false, error: GENERIC_ERROR }

  const { data: church } = await admin.from('churches').select('name').eq('id', churchId).maybeSingle()
  try {
    await sendInviteEmail({ to: email, firstName, inviteLink: activationUrl(activation), churchName: church?.name })
  } catch {
    console.error('[register] envoi de l’e-mail d’activation impossible')
    return { ok: false, error: 'Ton inscription est enregistrée, mais l’e-mail n’a pas pu être envoyé. Utilise « Première connexion » sur la page de connexion.' }
  }

  return { ok: true }
}
