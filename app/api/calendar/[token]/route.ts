import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import { siteUrl as getSiteUrl } from '@/lib/site'
import { hashToken, isWellFormedToken } from '@/lib/tokens'
import { resolveTimeZone } from '@/lib/timezone'

/*
 * Abonnement calendrier (ICS) d'un compte pour une église.
 * Le jeton opaque du lien est haché puis recherché dans `calendar_feeds` ; seuls les plans de
 * l'église du flux sont exportés. Les notes internes des plans ne sont jamais incluses : le
 * lien est copié dans des agendas tiers (Google, Apple, Outlook) qui le synchronisent depuis
 * leurs serveurs, hors du contrôle de l'église.
 */

function escapeIcal(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Instant UTC au format iCalendar (YYYYMMDDTHHMMSSZ), indépendant du fuseau du serveur. */
function toIcalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

const TYPE_NAMES: Record<string, string> = {
  sunday_service: 'Culte du dimanche',
  prayer_meeting: 'Réunion de prière',
  rehearsal:      'Répétition',
}

/** Historique exporté : un an en arrière (les services à venir sont tous exportés). */
const HISTORY_DAYS = 365

function notFound() {
  return new Response('Lien invalide ou révoqué', {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const cleanToken = token.replace(/\.ics$/, '')
  if (!isWellFormedToken(cleanToken)) return notFound()

  // Clé secrète : lien public sans session ; le flux trouvé fixe l'église, et chaque requête
  // suivante est filtrée par son church_id.
  const admin = createAdminClient()

  const { data: feed } = await admin
    .from('calendar_feeds')
    .select('church_id, user_id')
    .eq('token_hash', hashToken(cleanToken))
    .is('revoked_at', null)
    .maybeSingle()
  if (!feed) return notFound()

  // Le compte doit toujours appartenir à l'église (un ancien membre perd l'accès)
  const [{ data: membership }, { data: church }] = await Promise.all([
    admin
      .from('church_memberships')
      .select('id')
      .eq('church_id', feed.church_id)
      .eq('user_id', feed.user_id)
      .eq('status', 'active')
      .maybeSingle(),
    admin.from('churches').select('name, timezone').eq('id', feed.church_id).maybeSingle(),
  ])
  if (!membership || !church) return notFound()

  const since = new Date(Date.now() - HISTORY_DAYS * 24 * 3600 * 1000).toISOString()
  const { data: plans, error } = await admin
    .from('plans')
    .select('id, title, service_date, plan_type')
    .eq('church_id', feed.church_id)
    .gte('service_date', since)
    .order('service_date')

  if (error || !plans) {
    return new Response('Erreur', { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }

  const siteUrl = getSiteUrl()
  const timeZone = resolveTimeZone(church.timezone)

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Comora//Planning//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcal(`Planning — ${church.name}`)}`,
    // Heures exportées en UTC (suffixe Z) ; le fuseau de l'église sert d'indication d'affichage
    `X-WR-TIMEZONE:${timeZone}`,
    'X-WR-CALDESC:Services et événements de votre église',
  ]

  const stamp = toIcalDate(new Date())
  for (const plan of plans) {
    const start = new Date(plan.service_date)
    // Durée par défaut : 2h pour cultes, 1h pour prière/répétition
    const durationH = plan.plan_type === 'sunday_service' ? 2 : 1
    const end = new Date(start.getTime() + durationH * 3600000)
    const typeName = TYPE_NAMES[plan.plan_type ?? 'sunday_service'] ?? plan.plan_type ?? ''

    lines.push(
      'BEGIN:VEVENT',
      `UID:plan-${plan.id}@comora.fr`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toIcalDate(start)}`,
      `DTEND:${toIcalDate(end)}`,
      `SUMMARY:${escapeIcal(plan.title)}`,
      `DESCRIPTION:${escapeIcal(typeName)}`,
      `URL:${siteUrl}/espace/admin/plans/${plan.id}`,
      `CATEGORIES:${escapeIcal(typeName)}`,
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')

  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="planning.ics"',
      // Contenu propre à un lien secret : jamais mis en cache par un intermédiaire
      'Cache-Control': 'private, no-store',
    },
  })
}
