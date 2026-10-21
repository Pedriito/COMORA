'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { ChordChart } from '@/app/espace/chants/[id]/ChordChart'
import { AddSongForm } from './AddSongForm'
import { removePlanSong, movePlanSong, reorderPlanSongs } from '../actions'

type Arrangement = {
  id: string
  name: string
  chord_chart: string | null
  chord_chart_key: string | null
}

type PlanSong = {
  id: string
  order_index: number
  key_selected: string | null
  songs: { id: string; title: string } | null
  arrangements: Arrangement | null
}

type SongForAdd = {
  id: string
  title: string
  arrangements: { id: string; name: string; chord_chart_key: string | null; keys_available: string[] }[]
}

type Props = {
  planId: string
  planSongs: PlanSong[]
  allSongs: SongForAdd[]
}

export function SongsSection({ planId, planSongs, allSongs }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Ordre optimiste pour le drag
  const [optimisticSongs, setOptimisticSongs] = useState(planSongs)
  const optimisticSongsRef = useRef(planSongs)

  // Sync depuis le serveur (sauf pendant un drag actif)
  useEffect(() => {
    if (!isDraggingRef.current) {
      setOptimisticSongs(planSongs)
      optimisticSongsRef.current = planSongs
    }
  }, [planSongs])

  // Drag state (refs pour les event listeners non-passifs)
  const isDraggingRef      = useRef(false)
  const dragIdRef          = useRef<string | null>(null)
  const dragOverIndexRef   = useRef<number | null>(null)
  // Drag state (pour le rendu)
  const [draggingId,    setDraggingId]    = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const rowRefs          = useRef<(HTMLDivElement | null)[]>([])
  const listContainerRef = useRef<HTMLDivElement | null>(null)

  // Listeners non-passifs sur le conteneur de liste
  useEffect(() => {
    const container = listContainerRef.current
    if (!container) return

    // touchstart non-passif : bloque immédiatement le scroll quand on touche une poignée
    function handleTouchStart(e: TouchEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-drag-handle]')) return
      e.preventDefault() // empêche le scroll dès le debut du toucher
    }

    function handleTouchMove(e: TouchEvent) {
      if (!isDraggingRef.current) return
      e.preventDefault()

      const touch = e.touches[0]
      const y = touch.clientY
      const songs = optimisticSongsRef.current

      let newIdx = songs.length - 1
      for (let i = 0; i < rowRefs.current.length; i++) {
        const el = rowRefs.current[i]
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (y < rect.top + rect.height / 2) {
          newIdx = i
          break
        }
      }
      dragOverIndexRef.current = newIdx
      setDragOverIndex(newIdx)
    }

    function commitDrag() {
      if (!isDraggingRef.current) return

      const fromIdx = optimisticSongsRef.current.findIndex(ps => ps.id === dragIdRef.current)
      const toIdx   = dragOverIndexRef.current

      if (fromIdx !== -1 && toIdx !== null && fromIdx !== toIdx) {
        const newOrder = [...optimisticSongsRef.current]
        const [item]   = newOrder.splice(fromIdx, 1)
        newOrder.splice(toIdx, 0, item)
        setOptimisticSongs(newOrder)
        optimisticSongsRef.current = newOrder
        reorderPlanSongs(planId, newOrder.map(ps => ps.id))
      }

      isDraggingRef.current    = false
      dragIdRef.current        = null
      dragOverIndexRef.current = null
      setDraggingId(null)
      setDragOverIndex(null)
    }

    container.addEventListener('touchstart',  handleTouchStart, { passive: false })
    container.addEventListener('touchmove',   handleTouchMove,  { passive: false })
    container.addEventListener('touchend',    commitDrag)
    container.addEventListener('touchcancel', commitDrag)

    return () => {
      container.removeEventListener('touchstart',  handleTouchStart)
      container.removeEventListener('touchmove',   handleTouchMove)
      container.removeEventListener('touchend',    commitDrag)
      container.removeEventListener('touchcancel', commitDrag)
    }
  }, [planId])

  // Démarrage immédiat du drag tactile depuis la poignée (pas de long press)
  function startTouchDrag(id: string, currentIndex: number) {
    isDraggingRef.current    = true
    dragIdRef.current        = id
    dragOverIndexRef.current = currentIndex  // initialise à la position courante
    setDraggingId(id)
    setDragOverIndex(currentIndex)
    navigator.vibrate?.(20)
  }

  // ── Mouse drag (HTML5 Drag & Drop API) ─────────────────────────

  function handleMouseDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.effectAllowed = 'move'
    dragIdRef.current = id
    setDraggingId(id)
  }

  function handleMouseDragOver(e: React.DragEvent, i: number) {
    if (!dragIdRef.current) return
    e.preventDefault()
    const rect   = e.currentTarget.getBoundingClientRect()
    const newIdx = e.clientY < rect.top + rect.height / 2 ? i : i + 1
    if (dragOverIndexRef.current !== newIdx) {
      dragOverIndexRef.current = newIdx
      setDragOverIndex(newIdx)
    }
  }

  function commitMouseReorder() {
    const id    = dragIdRef.current
    const toIdx = dragOverIndexRef.current
    if (!id || toIdx === null) { handleMouseDragEnd(); return }

    const songs   = optimisticSongsRef.current
    const fromIdx = songs.findIndex(ps => ps.id === id)

    if (fromIdx !== -1 && fromIdx !== toIdx && fromIdx + 1 !== toIdx) {
      const newOrder  = [...songs]
      const [item]    = newOrder.splice(fromIdx, 1)
      const adjustedTo = toIdx > fromIdx ? toIdx - 1 : toIdx
      newOrder.splice(adjustedTo, 0, item)
      setOptimisticSongs(newOrder)
      optimisticSongsRef.current = newOrder
      startTransition(() => reorderPlanSongs(planId, newOrder.map(ps => ps.id)))
    }
    handleMouseDragEnd()
  }

  function handleMouseDragEnd() {
    dragIdRef.current        = null
    dragOverIndexRef.current = null
    setDraggingId(null)
    setDragOverIndex(null)
  }

  const active = optimisticSongs.find(ps => ps.id === activeId) ?? null
  const isOpen = active !== null

  function handleRemove(planSongId: string) {
    const fd = new FormData()
    fd.set('plan_song_id', planSongId)
    fd.set('plan_id', planId)
    startTransition(() => removePlanSong(fd))
    if (activeId === planSongId) setActiveId(null)
  }

  function handleMove(planSongId: string, direction: 'up' | 'down') {
    const fd = new FormData()
    fd.set('plan_song_id', planSongId)
    fd.set('plan_id', planId)
    fd.set('direction', direction)
    startTransition(() => movePlanSong(fd))
  }

  return (
    <div className="bg-white rounded-2xl border border-teal/20 flex min-h-0">

      {/* ── Liste ─────────────────────────────────────────────────── */}
      <div className={`flex flex-col min-w-0 transition-all duration-200
        ${isOpen ? 'hidden md:flex md:w-64 md:shrink-0 md:border-r md:border-teal/10' : 'flex-1'}
      `}>

        {/* En-tête */}
        <div className="px-4 py-3 border-b border-teal/10 bg-teal-50/50 flex items-center justify-between rounded-tl-2xl">
          <p className="font-sans text-xs text-dark/50 uppercase tracking-widest font-medium">Chants</p>
          <div className="flex items-center gap-2">
            {optimisticSongs.length > 0 && (
              <span className="text-xs text-dark/30 font-sans tabular-nums">{optimisticSongs.length}</span>
            )}
            {isOpen && (
              <button
                onClick={() => setActiveId(null)}
                className="text-dark/30 hover:text-dark text-base leading-none transition-colors"
                title="Fermer la partition"
              >×</button>
            )}
          </div>
        </div>

        {/* Songs */}
        <div ref={listContainerRef} className="flex-1 divide-y divide-teal/10 overflow-y-auto">
          {optimisticSongs.length === 0 && (
            <p className="px-4 py-6 text-center font-sans text-xs text-dark/50 italic">Aucun chant ajouté</p>
          )}

          {optimisticSongs.map((ps, i) => {
            const song      = ps.songs
            const arr       = ps.arrangements
            const isActive  = ps.id === activeId
            const isFirst   = i === 0
            const isLast    = i === optimisticSongs.length - 1
            const isDragged = ps.id === draggingId

            return (
              <div key={ps.id}>
                {/* Indicateur de dépôt AU-DESSUS de cette ligne */}
                {draggingId && dragOverIndex === i && (
                  <div className="h-0.5 bg-teal mx-3 rounded-full" />
                )}

                <div
                  ref={el => { rowRefs.current[i] = el }}
                  draggable={true}
                  onDragStart={(e) => handleMouseDragStart(e, ps.id)}
                  onDragOver={(e)  => handleMouseDragOver(e, i)}
                  onDrop={(e)      => { e.preventDefault(); commitMouseReorder() }}
                  onDragEnd={handleMouseDragEnd}
                  className={`flex items-center gap-2 px-3 py-2.5 transition-colors select-none ${
                    isDragged
                      ? 'opacity-40 bg-teal/5'
                      : isActive ? 'bg-teal/8' : 'hover:bg-teal/4'
                  }`}
                >
                  {/* Poignée de glissement — toucher et glisser pour réordonner */}
                  <div
                    data-drag-handle="true"
                    className="shrink-0 touch-none cursor-grab active:cursor-grabbing flex items-center justify-center w-8 h-8 -ml-1 text-dark/25 hover:text-dark/50 active:text-teal transition-colors"
                    onTouchStart={() => startTouchDrag(ps.id, i)}
                  >
                    <svg className="w-4 h-4 pointer-events-none" viewBox="0 0 14 14" fill="currentColor">
                      <rect x="2" y="2.5"  width="10" height="1.5" rx="0.75"/>
                      <rect x="2" y="6.25" width="10" height="1.5" rx="0.75"/>
                      <rect x="2" y="10"   width="10" height="1.5" rx="0.75"/>
                    </svg>
                  </div>

                  {/* Numéro */}
                  <span className={`font-sans text-xs tabular-nums shrink-0 w-4 ${isActive ? 'text-teal font-semibold' : 'text-dark/25'}`}>
                    {i + 1}
                  </span>

                  {/* Titre cliquable */}
                  <button
                    onClick={() => setActiveId(isActive ? null : ps.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className={`font-sans text-sm truncate ${isActive ? 'text-dark font-semibold' : 'text-dark/80 font-medium'}`}>
                      {song?.title ?? '—'}
                    </p>
                    {!isOpen && (
                      <p className="font-sans text-xs text-dark/35 truncate">
                        {arr?.name && <span className="mr-1.5">{arr.name}</span>}
                        {ps.key_selected && <span className="text-teal font-medium">{ps.key_selected}</span>}
                      </p>
                    )}
                    {isOpen && ps.key_selected && (
                      <p className="font-sans text-xs text-teal font-medium">{ps.key_selected}</p>
                    )}
                  </button>

                  {/* Flèches ▲▼ — desktop seulement */}
                  {!isOpen && (
                    <div className="hidden md:flex flex-col gap-0.5 shrink-0">
                      <button
                        onClick={() => handleMove(ps.id, 'up')}
                        disabled={isFirst || isPending}
                        className="text-dark/20 hover:text-teal disabled:opacity-0 text-xs leading-none transition-colors"
                      >▲</button>
                      <button
                        onClick={() => handleMove(ps.id, 'down')}
                        disabled={isLast || isPending}
                        className="text-dark/20 hover:text-teal disabled:opacity-0 text-xs leading-none transition-colors"
                      >▼</button>
                    </div>
                  )}

                  <button
                    onClick={() => handleRemove(ps.id)}
                    disabled={isPending}
                    className="text-dark/15 hover:text-red-400 transition-colors text-base leading-none shrink-0"
                  >×</button>
                </div>
              </div>
            )
          })}

          {/* Zone de dépôt en fin de liste + indicateur */}
          <div
            className="h-4"
            onDragOver={(e) => {
              if (!dragIdRef.current) return
              e.preventDefault()
              const newIdx = optimisticSongs.length
              if (dragOverIndexRef.current !== newIdx) {
                dragOverIndexRef.current = newIdx
                setDragOverIndex(newIdx)
              }
            }}
            onDrop={(e) => { e.preventDefault(); commitMouseReorder() }}
          >
            {draggingId && dragOverIndex === optimisticSongs.length && (
              <div className="h-0.5 bg-teal mx-3 rounded-full mt-1" />
            )}
          </div>
        </div>

        {/* Formulaire d'ajout */}
        <div className={`border-t border-teal/10 bg-teal-50/20 ${isOpen ? 'px-3 py-2' : 'px-4 py-3'}`}>
          <AddSongForm planId={planId} songs={allSongs} compact={isOpen} />
        </div>
      </div>

      {/* ── Partition ─────────────────────────────────────────────── */}
      {isOpen && active && (
        <div className="flex-1 overflow-y-auto px-4 py-4 min-w-0">
          <button
            onClick={() => setActiveId(null)}
            className="md:hidden mb-3 font-sans text-xs text-dark/40 hover:text-dark transition-colors"
          >
            ← {active.songs?.title ?? 'Retour'}
          </button>
          {active.arrangements?.chord_chart ? (
            <ChordChart
              chart={active.arrangements.chord_chart}
              originalKey={active.arrangements.chord_chart_key}
              initialKey={active.key_selected ?? active.arrangements.chord_chart_key ?? undefined}
              songId={active.songs?.id ?? ''}
              arrangementId={active.arrangements.id}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
              <p className="font-sans text-sm text-dark/40">Pas de grille pour ce chant.</p>
              {active.songs && (
                <a
                  href={`/espace/chants/${active.songs.id}`}
                  target="_blank"
                  className="font-sans text-xs text-teal hover:underline"
                >
                  Voir le chant →
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
