'use server'

import { redirect } from 'next/navigation'
import { requireChurch } from '@/lib/auth/church'

const PAGE = '/espace/mes-indisponibilites'

/** Date "YYYY-MM-DD" valide (le calendrier rejette 2026-02-30). */
function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

export async function addBlockout(formData: FormData) {
  const ctx = await requireChurch('membre')
  // Compte sans fiche de personne dans cette église : rien à enregistrer
  if (!ctx.memberId) redirect(`${PAGE}?error=insert`)

  const startDate = formData.get('start_date')
  const rawEnd    = formData.get('end_date')
  const endDate   = rawEnd ? rawEnd : startDate
  const rawReason = formData.get('reason')
  const reason    = typeof rawReason === 'string' && rawReason.trim() ? rawReason.trim().slice(0, 200) : null

  if (!isIsoDate(startDate) || !isIsoDate(endDate) || endDate < startDate) {
    redirect(`${PAGE}?error=dates`)
  }

  const { error } = await ctx.supabase.from('blockout_dates').insert({
    church_id: ctx.church.churchId,
    member_id: ctx.memberId,
    start_date: startDate,
    end_date: endDate,
    reason,
  })

  if (error) redirect(`${PAGE}?error=insert`)

  redirect(`${PAGE}?success=added`)
}

export async function removeBlockout(formData: FormData) {
  const ctx = await requireChurch('membre')
  const id = formData.get('id')
  if (!ctx.memberId || typeof id !== 'string' || !id) redirect(PAGE)

  await ctx.supabase
    .from('blockout_dates')
    .delete()
    .eq('id', id)
    .eq('church_id', ctx.church.churchId)
    .eq('member_id', ctx.memberId)
  redirect(PAGE)
}
