'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { addVideo, deleteVideo } from './video-actions'
import { getYoutubeThumbnail, getPlatformLabel, getEmbedUrl } from '@/lib/videoEmbed'

export type PlanVideo = { id: string; title: string | null; url: string; order_index: number }

type Props = { planId: string; initial: PlanVideo[]; canManage: boolean }

export default function VideoSection({ planId, initial, canManage }: Props) {
  const [items, setItems]       = useState<PlanVideo[]>(initial)
  const [adding, setAdding]     = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newUrl, setNewUrl]     = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function validateAndAdd() {
    setUrlError(null)
    const trimmed = newUrl.trim()
    if (!trimmed) return
    if (!getEmbedUrl(trimmed)) {
      setUrlError('URL non reconnue — colle un lien YouTube ou Vimeo')
      return
    }
    startTransition(async () => {
      const created = await addVideo(planId, newTitle, trimmed)
      if (created) setItems(prev => [...prev, created])
      setAdding(false)
      setNewTitle('')
      setNewUrl('')
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteVideo(id)
      setItems(prev => prev.filter(v => v.id !== id))
    })
  }

  return (
    <div className="space-y-3">
      <p className="font-sans text-xs text-dark/40 text-right -mt-1 mb-1">
        {items.length} vidéo{items.length !== 1 ? 's' : ''}
      </p>

      {items.length === 0 && !adding && (
        <p className="font-sans text-xs text-dark/30 italic px-1">Aucune vidéo pour ce culte.</p>
      )}

      {items.map(item => {
        const thumb    = getYoutubeThumbnail(item.url)
        const platform = getPlatformLabel(item.url)
        return (
          <div key={item.id} className="bg-white rounded-xl border border-teal/20 overflow-hidden flex items-center gap-3 px-3 py-2.5">
            {/* Miniature */}
            {thumb ? (
              <Image src={thumb} alt="" width={80} height={44} className="w-20 h-11 object-cover rounded-lg shrink-0 bg-dark/10" />
            ) : (
              <div className="w-20 h-11 rounded-lg bg-dark/10 flex items-center justify-center shrink-0">
                <span className="text-dark/30 text-xs">▶</span>
              </div>
            )}
            {/* Infos */}
            <div className="flex-1 min-w-0">
              {item.title && (
                <p className="font-sans text-xs text-teal/70 uppercase tracking-wide leading-none mb-0.5">{item.title}</p>
              )}
              <p className="font-sans text-sm text-dark truncate leading-snug">{item.url}</p>
              {platform && (
                <p className="font-sans text-[10px] text-dark/30 mt-0.5">{platform}</p>
              )}
            </div>
            {/* Actions */}
            {canManage && (
              <button
                onClick={() => handleDelete(item.id)}
                disabled={isPending}
                className="text-dark/25 hover:text-red-400 transition-colors font-sans text-lg leading-none shrink-0"
                title="Supprimer"
              >
                ×
              </button>
            )}
          </div>
        )
      })}

      {canManage && (
        adding ? (
          <div className="bg-white rounded-xl border border-teal/30 p-4 space-y-2">
            <input
              autoFocus
              value={newUrl}
              onChange={e => { setNewUrl(e.target.value); setUrlError(null) }}
              placeholder="https://youtube.com/watch?v=… ou https://vimeo.com/…"
              className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm font-sans text-dark placeholder:text-dark/30 focus:outline-none focus:border-teal/50 font-mono"
            />
            {urlError && <p className="font-sans text-xs text-red-500">{urlError}</p>}
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Titre (optionnel)"
              className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm font-sans text-dark placeholder:text-dark/30 focus:outline-none focus:border-teal/50"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setAdding(false); setNewTitle(''); setNewUrl(''); setUrlError(null) }}
                className="flex-1 py-1.5 rounded-lg border border-teal/20 font-sans text-xs text-dark/60 hover:bg-teal/5"
              >
                Annuler
              </button>
              <button
                onClick={validateAndAdd}
                disabled={!newUrl.trim() || isPending}
                className="flex-1 py-1.5 rounded-lg bg-teal text-white font-sans text-xs font-medium hover:bg-teal/90 disabled:opacity-40"
              >
                + Ajouter
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full py-2.5 rounded-xl border border-dashed border-teal/30 font-sans text-xs text-dark/40 hover:text-teal hover:border-teal/60 transition-colors"
          >
            + Ajouter une vidéo
          </button>
        )
      )}
    </div>
  )
}
