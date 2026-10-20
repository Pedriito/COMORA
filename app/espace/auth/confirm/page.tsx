'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ConfirmPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

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
        const userId = data.session?.user?.id
        if (userId) {
          const { data: profile } = await supabase
            .from('profiles').select('status').eq('id', userId).single()
          if (profile?.status === 'invited') { router.replace('/espace/set-password'); return }
        }
        router.replace('/espace/dashboard')
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

      const userId = data.session?.user?.id
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles').select('status').eq('id', userId).single()
        if (profile?.status === 'invited') { router.replace('/espace/set-password'); return }
      }

      router.replace('/espace/dashboard')
    }

    handleRedirect()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-teal-50">
      <p className="font-sans text-dark/50 text-sm">Connexion en cours…</p>
    </div>
  )
}
