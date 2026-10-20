'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { reorderPlanSongs, removePlanSong } from '../actions'

type PlanSong = {
  id: string
  key_selected: string | null
  songs: { id: number; title: string } | null
}

type Props = {
  planId: string
  planSongs: PlanSong[]
}

export function MobileSongsList({ planId, planSongs }: Props) {
  const [optimisticSongs, setOptimisticSongs] = useState(planSongs)
  const optimisticRef = useRef(planSongs)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!isDraggingRef.current) {
      setOptimisticSongs(planSongs)
      optimisticRef.current = planSongs
    }
  }, [planSongs])

  const isDraggingRef    = useRef(false)
  const dragIdRef        = useRef<string | null>(null)
  const dragOverIdxRef   = useRef<number | null>(null)

  const [draggingId,    setDraggingId]    = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const rowRefs      = useRef<(HTMLDivElement | null)[]>([])
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Bloque le scroll immédiatement quand on pose le doigt sur une poignée
    function onTouchStart(e: TouchEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-drag-handle]')) return
      e.preventDefault()
    }

    function onTouchMove(e: TouchEvent) {
      if (!isDraggingRef.current) return
      e.preventDefault()

      const y     = e.touches[0].clientY
      const songs = optimisticRef.current
      let newIdx  = songs.length - 1

      for (let i = 0; i < rowRefs.current.length; i++) {
        const el = rowRefs.current[i]
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (y < rect.top + rect.height / 2) { newIdx = i; break }
      }
      dragOverIdxRef.current = newIdx
      setDragOverIndex(newIdx)
    }

    function onTouchEnd() {
      if (!isDraggingRef.current) return

      const fromIdx = optimisticRef.current.findIndex(ps => ps.id === dragIdRef.current)
      const toIdx   = dragOverIdxRef.current

      if (fromIdx !== -1 && toIdx !== null && fromIdx !== toIdx) {
        const next       = [...optimisticRef.current]
        const [item]     = next.splice(fromIdx, 1)
        next.splice(toIdx, 0, item)
        setOptimisticSongs(next)
        optimisticRef.current = next
        reorderPlanSongs(planId, next.map(ps => ps.id))
      }

      isDraggingRef.current  = false
      dragIdRef.current      = null
      dragOverIdxRef.current = null
      setDraggingId(null)
      setDragOverIndex(null)
    }

    container.addEventListener('touchstart',  onTouchStart, { passive: false })
    container.addEventListener('touchmove',   onTouchMove,  { passive: false })
    container.addEventListener('touchend',    onTouchEnd)
    container.addEventListener('touchcancel', onTouchEnd)

    return () => {
      container.removeEventListener('touchstart',  onTouchStart)
      container.removeEventListener('touchmove',   onTouchMove)
      container.removeEventListener('touchend',    onTouchEnd)
      container.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [planId])

  function handleRemove(planSongId: string) {
    // Suppression optimiste
    const next = optimisticRef.current.filter(ps => ps.id !== planSongId)
    setOptimisticSongs(next)
    optimisticRef.current = next
    const fd = new FormData()
    fd.set('plan_song_id', planSongId)
    fd.set('plan_id', planId)
    startTransition(() => removePlanSong(fd))
  }

  function startDrag(id: string, index: number) {
    isDraggingRef.current  = true
    dragIdRef.current      = id
    dragOverIdxRef.current = index
    setDraggingId(id)
    setDragOverIndex(index)
    navigator.vibrate?.(20)
  }

  if (optimisticSongs.length === 0) {
    return (
      <p className="px-4 py-4 font-sans text-xs text-dark/40 italic text-center">Aucun chant ajouté</p>
    )
  }

  return (
    <div ref={containerRef} className="divide-y divide-teal/8">
      {optimisticSongs.map((ps, i) => {
        const isDragged = ps.id === draggingId
        return (
          <div key={ps.id}>
            {/* Indicateur de dépôt au-dessus */}
            {draggingId && dragOverIndex === i && (
              <div className="h-0.5 bg-teal mx-4 rounded-full" />
            )}

            <div
              ref={el => { rowRefs.current[i] = el }}
              className={`px-4 py-3 flex items-center gap-2 transition-colors ${isDragged ? 'opacity-40 bg-teal/5' : ''}`}
            >
              {/* Poignée drag */}
              <div
                data-drag-handle="true"
                className="touch-none shrink-0 w-8 h-8 -ml-2 flex items-center justify-center text-dark/20 active:text-teal transition-colors"
                onTouchStart={() => startDrag(ps.id, i)}
              >
                <svg className="w-4 h-4 pointer-events-none" viewBox="0 0 14 14" fill="currentColor">
                  <rect x="2" y="2.5"  width="10" height="1.5" rx="0.75"/>
                  <rect x="2" y="6.25" width="10" height="1.5" rx="0.75"/>
                  <rect x="2" y="10"   width="10" height="1.5" rx="0.75"/>
                </svg>
              </div>

              <span className="font-sans text-xs text-dark/25 tabular-nums w-4 text-right shrink-0">{i + 1}</span>

              <div className="flex-1 min-w-0">
                <p className="font-sans text-sm text-dark font-medium truncate">{ps.songs?.title ?? '—'}</p>
                {ps.key_selected && (
                  <p className="font-sans text-xs text-dark/35 mt-0.5">Tonalité : {ps.key_selected}</p>
                )}
              </div>

              {ps.songs?.id && (
                <Link
                  href={`/espace/chants/${ps.songs.id}`}
                  className="text-dark/25 hover:text-teal transition-colors font-sans text-sm shrink-0 p-1"
                >→</Link>
              )}

              <button
                onClick={() => handleRemove(ps.id)}
                disabled={isPending}
                className="text-dark/15 hover:text-red-400 transition-colors text-lg leading-none shrink-0 px-1 disabled:opacity-40"
                title="Supprimer ce chant"
              >×</button>
            </div>
          </div>
        )
      })}

      {/* Indicateur de dépôt en fin de liste */}
      {draggingId && dragOverIndex === optimisticSongs.length && (
        <div className="h-0.5 bg-teal mx-4 rounded-full my-1" />
      )}
    </div>
  )
}
