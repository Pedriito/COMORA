'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
import { siteUrl } from '@/lib/site'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')
  const { data: me } = await supabase
    .from('profiles')
    .select('permission')
    .eq('id', user.id)
    .single()
  if (me?.permission !== 'super_admin') redirect('/espace/dashboard')
  return createAdminClient()
}

export async function listChurches() {
  const admin = await requireSuperAdmin()
  const { data } = await admin
    .from('churches')
    .select('id, name, slug, created_at')
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function createChurch(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireSuperAdmin()

  const name       = (formData.get('name') as string)?.trim()
  const slug       = (formData.get('slug') as string)?.trim().toLowerCase()
  const adminEmail = (formData.get('admin_email') as string)?.trim().toLowerCase()

  if (!name || !slug || !adminEmail) {
    return { ok: false, error: 'Tous les champs sont requis.' }
  }

  // 1. Créer la ligne dans churches
  const { data: church, error: churchError } = await admin
    .from('churches')
    .insert({ name, slug })
    .select('id')
    .single()

  if (churchError || !church) {
    return { ok: false, error: churchError?.message ?? 'Impossible de créer l\'église.' }
  }

  // 2. Inviter l'admin par email (crée le compte Auth + envoie l'email d'activation)
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(adminEmail, {
    data: { church_id: church.id },
    redirectTo: `${siteUrl()}/espace/login`,
  })

  if (inviteError || !invited?.user) {
    // Rollback churches row
    await admin.from('churches').delete().eq('id', church.id)
    return { ok: false, error: inviteError?.message ?? 'Impossible d\'inviter l\'administrateur.' }
  }

  // 3. Créer le profil admin avec le bon church_id
  const { error: profileError } = await admin.from('profiles').insert({
    id:         invited.user.id,
    email:      adminEmail,
    church_id:  church.id,
    permission: 'admin',
    status:     'invited',
  })

  if (profileError) {
    return { ok: false, error: profileError.message }
  }

  // 4. Créer les paramètres de base de l'église
  await admin.from('church_settings').insert({
    church_id:  church.id,
    church_name: name,
  })

  // 5. Créer les équipes par défaut pour cette église
  const DEFAULT_TEAMS = [
    'Louange', 'Accueil', 'Prédication', 'Enfants', 'Technique', 'Prière',
  ]
  await admin.from('teams').insert(
    DEFAULT_TEAMS.map(name => ({ name, church_id: church.id }))
  )

  revalidatePath('/espace/admin/eglises')
  revalidateTag('teams', 'max')
  revalidateTag('profiles', 'max')
  return { ok: true }
}
