import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import { siteConfig, siteUrl as getSiteUrl } from '@/lib/site'

function escapeIcal(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function toIcalDate(dateStr: string): string {
  // YYYYMMDDTHHMMSSZ
  const d = new Date(dateStr)
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

const TYPE_NAMES: Record<string, string> = {
  sunday_service: 'Culte du dimanche',
  prayer_meeting: 'Réunion de prière',
  rehearsal:      'Répétition',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  // Enlever le .ics s'il est présent
  const cleanToken = token.replace(/\.ics$/, '')

  const admin = createAdminClient()

  // Vérifier le token
  const { data: settings } = await admin
    .from('projection_settings')
    .select('calendar_token')
    .single()

  if (!settings?.calendar_token || settings.calendar_token !== cleanToken) {
    return new Response('Token invalide', { status: 401 })
  }

  // Charger tous les plans (passés + à venir)
  const { data: plans } = await admin
    .from('plans')
    .select('id, title, service_date, plan_type, notes')
    .order('service_date')

  if (!plans) return new Response('Erreur', { status: 500 })

  const siteUrl = getSiteUrl()

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Comora//Planning//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Planning — ${siteConfig.name}`,
    'X-WR-TIMEZONE:Europe/Paris',
    'X-WR-CALDESC:Services et événements de votre église',
  ]

  for (const plan of plans) {
    const start = new Date(plan.service_date)
    // Durée par défaut : 2h pour cultes, 1h pour prière/répétition
    const durationH = plan.plan_type === 'sunday_service' ? 2 : 1
    const end = new Date(start.getTime() + durationH * 3600000)

    const typeName = TYPE_NAMES[plan.plan_type ?? 'sunday_service'] ?? plan.plan_type ?? ''
    const summary  = escapeIcal(plan.title)
    const desc     = plan.notes ? escapeIcal(plan.notes) : typeName
    const url      = `${siteUrl}/espace/admin/plans/${plan.id}`
    const uid      = `plan-${plan.id}@comora.fr`

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${toIcalDate(plan.service_date)}`,
      `DTEND:${toIcalDate(end.toISOString())}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${desc}`,
      `URL:${url}`,
      `CATEGORIES:${typeName}`,
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')

  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="eglise-planning.ics"',
      // Pollé périodiquement par des clients calendrier externes (Google/Apple Calendar) —
      // un court cache CDN évite de recalculer l'ICS complet à chaque poll.
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
