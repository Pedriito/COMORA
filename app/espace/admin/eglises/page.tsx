import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChurchForm } from './ChurchForm'

export default async function EglisesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')
  const { data: me } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  if (me?.permission !== 'super_admin') redirect('/espace/dashboard')

  const admin = createAdminClient()
  const { data: churches } = await admin
    .from('churches')
    .select('id, name, slug, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-teal-50">
      <header className="bg-white border-b border-teal/20 px-4 md:px-6 pb-4 flex items-center gap-4" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 16px)' }}>
        <Link href="/espace/dashboard" className="text-dark/40 hover:text-dark transition-colors font-sans text-sm shrink-0">←</Link>
        <div className="flex-1 min-w-0">
          <p className="font-sans text-xs text-dark/40 uppercase tracking-widest font-medium">Administration</p>
          <h1 className="font-display text-2xl text-dark font-light">Églises</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-8">

        <section>
          <p className="font-sans text-xs text-dark/40 uppercase tracking-widest mb-3 px-1">Ajouter une église</p>
          <ChurchForm />
        </section>

        <section>
          <p className="font-sans text-xs text-dark/40 uppercase tracking-widest mb-3 px-1">
            Églises enregistrées ({churches?.length ?? 0})
          </p>
          {churches && churches.length > 0 ? (
            <div className="space-y-2">
              {churches.map(c => (
                <div key={c.id} className="bg-white rounded-xl border border-teal/10 px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-sans text-sm font-medium text-dark">{c.name}</p>
                    <p className="font-sans text-xs text-dark/40 mt-0.5">/{c.slug}</p>
                  </div>
                  <span className="font-sans text-xs text-dark/30">
                    {new Date(c.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-sans text-sm text-dark/40 px-1">Aucune église pour l'instant.</p>
          )}
        </section>

      </main>
    </div>
  )
}
