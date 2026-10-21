'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { buildAllSlides, type Slide } from '@/lib/parseSlides'
import { CountdownDisplay, COUNTDOWN_SECONDS } from '@/app/_components/CountdownDisplay'
import { type ProjectionSettings, DEFAULT_SETTINGS, getBgStyle, getAnnBgStyle, getTextStyle, getAnnTextStyle, loadGoogleFont, mergeSettings, calcFontSize, calcAnnFontSize, projectionChannel, SETTINGS_EVENT } from '@/lib/projectionSettings'
import { PRESET_KEYFRAMES, getPresetById, type SlideStyle } from '@/lib/slidePresets'
import { createClient } from '@/lib/supabase/client'

type Song = {
  planSongId: string
  keySelected: string | null
  song: { id: string; title: string }
  arrangement: {
    id: string; name: string
    chord_chart: string | null; chord_chart_key: string | null
    slide_style: SlideStyle | null
  } | null
}

type Props = { planId: string; churchId: string; songs: Song[]; settings?: ProjectionSettings; churchName?: string }

export function ProjectorScreen({ planId, churchId, songs: songsProp, settings: settingsProp, churchName }: Props) {
  // Fusion avec les defaults pour gérer les nouvelles colonnes nulles en DB
  const [settings, setSettings] = useState<ProjectionSettings>(mergeSettings(settingsProp ?? null))
  // Songs en state pour recevoir les chants ajoutés à la volée depuis l'opérateur
  const [songs, setSongs] = useState(songsProp)

  // Écouter les réglages enregistrés depuis la page Paramètres (canal privé de l'église)
  useEffect(() => {
    const supabase = createClient()
    let ch: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false
    supabase.realtime.setAuth().then(() => {
      if (cancelled) return
      ch = supabase
        .channel(projectionChannel(churchId), { config: { private: true } })
        .on('broadcast', { event: SETTINGS_EVENT }, ({ payload }) => {
          // Valeurs revalidées : un message mal formé retombe sur les valeurs par défaut
          setSettings(mergeSettings(payload as Partial<ProjectionSettings>))
        })
        .subscribe()
    })
    return () => {
      cancelled = true
      if (ch) supabase.removeChannel(ch)
    }
  }, [churchId])
  const [current, setCurrent]         = useState<{ songIdx: number; slideIdx: number }>({ songIdx: 0, slideIdx: 0 })
  const [projectedImageUrl, setProjectedImageUrl] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showPrompt, setShowPrompt]   = useState(true)
  const [freeMessage, setFreeMessage] = useState<string | null>(null)
  const [slideOverrides, setSlideOverrides] = useState<Map<string, string[]>>(new Map())

  // Countdown
  const [countdown, setCountdown]     = useState<number | null>(null) // secondes restantes, null = inactif
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [verse, setVerse]               = useState<{ text: string; display: string; versionName: string } | null>(null)
  const [announcement, setAnnouncement] = useState<{ title: string | null; body: string; imageUrl: string | null } | null>(null)
  const [annImgOrientation, setAnnImgOrientation] = useState<'landscape' | 'portrait' | null>(null)
  const [projectedVideo, setProjectedVideo] = useState<{ embedUrl: string; title: string | null } | null>(null)
  const channelRef = useRef<BroadcastChannel | null>(null)

  // Charger les Google Fonts si nécessaire
  useEffect(() => { loadGoogleFont(settings.font_family) },     [settings.font_family])
  useEffect(() => { loadGoogleFont(settings.ann_font_family) }, [settings.ann_font_family])

  // Traduit et nettoie les noms de sections (retire les deux-points, traduit en français)
  function formatSection(raw: string): string {
    const s = raw.replace(/\s*:\s*$/, '').trim() // retire le ':' final
    const lower = s.toLowerCase()
    if (/^verse|^couplet|^strophe/.test(lower)) return s.replace(/verse/gi, 'Couplet').replace(/couplet/gi, 'Couplet').replace(/strophe/gi, 'Couplet')
    if (/^chorus|^refrain/.test(lower))          return s.replace(/chorus/gi, 'Refrain').replace(/refrain/gi, 'Refrain')
    if (/^bridge|^pont/.test(lower))             return s.replace(/bridge/gi, 'Pont').replace(/pont/gi, 'Pont')
    if (/^pre.?chorus|^pré.?refrain/.test(lower)) return 'Pré-refrain'
    if (/^intro/.test(lower))                    return 'Intro'
    if (/^outro/.test(lower))                    return 'Outro'
    if (/^tag/.test(lower))                      return 'Tag'
    if (/^interlude/.test(lower))                return 'Interlude'
    return s
  }

  const songSlides   = buildAllSlides(songs)
  const currentSong  = songSlides[current.songIdx]
  const currentSlide: Slide | null = currentSong?.slides[current.slideIdx] ?? null
  const slideKey     = `${current.songIdx}-${current.slideIdx}`
  const displayLines = slideOverrides.get(slideKey) ?? currentSlide?.lines ?? []

  // Police cohérente : basée sur la ligne la plus longue de tout le chant actif
  const allSongLines = currentSong?.slides
    .filter(s => !s.isBlank && s.lines.length > 0)
    .flatMap(s => s.lines) ?? []
  const songMaxLen = Math.max(...allSongLines.map(l => l.length), displayLines.reduce((m, l) => Math.max(m, l.length), 1), 1)
  const slideFs = calcFontSize(songMaxLen, settings.font_size_scale ?? 1.0)

  // Gestion du countdown (tick)
  useEffect(() => {
    if (countdown === null) return
    if (countdown <= 0) {
      setCountdown(null)
      return
    }
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownRef.current!)
          return null
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(countdownRef.current!)
  }, [countdown === null ? null : 'running']) // redémarre seulement au start/stop

  // Écouter les commandes de l'opérateur
  useEffect(() => {
    const ch = new BroadcastChannel(`projection-${planId}`)
    channelRef.current = ch
    ch.onmessage = (e) => {
      if (e.data?.type === 'GOTO') {
        setCurrent({ songIdx: e.data.songIdx, slideIdx: e.data.slideIdx })
        setFreeMessage(null)
        setProjectedVideo(null)
        setCountdown(null)
        setShowPrompt(false)
      }
      if (e.data?.type === 'MESSAGE') {
        setFreeMessage(e.data.text)
        setVerse(null)
        setProjectedVideo(null)
        setCountdown(null)
        setShowPrompt(false)
      }
      if (e.data?.type === 'CLEAR_MESSAGE') {
        setFreeMessage(null)
      }
      if (e.data?.type === 'VERSE') {
        setVerse({ text: e.data.text, display: e.data.display, versionName: e.data.versionName })
        setFreeMessage(null)
        setCountdown(null)
        setShowPrompt(false)
      }
      if (e.data?.type === 'CLEAR_VERSE') {
        setVerse(null)
      }
      if (e.data?.type === 'EDIT_SLIDE') {
        const key = `${e.data.songIdx}-${e.data.slideIdx}`
        setSlideOverrides(prev => {
          const next = new Map(prev)
          next.set(key, e.data.lines)
          return next
        })
      }
      if (e.data?.type === 'COUNTDOWN_START') {
        setFreeMessage(null)
        setShowPrompt(false)
        setCountdown(COUNTDOWN_SECONDS)
      }
      if (e.data?.type === 'COUNTDOWN_STOP') {
        clearInterval(countdownRef.current!)
        setCountdown(null)
      }
      if (e.data?.type === 'ANNOUNCEMENT') {
        setAnnouncement({ title: e.data.title ?? null, body: e.data.body ?? '', imageUrl: e.data.imageUrl ?? null })
        setFreeMessage(null)
        setVerse(null)
        setProjectedImageUrl(null)
        setCountdown(null)
        setShowPrompt(false)
      }
      if (e.data?.type === 'CLEAR_ANNOUNCEMENT') {
        setAnnouncement(null)
        setAnnImgOrientation(null)
      }
      if (e.data?.type === 'IMAGE') {
        setProjectedImageUrl(e.data.url)
        setFreeMessage(null)
        setVerse(null)
        setAnnouncement(null)
        setProjectedVideo(null)
        setCountdown(null)
        setShowPrompt(false)
      }
      if (e.data?.type === 'CLEAR_IMAGE') {
        setProjectedImageUrl(null)
      }
      if (e.data?.type === 'VIDEO') {
        setProjectedVideo({ embedUrl: e.data.embedUrl, title: e.data.title ?? null })
        setProjectedImageUrl(null)
        setFreeMessage(null)
        setVerse(null)
        setAnnouncement(null)
        setCountdown(null)
        setShowPrompt(false)
      }
      if (e.data?.type === 'CLEAR_VIDEO') {
        setProjectedVideo(null)
      }
      if (e.data?.type === 'ADD_SONG') {
        setSongs(prev => [...prev, { ...e.data.song, arrangement: e.data.song.arrangement ? { ...e.data.song.arrangement, slide_style: null } : null }])
      }
    }
    ch.postMessage({ type: 'READY' })
    return () => ch.close()
  }, [planId])

  // Suivre l'état plein écran
  useEffect(() => {
    function onFsChange() { setIsFullscreen(!!document.fullscreenElement) }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  function enterFullscreen() {
    document.documentElement.requestFullscreen().catch(() => {})
    setShowPrompt(false)
  }

  // Détection orientation de l'image d'annonce
  useEffect(() => {
    const url = announcement?.imageUrl
    if (!url) { setAnnImgOrientation(null); return }
    const img = new window.Image()
    img.onload = () => {
      setAnnImgOrientation(img.naturalWidth >= img.naturalHeight ? 'landscape' : 'portrait')
    }
    img.src = url
  }, [announcement?.imageUrl])

  const bgStyle      = getBgStyle(settings)
  const annBgStyle   = getAnnBgStyle(settings)
  const txtStyle     = getTextStyle(settings)
  const annTxtStyle  = getAnnTextStyle(settings)

  // Par chant : fond animé + layout (depuis songs original, pas SongSlides)
  const currentSlideStyle = songs[current.songIdx]?.arrangement?.slide_style ?? null
  const activePreset  = getPresetById(currentSlideStyle?.preset)
  const activeBgStyle = activePreset ? activePreset.bgStyle : bgStyle
  const activeLayout  = currentSlideStyle?.layout ?? 'fullscreen'
  const activeBandColor = currentSlideStyle?.band_color ?? 'rgba(0,0,0,0.70)'
  const activeTxtStyle  = currentSlideStyle?.text_color
    ? { ...txtStyle, color: currentSlideStyle.text_color }
    : txtStyle

  return (
    <>
    <style>{PRESET_KEYFRAMES}</style>
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none cursor-none overflow-hidden"
      style={activeBgStyle}
      onClick={!isFullscreen ? enterFullscreen : undefined}
    >
      {/* Overlay sombre pour les fonds image */}
      {settings.bg_type === 'image' && settings.overlay_opacity > 0 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: `rgba(0,0,0,${settings.overlay_opacity})` }}
        />
      )}
      {/* Invite plein écran */}
      {showPrompt && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center">
            <p className="text-white/50 font-sans text-sm mb-2">Cliquez pour passer en plein écran</p>
            <p className="text-white/20 font-sans text-xs">F11 fonctionne aussi</p>
          </div>
        </div>
      )}

      {/* Bouton plein écran discret */}
      {!isFullscreen && !showPrompt && (
        <button
          onClick={enterFullscreen}
          className="absolute top-3 right-3 z-10 text-white/20 hover:text-white/60 font-sans text-xs px-2 py-1 rounded transition-colors cursor-pointer"
        >
          ⛶ Plein écran
        </button>
      )}

      {/* ── COUNTDOWN ── */}
      {!showPrompt && countdown !== null && (
        <CountdownDisplay seconds={countdown} churchName={churchName} />
      )}

      {/* Image projetée */}
      {!showPrompt && projectedImageUrl && (
        <div
          className="absolute inset-0"
          style={{ backgroundImage: `url(${projectedImageUrl})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
        />
      )}

      {/* Vidéo projetée */}
      {!showPrompt && projectedVideo && (
        <div className="absolute inset-0 z-10 bg-black flex items-center justify-center">
          <iframe
            src={projectedVideo.embedUrl}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* ── Annonce ── */}
      {!showPrompt && countdown === null && !projectedImageUrl && !projectedVideo && announcement && (() => {
        const hasImage   = !!announcement.imageUrl
        const isLandscape = annImgOrientation === 'landscape'
        const isPortrait  = annImgOrientation === 'portrait'
        const lines       = announcement.body.split('\n')
        const maxLen      = Math.max(...lines.map(l => l.length), 1)

        const annPad        = `${(100 - (settings.ann_text_max_width ?? 94)) / 2}%`
        const annBodyScale  = settings.ann_font_size_scale       ?? 0.7
        const annTitleScale = settings.ann_title_font_size_scale ?? 1.1

        // Taille du titre : basée sur la longueur du titre (× 0.7 pour compenser le tracking large)
        const titleEffectiveLen = Math.max(15, Math.ceil((announcement.title?.length ?? 0) * 0.7))
        // Taille du corps : longueur min de 15 pour éviter les textes très courts (ex: "???") trop énormes
        const bodyEffectiveLen = Math.max(maxLen, 15)

        // ── Image avec orientation encore inconnue : affiche d'emblée l'image ──
        if (hasImage && annImgOrientation === null) {
          return (
            <div className="absolute inset-0 z-10">
              <Image src={announcement.imageUrl!} alt="" fill sizes="100vw" className="object-contain" />
            </div>
          )
        }

        // ── Paysage : image plein écran, sans texte superposé ───────────────
        if (hasImage && isLandscape) {
          return (
            <div className="absolute inset-0 z-10">
              <Image src={announcement.imageUrl!} alt="" fill sizes="100vw" className="object-contain" />
            </div>
          )
        }

        // ── Portrait : image à droite, texte à gauche ────────────────────────
        if (hasImage && isPortrait) {
          return (
            <div className="absolute inset-0 z-10 flex">
              <div className="w-[58%] h-full flex flex-col justify-center px-[5%]" style={annBgStyle}>
                {settings.ann_bg_type === 'image' && settings.ann_bg_image_url && (
                  <>
                    <div className="absolute inset-0 bg-center bg-cover" style={{ backgroundImage: `url(${settings.ann_bg_image_url})`, filter: settings.ann_bg_blur > 0 ? `blur(${settings.ann_bg_blur}px)` : undefined, transform: 'scale(1.05)' }} />
                    {settings.ann_bg_overlay_opacity > 0 && (
                      <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${settings.ann_bg_overlay_opacity})` }} />
                    )}
                  </>
                )}
                <div className="relative z-10">
                  {announcement.title && (
                    <p className="uppercase tracking-[0.4em] mb-6 font-sans font-semibold" style={{ color: settings.ann_text_color + 'cc', fontSize: calcAnnFontSize(titleEffectiveLen * 0.6, annTitleScale) }}>
                      {announcement.title}
                    </p>
                  )}
                  <div className="space-y-4">
                    {lines.map((line, i) => (
                      <p key={i} className="font-medium leading-tight" style={{ ...annTxtStyle, fontSize: calcAnnFontSize(bodyEffectiveLen * 0.6, annBodyScale) }}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
              <div className="relative w-[42%] h-full overflow-hidden">
                <Image src={announcement.imageUrl!} alt="" fill sizes="42vw" className="object-cover" />
              </div>
            </div>
          )
        }

        // ── Standard (sans image) ─────────────────────────────────────────────
        return (
          <>
            <div className="absolute inset-0 z-0" style={annBgStyle}>
              {settings.ann_bg_type === 'image' && settings.ann_bg_image_url && (
                <>
                  <div className="absolute inset-0 bg-center bg-cover" style={{ backgroundImage: `url(${settings.ann_bg_image_url})`, filter: settings.ann_bg_blur > 0 ? `blur(${settings.ann_bg_blur}px)` : undefined, transform: 'scale(1.05)' }} />
                  {settings.ann_bg_overlay_opacity > 0 && (
                    <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${settings.ann_bg_overlay_opacity})` }} />
                  )}
                </>
              )}
            </div>
            <div className="w-full relative z-10" style={{ paddingLeft: annPad, paddingRight: annPad }}>
              {announcement.title && (
                <p className="uppercase tracking-[0.4em] mb-8 font-sans font-semibold" style={{ color: settings.ann_text_color + 'cc', fontSize: calcAnnFontSize(titleEffectiveLen, annTitleScale) }}>
                  {announcement.title}
                </p>
              )}
              <div className="space-y-5">
                {lines.map((line, i) => (
                  <p key={i} className="font-medium leading-tight" style={{ ...annTxtStyle, fontSize: calcAnnFontSize(bodyEffectiveLen, annBodyScale) }}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </>
        )
      })()}

      {/* Message libre */}
      {!showPrompt && countdown === null && !projectedImageUrl && !projectedVideo && !announcement && freeMessage && !verse && (
        <div className="text-center w-full relative" style={{ padding: `0 ${(100 - (settings.text_max_width ?? 94)) / 2}%` }}>
          {freeMessage.split('\n').map((line, i) => {
            const maxLen = Math.max(...freeMessage.split('\n').map(l => l.length), 1)
            const fs = calcFontSize(maxLen, settings.font_size_scale ?? 1.0)
            return (
              <p key={i} className="font-semibold leading-tight" style={{ ...txtStyle, fontSize: fs }}>
                {line}
              </p>
            )
          })}
        </div>
      )}

      {/* Verset biblique */}
      {!showPrompt && countdown === null && !projectedImageUrl && !projectedVideo && verse && (
        <div className="text-center px-12 max-w-6xl w-full relative">
          <p className="text-xl uppercase tracking-[0.3em] mb-10 font-sans" style={{ color: settings.text_color + '66' }}>
            {verse.display}
          </p>
          <div className="space-y-6">
            {verse.text.split('\n').map((line, i) => {
              const verseLines = verse.text.split('\n')
              const maxLen = Math.max(...verseLines.map(l => l.length), 1)
              const fs = `clamp(2.2rem, ${Math.min(90 / maxLen, 6.5).toFixed(2)}vw, 5.5rem)`
              return (
                <p key={i} className="font-light leading-snug italic" style={{ ...txtStyle, fontSize: fs }}>
                  {line}
                </p>
              )
            })}
          </div>
          <p className="text-base font-sans mt-12 uppercase tracking-widest" style={{ color: settings.text_color + '33' }}>
            {verse.versionName}
          </p>
        </div>
      )}

      {/* Contenu de la diapo — layout plein écran */}
      {!showPrompt && countdown === null && !projectedImageUrl && !projectedVideo && !announcement && !freeMessage && !verse && currentSlide && !currentSlide.isBlank && activeLayout === 'fullscreen' && (
        <div className="text-center w-full relative" style={{ padding: `0 ${(100 - (settings.text_max_width ?? 94)) / 2}%` }}>
          {currentSlide.section && (
            <p className="text-base uppercase tracking-[0.4em] mb-10 font-sans" style={{ color: (activeTxtStyle.color as string ?? settings.text_color) + '40' }}>
              {formatSection(currentSlide.section)}
            </p>
          )}
          <div className="space-y-6">
            {displayLines.map((line, i) => (
              <p key={i} className="font-semibold leading-tight" style={{ ...activeTxtStyle, fontSize: slideFs }}>
                {line}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Contenu de la diapo — layout bande centrale */}
      {!showPrompt && countdown === null && !projectedImageUrl && !projectedVideo && !announcement && !freeMessage && !verse && currentSlide && !currentSlide.isBlank && activeLayout === 'band' && (
        <div
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2"
          style={{ backgroundColor: activeBandColor, padding: '4% 6%' }}
        >
          {currentSlide.section && (
            <p className="text-sm uppercase tracking-[0.35em] mb-5 font-sans text-center" style={{ color: (activeTxtStyle.color as string ?? settings.text_color) + '50' }}>
              {formatSection(currentSlide.section)}
            </p>
          )}
          <div className="space-y-5 text-center">
            {displayLines.map((line, i) => (
              <p key={i} className="font-semibold leading-tight" style={{ ...activeTxtStyle, fontSize: slideFs }}>
                {line}
              </p>
            ))}
          </div>
        </div>
      )}


      {/* Titre discret en bas */}
      {currentSong && !showPrompt && countdown === null && (
        <p className="absolute bottom-6 right-8 text-white/10 text-xs font-sans">
          {currentSong.title}
        </p>
      )}
    </div>
    </>
  )
}

