import { NextRequest } from 'next/server'
import { getChurchContext } from '@/lib/auth/church'
import { parseBibleRequest } from '@/lib/bible'

/**
 * Proxy serveur → bolls.life pour éviter les problèmes CORS.
 * GET /api/bible?translation=BDS&book=43&chapter=3
 * Réservé aux comptes membres d'une église. Retourne le JSON brut de
 * bolls.life : [{ pk, verse, text }, ...]
 */
export async function GET(req: NextRequest) {
  const ctx = await getChurchContext()
  if (!ctx) return Response.json({ error: 'Connexion requise' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const params = parseBibleRequest(searchParams.get('translation'), searchParams.get('book'), searchParams.get('chapter'))
  if (!params) {
    return Response.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  try {
    const url = `https://bolls.life/get-text/${params.translation}/${params.book}/${params.chapter}/`
    const res = await fetch(url, {
      next: { revalidate: 86400 }, // cache 24 h — la Bible ne change pas
    })
    if (!res.ok) {
      return Response.json(
        { error: `Erreur source biblique (${res.status})` },
        { status: 502 },
      )
    }
    const data = await res.json()
    return Response.json(data)
  } catch {
    return Response.json(
      { error: 'Impossible de contacter la source biblique — vérifie ta connexion' },
      { status: 502 },
    )
  }
}
