import { requireChurch } from '@/lib/auth/church'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PastoralMemberClient } from './PastoralMemberClient'

export default async function PastoralMemberPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await requireChurch('pastoral')
  const db = ctx.supabase
  const churchId = ctx.church.churchId

  const [
    { data: member },
    { data: contact },
    { data: prayerRequests },
    { data: pastoralNotes },
    { data: assignments },
  ] = await Promise.all([
    db.from('members')
      .select('id, first_name, last_name, status, created_at')
      .eq('church_id', churchId).eq('id', id).maybeSingle(),
    // Coordonnées : la RLS des coordonnées ne les ouvre qu'aux responsables et à la personne
    db.from('member_contacts')
      .select('email, phone, city, birthdate')
      .eq('church_id', churchId).eq('member_id', id).maybeSingle(),
    db.from('prayer_requests')
      .select('id, subject, notes, status, created_at, resolved_at')
      .eq('church_id', churchId)
      .eq('member_id', id)
      .order('created_at', { ascending: false }),
    db.from('pastoral_notes')
      .select('id, note_date, type, notes, created_at')
      .eq('church_id', churchId)
      .eq('member_id', id)
      .order('note_date', { ascending: false }),
    db.from('plan_assignments')
      .select('id, status, plan_id, plans!inner(title, service_date)')
      .eq('church_id', churchId)
      .eq('member_id', id)
      .order('plans.service_date', { ascending: false })
      .limit(10),
  ])

  if (!member) notFound()

  const p = { ...member, email: contact?.email ?? '', phone: contact?.phone ?? null, city: contact?.city ?? null, birthdate: contact?.birthdate ?? null }

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
          memberId={id}
          profile={p}
          prayerRequests={prayerRequests ?? []}
          pastoralNotes={pastoralNotes ?? []}
          assignments={(assignments ?? []) as never}
        />
      </main>
    </div>
  )
}
