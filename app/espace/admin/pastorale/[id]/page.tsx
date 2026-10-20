import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { PastoralMemberClient } from './PastoralMemberClient'

export default async function PastoralMemberPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')
  const { data: me } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(me?.permission ?? '')) redirect('/espace/dashboard')

  const admin = createAdminClient()

  const [
    { data: profile },
    { data: prayerRequests },
    { data: pastoralNotes },
    { data: assignments },
  ] = await Promise.all([
    admin.from('profiles')
      .select('id, first_name, last_name, email, phone, city, birthdate, status, created_at')
      .eq('id', id).single(),
    admin.from('prayer_requests')
      .select('id, subject, notes, status, created_at, resolved_at')
      .eq('profile_id', id)
      .order('created_at', { ascending: false }),
    admin.from('pastoral_notes')
      .select('id, note_date, type, notes, created_at')
      .eq('profile_id', id)
      .order('note_date', { ascending: false }),
    admin.from('plan_assignments')
      .select('id, status, plan_id, plans!inner(title, service_date)')
      .eq('user_id', id)
      .order('plans.service_date', { ascending: false })
      .limit(10),
  ])

  if (!profile) notFound()

  const p = profile as any

  return (
    <div className="min-h-screen bg-teal-50">
      <header className="bg-white border-b border-teal/20 px-4 md:px-6 pb-4 flex items-center gap-4" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 16px)' }}>
        <Link href="/espace/admin/pastorale" className="text-dark/40 hover:text-dark font-sans text-sm">← Pastorale</Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl text-dark font-light">{p.first_name} {p.last_name}</h1>
          <p className="font-sans text-xs text-dark/40 mt-0.5">Fiche pastorale</p>
        </div>
        <Link href={`/espace/admin/benevoles/${id}`}
          className="font-sans text-xs text-teal/60 hover:text-teal transition-colors">
          Fiche bénévole →
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
        <PastoralMemberClient
          profileId={id}
          profile={p}
          prayerRequests={(prayerRequests ?? []) as any}
          pastoralNotes={(pastoralNotes ?? []) as any}
          assignments={(assignments ?? []) as any}
        />
      </main>
    </div>
  )
}
