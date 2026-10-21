import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashToken, isWellFormedToken } from '@/lib/tokens'
import { SharedSetlist } from './SharedSetlist'

// Page à jeton : jamais indexée
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function PartageSetlistPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  if (!isWellFormedToken(token)) notFound()

  // Clé secrète : page publique à jeton. Seul le plan du lien (et ses chants,
  // filtrés par l'église du lien) est lu.
  const admin = createAdminClient()

  const { data: link } = await admin
    .from('plan_share_links')
    .select('plan_id, church_id')
    .eq('token_hash', hashToken(token))
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (!link) notFound()

  const { data: plan } = await admin
    .from('plans')
    .select('id, title, service_date')
    .eq('id', link.plan_id)
    .eq('church_id', link.church_id)
    .maybeSingle()

  if (!plan) notFound()

  const { data: rawSongs } = await admin
    .from('plan_songs')
    .select('id, order_index, key_selected, songs(id, title), arrangements(id, name, chord_chart, chord_chart_key)')
    .eq('plan_id', plan.id)
    .eq('church_id', link.church_id)
    .order('order_index')

  const songs = (rawSongs ?? []).map(ps => ({
    planSongId:  ps.id,
    orderIndex:  ps.order_index,
    keySelected: ps.key_selected,
    song:        ps.songs as unknown as { id: string; title: string },
    arrangement: ps.arrangements as unknown as {
      id: string; name: string
      chord_chart: string | null; chord_chart_key: string | null
    } | null,
  }))

  const dateStr = plan.service_date
    ? new Date(plan.service_date).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  return <SharedSetlist planTitle={plan.title} dateStr={dateStr} songs={songs} />
}
