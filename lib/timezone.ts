/*
 * Heures locales d'une église ↔ instants UTC.
 *
 * Les formulaires (`<input type="datetime-local">`, glisser-déposer du calendrier, édition de
 * l'heure) envoient une heure « naïve » ("YYYY-MM-DDTHH:mm", sans fuseau). Sans conversion,
 * Postgres l'interpréterait comme de l'UTC dans une colonne `timestamptz`. Chaque église a son
 * fuseau (`churches.timezone`, IANA) : toutes les conversions et tous les affichages passent par
 * lui, jamais par le fuseau du serveur.
 */

export const DEFAULT_TIMEZONE = 'Europe/Paris'

/** Fuseau IANA reconnu par le moteur (`Intl`) ? */
export function isValidTimeZone(timeZone: string | null | undefined): timeZone is string {
  if (!timeZone) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

/** Fuseau utilisable : celui de l'église s'il est valide, sinon le fuseau par défaut. */
export function resolveTimeZone(timeZone: string | null | undefined): string {
  return isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIMEZONE
}

export type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; second: number }

/** Composantes de l'heure locale d'un instant dans un fuseau donné. */
export function utcToLocalParts(instant: Date | string, timeZone: string): LocalParts {
  const date = typeof instant === 'string' ? new Date(instant) : instant
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimeZone(timeZone),
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value])) as Record<string, string>
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

/** Décalage (ms) du fuseau par rapport à UTC à cet instant. */
function offsetAt(utcMs: number, timeZone: string): number {
  const p = utcToLocalParts(new Date(utcMs), timeZone)
  const localAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return localAsUtc - Math.floor(utcMs / 1000) * 1000
}

/**
 * Convertit une heure locale naïve ("YYYY-MM-DDTHH:mm[:ss]") du fuseau donné en instant UTC ISO.
 * On lit d'abord les chiffres comme de l'UTC, on mesure le décalage réel du fuseau à cette date
 * (`Intl` applique les changements d'heure), puis on corrige ; une seconde passe règle les cas
 * où la correction fait franchir un changement d'heure.
 */
export function localToUtcIso(naiveLocal: string, timeZone: string): string {
  const [datePart, timePart = '00:00'] = naiveLocal.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [h = '0', mi = '0', s = '0'] = timePart.split(':')
  const guess = Date.UTC(y, mo - 1, d, Number(h), Number(mi), Number(s))

  const tz = resolveTimeZone(timeZone)
  let utc = guess - offsetAt(guess, tz)
  const second = guess - offsetAt(utc, tz)
  if (second !== utc) utc = second
  return new Date(utc).toISOString()
}

/** Date locale "YYYY-MM-DD" d'un instant dans le fuseau donné. */
export function localDateString(instant: Date | string, timeZone: string): string {
  const p = utcToLocalParts(instant, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Ajoute (ou retire) des jours à une date "YYYY-MM-DD", sans dépendre d'un fuseau. */
export function addDays(dateString: string, days: number): string {
  const [y, m, d] = dateString.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Instant UTC (ISO) du début de la journée locale "YYYY-MM-DD" dans le fuseau donné. */
export function startOfLocalDayUtc(dateString: string, timeZone: string): string {
  return localToUtcIso(`${dateString}T00:00`, timeZone)
}
