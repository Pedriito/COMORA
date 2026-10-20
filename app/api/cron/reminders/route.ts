import { createAdminClient } from '@/lib/supabase/admin'
import { sendReminderEmail } from '@/lib/email/espace'
import { sendPushToUser } from '@/lib/pushNotifications'
import { NextRequest } from 'next/server'

const INVITE_EXT_ID = '00000000-0000-0000-0000-000000000001'

// J-2 : relance uniquement pour les pending (confirmation attendue)
// J-7, J-1 : rappel informatif pour pending ET confirmed
const WINDOWS = [
  { days: 7,  pendingOnly: false },
  { days: 2,  pendingOnly: true  },
  { days: 1,  pendingOnly: false },
] as const

/** Découpe un tableau en lots de taille `size` — évite de lancer des centaines d'appels
 *  Auth Admin en parallèle d'un coup si un plan a beaucoup de bénévoles internes. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

type AdminClient = ReturnType<typeof createAdminClient>

/** Résout en une fois (profils + emails Auth) tous les bénévoles internes d'un lot
 *  d'affectations, au lieu d'un aller-retour séquentiel par affectation. */
export async function resolveInternalUsers(admin: AdminClient, userIds: string[]) {
  const uniqueIds = [...new Set(userIds)]
  const profileMap = new Map<string, { first_name: string }>()
  const emailMap = new Map<string, string>()
  if (uniqueIds.length === 0) return { profileMap, emailMap }

  const { data: profiles } = await admin.from('profiles').select('id, first_name').in('id', uniqueIds)
  for (const p of profiles ?? []) profileMap.set(p.id, { first_name: p.first_name })

  for (const batch of chunk(uniqueIds, 10)) {
    const results = await Promise.all(batch.map(id => admin.auth.admin.getUserById(id)))
    results.forEach(({ data }, i) => {
      const email = data?.user?.email
      if (email) emailMap.set(batch[i], email)
    })
  }

  return { profileMap, emailMap }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()

  const now = new Date()
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  const results: { planId: string; days: number; sent: number; skipped: number; errors: string[] }[] = []

  for (const { days, pendingOnly } of WINDOWS) {
    const start = new Date(todayUTC)
    start.setUTCDate(start.getUTCDate() + days)
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 1)

    const { data: plans, error: plansError } = await admin
      .from('plans')
      .select('id, title, service_date')
      .gte('service_date', start.toISOString())
      .lt('service_date', end.toISOString())

    if (plansError) {
      console.error(`[cron/reminders] erreur plans J-${days}:`, plansError.message)
      continue
    }

    for (const plan of plans ?? []) {
      const planResult = { planId: plan.id, days, sent: 0, skipped: 0, errors: [] as string[] }

      const statusFilter = pendingOnly ? ['pending'] : ['pending', 'confirmed']

      const { data: assignments } = await admin
        .from('plan_assignments')
        .select('id, user_id, status, external_name, external_email, reminder_sent_days, positions(name), teams(name)')
        .eq('plan_id', plan.id)
        .in('status', statusFilter)
        // Invités externes exclus des relances J-2 (pending only)
        .neq('user_id', pendingOnly ? INVITE_EXT_ID : '00000000-0000-0000-0000-000000000000')

      const internalUserIds = (assignments ?? [])
        .filter(a => a.user_id !== INVITE_EXT_ID)
        .map(a => a.user_id)
      const { profileMap, emailMap } = await resolveInternalUsers(admin, internalUserIds)

      for (const a of assignments ?? []) {
        // Déduplication : sauter si ce rappel a déjà été envoyé
        const alreadySent = (a.reminder_sent_days as number[] | null ?? []).includes(days)
        if (alreadySent) {
          planResult.skipped++
          continue
        }

        const isPending = a.status === 'pending'
        const position = a.positions as any
        const team = a.teams as any

        try {
          if (a.user_id === INVITE_EXT_ID) {
            // Invités externes — uniquement si email renseigné et non pendingOnly
            if (!a.external_email) continue
            await sendReminderEmail({
              to: a.external_email,
              firstName: a.external_name ?? 'Invité',
              planTitle: plan.title,
              serviceDate: plan.service_date,
              positionName: position?.name ?? null,
              teamName: team?.name ?? null,
              assignmentId: a.id,
              daysLeft: days,
              isPending,
              isExternal: true,
            })
          } else {
            // Bénévole interne
            const profile = profileMap.get(a.user_id)
            const email = emailMap.get(a.user_id)
            if (!email || !profile) continue

            await sendReminderEmail({
              to: email,
              firstName: profile.first_name,
              planTitle: plan.title,
              serviceDate: plan.service_date,
              positionName: position?.name ?? null,
              teamName: team?.name ?? null,
              assignmentId: a.id,
              daysLeft: days,
              isPending,
              isExternal: false,
            })

            // Push notification en complément
            const dayLabel = days === 1 ? 'demain' : `dans ${days} jours`
            const dateStr = new Date(plan.service_date).toLocaleDateString('fr-FR', {
              weekday: 'long', day: 'numeric', month: 'long',
            })
            const pushBody = isPending && days <= 2
              ? `Tu n'as pas encore confirmé pour ${dateStr}${team?.name ? ` · ${team.name}` : ''}`
              : `Tu es planifié(e) ${dayLabel} (${dateStr})${team?.name ? ` · ${team.name}` : ''}`

            await sendPushToUser(a.user_id, {
              title: isPending && days <= 2 ? `⚠ Confirmation attendue · ${plan.title}` : `⏰ Rappel — ${plan.title}`,
              body: pushBody,
              url: '/espace/dashboard',
              tag: `reminder-${a.id}-${days}`,
            }).catch(() => {})
          }

          // Marquer ce rappel comme envoyé pour éviter les doublons
          await admin
            .from('plan_assignments')
            .update({ reminder_sent_days: [...(a.reminder_sent_days as number[] ?? []), days] })
            .eq('id', a.id)

          planResult.sent++
          console.log(`[cron/reminders] J-${days} — "${plan.title}" — assignment ${a.id} (${a.status}) OK`)
        } catch (err: any) {
          const msg = err?.message ?? 'Erreur inconnue'
          planResult.errors.push(`assignment ${a.id}: ${msg}`)
          console.error(`[cron/reminders] J-${days} — "${plan.title}" — assignment ${a.id} ERREUR:`, msg)
        }
      }

      results.push(planResult)
    }
  }

  console.log('[cron/reminders] terminé:', JSON.stringify(results))
  return Response.json({ ok: true, results })
}
