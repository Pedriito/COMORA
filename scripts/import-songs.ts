/**
 * Import one-time des chants depuis le CSV Planning Center Services.
 * Usage: npx tsx scripts/import-songs.ts <path-to-csv>
 *
 * Le CSV a jusqu'à 3 arrangements par chant ; chaque arrangement peut contenir
 * une grille d'accords multi-lignes (champ RFC 4180 entre guillemets).
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// ── Config Supabase ────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY requis')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── Parseur CSV RFC 4180 ───────────────────────────────────────────────────
function parseCSV(raw: string): string[][] {
  const rows: string[][] = []
  let i = 0
  const n = raw.length

  while (i < n) {
    const row: string[] = []

    while (i < n) {
      if (raw[i] === '"') {
        // Champ entre guillemets (peut contenir \n et "")
        i++ // skip opening quote
        let field = ''
        while (i < n) {
          if (raw[i] === '"') {
            if (raw[i + 1] === '"') {
              field += '"'
              i += 2
            } else {
              i++ // skip closing quote
              break
            }
          } else {
            field += raw[i++]
          }
        }
        row.push(field)
      } else {
        // Champ sans guillemets
        let field = ''
        while (i < n && raw[i] !== ',' && raw[i] !== '\n' && raw[i] !== '\r') {
          field += raw[i++]
        }
        row.push(field)
      }

      if (i < n && raw[i] === ',') {
        i++ // next field
      } else {
        break // fin de ligne
      }
    }

    // Saute \r\n ou \n
    if (i < n && raw[i] === '\r') i++
    if (i < n && raw[i] === '\n') i++

    if (row.length > 0) rows.push(row)
  }

  return rows
}

// ── Helpers ────────────────────────────────────────────────────────────────
function parseLength(s: string): number | null {
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

function parseBPM(s: string): number | null {
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

function parseDate(s: string): string | null {
  if (!s.trim()) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

/** Parse "A, B: Débora, Bb: Makéda" → ["A", "B", "Bb"] (extrait juste les tonalités) */
function parseKeys(s: string): string[] {
  if (!s.trim()) return []
  // Les tonalités sont : [A-G][#b]? optionnellement suivies de : et texte
  const keys: string[] = []
  // Parcourt les segments séparés par ","
  for (const seg of s.split(',')) {
    const m = seg.trim().match(/^([A-G][#b]?)/)
    if (m) keys.push(m[1])
  }
  return [...new Set(keys)] // déduplique
}

function parseTags(cols: string[]): string[] {
  return cols.map(c => c.trim()).filter(Boolean)
}

// ── Structure d'un arrangement dans le CSV (colonnes fixes) ───────────────
const ARR_OFFSET = 7 // première col d'arrangement (0-based)
const ARR_SIZE   = 10 // nb de colonnes par arrangement

function parseArrangement(row: string[], idx: number) {
  const base = ARR_OFFSET + idx * ARR_SIZE
  return {
    name:             row[base + 0]?.trim() || null,
    bpm:              parseBPM(row[base + 1] ?? ''),
    length_seconds:   parseLength(row[base + 2] ?? ''),
    notes:            row[base + 3]?.trim() || null,
    keys_raw:         row[base + 4] ?? '',
    chord_chart:      row[base + 5]?.trim() || null,
    chord_chart_key:  row[base + 6]?.trim() || null,
    tags:             parseTags([row[base + 7] ?? '', row[base + 8] ?? '', row[base + 9] ?? '']),
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error('Usage: npx tsx scripts/import-songs.ts <path-to-csv>')
    process.exit(1)
  }

  const raw = fs.readFileSync(path.resolve(csvPath), 'utf-8')
  const rows = parseCSV(raw)

  if (rows.length < 2) {
    console.error('CSV vide ou mal formé')
    process.exit(1)
  }

  const header = rows[0]
  console.log(`📄 ${rows.length - 1} chants à importer`)
  console.log(`   Colonnes CSV : ${header.length}`)

  let imported = 0
  let errors = 0

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const songId = parseInt(row[0], 10)
    const title  = row[1]?.trim()

    if (!title || isNaN(songId)) {
      console.warn(`  ⚠  ligne ${r + 1} ignorée (id=${row[0]} title=${row[1]})`)
      continue
    }

    const song = {
      id:                   songId,
      title,
      ccli:                 row[2]?.trim() || null,
      themes:               row[3]?.trim() || null,
      notes:                row[4]?.trim() || null,
      last_scheduled_date:  parseDate(row[5] ?? ''),
    }

    // Upsert du chant
    const { error: songErr } = await supabase
      .from('songs')
      .upsert(song, { onConflict: 'id' })

    if (songErr) {
      console.error(`  ❌ song ${songId} (${title}): ${songErr.message}`)
      errors++
      continue
    }

    // Arrangements (jusqu'à 3)
    for (let a = 0; a < 3; a++) {
      const arr = parseArrangement(row, a)
      if (!arr.name) continue // pas d'arrangement

      // Vérifie si l'arrangement existe déjà
      const { data: existing } = await supabase
        .from('arrangements')
        .select('id')
        .eq('song_id', songId)
        .eq('name', arr.name)
        .single()

      const arrData = {
        song_id:         songId,
        name:            arr.name,
        bpm:             arr.bpm,
        length_seconds:  arr.length_seconds,
        notes:           arr.notes,
        chord_chart:     arr.chord_chart,
        chord_chart_key: arr.chord_chart_key,
        keys_available:  parseKeys(arr.keys_raw),
        tags:            arr.tags,
      }

      const { error: arrErr } = existing
        ? await supabase.from('arrangements').update(arrData).eq('id', existing.id)
        : await supabase.from('arrangements').insert(arrData)

      if (arrErr) {
        console.error(`    ❌ arrangement "${arr.name}" pour ${title}: ${arrErr.message}`)
      }
    }

    imported++
    if (imported % 20 === 0) console.log(`  ✓ ${imported} chants importés…`)
  }

  console.log(`\n✅ Import terminé : ${imported} chants, ${errors} erreurs`)
}

main().catch(e => { console.error(e); process.exit(1) })
