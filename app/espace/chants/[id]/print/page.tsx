import { requireChurch } from '@/lib/auth/church'
import { notFound } from 'next/navigation'
import { transposeChart, isChordLine, isSectionHeader } from '@/lib/transpose'
import { AutoPrint } from './AutoPrint'
import { PrintActions } from './PrintActions'

type SearchParams = { key?: string; arr?: string; chords?: string }

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<SearchParams>
}) {
  const { supabase, church } = await requireChurch('membre')

  const { id } = await params
  const { key, arr, chords } = await searchParams
  const showChords = chords !== 'false'

  const { data: song } = await supabase
    .from('songs')
    .select('id, title, ccli, arrangements(id, name, bpm, length_seconds, chord_chart, chord_chart_key, keys_available)')
    .eq('id', id)
    .eq('church_id', church.churchId)
    .maybeSingle()

  if (!song) notFound()

  // Arrangement sélectionné via ?arr= ou le premier avec une grille
  const arrangements = (song as any).arrangements as any[]
  const arrangement = arr
    ? arrangements.find((a: any) => a.id === arr)
    : arrangements.find((a: any) => a.chord_chart) ?? arrangements[0]

  if (!arrangement) notFound()

  const originalKey = arrangement.chord_chart_key ?? 'C'
  const selectedKey = key ?? originalKey
  const chart = arrangement.chord_chart ?? ''
  const transposed = transposeChart(chart, originalKey, selectedKey)

  function formatLength(sec: number) {
    return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`
  }

  return (
    <>
      <AutoPrint />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 13px;
          color: #1a1a1a;
          background: white;
          padding: 24px 32px;
        }

        header {
          border-bottom: 2px solid #1a1a1a;
          padding-bottom: 10px;
          margin-bottom: 16px;
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 16px;
        }

        h1 {
          font-size: 22px;
          font-weight: 600;
          line-height: 1.2;
        }

        .meta {
          font-size: 11px;
          color: #666;
          display: flex;
          gap: 12px;
          flex-shrink: 0;
        }

        .arrangement-name {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #888;
          margin-bottom: 12px;
        }

        pre {
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          line-height: 1.7;
          white-space: pre;
        }

        .line-chord {
          color: #0d7c7c;
          font-weight: 600;
        }

        .line-section {
          font-family: 'Inter', sans-serif;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #aaa;
          margin-top: 14px;
          margin-bottom: 2px;
          display: block;
        }

        .line-lyric {
          color: #333;
        }

        @media print {
          body { padding: 0; }
          @page { margin: 15mm 18mm; size: A4; }
        }

        .no-print {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .btn {
          padding: 6px 14px;
          border-radius: 8px;
          border: 1px solid #ccc;
          background: white;
          font-size: 12px;
          cursor: pointer;
          font-family: inherit;
        }

        .btn:hover { background: #f5f5f5; }

        @media print {
          .no-print { display: none !important; }
        }
      `}</style>

      <PrintActions />

      <header>
        <h1>{(song as any).title}</h1>
        <div className="meta">
          {(song as any).ccli && <span>CCLI {(song as any).ccli}</span>}
          <span>Tonalité : <strong>{selectedKey}</strong></span>
          {arrangement.bpm && <span>{arrangement.bpm} BPM</span>}
          {arrangement.length_seconds && <span>{formatLength(arrangement.length_seconds)}</span>}
        </div>
      </header>

      {arrangements.length > 1 && (
        <div className="arrangement-name">{arrangement.name}</div>
      )}

      <pre>
        {transposed.split('\n').map((line, i) => {
          if (!line.trim()) return <span key={i}>{'\n'}</span>

          // Accords en priorité (avant isSectionHeader — évite que F, G… soient pris pour des titres)
          if (isChordLine(line)) {
            if (!showChords) return null
            return <span key={i} className="line-chord">{line}{'\n'}</span>
          }

          if (isSectionHeader(line)) {
            return <span key={i} className="line-section">{line}</span>
          }

          return <span key={i} className="line-lyric">{line}{'\n'}</span>
        })}
      </pre>
    </>
  )
}
