'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { buildAllSlides, type Slide } from '@/lib/parseSlides'
import { updateSlideLyrics, searchSongsForProjection, removePlanSong, type SongSearchResult } from '@/app/espace/admin/plans/actions'
import { deleteAnnouncement } from '@/app/espace/admin/plans/[id]/annonces-actions'
import { fetchBibleVerse, BIBLE_VERSIONS } from '@/lib/bible'
import { createClient } from '@/lib/supabase/client'
import { SermonPdfPanel } from './SermonPdfPanel'
import { getEmbedUrl, getYoutubeThumbnail, getPlatformLabel } from '@/lib/videoEmbed'

type Song = {
  planSongId: string
  orderIndex: number
  keySelected: string | null
  song: { id: number; title: string }
  arrangement: {
    id: string; name: string
    chord_chart: string | null; chord_chart_key: string | null
  } | null
}

type Announcement = { id: string; title: string | null; body: string; order_index: number; image_url: string | null; video_url: string | null }
type Sermon = { id: string; title: string; url: string }
type PlanVideo = { id: string; title: string | null; url: string; order_index: number }

type Props = {
  planId: string
  songs: Song[]
  announcements: Announcement[]
  sermons: Sermon[]
  videos: PlanVideo[]
  initialSongIdx: number
  preOpenedWindow?: Window | null
  onClose: () => void
}

function slideKey(si: number, di: number) { return `${si}-${di}` }

export function ProjectionView({ planId, songs, announcements, sermons, videos, initialSongIdx, preOpenedWindow, onClose }: Props) {
  const router = useRouter()
  const [current, setCurrent]           = useState({ songIdx: initialSongIdx, slideIdx: 0 })
  const [projectorReady, setProjectorReady] = useState(false)
  const [projectorWindow, setProjectorWindow] = useState<Window | null>(null)
  const [freeMessage, setFreeMessage]   = useState('')
  const [isShowingMessage, setIsShowingMessage] = useState(false)
  // Overrides de paroles
  const [slideOverrides, setSlideOverrides] = useState<Map<string, string[]>>(new Map())
  // État d'édition (chants)
  const [editingKey, setEditingKey]     = useState<string | null>(null)
  const [editText, setEditText]         = useState('')
  const [saveStatus, setSaveStatus]     = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  // Overrides et édition des annonces
  const [annOverrides, setAnnOverrides] = useState<Map<string, { title: string | null; body: string }>>(new Map())
  const [editingAnnId, setEditingAnnId] = useState<string | null>(null)
  const [editAnnTitle, setEditAnnTitle] = useState('')
  const [editAnnBody, setEditAnnBody]   = useState('')
  // Suppressions locales
  const [removedAnnIds, setRemovedAnnIds]   = useState<Set<string>>(new Set())
  const [removedSongIds, setRemovedSongIds] = useState<Set<string>>(new Set())
  // Ajout de chant à la volée
  const [showAddSong, setShowAddSong]   = useState(false)
  const [addQuery, setAddQuery]         = useState('')
  const [searchResults, setSearchResults] = useState<SongSearchResult[]>([])
  const [isSearching, setIsSearching]   = useState(false)
  const [extraSongs, setExtraSongs]     = useState<Song[]>([])
  // Bible
  const [bibleRef, setBibleRef]             = useState('')
  const [bibleVersion, setBibleVersion]     = useState('BDS')
  const [bibleFetching, setBibleFetching]   = useState(false)
  const [bibleResult, setBibleResult]       = useState<{ text: string; display: string; versionName: string } | null>(null)
  const [bibleError, setBibleError]         = useState<string | null>(null)
  const [isShowingVerse, setIsShowingVerse] = useState(false)
  // Défilement automatique
  const [autoAdvanceSecs, setAutoAdvanceSecs] = useState<number | null>(null)
  const [autoResetKey, setAutoResetKey]       = useState(0)
  const [autoLoop, setAutoLoop]               = useState(false)
  // Décompte
  const [countdownActive, setCountdownActive] = useState(false)
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const channelRef = useRef<BroadcastChannel | null>(null)
  // Médias
  const [mediaFiles, setMediaFiles] = useState<{ id: string; name: string; url: string }[]>([])
  const [projectedImageUrl, setProjectedImageUrl] = useState<string | null>(null)
  // Prédication PDF
  const [projectedSermonLabel, setProjectedSermonLabel] = useState<string | null>(null)
  // Annonce projetée (id)
  const [projectedAnnouncementId, setProjectedAnnouncementId] = useState<string | null>(null)
  // Vidéo projetée (id)
  const [projectedVideoId, setProjectedVideoId] = useState<string | null>(null)

  const allSongs   = [...songs, ...extraSongs].filter(s => !removedSongIds.has(s.planSongId))
  const visibleAnnouncements = announcements.filter(a => !removedAnnIds.has(a.id))
  const songSlides = buildAllSlides(allSongs)

  // Toutes les diapos à plat
  const allSlides: { songIdx: number; slideIdx: number; slide: Slide; songTitle: string }[] = []
  songSlides.forEach((ss, si) => {
    ss.slides.forEach((slide, di) => {
      allSlides.push({ songIdx: si, slideIdx: di, slide, songTitle: ss.title })
    })
  })

  const currentSong  = songSlides[current.songIdx]
  const currentSlide = currentSong?.slides[current.slideIdx] ?? null
  const nextSlide    = (() => {
    const nextInSong = currentSong?.slides[current.slideIdx + 1]
    if (nextInSong) return nextInSong
    const nextSong = songSlides[current.songIdx + 1]
    return nextSong?.slides[0] ?? null
  })()

  // Lignes effectives (avec override éventuel)
  function getLines(si: number, di: number, slide: Slide): string[] {
    return slideOverrides.get(slideKey(si, di)) ?? slide.lines
  }

  // Annonce effective (avec override éventuel)
  function getEffectiveAnn(ann: Announcement) {
    return annOverrides.get(ann.id) ?? { title: ann.title, body: ann.body }
  }

  // Ouvrir l'éditeur d'annonce
  function openAnnEdit(ann: Announcement) {
    const eff = getEffectiveAnn(ann)
    setEditingAnnId(ann.id)
    setEditAnnTitle(eff.title ?? '')
    setEditAnnBody(eff.body)
    setEditingKey(null)
    setShowAddSong(false)
  }

  // Appliquer l'édition d'annonce
  function applyAnnEdit() {
    if (!editingAnnId) return
    const override = { title: editAnnTitle.trim() || null, body: editAnnBody.trim() }
    setAnnOverrides(prev => { const m = new Map(prev); m.set(editingAnnId, override); return m })
    // Re-projeter si cette annonce est déjà en cours (conserve l'image d'origine)
    if (projectedAnnouncementId === editingAnnId) {
      const ann = announcements.find(a => a.id === editingAnnId)
      channelRef.current?.postMessage({ type: 'ANNOUNCEMENT', title: override.title, body: override.body, imageUrl: ann?.image_url ?? null })
    }
    setEditingAnnId(null)
  }

  // Recherche debounce pour l'ajout à la volée
  useEffect(() => {
    if (!addQuery.trim()) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setIsSearching(true)
      const res = await searchSongsForProjection(addQuery)
      setSearchResults(res)
      setIsSearching(false)
    }, 350)
    return () => clearTimeout(timer)
  }, [addQuery])

  // Ajouter un chant à la volée
  function addSongToProjection(result: SongSearchResult) {
    const newSong: Song = {
      planSongId: `extra-${Date.now()}`,
      orderIndex: allSongs.length,
      keySelected: result.arrangement?.chord_chart_key ?? null,
      song: { id: result.songId, title: result.title },
      arrangement: result.arrangement
        ? { id: result.arrangement.id, name: result.arrangement.name, chord_chart: result.arrangement.chord_chart, chord_chart_key: result.arrangement.chord_chart_key }
        : null,
    }
    setExtraSongs(prev => [...prev, newSong])
    // Synchronise le projecteur : sans ça, il ne connaît pas ce chant et projette du noir
    channelRef.current?.postMessage({ type: 'ADD_SONG', song: newSong })
    setShowAddSong(false)
    setAddQuery('')
    setSearchResults([])
  }

  // Ouvrir l'éditeur pour une diapo
  function openEdit(si: number, di: number, slide: Slide) {
    const key = slideKey(si, di)
    setEditingKey(key)
    setEditText((slideOverrides.get(key) ?? slide.lines).join('\n'))
  }

  // Appliquer l'édition (affichage immédiat + sauvegarde permanente)
  async function applyEdit() {
    if (!editingKey) return
    const lines = editText.split('\n').map(l => l.trimEnd()).filter(l => l.length > 0)
    const [si, di] = editingKey.split('-').map(Number)

    // 1. Override local immédiat
    const newOverrides = new Map(slideOverrides)
    newOverrides.set(editingKey, lines)
    setSlideOverrides(newOverrides)

    // 2. Broadcast au projecteur
    channelRef.current?.postMessage({ type: 'EDIT_SLIDE', songIdx: si, slideIdx: di, lines })

    setEditingKey(null)

    // 3. Sauvegarde permanente en DB
    const slide = songSlides[si]?.slides[di]
    const arrangementId = allSongs[si]?.arrangement?.id
    if (slide && arrangementId && slide.chartLineNums && !slide.isBlank) {
      setSaveStatus('saving')
      const result = await updateSlideLyrics(arrangementId, slide.chartLineNums, lines, planId)
      setSaveStatus(result.ok ? 'saved' : 'error')
      if (result.ok) {
        router.refresh()
        setTimeout(() => setSaveStatus('idle'), 2500)
      }
    }
  }

  // Charger les médias depuis Supabase
  useEffect(() => {
    const supabase = createClient()
    supabase.from('media_files').select('id, name, url').eq('type', 'image').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setMediaFiles(data) })
  }, [])

  // BroadcastChannel
  useEffect(() => {
    const ch = new BroadcastChannel(`projection-${planId}`)
    channelRef.current = ch
    ch.onmessage = (e) => {
      if (e.data?.type === 'READY') setProjectorReady(true)
    }
    return () => {
      ch.close()
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current)
    }
  }, [planId])

  // Fenêtre projecteur — pré-ouverte dans le onClick de SetlistView (contexte du geste utilisateur)
  useEffect(() => {
    if (preOpenedWindow) {
      setProjectorWindow(preOpenedWindow)
      return () => { preOpenedWindow.close() }
    }
    // Fallback si pas de fenêtre pré-ouverte (ex : autoProjection via URL)
    const url = `/espace/admin/plans/${planId}/setlist/projector`
    const features = [
      `width=${window.screen.width}`,
      `height=${window.screen.height}`,
      'left=0', 'top=0',
      'toolbar=no', 'menubar=no', 'location=no', 'status=no',
      'noopener',
    ].join(',')
    const win = window.open(url, `projector-${planId}`, features)
    if (win) setProjectorWindow(win)
    return () => { win?.close() }
  }, [planId, preOpenedWindow])

  // Aller à une diapo
  const goto = useCallback((songIdx: number, slideIdx: number) => {
    setCurrent({ songIdx, slideIdx })
    setIsShowingMessage(false)
    channelRef.current?.postMessage({ type: 'GOTO', songIdx, slideIdx })
    // Repart du début du timer à chaque navigation manuelle
    setAutoResetKey(k => k + 1)
  }, [])

  function projectMessage() {
    if (!freeMessage.trim()) return
    setIsShowingMessage(true)
    channelRef.current?.postMessage({ type: 'MESSAGE', text: freeMessage.trim() })
  }

  function clearMessage() {
    setIsShowingMessage(false)
    channelRef.current?.postMessage({ type: 'CLEAR_MESSAGE' })
  }

  async function lookupBible() {
    if (!bibleRef.trim()) return
    setBibleFetching(true)
    setBibleError(null)
    setBibleResult(null)
    const res = await fetchBibleVerse(bibleRef.trim(), bibleVersion)
    if ('error' in res) {
      setBibleError(res.error)
    } else {
      setBibleResult(res)
    }
    setBibleFetching(false)
  }

  function projectVerse() {
    if (!bibleResult) return
    setIsShowingVerse(true)
    channelRef.current?.postMessage({ type: 'VERSE', text: bibleResult.text, display: bibleResult.display, versionName: bibleResult.versionName })
  }

  function clearVerse() {
    setIsShowingVerse(false)
    channelRef.current?.postMessage({ type: 'CLEAR_VERSE' })
  }

  function projectImage(url: string) {
    setProjectedImageUrl(url)
    setIsShowingMessage(false)
    setIsShowingVerse(false)
    channelRef.current?.postMessage({ type: 'IMAGE', url })
  }

  function clearImage() {
    setProjectedImageUrl(null)
    channelRef.current?.postMessage({ type: 'CLEAR_IMAGE' })
  }

  function projectAnnouncement(ann: Announcement) {
    const eff = getEffectiveAnn(ann)
    setProjectedAnnouncementId(ann.id)
    setProjectedImageUrl(null)
    setProjectedSermonLabel(null)
    setIsShowingMessage(false)
    setIsShowingVerse(false)
    channelRef.current?.postMessage({ type: 'ANNOUNCEMENT', title: eff.title ?? null, body: eff.body, imageUrl: ann.image_url ?? null })
  }

  function clearAnnouncement() {
    setProjectedAnnouncementId(null)
    channelRef.current?.postMessage({ type: 'CLEAR_ANNOUNCEMENT' })
  }

  function projectSermonPage(dataUrl: string, label: string) {
    setProjectedSermonLabel(label)
    setProjectedImageUrl(dataUrl)
    setProjectedAnnouncementId(null)
    setIsShowingMessage(false)
    setIsShowingVerse(false)
    channelRef.current?.postMessage({ type: 'IMAGE', url: dataUrl })
  }

  function clearSermonPage() {
    setProjectedSermonLabel(null)
    clearImage()
  }

  function projectVideo(video: PlanVideo) {
    const embedUrl = getEmbedUrl(video.url)
    if (!embedUrl) return
    setProjectedVideoId(video.id)
    setProjectedImageUrl(null)
    setProjectedAnnouncementId(null)
    setProjectedSermonLabel(null)
    setIsShowingMessage(false)
    setIsShowingVerse(false)
    channelRef.current?.postMessage({ type: 'VIDEO', embedUrl, title: video.title ?? null })
  }

  function clearVideo() {
    setProjectedVideoId(null)
    channelRef.current?.postMessage({ type: 'CLEAR_VIDEO' })
  }

  async function deleteAnn(ann: Announcement) {
    if (projectedAnnouncementId === ann.id) clearAnnouncement()
    setRemovedAnnIds(prev => new Set(prev).add(ann.id))
    await deleteAnnouncement(ann.id, planId)
  }

  async function removeSong(planSongId: string) {
    const removedIdx = allSongs.findIndex(s => s.planSongId === planSongId)
    if (removedIdx !== -1 && removedIdx <= current.songIdx) {
      setCurrent({ songIdx: Math.max(0, current.songIdx - 1), slideIdx: 0 })
    }
    setRemovedSongIds(prev => new Set(prev).add(planSongId))
    const isExtra = planSongId.startsWith('extra-')
    if (!isExtra) {
      const fd = new FormData()
      fd.append('plan_song_id', planSongId)
      fd.append('plan_id', planId)
      await removePlanSong(fd)
    }
  }

  const COUNTDOWN_SECONDS = 5 * 60

  function toggleCountdown() {
    if (countdownActive) {
      setCountdownActive(false)
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current)
      channelRef.current?.postMessage({ type: 'COUNTDOWN_STOP' })
    } else {
      setCountdownActive(true)
      setIsShowingMessage(false)
      channelRef.current?.postMessage({ type: 'COUNTDOWN_START' })
      // Réinitialise automatiquement après 5 min
      countdownTimerRef.current = setTimeout(() => {
        setCountdownActive(false)
      }, COUNTDOWN_SECONDS * 1000)
    }
  }

  // ── Défilement automatique ─────────────────────────────────────────────────
  // Refs mises à jour synchroniquement à chaque render (pas de stale closure)
  const currentRef      = useRef(current)
  currentRef.current    = current
  const songSlidesRef   = useRef(songSlides)
  songSlidesRef.current = songSlides
  const autoLoopRef     = useRef(autoLoop)
  autoLoopRef.current   = autoLoop
  const announcementsRef             = useRef(visibleAnnouncements)
  announcementsRef.current           = visibleAnnouncements
  const projectedAnnIdRef            = useRef(projectedAnnouncementId)
  projectedAnnIdRef.current          = projectedAnnouncementId
  const projectAnnouncementRef       = useRef(projectAnnouncement)
  projectAnnouncementRef.current     = projectAnnouncement

  // Overlays "durs" qui suspendent le timer (message libre, verset, image/PDF, décompte).
  // Les annonces NE suspendent PAS le timer : elles participent au cycle.
  const isHardOverlay = isShowingMessage || isShowingVerse || !!projectedImageUrl || countdownActive
  const hardOverlayRef = useRef(false)
  hardOverlayRef.current = isHardOverlay

  // Quand un overlay dur se ferme → reset du timer (la diapo courante repart à zéro)
  const prevHardOverlayRef = useRef(false)
  useEffect(() => {
    if (!isHardOverlay && prevHardOverlayRef.current && autoAdvanceSecs) {
      setAutoResetKey(k => k + 1)
    }
    prevHardOverlayRef.current = isHardOverlay
  }, [isHardOverlay, autoAdvanceSecs])

  useEffect(() => {
    if (!autoAdvanceSecs) return
    const id = setInterval(() => {
      if (hardOverlayRef.current) return // message / verset / image / décompte → suspendu

      const annId = projectedAnnIdRef.current
      const anns  = announcementsRef.current

      if (annId && anns.length > 0) {
        // Cycle à travers les annonces
        const idx  = anns.findIndex(a => a.id === annId)
        const next = anns[idx + 1]
        if (next) {
          projectAnnouncementRef.current(next)
        } else if (autoLoopRef.current && anns[0]) {
          projectAnnouncementRef.current(anns[0]) // reboucle sur la première
        }
        // Sans boucle sur la dernière annonce → reste en place
        return
      }

      // Cycle dans les diapos de chants
      const cur  = currentRef.current
      const ss   = songSlidesRef.current
      const song = ss[cur.songIdx]
      if (!song) return
      if (cur.slideIdx + 1 < song.slides.length) {
        goto(cur.songIdx, cur.slideIdx + 1)
      } else if (cur.songIdx + 1 < ss.length) {
        goto(cur.songIdx + 1, 0)
      } else if (autoLoopRef.current) {
        goto(0, 0) // reboucle sur le premier chant
      }
      // Sans boucle sur la dernière diapo → reste en place
    }, autoAdvanceSecs * 1000)
    return () => clearInterval(id)
  }, [autoAdvanceSecs, autoResetKey, goto])
  // ───────────────────────────────────────────────────────────────────────────

  // Navigation clavier
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (editingKey) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault()
        const nextInSong = currentSong?.slides[current.slideIdx + 1]
        if (nextInSong) {
          goto(current.songIdx, current.slideIdx + 1)
        } else if (current.songIdx < allSongs.length - 1) {
          goto(current.songIdx + 1, 0)
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (current.slideIdx > 0) {
          goto(current.songIdx, current.slideIdx - 1)
        } else if (current.songIdx > 0) {
          const prevSong = songSlides[current.songIdx - 1]
          goto(current.songIdx - 1, Math.max(0, prevSong.slides.length - 1))
        }
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, currentSong, goto, onClose, allSongs.length, songSlides, editingKey])

  // Scroll vers la diapo active
  const activeRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [current])

  const isFirst = current.songIdx === 0 && current.slideIdx === 0
  const isLast  = current.songIdx === allSongs.length - 1 &&
                  current.slideIdx === (currentSong?.slides.length ?? 1) - 1

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col text-white">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0">
        <div>
          <p className="font-sans text-xs text-white/40 uppercase tracking-widest">Tableau de bord opérateur</p>
          <p className="font-display text-base font-light text-white/80">
            {songSlides[current.songIdx]?.title}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`block w-2 h-2 rounded-full ${projectorReady ? 'bg-green-400' : 'bg-amber-400 animate-pulse'}`} />
            <span className="font-sans text-xs text-white/40">
              {projectorReady ? 'Projecteur connecté' : 'En attente du projecteur…'}
            </span>
          </div>
          {/* Statut sauvegarde paroles */}
          {saveStatus !== 'idle' && (
            <span className={`font-sans text-xs px-2 py-1 rounded ${
              saveStatus === 'saving' ? 'text-white/40' :
              saveStatus === 'saved'  ? 'text-green-400' :
              'text-red-400'
            }`}>
              {saveStatus === 'saving' ? '💾 Sauvegarde…' :
               saveStatus === 'saved'  ? '✓ Sauvegardé' :
               '✗ Erreur sauvegarde'}
            </span>
          )}
          {/* Bouton ajout chant */}
          <button
            onClick={() => { setShowAddSong(v => !v); setEditingKey(null) }}
            className={`px-3 py-1.5 rounded-lg font-sans text-xs transition-colors ${
              showAddSong ? 'bg-teal text-white' : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            ➕ Ajouter un chant
          </button>
          {/* Bouton décompte */}
          <button
            onClick={toggleCountdown}
            className={`px-3 py-1.5 rounded-lg font-sans text-xs transition-colors ${
              countdownActive
                ? 'bg-red-500/70 hover:bg-red-500 text-white font-semibold'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            {countdownActive ? '⏹ Arrêter le décompte' : '⏱ Décompte 5 min'}
          </button>
          <a
            href="/espace/admin/parametres/projection"
            target="_blank"
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg font-sans text-xs transition-colors"
            title="Modifier l'apparence (fond, police, couleurs)"
          >
            🎨 Apparence
          </a>
          {projectorWindow && (
            <button
              onClick={() => projectorWindow.focus()}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg font-sans text-xs transition-colors"
            >
              ↗ Basculer sur l'écran
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-white/10 hover:bg-red-500/40 rounded-lg font-sans text-xs transition-colors"
          >
            ✕ Quitter
          </button>
        </div>
      </div>

      {/* ── Corps ── */}
      <div className="flex flex-1 min-h-0">

        {/* Panneau gauche */}
        <div className="w-80 shrink-0 border-r border-white/10 overflow-y-auto">
        <div className="flex flex-col gap-3 p-4">

          {showAddSong ? (
            /* ── Ajout d'un chant à la volée ── */
            <div className="border border-teal/40 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-sans text-[10px] uppercase tracking-widest text-teal/70">➕ Ajouter un chant</p>
                <button onClick={() => { setShowAddSong(false); setAddQuery(''); setSearchResults([]) }} className="text-white/40 hover:text-white text-sm leading-none">✕</button>
              </div>
              <input
                autoFocus
                value={addQuery}
                onChange={e => setAddQuery(e.target.value)}
                placeholder="Titre ou mots des paroles…"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-sans text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-teal/50"
              />
              <p className="text-white/25 text-[10px] font-sans">Recherche dans les titres et les paroles</p>
              {isSearching && (
                <p className="text-white/30 text-xs font-sans text-center py-2">Recherche…</p>
              )}
              {!isSearching && searchResults.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {searchResults.map(r => (
                    <button
                      key={r.songId}
                      onClick={() => addSongToProjection(r)}
                      className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-teal/20 transition-colors group"
                    >
                      <p className="font-sans text-sm text-white truncate">{r.title}</p>
                      <p className="font-sans text-[10px] text-white/30 flex items-center gap-1">
                        {r.arrangement?.chord_chart_key && <span>{r.arrangement.chord_chart_key}</span>}
                        {r.matchedInLyrics && <span className="text-teal/60">· trouvé dans les paroles</span>}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {!isSearching && addQuery.trim() && searchResults.length === 0 && (
                <p className="text-white/30 text-xs font-sans text-center py-2">Aucun résultat</p>
              )}
            </div>
          ) : editingAnnId ? (
            /* ── Éditeur d'annonce ── */
            <div className="border border-amber-500/40 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-sans text-[10px] uppercase tracking-widest text-amber-400/70">✏️ Modifier l'annonce</p>
                <button onClick={() => setEditingAnnId(null)} className="text-white/40 hover:text-white text-sm leading-none">✕</button>
              </div>
              <input
                value={editAnnTitle}
                onChange={e => setEditAnnTitle(e.target.value)}
                placeholder="Titre (optionnel)"
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-sans text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50"
              />
              <textarea
                value={editAnnBody}
                onChange={e => setEditAnnBody(e.target.value)}
                rows={5}
                placeholder="Texte de l'annonce…"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-sans text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50 resize-none"
              />
              <p className="text-white/25 text-[10px] font-sans">Une ligne = une ligne projetée</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingAnnId(null)}
                  className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-sans text-xs text-white transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={applyAnnEdit}
                  disabled={!editAnnBody.trim()}
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 rounded-lg font-sans text-xs text-white font-semibold transition-colors"
                >
                  ✓ Appliquer
                </button>
              </div>
            </div>
          ) : editingKey ? (
            /* ── Éditeur de diapo ── */
            <div className="border border-teal/40 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-sans text-[10px] uppercase tracking-widest text-teal/70">✏️ Modifier la diapo</p>
                <button onClick={() => setEditingKey(null)} className="text-white/40 hover:text-white text-sm leading-none">✕</button>
              </div>
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                rows={5}
                autoFocus
                placeholder="Une ligne = une ligne de paroles"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-sans text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-teal/50 resize-none"
              />
              <p className="text-white/25 text-[10px] font-sans">Une ligne = une ligne projetée</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingKey(null)}
                  className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-sans text-xs text-white transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={applyEdit}
                  className="flex-1 py-2 bg-teal hover:bg-teal/80 rounded-lg font-sans text-xs text-white font-semibold transition-colors"
                >
                  ✓ Appliquer
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Diapo courante */}
              <div>
                <p className="font-sans text-[10px] uppercase tracking-widest text-white/30 mb-2">En cours</p>
                <SlidePreview slide={currentSlide} lines={currentSlide ? getLines(current.songIdx, current.slideIdx, currentSlide) : []} size="lg" />
              </div>
              {/* Diapo suivante */}
              <div>
                <p className="font-sans text-[10px] uppercase tracking-widest text-white/30 mb-2">Suivante</p>
                <SlidePreview slide={nextSlide} lines={nextSlide ? (() => {
                  // Trouver l'index de nextSlide
                  const nextIdx = current.slideIdx + 1 < (currentSong?.slides.length ?? 0)
                    ? { si: current.songIdx, di: current.slideIdx + 1 }
                    : { si: current.songIdx + 1, di: 0 }
                  return getLines(nextIdx.si, nextIdx.di, nextSlide)
                })() : []} size="sm" dim />
              </div>
            </>
          )}

          {/* Message libre */}
          <div className="border border-white/10 rounded-xl p-3 space-y-2">
            <p className="font-sans text-[10px] uppercase tracking-widest text-white/30">Message libre</p>
            <textarea
              value={freeMessage}
              onChange={e => setFreeMessage(e.target.value)}
              placeholder="Voiture à déplacer, sujet de prière…"
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-sans text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 resize-none"
            />
            {isShowingMessage ? (
              <button
                onClick={clearMessage}
                className="w-full py-2 bg-amber-500/80 hover:bg-amber-500 rounded-lg font-sans text-xs font-semibold text-white transition-colors"
              >
                ✕ Effacer le message
              </button>
            ) : (
              <button
                onClick={projectMessage}
                disabled={!freeMessage.trim()}
                className="w-full py-2 bg-white/10 hover:bg-white/20 disabled:opacity-25 rounded-lg font-sans text-xs font-semibold text-white transition-colors"
              >
                ↑ Projeter ce message
              </button>
            )}
          </div>

          {/* Verset biblique */}
          <div className="border border-white/10 rounded-xl p-3 space-y-2">
            <p className="font-sans text-[10px] uppercase tracking-widest text-white/30">Verset biblique</p>
            <input
              value={bibleRef}
              onChange={e => { setBibleRef(e.target.value); setBibleResult(null); setBibleError(null) }}
              onKeyDown={e => e.key === 'Enter' && lookupBible()}
              placeholder="Ex : Jean 3:16 ou Ps 23:1-3"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-sans text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30"
            />
            <select
              value={bibleVersion}
              onChange={e => { setBibleVersion(e.target.value); setBibleResult(null); setBibleError(null) }}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-sans text-xs text-white focus:outline-none focus:border-white/30"
            >
              {BIBLE_VERSIONS.map(v => (
                <option key={v.id} value={v.id} className="bg-gray-900">{v.name}</option>
              ))}
            </select>
            <button
              onClick={lookupBible}
              disabled={!bibleRef.trim() || bibleFetching}
              className="w-full py-2 bg-white/10 hover:bg-white/20 disabled:opacity-25 rounded-lg font-sans text-xs font-semibold text-white transition-colors"
            >
              {bibleFetching ? 'Recherche…' : '🔍 Chercher'}
            </button>
            {bibleError && (
              <p className="text-red-400 text-[10px] font-sans leading-snug">{bibleError}</p>
            )}
            {bibleResult && (
              <div className="space-y-2">
                <div className="bg-black/40 rounded-lg px-3 py-2 space-y-1 max-h-28 overflow-y-auto">
                  <p className="text-white/40 text-[9px] uppercase tracking-widest">{bibleResult.display} · {bibleResult.versionName}</p>
                  {bibleResult.text.split('\n').map((line, i) => (
                    <p key={i} className="text-white/80 text-[11px] font-sans leading-snug italic">{line}</p>
                  ))}
                </div>
                {isShowingVerse ? (
                  <button
                    onClick={clearVerse}
                    className="w-full py-2 bg-amber-500/80 hover:bg-amber-500 rounded-lg font-sans text-xs font-semibold text-white transition-colors"
                  >
                    ✕ Effacer le verset
                  </button>
                ) : (
                  <button
                    onClick={projectVerse}
                    className="w-full py-2 bg-teal hover:bg-teal/80 rounded-lg font-sans text-xs font-semibold text-white transition-colors"
                  >
                    ↑ Projeter ce verset
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Annonces */}
          {visibleAnnouncements.length > 0 && (
            <div className="border border-white/10 rounded-xl p-3 space-y-2">
              <p className="font-sans text-[10px] uppercase tracking-widest text-white/30">Annonces</p>
              <div className="space-y-1">
                {visibleAnnouncements.map(ann => {
                  const isActive = projectedAnnouncementId === ann.id
                  return (
                    <button
                      key={ann.id}
                      onClick={() => isActive ? clearAnnouncement() : projectAnnouncement(ann)}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
                        isActive
                          ? 'border-amber-400/60 bg-amber-500/20 text-white'
                          : 'border-white/10 hover:border-white/30 bg-white/5 text-white/70 hover:text-white'
                      }`}
                    >
                      {ann.title && (
                        <p className="text-[9px] uppercase tracking-widest text-white/40 leading-none mb-0.5">{ann.title}</p>
                      )}
                      <p className="font-sans text-xs leading-snug truncate">{ann.body}</p>
                    </button>
                  )
                })}
              </div>
              {projectedAnnouncementId && (() => {
                const ann = visibleAnnouncements.find(a => a.id === projectedAnnouncementId)
                return (
                  <div className="space-y-1">
                    {ann?.video_url && (
                      <button
                        onClick={() => projectVideo({ id: ann.id + '-video', title: ann.title, url: ann.video_url!, order_index: 0 })}
                        className="w-full py-1.5 bg-blue-500/80 hover:bg-blue-500 rounded-lg font-sans text-xs font-semibold text-white transition-colors"
                      >
                        ▶ Lancer la vidéo
                      </button>
                    )}
                    <button
                      onClick={clearAnnouncement}
                      className="w-full py-1.5 bg-amber-500/80 hover:bg-amber-500 rounded-lg font-sans text-xs font-semibold text-white transition-colors"
                    >
                      ✕ Effacer l'annonce
                    </button>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Prédication PDF */}
          {sermons.length > 0 && (
            <SermonPdfPanel
              sermons={sermons}
              onProjectPage={projectSermonPage}
              projectedLabel={projectedSermonLabel}
              onClear={clearSermonPage}
            />
          )}

          {/* Médias */}
          {mediaFiles.length > 0 && (
            <div className="border border-white/10 rounded-xl p-3 space-y-2">
              <p className="font-sans text-[10px] uppercase tracking-widest text-white/30">Images</p>
              <div className="grid grid-cols-3 gap-1.5">
                {mediaFiles.map(f => {
                  const isActive = projectedImageUrl === f.url
                  return (
                    <button
                      key={f.id}
                      onClick={() => isActive ? clearImage() : projectImage(f.url)}
                      title={f.name}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        isActive ? 'border-teal ring-1 ring-teal/50' : 'border-white/10 hover:border-white/40'
                      }`}
                    >
                      <Image src={f.url} alt={f.name} fill sizes="(max-width:640px) 33vw, 25vw" className="object-cover" />
                      {isActive && (
                        <div className="absolute inset-0 bg-teal/30 flex items-center justify-center">
                          <span className="text-white text-lg">✓</span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
              {projectedImageUrl && (
                <button
                  onClick={clearImage}
                  className="w-full py-1.5 bg-amber-500/80 hover:bg-amber-500 rounded-lg font-sans text-xs font-semibold text-white transition-colors"
                >
                  ✕ Effacer l'image
                </button>
              )}
            </div>
          )}

          {/* Défilement automatique */}
          <div className="border border-white/10 rounded-xl p-3 space-y-2">
            <p className="font-sans text-[10px] uppercase tracking-widest text-white/30">Défilement auto</p>
            <div className="flex gap-2">
              <select
                value={autoAdvanceSecs ?? 0}
                onChange={e => {
                  const v = Number(e.target.value)
                  setAutoAdvanceSecs(v === 0 ? null : v)
                  setAutoResetKey(k => k + 1)
                }}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 font-sans text-xs text-white focus:outline-none focus:border-white/30"
              >
                <option value={0} className="bg-gray-900">Désactivé</option>
                {[1,2,3,4,5,7,10,15,20].map(s => (
                  <option key={s} value={s} className="bg-gray-900">{s}s</option>
                ))}
              </select>
              <button
                onClick={() => setAutoLoop(v => !v)}
                title={autoLoop ? 'Boucle activée — cliquer pour désactiver' : 'Activer la boucle'}
                className={`px-2.5 py-1.5 rounded-lg font-sans text-xs transition-colors border ${
                  autoLoop
                    ? 'bg-teal/20 border-teal/50 text-teal'
                    : 'bg-white/5 border-white/10 text-white/30 hover:text-white hover:border-white/30'
                }`}
              >
                🔁
              </button>
            </div>
            {autoAdvanceSecs && (
              <p className="text-white/25 text-[10px] font-sans leading-snug">
                {isHardOverlay
                  ? '⏸ Suspendu'
                  : projectedAnnouncementId
                    ? `↻ Annonces (${visibleAnnouncements.findIndex(a => a.id === projectedAnnouncementId) + 1}/${visibleAnnouncements.length}) · ${autoAdvanceSecs}s`
                    : `▶ ${autoAdvanceSecs}s / diapo${autoLoop ? ' · boucle ∞' : ''}`}
              </p>
            )}
          </div>

          {/* Prev / Next */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (current.slideIdx > 0) goto(current.songIdx, current.slideIdx - 1)
                else if (current.songIdx > 0) {
                  const prev = songSlides[current.songIdx - 1]
                  goto(current.songIdx - 1, Math.max(0, prev.slides.length - 1))
                }
              }}
              disabled={isFirst}
              className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-25 rounded-xl font-sans text-sm transition-colors"
            >
              ← Précédente
            </button>
            <button
              onClick={() => {
                const nextInSong = currentSong?.slides[current.slideIdx + 1]
                if (nextInSong) goto(current.songIdx, current.slideIdx + 1)
                else if (current.songIdx < allSongs.length - 1) goto(current.songIdx + 1, 0)
              }}
              disabled={isLast}
              className="flex-1 py-2.5 bg-teal hover:bg-teal/80 disabled:opacity-25 rounded-xl font-sans text-sm font-semibold transition-colors"
            >
              Suivante →
            </button>
          </div>

          {/* Liste des chants */}
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <p className="font-sans text-[10px] uppercase tracking-widest text-white/30 px-3 py-2 border-b border-white/10">
              Chants
            </p>
            <div className="divide-y divide-white/5">
              {songSlides.map((ss, si) => {
                const isActiveSong = current.songIdx === si
                return (
                  <button
                    key={si}
                    onClick={() => goto(si, 0)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors ${
                      isActiveSong
                        ? 'bg-teal/20 text-white'
                        : 'text-white/50 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className={`font-sans text-[10px] tabular-nums w-4 shrink-0 ${isActiveSong ? 'text-teal' : 'text-white/25'}`}>
                      {si + 1}
                    </span>
                    <span className="font-sans text-xs truncate">{ss.title}</span>
                    {isActiveSong && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-teal shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>{/* fin inner flex */}
        </div>{/* fin panneau gauche */}

        {/* Grille de toutes les diapos */}
        <div className="flex-1 overflow-y-auto p-4">

          {/* ── Section Vidéos ── */}
          {videos.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="font-sans text-xs text-blue-400/50 w-4">▶</span>
                <p className="font-display text-sm text-blue-400/70 font-light">Vidéos</p>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 pl-7">
                {videos.map(video => {
                  const isActive = projectedVideoId === video.id
                  const thumb    = getYoutubeThumbnail(video.url)
                  const platform = getPlatformLabel(video.url)
                  return (
                    <div
                      key={video.id}
                      onClick={() => isActive ? clearVideo() : projectVideo(video)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && (isActive ? clearVideo() : projectVideo(video))}
                      className={`group relative rounded-lg border-2 transition-all overflow-hidden aspect-video flex flex-col items-center justify-center cursor-pointer ${
                        isActive
                          ? 'border-blue-400 ring-1 ring-blue-400/50'
                          : 'border-blue-500/30 bg-white/5 hover:bg-white/10 hover:border-blue-400/50'
                      }`}
                    >
                      {thumb ? (
                        <Image src={thumb} alt="" fill sizes="(max-width:640px) 33vw, 25vw" className="object-cover opacity-60 group-hover:opacity-80 transition-opacity" />
                      ) : (
                        <div className="absolute inset-0 bg-blue-900/30" />
                      )}
                      <div className="relative z-10 text-center px-1.5">
                        <span className="text-white text-xl drop-shadow-lg">▶</span>
                        {video.title && (
                          <p className="text-white/90 text-[9px] uppercase tracking-wide leading-tight mt-1 truncate w-full drop-shadow">{video.title}</p>
                        )}
                        {platform && (
                          <p className="text-white/40 text-[8px] font-sans mt-0.5">{platform}</p>
                        )}
                      </div>
                      {isActive && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-400" />
                      )}
                    </div>
                  )
                })}
              </div>
              {projectedVideoId && (
                <div className="mt-2 pl-7">
                  <button
                    onClick={clearVideo}
                    className="px-3 py-1.5 bg-blue-500/80 hover:bg-blue-500 rounded-lg font-sans text-xs font-semibold text-white transition-colors"
                  >
                    ✕ Arrêter la vidéo
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Section Annonces ── */}
          {visibleAnnouncements.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="font-sans text-xs text-amber-400/50 w-4">♦</span>
                <p className="font-display text-sm text-amber-400/70 font-light">Annonces</p>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 pl-7">
                {visibleAnnouncements.map(ann => {
                  const isActive = projectedAnnouncementId === ann.id
                  const hasOverride = annOverrides.has(ann.id)
                  const eff = getEffectiveAnn(ann)
                  return (
                    <div
                      key={ann.id}
                      onClick={() => isActive ? clearAnnouncement() : projectAnnouncement(ann)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && (isActive ? clearAnnouncement() : projectAnnouncement(ann))}
                      className={`group relative rounded-lg border-2 transition-all overflow-hidden aspect-video flex flex-col justify-start px-2 py-2 cursor-pointer ${
                        isActive
                          ? 'border-amber-400 bg-amber-500/20 ring-1 ring-amber-400/50'
                          : 'border-amber-500/30 bg-white/5 hover:bg-white/10 hover:border-amber-400/50'
                      }`}
                    >
                      {/* Miniature en fond si image */}
                      {ann.image_url && (
                        <Image src={ann.image_url} alt="" fill sizes="(max-width:640px) 33vw, 25vw" className="object-cover opacity-20 group-hover:opacity-30 transition-opacity" />
                      )}
                      {eff.title && (
                        <p className={`relative z-10 text-[9px] uppercase tracking-widest leading-none mb-1 truncate w-full ${hasOverride ? 'text-amber-300/80' : 'text-amber-400/70'}`}>
                          {eff.title}
                        </p>
                      )}
                      <div className="flex-1 overflow-hidden relative z-10">
                        {eff.body.split('\n').slice(0, 4).map((line, i) => (
                          <p key={i} className={`text-[11px] leading-tight text-left truncate w-full ${hasOverride ? 'text-amber-200/80' : 'text-white/80'}`}>
                            {line}
                          </p>
                        ))}
                      </div>
                      {isActive && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400 group-hover:hidden" />
                      )}
                      {hasOverride && (
                        <span className="absolute bottom-1 right-1 text-[8px] text-amber-400" title="Modifié">✏️</span>
                      )}
                      {/* Indicateur vidéo */}
                      {ann.video_url && (
                        <span className="absolute bottom-1 left-1 text-[8px] text-blue-400/80 z-10" title="Vidéo associée">▶</span>
                      )}
                      {/* Bouton édition au hover */}
                      <button
                        onClick={e => { e.stopPropagation(); openAnnEdit(ann) }}
                        className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 bg-black/70 hover:bg-amber-500/80 rounded p-0.5 transition-all text-[10px] leading-none"
                        title="Modifier l'annonce"
                      >
                        ✏️
                      </button>
                      {/* Bouton suppression au hover */}
                      <button
                        onClick={e => { e.stopPropagation(); deleteAnn(ann) }}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-black/70 hover:bg-red-500/80 rounded p-0.5 transition-all text-[10px] leading-none z-20"
                        title="Supprimer l'annonce"
                      >
                        ✕
                      </button>
                      {/* Bouton lancer la vidéo au hover */}
                      {ann.video_url && (
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            projectVideo({ id: ann.id + '-video', title: ann.title, url: ann.video_url!, order_index: 0 })
                          }}
                          className="absolute bottom-1 right-5 opacity-0 group-hover:opacity-100 bg-black/70 hover:bg-blue-500/80 rounded p-0.5 transition-all text-[10px] leading-none"
                          title="Lancer la vidéo"
                        >
                          ▶
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Section Chants ── */}
          {songSlides.map((ss, si) => {
            if (ss.slides.length === 0) return null
            return (
              <div key={si} className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-sans text-xs text-white/30 tabular-nums w-4">{si + 1}</span>
                  <p className="font-display text-sm text-white/60 font-light">{ss.title}</p>
                  <div className="flex-1 h-px bg-white/10" />
                  <button
                    onClick={() => removeSong(allSongs[si].planSongId)}
                    className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold text-white/40 hover:text-white hover:bg-red-500/60 transition-all leading-none"
                    title="Supprimer ce chant du plan"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 pl-7">
                  {ss.slides.map((slide, di) => {
                    const isActive  = current.songIdx === si && current.slideIdx === di
                    const key       = slideKey(si, di)
                    const hasOverride = slideOverrides.has(key)
                    const lines     = getLines(si, di, slide)

                    return (
                      <div
                        key={di}
                        ref={isActive ? (el => { activeRef.current = el }) : null}
                        onClick={() => goto(si, di)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && goto(si, di)}
                        className={`group relative rounded-lg border-2 transition-all text-left overflow-hidden aspect-video flex flex-col items-center justify-center px-2 py-2 cursor-pointer ${
                          isActive
                            ? 'border-teal bg-teal/10 ring-1 ring-teal/50'
                            : `${slide.isBlank ? 'border-white/10 hover:border-white/30' : sectionBorder(slide.section)} bg-white/5 hover:bg-white/10`
                        }`}
                      >
                        {slide.isBlank ? (
                          <span className="text-white/20 text-base">⬛</span>
                        ) : (
                          <>
                            {slide.section && (
                              <p className="text-white/30 text-[9px] uppercase tracking-wider leading-none mb-1 text-center truncate w-full">
                                {slide.section}
                              </p>
                            )}
                            {lines.map((line, li) => (
                              <p key={li} className={`text-[11px] leading-tight text-center truncate w-full ${hasOverride ? 'text-amber-300' : 'text-white'}`}>
                                {line}
                              </p>
                            ))}
                          </>
                        )}

                        {/* Indicateur diapo active */}
                        {isActive && (
                          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-teal" />
                        )}

                        {/* Indicateur override */}
                        {hasOverride && (
                          <span className="absolute bottom-1 right-1 text-[8px] text-amber-400" title="Modifié">✏️</span>
                        )}

                        {/* Bouton édition (hover) — visible uniquement sur les diapos non-blank */}
                        {!slide.isBlank && (
                          <button
                            onClick={e => { e.stopPropagation(); openEdit(si, di, slide) }}
                            className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 bg-black/70 hover:bg-teal/80 rounded p-0.5 transition-all text-[10px] leading-none"
                            title="Modifier les paroles"
                          >
                            ✏️
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Couleur de bordure selon le type de section ── */
function sectionBorder(section: string): string {
  const s = section.toLowerCase()
  if (/chorus|refrain/.test(s))              return 'border-red-500/50   hover:border-red-500/90'
  if (/verse|couplet|strophe|verset/.test(s)) return 'border-green-500/50 hover:border-green-500/90'
  if (/bridge|pont/.test(s))                  return 'border-blue-500/50  hover:border-blue-500/90'
  return 'border-white/10 hover:border-white/30'
}

/* ── Composant prévisualisation ── */
function SlidePreview({ slide, lines, size, dim }: { slide: Slide | null; lines: string[]; size: 'lg' | 'sm'; dim?: boolean }) {
  const padding  = size === 'lg' ? 'px-4 py-5' : 'px-3 py-3'
  const textSize = size === 'lg' ? 'text-sm'   : 'text-xs'
  const labelSize = size === 'lg' ? 'text-[9px]' : 'text-[8px]'

  return (
    <div className={`bg-black rounded-xl border border-white/10 aspect-video flex flex-col items-center justify-center ${padding} ${dim ? 'opacity-50' : ''}`}>
      {slide ? (
        slide.isBlank ? (
          <p className="text-white/20 text-xs font-sans">⬛ transition</p>
        ) : (
          <>
            {slide.section && (
              <p className={`text-white/30 ${labelSize} uppercase tracking-wider mb-2 text-center`}>
                {slide.section}
              </p>
            )}
            {lines.map((line, i) => (
              <p key={i} className={`text-white ${textSize} leading-snug text-center font-sans font-semibold`}>
                {line}
              </p>
            ))}
          </>
        )
      ) : (
        <p className="text-white/20 text-xs font-sans">—</p>
      )}
    </div>
  )
}
