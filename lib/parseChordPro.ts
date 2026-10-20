/**
 * Parse un fichier ChordPro (format shir.fr) et le convertit
 * vers notre format interne (accords sur la ligne au-dessus des paroles,
 * sections entre crochets).
 */

export type ParsedChordPro = {
  title:      string
  artist:     string | null
  key:        string | null
  bpm:        number | null
  chart:      string   // notre format chord_chart
}

/** Extrait la valeur d'une directive ChordPro {tag:value} */
function directive(line: string, tag: string): string | null {
  const re = new RegExp(`\\{${tag}:([^}]*)\\}`, 'i')
  const m = line.match(re)
  return m ? m[1].trim() : null
}

/** Convertit une ligne ChordPro avec accords inline vers deux lignes (accords + paroles) */
function inlineToAbove(line: string): string {
  // Si pas d'accord inline, retourner la ligne telle quelle
  if (!line.includes('[')) return line

  let chordLine = ''
  let lyricsLine = ''
  let i = 0

  while (i < line.length) {
    if (line[i] === '[') {
      const end = line.indexOf(']', i)
      if (end === -1) { lyricsLine += line[i++]; continue }
      const chord = line.slice(i + 1, end)
      // Aligner l'accord à la position courante dans lyricsLine
      const pos = lyricsLine.length
      while (chordLine.length < pos) chordLine += ' '
      chordLine += chord
      i = end + 1
    } else {
      lyricsLine += line[i++]
    }
  }

  // Ne retourner que la ligne d'accords si la ligne de paroles est vide
  if (!lyricsLine.trim()) return chordLine.trim()
  return `${chordLine}\n${lyricsLine}`
}

/** Normalise un nom de section */
function sectionName(raw: string): string {
  const s = raw.toLowerCase().trim()
  if (/refrain|chorus|soc/.test(s))   return 'Refrain'
  if (/couplet|verse|strophe/.test(s)) return 'Couplet'
  if (/pont|bridge/.test(s))           return 'Pont'
  if (/intro/.test(s))                 return 'Intro'
  if (/outro/.test(s))                 return 'Outro'
  if (/pre.?refrain|pre.?chorus/.test(s)) return 'Pré-refrain'
  if (/tag/.test(s))                   return 'Tag'
  // Conserver le nom original si non reconnu
  return raw.trim()
}

export function parseChordPro(text: string): ParsedChordPro {
  const lines = text.split('\n')
  let title  = ''
  let artist: string | null = null
  let key:    string | null = null
  let bpm:    number | null = null

  const sections: { name: string; lines: string[] }[] = []
  let currentSection: { name: string; lines: string[] } | null = null
  let inChorus = false
  let chorusCount = 0
  let coupletCount = 0

  function pushSection() {
    if (currentSection && currentSection.lines.some(l => l.trim())) {
      sections.push(currentSection)
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    // ── Directives ────────────────────────────────────────────────────────
    if (line.startsWith('{') && line.includes('}')) {
      const t = directive(line, 't') ?? directive(line, 'title')
      if (t) { title = t; continue }

      const st = directive(line, 'st') ?? directive(line, 'subtitle')
      if (st) { artist = st; continue }

      const k = directive(line, 'key')
      if (k) { key = k.replace(/m$/, ''); continue }  // enlève le 'm' de 'Em' pour avoir juste la tonalité

      const tempo = directive(line, 'tempo')
      if (tempo) { bpm = parseInt(tempo, 10) || null; continue }

      // Début refrain
      if (/\{soc\}/i.test(line) || /\{start_of_chorus\}/i.test(line)) {
        pushSection()
        chorusCount++
        const name = chorusCount > 1 ? `Refrain ${chorusCount}` : 'Refrain'
        currentSection = { name, lines: [] }
        inChorus = true
        continue
      }
      // Fin refrain
      if (/\{eoc\}/i.test(line) || /\{end_of_chorus\}/i.test(line)) {
        inChorus = false
        continue
      }
      // Début verse
      if (/\{sov\}/i.test(line) || /\{start_of_verse\}/i.test(line)) {
        pushSection()
        coupletCount++
        const name = coupletCount > 1 ? `Couplet ${coupletCount}` : 'Couplet 1'
        currentSection = { name, lines: [] }
        continue
      }
      if (/\{eov\}/i.test(line) || /\{end_of_verse\}/i.test(line)) continue

      // Début bridge
      if (/\{sob\}/i.test(line) || /\{start_of_bridge\}/i.test(line)) {
        pushSection()
        currentSection = { name: 'Pont', lines: [] }
        continue
      }
      if (/\{eob\}/i.test(line) || /\{end_of_bridge\}/i.test(line)) continue

      // Commentaires utilisés comme titres de section {c:Pont}, {c:Couplet 2}…
      const comment = directive(line, 'c') ?? directive(line, 'comment')
      if (comment) {
        const norm = sectionName(comment)
        // Si le commentaire ressemble à un label de section, l'utiliser
        if (/couplet|verse|refrain|chorus|pont|bridge|intro|outro|tag|pré|pre/i.test(comment)) {
          pushSection()
          currentSection = { name: norm, lines: [] }
        }
        // Sinon ignorer (copyright, info catalogue…)
        continue
      }

      // Ignorer les autres directives (copyright, etc.)
      continue
    }

    // ── Ligne vide ────────────────────────────────────────────────────────
    if (!line.trim()) {
      if (currentSection) currentSection.lines.push('')
      continue
    }

    // ── Ligne de contenu ──────────────────────────────────────────────────
    // Si on est encore dans aucune section, créer une section implicite
    if (!currentSection) {
      coupletCount++
      const name = coupletCount > 1 ? `Couplet ${coupletCount}` : 'Couplet 1'
      currentSection = { name, lines: [] }
    }

    const converted = inlineToAbove(line)
    currentSection.lines.push(...converted.split('\n'))
  }

  pushSection()

  // ── Construire le chord_chart ──────────────────────────────────────────
  const parts: string[] = []
  for (const sec of sections) {
    // Supprimer les lignes vides en début/fin de section
    const trimmed = sec.lines.join('\n').trim()
    if (!trimmed) continue
    parts.push(`[${sec.name}]\n${trimmed}`)
  }

  const chart = parts.join('\n\n')

  return { title, artist, key, bpm, chart }
}
