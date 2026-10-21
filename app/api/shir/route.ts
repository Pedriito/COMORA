import { NextRequest } from 'next/server'
import { siteConfig } from '@/lib/site'
import { getChurchContext } from '@/lib/auth/church'
import { cleanContinue, cleanQuery, cleanTitle } from './params'

const USER_AGENT = `${siteConfig.name}/1.0 (+${siteConfig.url})`

const SHIR_API  = 'https://shir.fr/w/api.php'
const SHIR_BASE = 'https://shir.fr'

/** Proxy pour éviter les restrictions CORS de shir.fr, réservé aux comptes membres d'une église. */
export async function GET(req: NextRequest) {
  const ctx = await getChurchContext()
  if (!ctx) return Response.json({ error: 'Connexion requise' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const action = searchParams.get('action')

  try {
    // ── Recherche de chants ──────────────────────────────────────────────
    if (action === 'search') {
      if (!(searchParams.get('q') ?? '').trim()) return Response.json({ results: [] })
      const q = cleanQuery(searchParams.get('q'))
      if (!q) return Response.json({ error: 'Recherche invalide' }, { status: 400 })
      const url = `${SHIR_API}?action=query&list=search&srsearch=${encodeURIComponent(q)}&srnamespace=0&srlimit=12&format=json&origin=*`
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
      if (!res.ok) return Response.json({ error: 'Source indisponible' }, { status: 502 })
      const data = await res.json()
      const results = (data.query?.search ?? []).map((r: { title: string }) => ({ title: r.title }))
      return Response.json({ results })
    }

    // ── Parcourir la catégorie ───────────────────────────────────────────
    if (action === 'browse') {
      const cont = cleanContinue(searchParams.get('continue'))
      if (cont === null) return Response.json({ error: 'Pagination invalide' }, { status: 400 })
      const url = `${SHIR_API}?action=query&list=categorymembers&cmtitle=Cat%C3%A9gorie:Chant&cmlimit=50&format=json&origin=*${cont ? `&cmcontinue=${encodeURIComponent(cont)}` : ''}`
      const res  = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
      if (!res.ok) return Response.json({ error: 'Source indisponible' }, { status: 502 })
      const data = await res.json()
      const results  = (data.query?.categorymembers ?? []).map((m: { title: string }) => ({ title: m.title }))
      const nextCont = data['query-continue']?.categorymembers?.cmcontinue ?? null
      return Response.json({ results, continue: nextCont })
    }

    // ── Récupérer le fichier ChordPro ────────────────────────────────────
    if (action === 'fetch') {
      const title = cleanTitle(searchParams.get('title'))
      if (!title) return Response.json({ error: 'Titre invalide' }, { status: 400 })
      const url   = `${SHIR_BASE}/chant/chordpro/${encodeURIComponent(title)}.chordpro`
      const res   = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
      if (!res.ok) return Response.json({ error: `HTTP ${res.status}` }, { status: 404 })
      const text  = await res.text()
      return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }

    return Response.json({ error: 'action inconnue' }, { status: 400 })
  } catch {
    return Response.json({ error: 'Source indisponible' }, { status: 502 })
  }
}
