import { NextRequest } from 'next/server'
import { getChurchContext } from '@/lib/auth/church'
import { cleanQuery, cleanSongId } from './params'

const BASE = 'https://db.ltc-asaph.com'


type SongEntry = {
  legacy_id: number
  title: { display: { main: string } }
  authors: { name: string }[]
}

/** Proxy vers la base LTC Asaph (import de chants), réservé aux comptes membres d'une église. */
export async function GET(req: NextRequest) {
  const ctx = await getChurchContext()
  if (!ctx) return Response.json({ error: 'Connexion requise' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const action = searchParams.get('action')

  try {
    // ── Recherche ────────────────────────────────────────────────────────────
    if (action === 'search') {
      if (!(searchParams.get('q') ?? '').trim()) return Response.json({ results: [] })
      const q = cleanQuery(searchParams.get('q'))
      if (!q) return Response.json({ error: 'Recherche invalide' }, { status: 400 })

      const [searchRes, songsRes] = await Promise.all([
        fetch(`${BASE}/json/songs/search?s=${encodeURIComponent(q)}`, { next: { revalidate: 0 } }),
        fetch(`${BASE}/json/songs.json`, { next: { revalidate: 3600 } }),
      ])
      if (!searchRes.ok || !songsRes.ok) return Response.json({ error: 'Source indisponible' }, { status: 502 })
      const indices: number[] = await searchRes.json()
      if (!Array.isArray(indices) || !indices.length) return Response.json({ results: [] })
      const songs: Record<string, SongEntry> = await songsRes.json()

      const results = indices.slice(0, 15).map(idx => {
        const song = songs[String(idx)]
        if (!song) return null
        return {
          id:      song.legacy_id,
          title:   song.title?.display?.main ?? '',
          authors: (song.authors ?? []).map(a => a.name).join(', '),
        }
      }).filter(Boolean)

      return Response.json({ results })
    }

    // ── Récupérer le détail d'un chant (legacy_id) ──────────────────────────
    if (action === 'fetch') {
      const id = cleanSongId(searchParams.get('id'))
      if (!id) return Response.json({ error: 'Identifiant invalide' }, { status: 400 })

      const res = await fetch(`${BASE}/json/songs/${id}`, {
        headers: { 'Accept': 'application/json' },
      })
      if (!res.ok) return Response.json({ error: `HTTP ${res.status}` }, { status: 404 })

      const data = await res.json()
      const attrs = data?.data?.attributes
      if (!attrs) return Response.json({ error: 'Données introuvables' }, { status: 404 })

      const title   = attrs.title?.display?.main ?? ''
      const authors = (attrs.authors ?? []).map((a: { name: string }) => a.name).join(', ')
      const keyData = attrs.key
      const key     = keyData?.key
        ? `${keyData.key}${keyData.scale === 'minor' ? 'm' : ''}`
        : null
      const bpm    = attrs.tempo ? Number(attrs.tempo) : null
      const lyrics = attrs.full_lyrics ?? ''

      return Response.json({ title, authors, key, bpm, lyrics })
    }

    return Response.json({ error: 'action inconnue' }, { status: 400 })
  } catch {
    return Response.json({ error: 'Source indisponible' }, { status: 502 })
  }
}
