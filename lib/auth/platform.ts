import 'server-only'
import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/*
 * Accès au back-office des fondateurs, côté serveur.
 *
 * Trois verrous, dans cet ordre :
 *   1. connecté ;
 *   2. compte de platform_admins : sinon la page n'existe pas (404, pas de 403 qui confirmerait l'adresse) ;
 *   3. session en deux étapes (TOTP, niveau aal2) : sinon vérification ou inscription de l'application.
 *
 * La base refait les deux derniers contrôles à chaque appel (platform_assert) : ce module sert à
 * choisir quoi afficher, pas à protéger les données.
 */

export type PlatformContext = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
}

/** Compte de l'équipe, éventuellement pas encore en deux étapes. Sinon : connexion ou 404. */
export const getPlatformAdmin = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')
  const { data: isAdmin } = await supabase.rpc('is_platform_admin')
  if (isAdmin !== true) notFound()
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  return { supabase, userId: user.id, secondFactorDone: aal?.currentLevel === 'aal2' }
})

/** Pages et actions du back-office : compte de l'équipe ET deux étapes validées. */
export async function requirePlatformAdmin(): Promise<PlatformContext> {
  const admin = await getPlatformAdmin()
  if (!admin.secondFactorDone) redirect('/espace/plateforme/verification')
  return { supabase: admin.supabase, userId: admin.userId }
}
