import { NextRequest } from 'next/server'
import { siteConfig } from '@/lib/site'

const USER_AGENT = `${siteConfig.name}/1.0 (+${siteConfig.url})`

const SHIR_API  = 'http://shir.fr/w/api.php'
const SHIR_BASE = 'http://shir.fr'

/** Proxy pour éviter les restrictions CORS de shir.fr */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const action = searchParams.get('action')

  try {
    // ── Recherche de chants ──────────────────────────────────────────────
    if (action === 'search') {
      const q = searchParams.get('q') ?? ''
      const url = `${SHIR_API}?action=query&list=search&srsearch=${encodeURIComponent(q)}&srnamespace=0&srlimit=12&format=json&origin=*`
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
      const data = await res.json()
      const results = (data.query?.search ?? []).map((r: { title: string }) => ({ title: r.title }))
      return Response.json({ results })
    }

    // ── Parcourir la catégorie ───────────────────────────────────────────
    if (action === 'browse') {
      const cont = searchParams.get('continue') ?? ''
      const url = `${SHIR_API}?action=query&list=categorymembers&cmtitle=Cat%C3%A9gorie:Chant&cmlimit=50&format=json&origin=*${cont ? `&cmcontinue=${encodeURIComponent(cont)}` : ''}`
      const res  = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
      const data = await res.json()
      const results  = (data.query?.categorymembers ?? []).map((m: { title: string }) => ({ title: m.title }))
      const nextCont = data['query-continue']?.categorymembers?.cmcontinue ?? null
      return Response.json({ results, continue: nextCont })
    }

    // ── Récupérer le fichier ChordPro ────────────────────────────────────
    if (action === 'fetch') {
      const title = searchParams.get('title') ?? ''
      const url   = `${SHIR_BASE}/chant/chordpro/${encodeURIComponent(title)}.chordpro`
      const res   = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
      if (!res.ok) return Response.json({ error: `HTTP ${res.status}` }, { status: 404 })
      const text  = await res.text()
      return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }

    return Response.json({ error: 'action inconnue' }, { status: 400 })
  } catch (e: unknown) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}
