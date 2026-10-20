'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

type Sermon = { id: string; title: string; url: string }

type Props = {
  sermons: Sermon[]
  onProjectPage: (dataUrl: string, label: string) => void
  projectedLabel: string | null
  onClear: () => void
}

export function SermonPdfPanel({ sermons, onProjectPage, projectedLabel, onClear }: Props) {
  const [activeSid, setActiveSid] = useState<string | null>(sermons[0]?.id ?? null)
  const [pages, setPages]         = useState<string[]>([])  // data URLs des pages rendues
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const renderRef = useRef<{ url: string; done: boolean }>({ url: '', done: false })

  const activeSermon = sermons.find(s => s.id === activeSid) ?? sermons[0] ?? null

  useEffect(() => {
    if (!activeSermon) return
    setPages([])
    setError(null)
    setLoading(true)
    renderRef.current = { url: activeSermon.url, done: false }

    async function render() {
      try {
        // Chargement dynamique de pdfjs-dist pour éviter les problèmes SSR
        const pdfjsLib = await import('pdfjs-dist')
        // Worker servi par l'application (aucun appel à un CDN tiers)
        if (!pdfjsLib.GlobalWorkerOptions.workerPort) {
          pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(
            new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
            { type: 'module' },
          )
        }

        const task = pdfjsLib.getDocument({ url: activeSermon.url, withCredentials: false })
        const pdf  = await task.promise

        if (renderRef.current.url !== activeSermon.url) return // Changé pendant le chargement

        const urls: string[] = []
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (renderRef.current.url !== activeSermon.url) break
          const page = await pdf.getPage(pageNum)
          const viewport = page.getViewport({ scale: 1.5 })
          const canvas   = document.createElement('canvas')
          canvas.width   = viewport.width
          canvas.height  = viewport.height
          const ctx = canvas.getContext('2d')!
          await page.render({ canvasContext: ctx, viewport, canvas }).promise
          urls.push(canvas.toDataURL('image/jpeg', 0.85))
          setPages([...urls]) // Mise à jour progressive
        }
        setLoading(false)
      } catch (err) {
        if (renderRef.current.url === activeSermon.url) {
          setError(err instanceof Error ? err.message : 'Erreur de rendu PDF')
          setLoading(false)
        }
      }
    }

    render()
    return () => { renderRef.current.done = true }
  }, [activeSermon?.url])

  if (sermons.length === 0) return null

  return (
    <div className="border border-white/10 rounded-xl p-3 space-y-2">
      <p className="font-sans text-[10px] uppercase tracking-widest text-white/30">Prédication</p>

      {/* Sélecteur si plusieurs PDF */}
      {sermons.length > 1 && (
        <div className="flex flex-col gap-1">
          {sermons.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSid(s.id)}
              className={`text-left px-2 py-1.5 rounded-lg font-sans text-xs transition-colors truncate ${
                activeSid === s.id ? 'bg-teal/30 text-white' : 'text-white/50 hover:bg-white/5'
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}

      {/* Pages du PDF */}
      {loading && pages.length === 0 && (
        <div className="flex items-center gap-2 py-2">
          <svg className="animate-spin w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          <span className="text-white/40 text-xs font-sans">Chargement du PDF…</span>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-xs font-sans">{error}</p>
      )}

      {pages.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-0.5">
          {pages.map((dataUrl, i) => {
            const label = `${activeSermon?.title ?? 'Diapo'} — p.${i + 1}`
            const isActive = projectedLabel === label
            return (
              <button
                key={i}
                onClick={() => isActive ? onClear() : onProjectPage(dataUrl, label)}
                className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                  isActive ? 'border-teal ring-1 ring-teal/50' : 'border-white/10 hover:border-white/40'
                }`}
                title={`Page ${i + 1}`}
              >
                <Image src={dataUrl} alt={`Page ${i + 1}`} fill unoptimized className="object-contain bg-white" />
                <span className="absolute bottom-0.5 right-1 text-[9px] text-white/60 font-sans bg-black/50 rounded px-1">
                  {i + 1}
                </span>
                {isActive && (
                  <div className="absolute inset-0 bg-teal/30 flex items-center justify-center">
                    <span className="text-white text-base">✓</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {projectedLabel && (
        <button
          onClick={onClear}
          className="w-full py-1.5 bg-amber-500/80 hover:bg-amber-500 rounded-lg font-sans text-xs font-semibold text-white transition-colors"
        >
          ✕ Effacer la diapo prédication
        </button>
      )}
    </div>
  )
}
