'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  readCreateChurchForm, validateCreateChurch,
  type CreateChurchField, type CreateChurchInput,
} from '@/lib/church/create'
import { founderDeadline, isFounderAt, trialEndsAt } from '@/lib/church/founder'
import { SLUG_MESSAGES, validateSlug } from '@/lib/church/slug'
import { LEGAL_DOCUMENTS } from '@/lib/legal'

export type CreateChurchState =
  | { status: 'idle' }
  | { status: 'error'; message?: string; errors: Partial<Record<CreateChurchField, string>>; values: CreateChurchInput }

export type SlugCheck =
  | { state: 'available' }
  | { state: 'invalid'; message: string }
  | { state: 'taken'; message: string; suggestion: string | null }

/** Compte connecté dont l'e-mail est vérifié, ou redirection vers la connexion. */
async function requireVerifiedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')
  return user
}

/**
 * Vérification en direct de l'adresse choisie. Réservée aux comptes connectés
 * (la liste des adresses prises ne sert pas à être parcourue par n'importe qui).
 */
export async function checkSlug(slug: string): Promise<SlugCheck> {
  await requireVerifiedUser()
  const normalized = String(slug ?? '').trim().toLowerCase()
  const problem = validateSlug(normalized)
  if (problem) return { state: 'invalid', message: SLUG_MESSAGES[problem] }

  // Clé secrète : la RLS masque les autres églises, or l'unicité est mondiale.
  // Seule l'existence est lue, jamais le contenu d'une église.
  const admin = createAdminClient()
  const candidates = [normalized, ...[2, 3, 4, 5, 6].map(n => `${normalized}-${n}`.slice(0, 40))]
  const { data } = await admin.from('churches').select('slug').in('slug', candidates)
  const taken = new Set((data ?? []).map(row => String(row.slug).toLowerCase()))
  if (!taken.has(normalized)) return { state: 'available' }

  const suggestion = candidates.slice(1).find(c => !taken.has(c) && validateSlug(c) === null) ?? null
  return { state: 'taken', message: 'Cette adresse est déjà utilisée par une autre église.', suggestion }
}

function failure(input: CreateChurchInput, errors: Partial<Record<CreateChurchField, string>>, message?: string): CreateChurchState {
  return { status: 'error', message, errors, values: input }
}

/**
 * Crée l'espace de l'église : le compte connecté en devient administrateur.
 * Statut fondateur et fin d'essai sont décidés ici, côté serveur, jamais par le navigateur.
 */
export async function createChurchSpace(_previous: CreateChurchState, formData: FormData): Promise<CreateChurchState> {
  const user = await requireVerifiedUser()
  const input = readCreateChurchForm(formData)
  const checked = validateCreateChurch(input)
  if (!checked.ok) return failure(input, checked.errors)

  if (!user.email_confirmed_at) {
    return failure(input, {}, 'Confirmez d’abord votre adresse e-mail grâce au lien que nous vous avons envoyé.')
  }

  const { values } = checked
  const now = new Date()

  // Clé secrète : la fonction de création n'est appelable que par le serveur.
  // L'identité vient de la session vérifiée, jamais d'un champ du formulaire.
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('create_church', {
    p_user_id: user.id,
    p_name: values.name,
    p_slug: values.slug,
    p_city: values.city,
    p_country: values.country,
    p_size_bracket: values.size,
    p_is_founder: isFounderAt(now, founderDeadline()),
    p_trial_ends_at: trialEndsAt(now).toISOString(),
    p_cgv_version: LEGAL_DOCUMENTS.cgv.version,
    p_privacy_version: LEGAL_DOCUMENTS.confidentialite.version,
  })

  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    console.error('[creer] création refusée :', error?.code ?? 'réponse inattendue')
    return failure(input, {}, 'La création n’a pas pu aboutir. Réessayez dans quelques instants.')
  }

  const result = data as { ok: boolean; error?: string }
  if (!result.ok) {
    switch (result.error) {
      case 'slug_taken':
        return failure(input, { slug: 'Cette adresse vient d’être prise par une autre église. Choisissez-en une autre.' })
      case 'email_not_confirmed':
        return failure(input, {}, 'Confirmez d’abord votre adresse e-mail grâce au lien que nous vous avons envoyé.')
      case 'too_many':
        return failure(input, {}, 'Votre compte administre déjà plusieurs espaces. Contactez-nous si vous avez besoin d’en créer un autre.')
      case 'invalid_slug':
        return failure(input, { slug: 'Cette adresse n’est pas valide.' })
      case 'invalid_name':
        return failure(input, { name: 'Ce nom n’est pas valide.' })
      default:
        console.error('[creer] refus inattendu :', result.error)
        return failure(input, {}, 'La création n’a pas pu aboutir. Réessayez dans quelques instants.')
    }
  }

  revalidatePath('/espace', 'layout')
  redirect('/espace/demarrage')
}
