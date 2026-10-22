import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReminderEmail } from '@/lib/email/espace'
import { sendPushToUser } from '@/lib/pushNotifications'
import { addDays, localDateString, resolveTimeZone, startOfLocalDayUtc } from '@/lib/timezone'

// J-2 : relance uniquement pour les pending (confirmation attendue)
// J-7, J-1 : rappel informatif pour pending ET confirmed
export const WINDOWS = [
  { days: 7,  pendingOnly: false },
  { days: 2,  pendingOnly: true  },
  { days: 1,  pendingOnly: false },
] as const

/** En-tête `Authorization` attendu ? Refus si CRON_SECRET est vide ; comparaison à temps constant. */
export function isAuthorizedCron(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret || !authHeader) return false
  const digest = (v: string) => createHash('sha256').update(v).digest()
  return timingSafeEqual(digest(authHeader), digest(`Bearer ${secret}`))
}

/** Découpe un tableau en lots de taille `size` — évite de lancer des centaines d'appels
 *  Auth Admin en parallèle d'un coup si un plan a beaucoup de bénévoles internes. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Bornes UTC [début, fin) de la journée locale située `days` jours après `now`, dans le fuseau donné. */
export function windowBounds(now: Date, days: number, timeZone: string): { start: string; end: string } {
  const target = addDays(localDateString(now, timeZone), days)
  return {
    start: startOfLocalDayUtc(target, timeZone),
    end: startOfLocalDayUtc(addDays(target, 1), timeZone),
  }
}

type AdminClient = ReturnType<typeof createAdminClient>

export type InternalRecipient = { firstName: string; email: string | null; userId: string | null }

/**
 * Résout en une fois les personnes internes (members) d'un lot d'affectations d'une église :
 * prénom, compte, e-mail du compte (Auth) ou, sans compte, e-mail de la fiche de contact.
 */
export async function resolveInternalMembers(admin: AdminClient, churchId: string, memberIds: string[]) {
  const uniqueIds = [...new Set(memberIds)]
  const recipients = new Map<string, InternalRecipient>()
  if (uniqueIds.length === 0) return recipients

  const [{ data: members }, { data: contacts }] = await Promise.all([
    admin.from('members').select('id, first_name, user_id').eq('church_id', churchId).in('id', uniqueIds),
    admin.from('member_contacts').select('member_id, email').eq('church_id', churchId).in('member_id', uniqueIds),
  ])
  const contactEmail = new Map<string, string>()
  for (const c of contacts ?? []) if (c.email) contactEmail.set(c.member_id, c.email)

  for (const m of members ?? []) {
    recipients.set(m.id, { firstName: m.first_name, email: contactEmail.get(m.id) ?? null, userId: m.user_id })
  }

  // L'e-mail du compte prime sur la fiche de contact (c'est celui qui sert à se connecter)
  const withAccount = [...recipients.entries()].filter(([, r]) => r.userId)
  for (const batch of chunk(withAccount, 10)) {
    const results = await Promise.all(batch.map(([, r]) => admin.auth.admin.getUserById(r.userId!)))
    results.forEach(({ data }, i) => {
      const email = data?.user?.email
      if (email) batch[i][1].email = email
    })
  }

  return recipients
}

type WindowResult = { churchId: string; planId: string; days: number; sent: number; skipped: number; errors: number }

/** Envoie les rappels d'une église : ses plans, ses affectations, son fuseau. */
export async function sendChurchReminders(
  admin: AdminClient,
  church: { id: string; name?: string | null; timezone: string | null },
  now: Date,
): Promise<WindowResult[]> {
  const churchId = church.id
  const timeZone = resolveTimeZone(church.timezone)
  const results: WindowResult[] = []

  for (const { days, pendingOnly } of WINDOWS) {
    const { start, end } = windowBounds(now, days, timeZone)

    const { data: plans, error: plansError } = await admin
      .from('plans')
      .select('id, title, service_date')
      .eq('church_id', churchId)
      .gte('service_date', start)
      .lt('service_date', end)

    if (plansError) {
      console.error(`[cron/reminders] erreur plans J-${days} :`, plansError.message)
      continue
    }

    for (const plan of plans ?? []) {
      const planResult: WindowResult = { churchId, planId: plan.id, days, sent: 0, skipped: 0, errors: 0 }

      let query = admin
        .from('plan_assignments')
        .select('id, member_id, status, external_name, external_email, reminder_sent_days, positions(name), teams(name)')
        .eq('church_id', churchId)
        .eq('plan_id', plan.id)
        .in('status', pendingOnly ? ['pending'] : ['pending', 'confirmed'])
      // Invités externes exclus des relances J-2 (pending only)
      if (pendingOnly) query = query.not('member_id', 'is', null)
      const { data: assignments } = await query

      const recipients = await resolveInternalMembers(
        admin,
        churchId,
        (assignments ?? []).map(a => a.member_id).filter((id): id is string => !!id),
      )

      for (const a of assignments ?? []) {
        // Déduplication : sauter si ce rappel a déjà été envoyé
        const sentDays = (a.reminder_sent_days as number[] | null) ?? []
        if (sentDays.includes(days)) {
          planResult.skipped++
          continue
        }

        const isPending = a.status === 'pending'
        const position = a.positions as unknown as { name: string } | null
        const team = a.teams as unknown as { name: string } | null

        try {
          if (!a.member_id) {
            // Invité externe : uniquement si un e-mail est renseigné
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
              timeZone,
              churchName: church.name,
            })
          } else {
            const r = recipients.get(a.member_id)
            if (!r || (!r.email && !r.userId)) continue

            if (r.email) {
              await sendReminderEmail({
                to: r.email,
                firstName: r.firstName,
                planTitle: plan.title,
                serviceDate: plan.service_date,
                positionName: position?.name ?? null,
                teamName: team?.name ?? null,
                assignmentId: a.id,
                daysLeft: days,
                isPending,
                isExternal: false,
                timeZone,
                churchName: church.name,
              })
            }

            // Notification push en complément (compte requis)
            if (r.userId) {
              const dayLabel = days === 1 ? 'demain' : `dans ${days} jours`
              const dateStr = new Date(plan.service_date).toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long', timeZone,
              })
              const pushBody = isPending && days <= 2
                ? `Tu n'as pas encore confirmé pour ${dateStr}${team?.name ? ` · ${team.name}` : ''}`
                : `Tu es planifié(e) ${dayLabel} (${dateStr})${team?.name ? ` · ${team.name}` : ''}`

              await sendPushToUser(r.userId, {
                title: isPending && days <= 2 ? `⚠ Confirmation attendue · ${plan.title}` : `⏰ Rappel — ${plan.title}`,
                body: pushBody,
                url: '/espace/dashboard',
                tag: `reminder-${a.id}-${days}`,
              }).catch(() => {})
            }
          }

          // Marquer ce rappel comme envoyé pour éviter les doublons
          await admin
            .from('plan_assignments')
            .update({ reminder_sent_days: [...sentDays, days] })
            .eq('id', a.id)
            .eq('church_id', churchId)

          planResult.sent++
        } catch (err) {
          planResult.errors++
          console.error(`[cron/reminders] J-${days} — affectation ${a.id} :`, (err as Error)?.message ?? 'erreur inconnue')
        }
      }

      results.push(planResult)
    }
  }

  return results
}
