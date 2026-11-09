import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import { isAuthorizedCron } from '../reminders/reminders'
import { runLifecycleEmails } from '@/lib/email/lifecycle-send'

/*
 * Cycle de vie des espaces, appelé chaque jour (Authorization: Bearer CRON_SECRET) :
 *   1. les essais et grâces terminés passent en lecture seule, suppression programmée à +90 jours ;
 *   2. on recense les espaces à avertir (J-7) et ceux dont la suppression est échue.
 *
 * AUCUNE SUPPRESSION n'est faite ici : l'étape 2 est une simulation qui journalise ce qui serait
 * supprimé. La suppression réelle est irréversible ; elle sera ajoutée après relecture du code.
 * Les e-mails d'avertissement arrivent à l'étape 8.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Clé secrète : tâche planifiée sans session, sur l'ensemble des églises.
  const admin = createAdminClient()

  const { data: step, error } = await admin.rpc('church_lifecycle_step')
  if (error) {
    console.error('[cron/lifecycle] passage en lecture seule impossible :', error.message)
    return Response.json({ ok: false }, { status: 500 })
  }

  const now = new Date()

  // Un échec d'e-mail ne doit pas masquer le reste du passage : on le signale par un code 500 à la fin
  let emails: Awaited<ReturnType<typeof runLifecycleEmails>> | null = null
  try {
    emails = await runLifecycleEmails(admin, now)
  } catch (err) {
    console.error('[cron/lifecycle] e-mails impossibles :', (err as Error).message)
  }

  const { data: due } = await admin.from('churches').select('id').lte('deletion_scheduled_at', now.toISOString())

  console.log(
    `[cron/lifecycle] ${JSON.stringify(step)} · e-mails : ${emails ? JSON.stringify(emails) : 'ÉCHEC'} · suppression échue (SIMULATION, rien n'est supprimé) : ${due?.length ?? 0}`,
  )
  return Response.json({ ok: emails !== null, ...(step as object), emails, deletionDue: due?.length ?? 0, deleted: 0 }, { status: emails ? 200 : 500 })
}
