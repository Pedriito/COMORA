'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireChurch } from '@/lib/auth/church'
import { localToUtcIso } from '@/lib/timezone'
import { churchTimeZone } from '../admin/plans/notifyTeamLeaders'
import { readMembersFile } from '@/lib/onboarding/read-file'
import { revalidateRows, type ImportPreview } from '@/lib/onboarding/members-import'
import { parsePositions, parseServiceDateTime, validateServiceTitle, validateTeamName } from '@/lib/onboarding/forms'
import { STEP_KEYS, type StepKey } from '@/lib/onboarding/progress'

export type StepState = {
  error?: string
  ok?: boolean
  preview?: ImportPreview
  imported?: { imported: number; skipped: number }
} | null

const text = (fd: FormData, name: string) => String(fd.get(name) ?? '').trim()

function refresh() {
  revalidatePath('/espace/demarrage')
  revalidatePath('/espace/dashboard')
}

/** Étape 1 : lit le fichier et montre ce qui sera importé, sans rien écrire. */
export async function previewMembersImport(_prev: StepState, formData: FormData): Promise<StepState> {
  await requireChurch('admin')
  const file = formData.get('file')
  const result = await readMembersFile(file instanceof File ? file : null)
  if (!result.ok) return { error: result.error }
  const { preview } = result
  if (preview.missingFirstName) {
    return { error: 'Nous n’avons pas trouvé la colonne « Prénom ». Utilisez le modèle proposé, ou renommez la première colonne.' }
  }
  if (preview.rows.length === 0) return { error: 'Aucune personne à importer dans ce fichier.', preview }
  return { preview }
}

/** Étape 1 : importe les lignes de l'aperçu (revérifiées ici), en une seule opération. */
export async function confirmMembersImport(_prev: StepState, formData: FormData): Promise<StepState> {
  const ctx = await requireChurch('admin')
  let rows: unknown
  try {
    rows = JSON.parse(text(formData, 'rows'))
  } catch {
    return { error: 'L’aperçu a expiré. Choisissez à nouveau votre fichier.' }
  }
  const checked = revalidateRows(rows)
  if (checked.rows.length === 0) return { error: 'Aucune personne à importer.' }

  const { data, error } = await ctx.supabase.rpc('import_members', { p_church_id: ctx.church.churchId, p_rows: checked.rows })
  if (error || !data) return { error: 'L’import n’a pas pu aboutir. Rien n’a été ajouté : vous pouvez réessayer.' }
  refresh()
  const result = data as { imported: number; skipped: number }
  return { ok: true, imported: { imported: result.imported, skipped: result.skipped } }
}

/** Étape 2 : première équipe, avec ses postes. */
export async function createFirstTeam(_prev: StepState, formData: FormData): Promise<StepState> {
  const ctx = await requireChurch('admin')
  const name = text(formData, 'name')
  const nameError = validateTeamName(name)
  if (nameError) return { error: nameError }
  const { positions, error: positionsError } = parsePositions(String(formData.get('positions') ?? ''))
  if (positionsError) return { error: positionsError }

  const churchId = ctx.church.churchId
  const { data: team, error } = await ctx.supabase.from('teams').insert({ church_id: churchId, name }).select('id').single()
  if (error || !team) {
    return { error: error?.code === '23505' ? 'Une équipe porte déjà ce nom.' : 'L’équipe n’a pas pu être créée. Réessayez dans un instant.' }
  }
  if (positions.length > 0) {
    const { error: positionError } = await ctx.supabase
      .from('positions')
      .insert(positions.map(p => ({ church_id: churchId, team_id: team.id, name: p })))
    if (positionError) {
      await ctx.supabase.from('teams').delete().eq('id', team.id).eq('church_id', churchId)
      return { error: 'Les postes n’ont pas pu être créés. Rien n’a été ajouté, vous pouvez réessayer.' }
    }
  }
  refresh()
  return { ok: true }
}

/** Étape 3 : premier culte. */
export async function createFirstService(_prev: StepState, formData: FormData): Promise<StepState> {
  const ctx = await requireChurch('admin')
  const title = text(formData, 'title')
  const titleError = validateServiceTitle(title)
  if (titleError) return { error: titleError }
  const when = parseServiceDateTime(text(formData, 'date'), text(formData, 'time'))
  if (!when.local) return { error: when.error }

  const timeZone = await churchTimeZone(ctx.supabase, ctx.church.churchId)
  const { error } = await ctx.supabase.from('plans').insert({
    church_id: ctx.church.churchId,
    title,
    service_date: localToUtcIso(when.local, timeZone),
  })
  if (error) return { error: 'Le culte n’a pas pu être créé. Réessayez dans un instant.' }
  refresh()
  return { ok: true }
}

/** Passer une étape : elle reste reprenable, on cesse seulement de la réclamer. */
export async function skipStep(formData: FormData) {
  const ctx = await requireChurch('admin')
  const key = text(formData, 'step') as StepKey
  if (!STEP_KEYS.includes(key)) redirect('/espace/demarrage')

  const { data } = await ctx.supabase.from('onboarding_progress').select('skipped').eq('church_id', ctx.church.churchId).maybeSingle()
  const skipped = [...new Set([...(data?.skipped ?? []), key])]
  await ctx.supabase
    .from('onboarding_progress')
    .upsert({ church_id: ctx.church.churchId, skipped, updated_at: new Date().toISOString() })
  refresh()
  redirect('/espace/demarrage')
}

/** Fermer le guide : le rappel du tableau de bord disparaît, la page reste accessible. */
export async function dismissOnboarding() {
  const ctx = await requireChurch('admin')
  await ctx.supabase
    .from('onboarding_progress')
    .upsert({ church_id: ctx.church.churchId, dismissed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
  refresh()
  redirect('/espace/dashboard')
}
