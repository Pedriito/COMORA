import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { deliver } from '@/lib/email/espace'
import {
  dueTimeKinds,
  emailKey,
  renderLifecycleEmail,
  type ChurchLifecycleRow,
  type LifecycleContext,
  type LifecycleKind,
} from '@/lib/email/lifecycle'

/*
 * Envoi des e-mails du cycle de vie, avec la clé secrète (tâche planifiée et webhook, sans session).
 *
 * Garanties :
 *   - jamais deux fois le même message à la même personne : l'envoi est réservé dans email_sends
 *     (claim_email_send, atomique) avant de partir ;
 *   - en cas d'échec d'envoi, la réservation est levée : le prochain passage réessaie ;
 *   - aucune adresse ni aucun nom dans les journaux.
 *
 * Les destinataires sont les administrateurs actifs de l'église, retrouvés par son identifiant :
 * un message ne peut pas partir vers une autre église.
 */

type Admin = SupabaseClient

export type Recipient = { userId: string; email: string; firstName: string }
export type SendTally = { sent: number; skipped: number; failed: number }
export type MessageExtras = Pick<LifecycleContext, 'daysLeft' | 'trialEndsAt' | 'graceEndsAt' | 'deletionAt' | 'periodEnd' | 'offerName' | 'interval'>

/** Message d'erreur sans adresse e-mail : les journaux ne doivent contenir aucune donnée de personne. */
const redact = (err: unknown) => (err instanceof Error ? err.message : 'erreur inconnue').replace(/[^\s<>"']+@[^\s<>"']+/g, '[adresse]')

const none = (): SendTally => ({ sent: 0, skipped: 0, failed: 0 })

/** Administrateurs actifs d'une église, avec leur adresse de connexion et leur prénom. */
export async function churchAdminRecipients(admin: Admin, churchId: string): Promise<Recipient[]> {
  const { data: memberships } = await admin.from('church_memberships').select('user_id').eq('church_id', churchId).eq('role', 'admin').eq('status', 'active')
  const ids = (memberships ?? []).map((m: { user_id: string }) => m.user_id)
  if (ids.length === 0) return []

  const { data: profiles } = await admin.from('profiles').select('id, first_name').in('id', ids)
  const firstNames = new Map((profiles ?? []).map((p: { id: string; first_name: string | null }) => [p.id, p.first_name ?? '']))

  const users = await Promise.all(ids.map((id) => admin.auth.admin.getUserById(id)))
  const recipients: Recipient[] = []
  users.forEach(({ data }, i) => {
    const email = data?.user?.email
    if (email) recipients.push({ userId: ids[i], email, firstName: firstNames.get(ids[i]) ?? '' })
  })
  return recipients
}

/** Envoie un message du cycle de vie à tous les administrateurs de l'église (sauf ceux qui l'ont déjà reçu). */
export async function sendLifecycleEmail(
  admin: Admin,
  church: { id: string; name: string; timezone: string },
  kind: LifecycleKind,
  key: string,
  extras: MessageExtras = {},
): Promise<SendTally> {
  const tally = none()
  const recipients = await churchAdminRecipients(admin, church.id)

  for (const r of recipients) {
    const { data: claimed, error } = await admin.rpc('claim_email_send', { p_church_id: church.id, p_user_id: r.userId, p_kind: key })
    if (error) {
      console.error(`[email/${kind}] réservation impossible :`, error.code ?? 'erreur')
      tally.failed++
      continue
    }
    if (!claimed) {
      tally.skipped++
      continue
    }
    try {
      const { subject, html } = renderLifecycleEmail(kind, { ...extras, firstName: r.firstName, churchName: church.name, timeZone: church.timezone })
      await deliver(kind, { to: r.email, subject, html, idempotencyKey: `lifecycle/${church.id}/${r.userId}/${key}` })
      await admin.from('email_sends').update({ sent_at: new Date().toISOString() }).eq('church_id', church.id).eq('user_id', r.userId).eq('kind', key)
      tally.sent++
    } catch (err) {
      console.error(`[email/${kind}] envoi impossible :`, redact(err))
      // On lève la réservation : le prochain passage réessaiera
      await admin.from('email_sends').delete().eq('church_id', church.id).eq('user_id', r.userId).eq('kind', key).is('sent_at', null)
      tally.failed++
    }
  }
  return tally
}

/**
 * Envoi d'un message déclenché par un événement (création de l'espace, webhook Stripe).
 * Ne lève jamais d'erreur : un problème d'e-mail ne doit ni bloquer la création d'un espace
 * ni faire rejouer un événement de paiement. Le cron rattrape les messages qui dépendent du temps.
 */
export async function notifyChurch(
  admin: Admin,
  churchId: string,
  kind: LifecycleKind,
  discriminator?: string | Date | null,
  extras: MessageExtras = {},
): Promise<void> {
  try {
    const { data: church } = await admin.from('churches').select('id, name, timezone').eq('id', churchId).maybeSingle()
    if (!church) return
    await sendLifecycleEmail(admin, church, kind, emailKey(kind, discriminator), extras)
  } catch (err) {
    console.error(`[email/${kind}] notification impossible :`, redact(err))
  }
}

export type LifecycleSummary = { churches: number } & Record<LifecycleKind, SendTally>

const emptySummary = (): LifecycleSummary => ({
  churches: 0,
  welcome: none(),
  no_import_d3: none(),
  trial_midway: none(),
  trial_ending_7: none(),
  trial_ending_1: none(),
  deletion_warning: none(),
  payment_failed: none(),
  subscription_confirmed: none(),
  cancellation_scheduled: none(),
  subscription_ended: none(),
})

const CHURCH_COLUMNS = 'id, name, timezone, billing_status, created_at, trial_ends_at, grace_ends_at, deletion_scheduled_at'

/** Une église qui n'a pas encore importé de personnes (hors la sienne) et n'a pas écarté cette étape. */
async function wantsImportNudge(admin: Admin, churchId: string): Promise<boolean> {
  const [{ count }, { data: progress }] = await Promise.all([
    admin.from('members').select('id', { count: 'exact', head: true }).eq('church_id', churchId),
    admin.from('onboarding_progress').select('skipped').eq('church_id', churchId).maybeSingle(),
  ])
  const skipped = (progress as { skipped?: string[] } | null)?.skipped ?? []
  return (count ?? 0) < 2 && !skipped.includes('import')
}

/**
 * Passage quotidien : envoie à chaque église les messages que son calendrier rend dus
 * (bienvenue, relance d'import, essai, impayé, avertissement de suppression).
 * Chaque église est traitée séparément : une erreur chez l'une n'arrête pas les autres.
 */
export async function runLifecycleEmails(admin: Admin, now: Date = new Date()): Promise<LifecycleSummary> {
  const summary = emptySummary()
  const { data, error } = await admin.from('churches').select(CHURCH_COLUMNS).neq('billing_status', 'active')
  if (error) throw new Error(`églises : ${error.message}`)

  for (const church of (data ?? []) as ChurchLifecycleRow[]) {
    summary.churches++
    try {
      for (const { kind, key } of dueTimeKinds(church, now)) {
        if (kind === 'no_import_d3' && !(await wantsImportNudge(admin, church.id))) continue
        const trialMsLeft = church.trial_ends_at ? new Date(church.trial_ends_at).getTime() - now.getTime() : null
        const tally = await sendLifecycleEmail(admin, church, kind, key, {
          daysLeft: trialMsLeft === null ? undefined : Math.max(0, Math.ceil(trialMsLeft / 864e5)),
          trialEndsAt: church.trial_ends_at,
          graceEndsAt: church.grace_ends_at,
          deletionAt: church.deletion_scheduled_at,
        })
        summary[kind].sent += tally.sent
        summary[kind].skipped += tally.skipped
        summary[kind].failed += tally.failed
      }
    } catch (err) {
      console.error(`[email/lifecycle] église ${church.id} :`, redact(err))
    }
  }
  return summary
}
