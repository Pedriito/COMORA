import { requireChurch } from '@/lib/auth/church'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SongForm } from '../../SongForm'

export default async function ModifierChantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; saved?: string; created?: string }>
}) {
  const { supabase, church } = await requireChurch('responsable')

  const { id: songId } = await params
  const { error, saved, created } = await searchParams

  const { data: song } = await supabase
    .from('songs')
    .select('id, title, arrangements(id, name, chord_chart, chord_chart_key, youtube_url, audio_url)')
    .eq('id', songId)
    .eq('church_id', church.churchId)
    .maybeSingle()

  if (!song) notFound()

  type Arr = { id: string; name: string; chord_chart: string | null; chord_chart_key: string | null; youtube_url: string | null; audio_url: string | null }
  const arrangements = song.arrangements as unknown as Arr[]
  // Arrangement principal = celui avec chord_chart, sinon le premier
  const mainArr = arrangements.find(a => a.chord_chart) ?? arrangements[0] ?? null

  return (
    <div className="min-h-screen bg-teal-50">
      <header className="bg-white border-b border-teal/20 px-4 md:px-8 py-4 flex items-center gap-4">
        <Link href="/espace/admin/chants" className="text-dark/40 hover:text-dark transition-colors font-sans text-sm">←</Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl text-dark font-light truncate">{song.title}</h1>
          <p className="text-xs text-dark/40 font-sans mt-0.5">Modifier</p>
        </div>
        <Link
          href={`/espace/chants/${songId}`}
          className="px-3 py-1.5 font-sans text-xs text-dark/50 hover:text-dark hover:bg-teal/5 rounded-lg transition-colors"
        >
          Voir →
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 md:px-6 py-6">
        {created && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <p className="font-sans text-sm text-green-700">✓ Chant créé avec succès.</p>
          </div>
        )}
        {saved && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <p className="font-sans text-sm text-green-700">✓ Modifications enregistrées.</p>
          </div>
        )}
        {error === 'titre_manquant' && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="font-sans text-sm text-red-600">Le titre est obligatoire.</p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-teal/20 p-6">
          <SongForm
            mode="edit"
            songId={songId}
            arrangement={mainArr ?? undefined}
            defaultValues={{ title: song.title }}
          />
        </div>

        {arrangements.length > 1 && (
          <p className="mt-4 text-xs text-dark/35 font-sans text-center">
            Ce chant a {arrangements.length} arrangements — seul l'arrangement principal est éditable ici.
          </p>
        )}
      </main>
    </div>
  )
}
