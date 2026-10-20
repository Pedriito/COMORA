import { NextRequest } from 'next/server'

const BASE = 'https://db.ltc-asaph.com'


type SongEntry = {
  legacy_id: number
  title: { display: { main: string } }
  authors: { name: string }[]
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const action = searchParams.get('action')

  try {
    // ── Recherche ────────────────────────────────────────────────────────────
    if (action === 'search') {
      const q = searchParams.get('q') ?? ''
      if (!q.trim()) return Response.json({ results: [] })

      const [searchRes, songsRes] = await Promise.all([
        fetch(`${BASE}/json/songs/search?s=${encodeURIComponent(q)}`, { next: { revalidate: 0 } }),
        fetch(`${BASE}/json/songs.json`, { next: { revalidate: 3600 } }),
      ])
      const indices: number[] = await searchRes.json()
      if (!indices.length) return Response.json({ results: [] })
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
      const id = searchParams.get('id') ?? ''
      if (!id) return Response.json({ error: 'id manquant' }, { status: 400 })

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
  } catch (e: unknown) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}
