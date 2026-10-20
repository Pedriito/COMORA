import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MediaLibrary from './MediaLibrary'

export default async function MediathequePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')
  const { data: me } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  if (!['admin', 'editor', 'super_admin'].includes(me?.permission ?? '')) redirect('/espace/dashboard')

  const { data: files } = await supabase
    .from('media_files')
    .select('id, name, url, storage_path, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-teal-50">
      <header className="bg-white border-b border-teal/20 px-4 md:px-6 py-4 flex items-center gap-3">
        <Link href="/espace/admin/parametres" className="text-dark/40 hover:text-dark transition-colors font-sans text-sm shrink-0">←</Link>
        <h1 className="font-display text-xl md:text-2xl text-dark font-light">Médiathèque</h1>
      </header>
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <MediaLibrary initial={(files ?? []) as any} />
      </main>
    </div>
  )
}
