import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { routeRequest } from '@/lib/routing/hosts'
import { supabasePublicKey, supabaseUrl } from '@/lib/supabase/env'

// Pages de l'espace accessibles sans être connecté
const PUBLIC_EXACT = ['/espace/login', '/espace/set-password', '/espace/mot-de-passe-oublie']
const PUBLIC_PREFIXES = ['/espace/auth', '/espace/activer', '/espace/repondre', '/espace/rejoindre']

export function isPublicEspacePath(pathname: string) {
  return PUBLIC_EXACT.includes(pathname) || PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
}

export async function proxy(request: NextRequest) {
  // 1. Domaine : landing, espace (app.comora.fr) ou site d'église (<slug>.comora.fr)
  const decision = routeRequest(request.nextUrl, request.headers.get('host'))
  if (decision.action === 'redirect') return NextResponse.redirect(decision.url, decision.status)

  const rewriteTo = decision.action === 'rewrite' ? new URL(decision.pathname + request.nextUrl.search, request.url) : null
  const pathname = rewriteTo?.pathname ?? request.nextUrl.pathname
  const respond = () => (rewriteTo ? NextResponse.rewrite(rewriteTo, { request }) : NextResponse.next({ request }))

  // 2. Session : seulement pour l'espace de gestion
  if (pathname !== '/espace' && !pathname.startsWith('/espace/')) return respond()

  let response = respond()
  const url = supabaseUrl()
  const key = supabasePublicKey()
  if (!url || !key) return response

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = respond()
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()

  // Pas connecté → page de connexion (sauf pages publiques)
  if (!user && !isPublicEspacePath(pathname)) {
    return NextResponse.redirect(new URL('/espace/login', request.url))
  }

  // Connecté → la page de connexion mène au tableau de bord
  if (user && pathname === '/espace/login') {
    return NextResponse.redirect(new URL('/espace/dashboard', request.url))
  }

  return response
}

export const config = {
  // Tout sauf les fichiers statiques de Next (le routage par domaine concerne toutes les pages)
  matcher: ['/((?!_next/static|_next/image).*)'],
}
