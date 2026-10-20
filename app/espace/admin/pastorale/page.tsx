import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PrayerRequestForm } from './PrayerRequestForm'
import { IconHome, IconPhone, IconChat, IconDocument } from '@/app/espace/_components/Icons'

export default async function PastoralePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')
  const { data: me } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(me?.permission ?? '')) redirect('/espace/dashboard')

  const admin = createAdminClient()
  const { filter: rawFilter } = await searchParams
  const filter = rawFilter ?? 'tous'

  const [
    { data: allPrayerRequests },
    { data: recentNotes },
    { data: profiles },
  ] = await Promise.all([
    admin
      .from('prayer_requests')
      .select('id, subject, notes, status, person_name, created_at, profile_id, profiles!prayer_requests_profile_id_fkey(first_name, last_name)')
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    admin
      .from('pastoral_notes')
      .select('id, note_date, type, notes, profile_id, profiles!pastoral_notes_profile_id_fkey(first_name, last_name)')
      .order('note_date', { ascending: false })
      .limit(10),
    admin
      .from('profiles')
      .select('id, first_name, last_name')
      .order('first_name'),
  ])

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const prayerRequests = (allPrayerRequests ?? []).filter(pr => {
    if (filter === 'nouveaux') return new Date(pr.created_at) >= weekAgo
    if (filter === 'presentes') return pr.notes?.includes('Présenté en réunion')
    return true
  })

  const presentedCount = (allPrayerRequests ?? []).filter(pr => pr.notes?.includes('Présenté en réunion')).length
  const newThisWeek    = (allPrayerRequests ?? []).filter(pr => new Date(pr.created_at) >= weekAgo).length

  const typeInfo: Record<string, { Icon: React.ComponentType<{ className?: string }>; label: string }> = {
    visit:   { Icon: IconHome,     label: 'Visite' },
    call:    { Icon: IconPhone,    label: 'Appel' },
    message: { Icon: IconChat,     label: 'Message' },
    other:   { Icon: IconDocument, label: 'Autre' },
  }

  const filters = [
    { key: 'tous',      label: 'Tous' },
    { key: 'nouveaux',  label: 'Nouveaux' },
    { key: 'presentes', label: 'Présentés' },
  ]

  return (
    <div className="min-h-screen bg-teal-50">
      <header className="bg-white border-b border-teal/20 px-4 md:px-6 pb-4 flex items-center gap-4" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 16px)' }}>
        <div className="flex-1 min-w-0">
          <p className="font-sans text-xs text-dark/40 uppercase tracking-widest font-medium">Accompagnement</p>
          <h1 className="font-display text-2xl text-dark font-light">Pastorale</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PrayerRequestForm profiles={(profiles ?? []) as any} buttonVariant="header" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">

        <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">

          {/* ── Sujets de prière (left) ── */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-xl text-dark font-light">
                Sujets de prière
              </h2>
              <span className="font-sans text-sm bg-teal/10 text-teal px-2.5 py-0.5 rounded-full">
                {allPrayerRequests?.length ?? 0}
              </span>
            </div>

            {/* Filter pills */}
            <div className="flex gap-2 flex-wrap">
              {filters.map(f => (
                <Link
                  key={f.key}
                  href={`?filter=${f.key}`}
                  className={`px-4 py-1.5 rounded-full font-sans text-sm transition-colors ${
                    filter === f.key
                      ? 'bg-teal text-white'
                      : 'bg-white border border-teal/20 text-dark/60 hover:border-teal/40'
                  }`}
                >
                  {f.label}
                </Link>
              ))}
            </div>

            {/* Liste */}
            <div className="space-y-3">
              {prayerRequests.map(pr => {
                const profile = pr.profiles as any
                const name = profile
                  ? `${profile.first_name} ${profile.last_name}`
                  : (pr.person_name ?? 'Anonyme')
                const initials = profile
                  ? `${(profile.first_name ?? '')[0] ?? ''}${(profile.last_name ?? '')[0] ?? ''}`.toUpperCase()
                  : '?'
                const isPresented = pr.notes?.includes('Présenté en réunion')
                const displayNotes = pr.notes
                  ? pr.notes.split('\n').filter((l: string) => !l.includes('Présenté en réunion')).join('\n').trim()
                  : null

                return (
                  <div key={pr.id} className="bg-white rounded-2xl border border-teal/20 px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-teal/10 flex items-center justify-center font-sans text-xs font-bold text-teal shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-sans text-xs text-dark/50 uppercase tracking-wide font-medium">{name}</p>
                          {isPresented && (
                            <span className="font-sans text-[10px] bg-teal/10 text-teal px-2 py-0.5 rounded-full shrink-0">Présenté</span>
                          )}
                        </div>
                        <p className="font-sans text-sm text-dark mt-0.5 leading-snug">{pr.subject}</p>
                        {displayNotes && (
                          <p className="font-sans text-xs text-dark/50 mt-1 leading-snug">{displayNotes}</p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <p className="font-sans text-xs text-dark/30">
                            {new Date(pr.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                          </p>
                          <div className="flex gap-1.5">
                            <form action={async () => {
                              'use server'
                              const { resolvePrayerRequest } = await import('./actions')
                              await resolvePrayerRequest(pr.id)
                            }}>
                              <button type="submit" className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 text-green-600 font-sans text-xs hover:bg-green-100 transition-colors">
                                ✓ Prié
                              </button>
                            </form>
                            <form action={async () => {
                              'use server'
                              const { deletePrayerRequest } = await import('./actions')
                              await deletePrayerRequest(pr.id)
                            }}>
                              <button type="submit" className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-red-50 text-dark/30 hover:text-red-400 transition-colors">
                                ×
                              </button>
                            </form>
                          </div>
                        </div>
                      </div>
                    </div>
                    {pr.profile_id && (
                      <Link href={`/espace/admin/pastorale/${pr.profile_id}`} className="font-sans text-[10px] text-teal/50 hover:text-teal mt-2 ml-12 inline-block">
                        Voir la fiche →
                      </Link>
                    )}
                  </div>
                )
              })}
              {prayerRequests.length === 0 && (
                <p className="font-sans text-xs text-dark/30 italic px-1">Aucun sujet de prière.</p>
              )}
            </div>
          </section>

          {/* ── Sidebar (right) ── */}
          <aside className="space-y-4 lg:sticky lg:top-6">

            {/* Aperçu */}
            <div className="bg-white rounded-2xl border border-teal/20 p-5 space-y-3">
              <p className="font-sans text-xs text-dark/40 uppercase tracking-widest font-medium">Aperçu</p>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="font-sans text-sm text-dark/70">Sujets actifs</p>
                  <p className="font-sans text-sm font-medium text-dark">{allPrayerRequests?.length ?? 0}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="font-sans text-sm text-dark/70">Présentés en réunion</p>
                  <p className="font-sans text-sm font-medium text-teal">{presentedCount}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="font-sans text-sm text-dark/70">Nouveaux cette semaine</p>
                  <p className="font-sans text-sm font-medium text-amber-600">{newThisWeek}</p>
                </div>
              </div>
            </div>

            {/* Activité récente */}
            <div className="bg-white rounded-2xl border border-teal/20 p-5">
              <p className="font-sans text-xs text-dark/40 uppercase tracking-widest font-medium mb-3">Activité récente</p>
              <div className="space-y-3">
                {recentNotes?.map(n => {
                  const profile = n.profiles as any
                  const name = profile ? `${profile.first_name} ${profile.last_name}` : '—'
                  const t = typeInfo[n.type]
                  return (
                    <Link
                      key={n.id}
                      href={`/espace/admin/pastorale/${n.profile_id}`}
                      className="flex items-start gap-2.5 group"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-teal mt-1.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-sans text-xs text-dark leading-snug">
                          <span className="font-medium">{name}</span>
                          {' · '}{t?.label ?? n.type}
                        </p>
                        <p className="font-sans text-[10px] text-dark/40 mt-0.5">
                          {new Date(n.note_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                        </p>
                      </div>
                    </Link>
                  )
                })}
                {(!recentNotes || recentNotes.length === 0) && (
                  <p className="font-sans text-xs text-dark/30 italic">Aucune activité récente.</p>
                )}
              </div>
            </div>

          </aside>
        </div>

        {/* ── Fiches membres ── */}
        <section className="bg-white rounded-2xl border border-teal/20 overflow-hidden">
          <div className="px-5 py-3 border-b border-teal/10 bg-teal-50/50">
            <p className="font-sans text-xs text-dark/50 uppercase tracking-widest font-medium">Fiches membres</p>
          </div>
          <div className="divide-y divide-teal/10">
            {profiles?.map(p => (
              <Link
                key={p.id}
                href={`/espace/admin/pastorale/${p.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-teal/5 transition-colors group"
              >
                <p className="font-sans text-sm text-dark">{p.first_name} {p.last_name}</p>
                <span className="font-sans text-xs text-teal/40 group-hover:text-teal transition-colors">Fiche →</span>
              </Link>
            ))}
          </div>
        </section>

      </main>
    </div>
  )
}
