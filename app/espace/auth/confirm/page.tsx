'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ConfirmPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // Tableau de bord, ou page d'attente si le compte n'a aucune église active
    async function homeFor(userId: string | undefined) {
      if (!userId) return '/espace/login?error=auth'
      const { data: membership } = await supabase
        .from('church_memberships')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()
      return membership ? '/espace/dashboard' : '/espace/sans-eglise'
    }

    async function handleRedirect() {
      // Cas 1 : flux PKCE — Supabase envoie ?code=xxx dans la query string
      const queryParams = new URLSearchParams(window.location.search)
      const code = queryParams.get('code')
      const typeFromQuery = queryParams.get('type')

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) { router.replace('/espace/login?error=auth'); return }
        if (typeFromQuery === 'recovery' || typeFromQuery === 'invite') {
          router.replace('/espace/set-password'); return
        }
        router.replace(await homeFor(data.session?.user?.id))
        return
      }

      // Cas 2 : flux implicite (ancien) — Supabase envoie #access_token=...&type=recovery
      const hash = window.location.hash.substring(1)
      const params = new URLSearchParams(hash)
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const type = params.get('type')

      if (!accessToken || !refreshToken) {
        router.replace('/espace/login?error=auth')
        return
      }

      const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      if (error) { router.replace('/espace/login?error=auth'); return }

      if (type === 'recovery' || type === 'invite') {
        router.replace('/espace/set-password'); return
      }

      router.replace(await homeFor(data.session?.user?.id))
    }

    handleRedirect()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-teal-50">
      <p className="font-sans text-dark/50 text-sm">Connexion en cours…</p>
    </div>
  )
}
