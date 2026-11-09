'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requirePlatformAdmin } from '@/lib/auth/platform'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MESSAGES: Record<string, string> = {
  invalid_days: 'invalide',
  not_found: 'introuvable',
  not_extendable: 'non-prolongeable',
  not_requested: 'non-demandee',
  too_many_members: 'trop-grande',
  not_solidarity: 'non-solidaire',
}

function back(result: string): never {
  revalidatePath('/espace/plateforme')
  redirect(`/espace/plateforme?resultat=${result}`)
}

type Result = { ok?: boolean; error?: string } | null

/** Issue d'une fonction du back-office : le code du message affiché, jamais le détail de la base. */
function outcome(success: string, data: unknown, error: { code?: string } | null): string {
  if (error) return error.code === '42501' ? 'refuse' : 'erreur'
  const result = data as Result
  if (result?.ok) return success
  return MESSAGES[result?.error ?? ''] ?? 'erreur'
}

/** Prolonge l'essai d'une église. Le rôle et la double vérification sont revérifiés ici, puis par la base. */
export async function extendTrial(formData: FormData) {
  const { supabase } = await requirePlatformAdmin()
  const churchId = String(formData.get('churchId') ?? '')
  const days = Number(formData.get('days'))
  if (!UUID.test(churchId) || !Number.isInteger(days) || days < 1 || days > 90) back('invalide')
  const { data, error } = await supabase.rpc('platform_extend_trial', { p_church: churchId, p_days: days })
  back(outcome('essai-prolonge', data, error))
}

export async function approveSolidarity(formData: FormData) {
  const { supabase } = await requirePlatformAdmin()
  const churchId = String(formData.get('churchId') ?? '')
  if (!UUID.test(churchId)) back('invalide')
  const { data, error } = await supabase.rpc('platform_approve_solidarity', { p_church: churchId })
  back(outcome('solidaire-valide', data, error))
}

export async function revokeSolidarity(formData: FormData) {
  const { supabase } = await requirePlatformAdmin()
  const churchId = String(formData.get('churchId') ?? '')
  if (!UUID.test(churchId)) back('invalide')
  const { data, error } = await supabase.rpc('platform_revoke_solidarity', { p_church: churchId })
  back(outcome('solidaire-retire', data, error))
}
