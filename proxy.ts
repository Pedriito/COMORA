import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { supabasePublicKey, supabaseUrl } from '@/lib/supabase/env'

// Pages de l'espace accessibles sans être connecté
const PUBLIC_EXACT = ['/espace/login', '/espace/set-password', '/espace/mot-de-passe-oublie']
const PUBLIC_PREFIXES = ['/espace/auth', '/espace/activer', '/espace/repondre', '/espace/rejoindre']

export function isPublicEspacePath(pathname: string) {
  return PUBLIC_EXACT.includes(pathname) || PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // Anciennes adresses de l'espace bénévoles
  if (pathname === '/benevoles' || pathname.startsWith('/benevoles/')) {
    const target = request.nextUrl.clone()
    target.pathname = pathname.replace(/^\/benevoles/, '/espace')
    target.search = search
    return NextResponse.redirect(target, 308)
  }

  let supabaseResponse = NextResponse.next({ request })

  const url = supabaseUrl()
  const key = supabasePublicKey()
  if (!url || !key) return supabaseResponse

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
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

  return supabaseResponse
}

export const config = {
  matcher: ['/espace/:path*', '/benevoles', '/benevoles/:path*'],
}
