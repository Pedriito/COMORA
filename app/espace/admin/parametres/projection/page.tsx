import { requireChurch } from '@/lib/auth/church'
import Link from 'next/link'
import ProjectionSettingsForm from './ProjectionSettingsForm'
import { loadProjectionSettings } from '@/lib/projectionSettings'

export default async function ProjectionSettingsPage() {
  const { supabase, church } = await requireChurch('responsable')

  const [settings, { data: mediaFiles }] = await Promise.all([
    loadProjectionSettings(supabase, church.churchId),
    supabase
      .from('media_files')
      .select('id, name, url')
      .eq('church_id', church.churchId)
      .eq('type', 'image')
      .order('created_at', { ascending: false }),
  ])

  return (
    <div className="min-h-screen bg-teal-50">
      <header className="bg-white border-b border-teal/20 px-4 md:px-6 pb-4 flex items-center gap-3" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 16px)' }}>
        <Link href="/espace/admin/parametres" className="text-dark/40 hover:text-dark transition-colors font-sans text-sm shrink-0">←</Link>
        <h1 className="font-display text-xl md:text-2xl text-dark font-light">Apparence de la projection</h1>
      </header>
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <ProjectionSettingsForm
          churchId={church.churchId}
          initial={settings}
          mediaFiles={mediaFiles ?? []}
        />
      </main>
    </div>
  )
}
