'use server'

import { createServerClient } from '@supabase/ssr'
import { supabasePublicKey, supabaseUrl } from '@/lib/supabase/env'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function setPassword(formData: FormData) {
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  if (password !== confirm) {
    redirect('/espace/set-password?error=mismatch')
  }

  if (password.length < 8) {
    redirect('/espace/set-password?error=short')
  }

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

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    redirect('/espace/set-password?error=failed')
  }

  // Le passage « invité → actif » a eu lieu à l'activation du lien ;
  // le profil redirige vers /espace/sans-eglise si le compte n'a aucune église active.
  redirect('/espace/profil?from=activation')
}
