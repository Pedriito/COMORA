import { NextRequest } from 'next/server'

/**
 * Proxy serveur → bolls.life pour éviter les problèmes CORS.
 * GET /api/bible?translation=BDS&book=43&chapter=3
 * Retourne le JSON brut de bolls.life : [{ pk, verse, text }, ...]
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const translation = searchParams.get('translation')
  const book        = searchParams.get('book')
  const chapter     = searchParams.get('chapter')

  if (!translation || !book || !chapter) {
    return Response.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  try {
    const url = `https://bolls.life/get-text/${translation}/${book}/${chapter}/`
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
