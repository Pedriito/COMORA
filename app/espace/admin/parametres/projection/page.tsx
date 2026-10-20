import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ProjectionSettingsForm from './ProjectionSettingsForm'
import { DEFAULT_SETTINGS, SETTINGS_ID } from '@/lib/projectionSettings'

export default async function ProjectionSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const { data: me } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  if (!['admin', 'editor', 'super_admin'].includes(me?.permission ?? '')) redirect('/espace/dashboard')

  const [{ data: rawSettings }, { data: mediaFiles }] = await Promise.all([
    supabase.from('projection_settings').select('*').eq('id', SETTINGS_ID).single(),
    supabase.from('media_files').select('id, name, url').eq('type', 'image').order('created_at', { ascending: false }),
  ])

  const settings = rawSettings ?? DEFAULT_SETTINGS

  return (
    <div className="min-h-screen bg-teal-50">
      <header className="bg-white border-b border-teal/20 px-4 md:px-6 pb-4 flex items-center gap-3" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 16px)' }}>
        <Link href="/espace/admin/parametres" className="text-dark/40 hover:text-dark transition-colors font-sans text-sm shrink-0">←</Link>
        <h1 className="font-display text-xl md:text-2xl text-dark font-light">Apparence de la projection</h1>
      </header>
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <ProjectionSettingsForm
          initial={settings as any}
          mediaFiles={(mediaFiles ?? []) as { id: string; name: string; url: string }[]}
        />
      </main>
    </div>
  )
}
