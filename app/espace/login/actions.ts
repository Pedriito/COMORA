'use server'

import { createServerClient } from '@supabase/ssr'
import { supabasePublicKey, supabaseUrl } from '@/lib/supabase/env'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function logout() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    supabaseUrl()!,
    supabasePublicKey()!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )
  await supabase.auth.signOut()
  redirect('/espace/login')
}

export async function login(formData: FormData) {
  const email      = formData.get('email') as string
  const password   = formData.get('password') as string
  const rememberMe = formData.get('remember_me') === 'on'

  const cookieStore = await cookies()
  const supabase = createServerClient(
    supabaseUrl()!,
    supabasePublicKey()!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Sans "rester connecté" : cookie de session (expire à la fermeture du navigateur)
            const cookieOptions = rememberMe
              ? options
              : { ...options, maxAge: undefined, expires: undefined }
            cookieStore.set(name, value, cookieOptions)
          })
        },
      },
    }
  )

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    redirect('/espace/login?error=credentials')
  }

  // Compte sans église active (invitation retirée, église supprimée…)
  const { data: membership } = await supabase
    .from('church_memberships')
    .select('id')
    .eq('user_id', data.user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  redirect(membership ? '/espace/dashboard' : '/espace/sans-eglise')
}
