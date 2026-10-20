/**
 * Convertit une heure locale "naïve" (Europe/Paris, sans indication de fuseau — ex : celle
 * envoyée par un `<input type="datetime-local">`, ou construite à la main par concaténation de
 * chaînes ailleurs dans `admin/plans`) en instant UTC ISO, pour écriture dans une colonne
 * `timestamptz`.
 *
 * Nécessaire car toutes les écritures de `plans.service_date` (création, duplication,
 * glisser-déposer dans le calendrier, édition inline de l'heure) envoient une chaîne
 * "YYYY-MM-DDTHH:mm" sans fuseau. Sans conversion, Postgres l'interprète comme de l'UTC : une
 * saisie de "10:00" est alors stockée comme 10h UTC, puis affichée (correctement, elle) en heure
 * de Paris comme 11h (CET, hiver) ou 12h (CEST, été) — d'où l'heure fausse ET son décalage
 * saisonnier ("ça ne devrait pas bouger").
 *
 * Algorithme (double conversion via `Intl`) : on interprète d'abord les chiffres saisis comme de
 * l'UTC (hypothèse de travail arbitraire), on formate cet instant en heure de Paris pour
 * connaître le décalage réel à cette date précise (`Intl` applique automatiquement les règles de
 * changement d'heure, pas de table de dates DST à maintenir), puis on corrige l'instant UTC de ce
 * décalage.
 */
export function parisLocalToUtcIso(naiveLocal: string): string {
  const [datePart, timePart = '00:00'] = naiveLocal.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [h = '0', mi = '0', s = '0'] = timePart.split(':')

  const guessUtc = new Date(Date.UTC(y, mo - 1, d, Number(h), Number(mi), Number(s)))

  const parisFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts = Object.fromEntries(
    parisFormatter.formatToParts(guessUtc).map(p => [p.type, p.value])
  ) as Record<string, string>

  const parisReadAsUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  )

  const offsetMs = parisReadAsUtc - guessUtc.getTime()
  return new Date(guessUtc.getTime() - offsetMs).toISOString()
}
