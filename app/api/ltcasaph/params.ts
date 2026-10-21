/** Validation des paramètres du proxy db.ltc-asaph.com. */

const MAX_QUERY = 100

export function cleanQuery(value: string | null): string | null {
  const q = (value ?? '').trim()
  if (!q || q.length > MAX_QUERY || /[\u0000-\u001f\u007f]/.test(q)) return null
  return q
}

/** Identifiant de chant LTC Asaph : entier positif (legacy_id). */
export function cleanSongId(value: string | null): string | null {
  return value && /^[1-9]\d{0,6}$/.test(value) ? value : null
}
