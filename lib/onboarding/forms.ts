/** Contrôle des petits formulaires du guide de démarrage (fonctions pures, testées). */

export function parsePositions(raw: string): { positions: string[]; error?: string } {
  const names = raw
    .split(/[\n,;]+/)
    .map(n => n.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
  const unique = [...new Map(names.map(n => [n.toLowerCase(), n])).values()]
  if (unique.some(n => n.length > 80)) return { positions: [], error: 'Un poste est trop long (80 caractères au maximum).' }
  if (unique.length > 30) return { positions: [], error: 'Trente postes au maximum pour commencer : vous pourrez en ajouter ensuite.' }
  return { positions: unique }
}

export function validateTeamName(name: string): string | null {
  if (!name.trim()) return 'Donnez un nom à votre équipe (par exemple « Accueil » ou « Louange »).'
  if (name.trim().length > 80) return 'Ce nom est trop long (80 caractères au maximum).'
  return null
}

/** Date AAAA-MM-JJ et heure HH:MM d'un culte → instant local naïf, ou une erreur lisible. */
export function parseServiceDateTime(date: string, time: string): { local?: string; error?: string } {
  const d = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const t = time.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  if (!d || !t) return { error: 'Indiquez la date et l’heure du culte.' }
  const check = new Date(Date.UTC(+d[1], +d[2] - 1, +d[3]))
  if (check.getUTCFullYear() !== +d[1] || check.getUTCMonth() !== +d[2] - 1 || check.getUTCDate() !== +d[3]) {
    return { error: 'Cette date n’existe pas.' }
  }
  return { local: `${date}T${time}` }
}

export function validateServiceTitle(title: string): string | null {
  if (!title.trim()) return 'Donnez un titre au culte (par exemple « Culte du dimanche »).'
  if (title.trim().length > 160) return 'Ce titre est trop long (160 caractères au maximum).'
  return null
}
