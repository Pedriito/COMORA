import { createServerClient } from '@supabase/ssr'
import { supabasePublicKey, supabaseUrl } from '@/lib/supabase/env'
import { cookies } from 'next/headers'
import { safeNextPath } from '@/lib/http/safe-redirect'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  // Où continuer après la confirmation (ex. création de l'espace) : chemin de l'espace uniquement
  const next = safeNextPath(searchParams.get('next'))

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      supabaseUrl()!,
      supabasePublicKey()!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      if (type === 'recovery' || type === 'invite') {
        return NextResponse.redirect(`${origin}/espace/set-password`)
      }
      if (next) return NextResponse.redirect(`${origin}${next}`)
      // Compte sans église active : page d'attente
      const userId = sessionData.session?.user?.id
      const { data: membership } = userId
        ? await supabase
            .from('church_memberships')
            .select('id')
            .eq('user_id', userId)
            .eq('status', 'active')
            .limit(1)
            .maybeSingle()
        : { data: null }
      return NextResponse.redirect(`${origin}${membership ? '/espace/dashboard' : '/espace/sans-eglise'}`)
    }
  }

  return NextResponse.redirect(`${origin}/espace/login?error=auth`)
}
