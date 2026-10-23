import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import { isAuthorizedCron } from '../reminders/reminders'

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
  const warnBefore = new Date(now.getTime() + 7 * 864e5).toISOString()
  const [{ data: toWarn }, { data: due }] = await Promise.all([
    admin.from('churches').select('id').gt('deletion_scheduled_at', now.toISOString()).lte('deletion_scheduled_at', warnBefore),
    admin.from('churches').select('id').lte('deletion_scheduled_at', now.toISOString()),
  ])

  console.log(
    `[cron/lifecycle] ${JSON.stringify(step)} · à avertir (J-7) : ${toWarn?.length ?? 0} · suppression échue (SIMULATION, rien n'est supprimé) : ${due?.length ?? 0}`,
  )
  return Response.json({ ok: true, ...(step as object), toWarn: toWarn?.length ?? 0, deletionDue: due?.length ?? 0, deleted: 0 })
}
