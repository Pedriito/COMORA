/**
 * Import d'une liste de personnes (CSV ou Excel) : lecture, reconnaissance des
 * colonnes, contrôle de chaque ligne. Fonctions pures, testées sans serveur
 * (lib/onboarding/members-import.test.ts). Le serveur refait ce contrôle avant
 * d'écrire : ce que le navigateur renvoie n'est jamais cru sur parole.
 */

export const MAX_IMPORT_ROWS = 2000
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024

export type ImportRow = {
  first_name: string
  last_name: string
  email: string
  phone: string
  city: string
  /** AAAA-MM-JJ ou chaîne vide. */
  birthdate: string
}

export type RowIssue = { line: number; message: string }

export type ImportPreview = {
  rows: ImportRow[]
  /** Lignes écartées, avec la raison, pour les montrer à la personne. */
  issues: RowIssue[]
  /** Colonnes du fichier qui n'ont pas été reconnues. */
  ignoredColumns: string[]
  /** Fichier sans les colonnes indispensables (prénom). */
  missingFirstName: boolean
}

type Field = keyof ImportRow

const HEADER_ALIASES: Record<Field, string[]> = {
  first_name: ['prenom', 'prenoms', 'first name', 'firstname', 'given name'],
  last_name: ['nom', 'nom de famille', 'last name', 'lastname', 'surname', 'family name'],
  email: ['email', 'e-mail', 'mail', 'courriel', 'adresse email', 'adresse e-mail', 'adresse mail'],
  phone: ['telephone', 'tel', 'tel.', 'portable', 'mobile', 'phone', 'numero de telephone', 'gsm'],
  city: ['ville', 'city', 'commune'],
  birthdate: ['date de naissance', 'naissance', 'anniversaire', 'birthdate', 'birthday', 'date naissance'],
}

/** Minuscules, sans accents, espaces simples : « Prénom » = « prenom ». */
export function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[_\s]+/g, ' ')
    .trim()
}

/** Séparateur le plus fréquent sur la première ligne : « ; » (Excel français), « , » ou tabulation. */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const counts = [';', ',', '\t'].map(d => [d, firstLine.split(d).length - 1] as const)
  counts.sort((a, b) => b[1] - a[1])
  return counts[0][1] > 0 ? counts[0][0] : ';'
}

/** Lecture CSV (guillemets, séparateur dans un champ, retours à la ligne dans un champ). */
export function parseDelimited(input: string): string[][] {
  const text = input.replace(/^﻿/, '')
  const delimiter = detectDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === delimiter) { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      rows.push(row); row = []
    } else field += c
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

/** Décode des octets CSV : UTF-8, sinon Windows-1252 (ancien Excel). */
export function decodeCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/

export function isEmail(value: string): boolean {
  return value.length <= 254 && EMAIL.test(value)
}

/** « 06 12 34 56 78 », « +33 6… » : on garde chiffres, +, espaces et tirets usuels. */
export function cleanPhone(value: string): string | null {
  const v = value.trim()
  if (!v) return ''
  if (!/^[+\d][\d\s().-]{5,24}$/.test(v)) return null
  return v.replace(/\s+/g, ' ')
}

/** JJ/MM/AAAA, JJ-MM-AAAA ou AAAA-MM-JJ → AAAA-MM-JJ ; null si invalide. */
export function parseBirthdate(value: string): string | null {
  const v = value.trim()
  if (!v) return ''
  let y: number, m: number, d: number
  let match = v.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/)
  if (match) { d = +match[1]; m = +match[2]; y = +match[3] }
  else if ((match = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/))) { y = +match[1]; m = +match[2]; d = +match[3] }
  else return null
  const date = new Date(Date.UTC(y, m - 1, d))
  const valid = date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
  const thisYear = new Date().getUTCFullYear()
  if (!valid || y < 1900 || y > thisYear) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Une cellule (texte, nombre, date Excel) en texte propre. */
export function cellToString(cell: unknown): string {
  if (cell == null) return ''
  if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? '' : cell.toISOString().slice(0, 10)
  return String(cell).trim()
}

/** Anti-« injection de formule » : une cellule qui commence par = + - @ ne sera jamais interprétée par un tableur si on réexporte. */
function safeText(value: string): string {
  return /^[=+\-@]/.test(value) && !/^[+-]?[\d\s().-]+$/.test(value) ? `'${value}` : value
}

/**
 * Fichier lu (lignes de cellules, la première étant l'en-tête) → lignes contrôlées.
 * Les lignes en erreur sont écartées et expliquées ; les doublons d'adresse du fichier aussi.
 */
export function buildPreview(table: unknown[][]): ImportPreview {
  const [header = [], ...body] = table
  const columns = new Map<Field, number>()
  const ignored: string[] = []

  header.forEach((h, index) => {
    const name = normalizeHeader(cellToString(h))
    if (!name) return
    const field = (Object.keys(HEADER_ALIASES) as Field[]).find(f => HEADER_ALIASES[f].includes(name))
    if (field && !columns.has(field)) columns.set(field, index)
    else ignored.push(cellToString(h))
  })

  const preview: ImportPreview = { rows: [], issues: [], ignoredColumns: ignored, missingFirstName: !columns.has('first_name') }
  if (preview.missingFirstName) return preview

  const get = (row: unknown[], field: Field) => {
    const index = columns.get(field)
    return index === undefined ? '' : cellToString(row[index])
  }
  const seen = new Set<string>()

  body.forEach((raw, i) => {
    const line = i + 2 // ligne 1 = en-tête, comme dans le tableur
    const cells = Array.isArray(raw) ? raw : []
    if (cells.every(c => cellToString(c) === '')) return

    if (preview.rows.length >= MAX_IMPORT_ROWS) {
      if (!preview.issues.some(x => x.message.startsWith('Trop de lignes'))) {
        preview.issues.push({ line, message: `Trop de lignes : les ${MAX_IMPORT_ROWS} premières personnes sont conservées. Importez le reste dans un second fichier.` })
      }
      return
    }

    const first = get(cells, 'first_name')
    const last = get(cells, 'last_name')
    const email = get(cells, 'email').toLowerCase()
    const phone = cleanPhone(get(cells, 'phone'))
    const birth = parseBirthdate(get(cells, 'birthdate'))

    if (!first) return void preview.issues.push({ line, message: 'Prénom manquant.' })
    if (first.length > 80 || last.length > 80) return void preview.issues.push({ line, message: 'Prénom ou nom trop long (80 caractères au maximum).' })
    if (email && !isEmail(email)) return void preview.issues.push({ line, message: `Adresse e-mail invalide : « ${email} ».` })
    if (phone === null) return void preview.issues.push({ line, message: 'Numéro de téléphone invalide.' })
    if (birth === null) return void preview.issues.push({ line, message: 'Date de naissance invalide (format attendu : 25/12/1980).' })
    if (email && seen.has(email)) return void preview.issues.push({ line, message: `Doublon dans le fichier : ${email} apparaît déjà plus haut.` })
    if (email) seen.add(email)

    preview.rows.push({
      first_name: safeText(first),
      last_name: safeText(last),
      email,
      phone,
      city: safeText(get(cells, 'city')).slice(0, 120),
      birthdate: birth,
    })
  })

  return preview
}

/**
 * Renvoie les lignes à nouveau contrôlées : le navigateur renvoie le résultat de
 * l'aperçu, le serveur le refait passer par buildPreview() avant d'écrire.
 */
export function revalidateRows(rows: unknown): ImportPreview {
  if (!Array.isArray(rows)) return { rows: [], issues: [], ignoredColumns: [], missingFirstName: false }
  const table: unknown[][] = [
    ['prenom', 'nom', 'email', 'telephone', 'ville', 'naissance'],
    ...rows.map(r => {
      const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>
      return [o.first_name, o.last_name, o.email, o.phone, o.city, o.birthdate]
    }),
  ]
  return buildPreview(table)
}

/** Modèle à télécharger : « ; » et BOM pour s'ouvrir correctement dans Excel en français. */
export const TEMPLATE_CSV =
  '﻿Prénom;Nom;E-mail;Téléphone;Ville;Date de naissance\r\n' +
  'Marie;Dupont;marie.dupont@exemple.fr;06 12 34 56 78;Lyon;14/03/1985\r\n' +
  'Samuel;Martin;;;;\r\n'
