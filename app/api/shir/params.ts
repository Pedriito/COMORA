/** Validation des paramètres du proxy shir.fr (liste blanche, longueurs bornées). */

const MAX_QUERY = 100
const MAX_TITLE = 200
const MAX_CONTINUE = 200

// Pas de caractère de contrôle (retours à la ligne, tabulations…)
const CONTROL = /[\u0000-\u001f\u007f]/

export function cleanQuery(value: string | null): string | null {
  const q = (value ?? '').trim()
  if (!q || q.length > MAX_QUERY || CONTROL.test(q)) return null
  return q
}

/** Titre de page shir.fr : texte court sans caractère de contrôle (encodé ensuite dans l'URL). */
export function cleanTitle(value: string | null): string | null {
  const t = (value ?? '').trim()
  if (!t || t.length > MAX_TITLE || CONTROL.test(t)) return null
  return t
}

/** Jeton de pagination MediaWiki (ex. « page|4142|123 ») ; vide = première page. */
export function cleanContinue(value: string | null): string | null | undefined {
  const c = value ?? ''
  if (!c) return undefined
  if (c.length > MAX_CONTINUE || CONTROL.test(c)) return null
  return c
}
