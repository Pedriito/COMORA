import { isChordLine, isSectionHeader, transposeChart } from './transpose'

export type Slide = {
  songIdx: number
  slideIdx: number
  section: string
  lines: string[]
  isBlank?: boolean
  /** Numéros de lignes (0-indexés) dans le chord_chart original — utilisés pour la sauvegarde permanente */
  chartLineNums?: number[]
}

export type SongSlides = {
  title: string
  slides: Slide[]
}

type SongInput = {
  song: { title: string }
  keySelected: string | null
  arrangement: {
    chord_chart: string | null
    chord_chart_key: string | null
  } | null
}

function parseSongSlides(chart: string, fromKey: string | null, toKey: string | null, songIdx: number): Slide[] {
  // On parse toujours sur le texte ORIGINAL pour conserver les numéros de lignes corrects
  const rawLines = chart.split('\n')
  const slides: Slide[] = []
  let currentSection = ''
  let lyricBuffer: { text: string; lineNum: number }[] = []
  let localSlideIdx = 0

  function flushBuffer() {
    for (let i = 0; i < lyricBuffer.length; i += 2) {
      const pair = lyricBuffer.slice(i, i + 2)
      slides.push({
        songIdx,
        slideIdx: localSlideIdx++,
        section: currentSection,
        lines: pair.map(p => p.text),
        chartLineNums: pair.map(p => p.lineNum),
      })
    }
    lyricBuffer = []
  }

  rawLines.forEach((raw, lineNum) => {
    const line = raw.trimEnd()
    if (line.trim() === '') { flushBuffer(); return }
    if (isChordLine(line)) return
    if (isSectionHeader(line)) {
      flushBuffer()
      currentSection = line.trim().replace(/^\[|\]$/g, '').trim()
      return
    }
    lyricBuffer.push({ text: line.trim(), lineNum })
  })
  flushBuffer()

  // Appliquer la transposition sur les lignes d'accords uniquement (les paroles ne changent pas)
  // Note : la transposition ne touche pas les paroles donc les lignes affichées sont correctes.
  // Si une transposition est demandée, on réapplique sur les lignes de texte (pas les paroles).
  const result = slides.filter(s => s.lines.length > 0)

  if (fromKey && toKey && fromKey !== toKey) {
    // La transposition ne change que les accords — les lines[] sont inchangées. OK.
  }

  return result
}

export function buildAllSlides(songs: SongInput[]): SongSlides[] {
  return songs.map((s, songIdx) => {
    const chart = s.arrangement?.chord_chart ?? ''
    const fromKey = s.arrangement?.chord_chart_key ?? null
    const toKey = s.keySelected ?? fromKey
    const slides = chart ? parseSongSlides(chart, fromKey, toKey, songIdx) : []
    // Diapo noire de transition au début de chaque chant
    const blankSlide: Slide = { songIdx, slideIdx: 0, section: '', lines: [], isBlank: true }
    const numbered = [blankSlide, ...slides].map((sl, i) => ({ ...sl, slideIdx: i }))
    return { title: s.song.title, slides: numbered }
  })
}
