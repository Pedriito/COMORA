'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requestOrigin } from '@/lib/http/origin'
import { readSignupForm, validateSignup, type SignupField } from '@/lib/church/signup'

export type SignupState =
  | { status: 'idle' }
  | { status: 'error'; message?: string; errors: Partial<Record<SignupField, string>>; values: { firstName: string; lastName: string; email: string } }
  | { status: 'sent'; email: string; method: 'password' | 'magic' }

/** Après confirmation de l'e-mail, la personne arrive directement sur la création de l'espace. */
async function confirmationUrl() {
  return `${await requestOrigin()}/espace/auth/callback?next=/espace/creer`
}

function failure(input: ReturnType<typeof readSignupForm>, errors: Partial<Record<SignupField, string>>, message?: string): SignupState {
  return { status: 'error', message, errors, values: { firstName: input.firstName, lastName: input.lastName, email: input.email } }
}

/**
 * Inscription par e-mail et mot de passe. Supabase envoie le lien de confirmation ;
 * la réponse est la même que l'adresse soit déjà inscrite ou non (pas d'énumération).
 */
export async function signUpWithPassword(_previous: SignupState, formData: FormData): Promise<SignupState> {
  const input = readSignupForm(formData)
  const errors = validateSignup(input, true)
  if (Object.keys(errors).length > 0) return failure(input, errors)

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: await confirmationUrl(),
      data: { first_name: input.firstName, last_name: input.lastName },
    },
  })

  if (error) {
    if (error.code === 'weak_password') return failure(input, { password: 'Ce mot de passe est trop facile à deviner. Choisissez-en un autre.' })
    if (error.code === 'over_email_send_rate_limit' || error.status === 429) {
      return failure(input, {}, 'Trop de demandes pour le moment. Réessayez dans quelques minutes.')
    }
    console.error('[inscription] signUp refusé :', error.code)
    return failure(input, {}, 'L’inscription n’a pas pu aboutir. Réessayez dans quelques instants.')
  }

  // Confirmation d'e-mail désactivée sur ce projet : la session existe déjà (jamais en production)
  if (data.session) redirect('/espace/creer')
  return { status: 'sent', email: input.email, method: 'password' }
}

/** Inscription (ou connexion) par lien magique : cliquer sur le lien prouve l'adresse e-mail. */
export async function sendMagicLink(_previous: SignupState, formData: FormData): Promise<SignupState> {
  const input = readSignupForm(formData)
  const errors = validateSignup(input, false)
  if (Object.keys(errors).length > 0) return failure(input, errors)

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: input.email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: await confirmationUrl(),
      data: { first_name: input.firstName, last_name: input.lastName },
    },
  })

  if (error) {
    if (error.code === 'over_email_send_rate_limit' || error.status === 429) {
      return failure(input, {}, 'Un e-mail vient d’être envoyé. Patientez une minute avant de recommencer.')
    }
    console.error('[inscription] lien magique refusé :', error.code)
    return failure(input, {}, 'Le lien n’a pas pu être envoyé. Réessayez dans quelques instants.')
  }
  return { status: 'sent', email: input.email, method: 'magic' }
}
