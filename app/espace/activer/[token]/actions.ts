'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashToken, isWellFormedToken } from '@/lib/tokens'
import { siteUrl } from '@/lib/site'

/**
 * Activation d'un compte, au clic sur le bouton (jamais au chargement de la
 * page : les robots qui préchargent les liens ne consomment rien).
 * Le lien de connexion Supabase est généré à ce moment-là, puis suivi.
 */
export async function activateAccount(formData: FormData) {
  const token = String(formData.get('token') ?? '')
  if (!isWellFormedToken(token)) redirect('/espace/login?error=expired')

  // Clé secrète : page publique à jeton (account_activations n'a aucune policy)
  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Usage unique : le lien est marqué utilisé dans la même requête qui le vérifie
  const { data: activation } = await admin
    .from('account_activations')
    .update({ used_at: now })
    .eq('token_hash', hashToken(token))
    .is('used_at', null)
    .gt('expires_at', now)
    .select('church_id, user_id')
    .maybeSingle()

  if (!activation) redirect('/espace/login?error=expired')
  const { church_id: churchId, user_id: userId } = activation

  // Invité → actif, dans l'église du lien seulement (un compte désactivé le reste)
  await admin
    .from('church_memberships')
    .update({ status: 'active' })
    .eq('church_id', churchId)
    .eq('user_id', userId)
    .eq('status', 'invited')
  await admin
    .from('members')
    .update({ status: 'active' })
    .eq('church_id', churchId)
    .eq('user_id', userId)
    .eq('status', 'invited')
  // Ouvre l'espace sur cette église (refusé par la base si l'appartenance n'est pas active)
  await admin.from('profiles').update({ active_church_id: churchId }).eq('id', userId)

  const { data: userData } = await admin.auth.admin.getUserById(userId)
  const email = userData?.user?.email
  if (!email) redirect('/espace/login?error=auth')

  const { data: linkData } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${siteUrl()}/espace/auth/confirm` },
  })
  const actionLink = linkData?.properties?.action_link
  if (!actionLink) redirect('/espace/login?error=auth')

  redirect(actionLink)
}
