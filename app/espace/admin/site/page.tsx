import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getChurchSettings, getChurchSchedules } from '@/lib/churchSettings'
import SiteSettingsForm from './SiteSettingsForm'
import SchedulesManager from './SchedulesManager'

export default async function SitePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')
  const { data: me } = await supabase.from('profiles').select('permission, church_id').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(me?.permission ?? '') || !me?.church_id) redirect('/espace/dashboard')

  const { data: church } = await supabase.from('churches').select('name, slug').eq('id', me.church_id).maybeSingle()
  const [settings, schedules] = await Promise.all([
    getChurchSettings(me.church_id, church?.name ?? ''),
    getChurchSchedules(me.church_id),
  ])

  return (
    <div className="min-h-screen bg-teal-50">
      <header className="bg-white border-b border-teal/20 px-4 md:px-6 pb-4 flex items-center gap-4" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 16px)' }}>
        <Link href="/espace/admin/parametres" className="text-dark/40 hover:text-dark transition-colors font-sans text-sm shrink-0">←</Link>
        <div className="flex-1 min-w-0">
          <p className="font-sans text-xs text-dark/40 uppercase tracking-widest font-medium">Présence en ligne</p>
          <h1 className="font-display text-2xl text-dark font-light">Site web</h1>
        </div>
        {church?.slug && (
        <Link
          href={`/sites/${church.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal/20 font-sans text-xs text-dark/60 hover:bg-teal/5 transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="8" cy="8" rx="2.5" ry="6.5"/>
            <ellipse cx="8" cy="8" rx="6.5" ry="6.5"/>
            <line x1="1.5" y1="8" x2="14.5" y2="8"/>
          </svg>
          Voir le site
        </Link>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="grid lg:grid-cols-[1fr_300px] gap-8 items-start">
          <div className="space-y-8">
            <section>
              <p className="font-sans text-xs text-dark/40 uppercase tracking-widest mb-3 px-1">Contenu du site</p>
              <SiteSettingsForm initial={settings} />
            </section>

            <section>
              <p className="font-sans text-xs text-dark/40 uppercase tracking-widest mb-3 px-1">Horaires</p>
              <SchedulesManager initial={schedules} />
            </section>
          </div>

          {/* Preview sidebar */}
          <div className="hidden lg:block sticky top-6">
            <p className="font-sans text-xs text-dark/40 uppercase tracking-widest mb-3 px-1">Aperçu du site</p>
            <div className="bg-white rounded-2xl border border-teal/20 overflow-hidden shadow-sm">
              {/* URL bar mock */}
              <div className="bg-teal-50/60 px-3 py-2.5 border-b border-teal/10 flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-300/70"/>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-300/70"/>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-300/70"/>
                </div>
                <div className="flex-1 bg-white/80 rounded-md px-3 py-1 text-[10px] font-sans text-dark/40 text-center">
                  {church?.slug ? `${church.slug}.comora.fr` : 'votre-eglise.comora.fr'}
                </div>
              </div>
              {/* Preview content */}
              <div>
                <div className="bg-teal px-5 py-6">
                  <p className="font-sans text-[9px] text-white/60 uppercase tracking-widest">{(settings.church_name || 'Votre église').toUpperCase()}</p>
                  <h2 className="font-display text-white text-lg font-light leading-tight mt-1">{settings.tagline || 'Votre devise apparaîtra ici.'}</h2>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-coral/15 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-coral/70" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-sans text-[9px] text-dark/40 uppercase tracking-widest">Pasteurs</p>
                      <p className="font-sans text-xs text-dark font-medium">{settings.pastors_names || '—'}</p>
                    </div>
                  </div>
                  {settings.address_street && (
                    <div className="flex items-start gap-2">
                      <svg className="w-3.5 h-3.5 text-dark/30 mt-0.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 1.5A4.5 4.5 0 0 0 3.5 6c0 2.5 4.5 8.5 4.5 8.5S12.5 8.5 12.5 6A4.5 4.5 0 0 0 8 1.5zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
                      </svg>
                      <p className="font-sans text-[10px] text-dark/50 leading-snug">
                        {settings.address_street}<br/>
                        {settings.address_zip} {settings.address_city}
                        {settings.address_dept && ` · ${settings.address_dept}`}
                      </p>
                    </div>
                  )}
                </div>
                <div className="px-4 pb-3 border-t border-teal/5 pt-2">
                  <p className="font-sans text-[9px] text-center text-dark/30 italic">Mise à jour en direct depuis le formulaire</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
