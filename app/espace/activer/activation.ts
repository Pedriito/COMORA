import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateToken, hashToken } from '@/lib/tokens'
import { siteUrl } from '@/lib/site'

/*
 * Liens d'activation d'un compte (invitation, inscription, mot de passe
 * oublié). Seule l'empreinte du jeton est stockée ; le lien de connexion
 * Supabase n'est généré qu'au clic, sur /espace/activer/<jeton>.
 */

type AdminClient = ReturnType<typeof createAdminClient>

export const ACTIVATION_HOURS = 72

export function activationExpiry(now = Date.now()): Date {
  return new Date(now + ACTIVATION_HOURS * 60 * 60 * 1000)
}

export function activationUrl(token: string): string {
  return `${siteUrl()}/espace/activer/${token}`
}

/**
 * Nouveau lien d'activation pour ce compte dans cette église. Les liens
 * précédents du compte, non utilisés, sont supprimés : seul le dernier
 * envoyé fonctionne. Renvoie le jeton en clair (à envoyer, jamais stocké),
 * ou null si l'enregistrement a échoué.
 */
export async function createActivation(admin: AdminClient, churchId: string, userId: string): Promise<string | null> {
  // Clé secrète : account_activations n'a aucune policy (accès serveur uniquement)
  await admin.from('account_activations').delete().eq('user_id', userId).is('used_at', null)

  const token = generateToken()
  const { error } = await admin.from('account_activations').insert({
    church_id: churchId,
    user_id: userId,
    token_hash: hashToken(token),
    expires_at: activationExpiry().toISOString(),
  })
  return error ? null : token
}

function isAlreadyRegistered(error: { code?: string; message?: string }): boolean {
  return error.code === 'email_exists' || /already/i.test(error.message ?? '')
}

/**
 * Compte Auth de cette adresse : créé s'il n'existe pas (sans e-mail de
 * Supabase), sinon retrouvé. Un compte existant n'est jamais modifié.
 * Renvoie null en cas d'échec.
 */
export async function findOrCreateAccount(
  admin: AdminClient,
  { email, firstName, lastName }: { email: string; firstName: string; lastName: string },
): Promise<{ userId: string; created: boolean } | null> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: false,
    user_metadata: { first_name: firstName, last_name: lastName },
  })
  if (!error && data.user) return { userId: data.user.id, created: true }
  if (!error || !isAlreadyRegistered(error)) return null

  // Compte existant : generateLink renvoie le compte de cette adresse (le lien
  // produit n'est ni envoyé ni stocké), sans parcourir la liste paginée des comptes.
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const userId = link?.user?.id
  return userId ? { userId, created: false } : null
}

/** Adresse e-mail plausible (la vérification réelle est l'e-mail envoyé). */
export function isEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
