import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import { isAuthorizedCron, sendChurchReminders } from './reminders'

/*
 * Rappels J-7 / J-2 / J-1, appelé par le cron (Authorization: Bearer CRON_SECRET).
 * Chaque église est traitée séparément, dans son fuseau : aucun envoi ne mélange les données
 * de deux églises.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Clé secrète : tâche planifiée sans session ; chaque requête est filtrée par church_id
  // (voir sendChurchReminders).
  const admin = createAdminClient()

  const { data: churches, error } = await admin
    .from('churches')
    .select('id, name, timezone')
    .not('billing_status', 'in', '(canceled,pending_deletion)')

  if (error) {
    console.error('[cron/reminders] erreur églises :', error.message)
    return Response.json({ ok: false }, { status: 500 })
  }

  const now = new Date()
  const results = []
  for (const church of churches ?? []) {
    try {
      results.push(...await sendChurchReminders(admin, church, now))
    } catch (err) {
      console.error(`[cron/reminders] église ${church.id} :`, (err as Error)?.message ?? 'erreur inconnue')
    }
  }

  const sent = results.reduce((n, r) => n + r.sent, 0)
  const errors = results.reduce((n, r) => n + r.errors, 0)
  console.log(`[cron/reminders] terminé : ${churches?.length ?? 0} église(s), ${sent} rappel(s), ${errors} erreur(s)`)
  return Response.json({ ok: true, churches: churches?.length ?? 0, sent, errors })
}
