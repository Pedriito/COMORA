'use client'

import { useEffect, useState, useTransition } from 'react'
import Image from 'next/image'
import { saveProjectionSettings } from './actions'

type BgType        = 'color' | 'gradient' | 'image'
type TextTransform = 'uppercase' | 'capitalize' | 'small-caps' | 'none'

type ProjectionSettings = {
  id: string
  bg_type: BgType; bg_color: string; bg_gradient: string | null
  bg_image_url: string | null; bg_blur: number; overlay_opacity: number
  font_family: string; text_color: string; text_shadow: boolean
  text_transform: TextTransform; font_size_scale: number; text_max_width: number
  ann_bg_type: BgType; ann_bg_color: string; ann_bg_gradient: string | null
  ann_bg_image_url: string | null; ann_bg_blur: number; ann_bg_overlay_opacity: number
  ann_font_family: string; ann_text_color: string; ann_text_shadow: boolean
  ann_text_transform: TextTransform; ann_title_font_size_scale: number; ann_font_size_scale: number; ann_text_max_width: number
}

type MediaFile = { id: string; name: string; url: string }
type Props = { initial: ProjectionSettings; mediaFiles: MediaFile[] }

const GRADIENTS = [
  { label: 'Nuit profonde',  value: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' },
  { label: 'Aube marine',    value: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)' },
  { label: 'Forêt sombre',   value: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)' },
  { label: 'Bordeaux',       value: 'linear-gradient(135deg, #1a0a0a, #3d0000, #200000)' },
  { label: 'Violet profond', value: 'linear-gradient(135deg, #1a0033, #2d0057, #1a0033)' },
]

const FONTS = [
  'Inter', 'Montserrat', 'Oswald', 'Raleway',
  'Playfair Display', 'Bebas Neue', 'Poppins', 'Lato', 'Cinzel',
]

// Tailles en pt affichées dans le menu — converties en scale (72pt = 1.0 = référence normale)
const SIZE_PT_OPTIONS = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36,
  40, 44, 48, 54, 60, 66, 72, 80, 88, 96, 108, 120, 144, 168, 200,
]
const PT_TO_SCALE = (pt: number) => pt / 72
const SCALE_TO_PT = (scale: number) => Math.round(scale * 72)

// ── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 focus-visible:ring-offset-2 ${value ? 'bg-teal-600' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

// ── Casse ────────────────────────────────────────────────────────────────────
function CassePicker({ value, fontFamily, onChange }: {
  value: TextTransform; fontFamily: string; onChange: (v: TextTransform) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {([
        { value: 'uppercase',  label: 'MAJUSCULES',   preview: 'GLOIRE À TOI' },
        { value: 'capitalize', label: 'Initiales',    preview: 'Gloire À Toi' },
        { value: 'small-caps', label: 'Petites maj.', preview: 'Gloire à toi' },
        { value: 'none',       label: 'Normal',       preview: 'Gloire à toi' },
      ] as const).map(opt => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className={`flex flex-col items-center gap-1 px-3 py-3 rounded-lg border text-center transition-colors ${value === opt.value ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-700 border-gray-200 hover:border-teal-300'}`}
        >
          <span className="text-sm font-semibold leading-tight" style={{
            textTransform: opt.value === 'small-caps' || opt.value === 'none' ? 'none' : opt.value,
            fontVariant: opt.value === 'small-caps' ? 'small-caps' : undefined,
            fontFamily: `'${fontFamily}', sans-serif`,
          }}>{opt.preview}</span>
          <span className="text-[10px] opacity-70 font-normal">{opt.label}</span>
        </button>
      ))}
    </div>
  )
}

// ── Taille ───────────────────────────────────────────────────────────────────
function SizePicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const pt = SCALE_TO_PT(value ?? 1.0)
  return (
    <div className="flex items-center gap-2">
      <select
        value={pt}
        onChange={e => onChange(PT_TO_SCALE(Number(e.target.value)))}
        className="w-28 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        {SIZE_PT_OPTIONS.map(p => (
          <option key={p} value={p}>{p} pt</option>
        ))}
      </select>
      {pt === 72 && <span className="text-xs text-gray-400">— taille normale</span>}
    </div>
  )
}

// ── Fond ─────────────────────────────────────────────────────────────────────
type BgPickerProps = {
  bgType: BgType; bgColor: string; bgGradient: string | null
  bgImageUrl: string | null; bgBlur: number; overlayOpacity: number
  mediaFiles: MediaFile[]
  onBgType: (v: BgType) => void; onBgColor: (v: string) => void
  onBgGradient: (v: string | null) => void; onBgImageUrl: (v: string | null) => void
  onBgBlur: (v: number) => void; onOverlayOpacity: (v: number) => void
}

function BackgroundPicker({
  bgType, bgColor, bgGradient, bgImageUrl, bgBlur, overlayOpacity,
  mediaFiles, onBgType, onBgColor, onBgGradient, onBgImageUrl, onBgBlur, onOverlayOpacity,
}: BgPickerProps) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['color', 'gradient', 'image'] as const).map(type => (
          <button key={type} type="button" onClick={() => onBgType(type)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${bgType === type ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-700 border-gray-200 hover:border-teal-300'}`}
          >
            {type === 'color' ? 'Couleur' : type === 'gradient' ? 'Dégradé' : 'Image'}
          </button>
        ))}
      </div>
      {bgType === 'color' && (
        <div className="flex items-center gap-3">
          <input type="color" value={bgColor} onChange={e => onBgColor(e.target.value)} className="h-10 w-14 rounded cursor-pointer border border-gray-200" />
          <input type="text" value={bgColor} onChange={e => onBgColor(e.target.value)} maxLength={7} className="w-28 px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
      )}
      {bgType === 'gradient' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {GRADIENTS.map(g => (
              <button key={g.label} type="button" onClick={() => onBgGradient(g.value)}
                className={`relative h-14 rounded-lg overflow-hidden border-2 transition-all ${bgGradient === g.value ? 'ring-2 ring-teal-500 ring-offset-1 border-teal-500' : 'border-transparent hover:border-gray-300'}`}
                style={{ background: g.value }}
              >
                <span className="absolute bottom-1 left-2 text-white text-xs font-medium drop-shadow">{g.label}</span>
              </button>
            ))}
          </div>
          <div className="space-y-1">
            <label className="font-sans text-xs text-gray-400 uppercase tracking-widest">Dégradé personnalisé (CSS)</label>
            <input type="text" value={bgGradient ?? ''} onChange={e => onBgGradient(e.target.value || null)} placeholder="linear-gradient(135deg, #000, #333)" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
        </div>
      )}
      {bgType === 'image' && (
        <div className="space-y-4">
          {mediaFiles.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Ajoutez des images dans la médiathèque d'abord.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {mediaFiles.map(file => (
                <button key={file.id} type="button" onClick={() => onBgImageUrl(file.url)}
                  className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${bgImageUrl === file.url ? 'ring-2 ring-teal-500 ring-offset-1 border-teal-500' : 'border-transparent hover:border-gray-300'}`}
                >
                  <Image src={file.url} alt={file.name} fill sizes="(max-width:640px) 50vw, 33vw" className="object-cover" />
                </button>
              ))}
            </div>
          )}
          <div className="space-y-1">
            <label className="font-sans text-xs text-gray-400 uppercase tracking-widest flex justify-between">
              <span>Overlay (obscurcissement)</span><span>{Math.round(overlayOpacity * 100)}%</span>
            </label>
            <input type="range" min={0} max={85} step={1} value={Math.round(overlayOpacity * 100)} onChange={e => onOverlayOpacity(Number(e.target.value) / 100)} className="w-full accent-teal-600" />
          </div>
          <div className="space-y-1">
            <label className="font-sans text-xs text-gray-400 uppercase tracking-widest flex justify-between">
              <span>Flou</span><span>{bgBlur}px</span>
            </label>
            <input type="range" min={0} max={20} step={1} value={bgBlur} onChange={e => onBgBlur(Number(e.target.value))} className="w-full accent-teal-600" />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Texte (réutilisable chants / annonces) ────────────────────────────────────
type TextPickerProps = {
  fontFamily: string; textColor: string; textShadow: boolean
  textTransform: TextTransform; fontSizeScale: number; textMaxWidth: number
  mediaFiles: MediaFile[]
  onFontFamily:    (v: string) => void
  onTextColor:     (v: string) => void
  onTextShadow:    (v: boolean) => void
  onTextTransform: (v: TextTransform) => void
  onFontSizeScale: (v: number) => void
  onTextMaxWidth:  (v: number) => void
}

function TextSettingsPicker({
  fontFamily, textColor, textShadow, textTransform, fontSizeScale, textMaxWidth,
  onFontFamily, onTextColor, onTextShadow, onTextTransform, onFontSizeScale, onTextMaxWidth,
}: TextPickerProps) {
  return (
    <div className="space-y-5">

      {/* Taille */}
      <div className="space-y-2">
        <label className="font-sans text-xs text-gray-400 uppercase tracking-widest">Taille de police</label>
        <SizePicker value={fontSizeScale} onChange={onFontSizeScale} />
      </div>

      {/* Casse */}
      <div className="space-y-2">
        <label className="font-sans text-xs text-gray-400 uppercase tracking-widest">Casse</label>
        <CassePicker value={textTransform} fontFamily={fontFamily} onChange={onTextTransform} />
      </div>

      {/* Police */}
      <div className="space-y-2">
        <label className="font-sans text-xs text-gray-400 uppercase tracking-widest">Police</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {FONTS.map(font => (
            <button key={font} type="button" onClick={() => onFontFamily(font)}
              className={`px-3 py-2.5 rounded-lg border text-sm transition-colors text-left ${fontFamily === font ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-700 border-gray-200 hover:border-teal-300'}`}
              style={{ fontFamily: `'${font}', sans-serif` }}
            >
              {font}
            </button>
          ))}
        </div>
      </div>

      {/* Couleur */}
      <div className="space-y-2">
        <label className="font-sans text-xs text-gray-400 uppercase tracking-widest">Couleur du texte</label>
        <div className="flex items-center gap-3">
          <input type="color" value={textColor} onChange={e => onTextColor(e.target.value)} className="h-10 w-14 rounded cursor-pointer border border-gray-200" />
          <input type="text" value={textColor} onChange={e => onTextColor(e.target.value)} maxLength={7} className="w-28 px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
      </div>

      {/* Ombre */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-sans text-xs text-gray-400 uppercase tracking-widest">Ombre portée</span>
          <p className="font-sans text-[11px] text-gray-300 mt-0.5">Améliore la lisibilité sur fond clair ou image</p>
        </div>
        <Toggle value={textShadow} onChange={onTextShadow} />
      </div>

      {/* Largeur max */}
      <div className="space-y-1">
        <label className="font-sans text-xs text-gray-400 uppercase tracking-widest flex justify-between">
          <span>Largeur du texte</span>
          <span>{textMaxWidth}% de la diapo</span>
        </label>
        <input type="range" min={70} max={100} step={2} value={textMaxWidth} onChange={e => onTextMaxWidth(Number(e.target.value))} className="w-full accent-teal-600" />
        <p className="font-sans text-[11px] text-gray-300">Plus large = marges plus petites, texte plus grand possible</p>
      </div>

    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function ProjectionSettingsForm({ initial, mediaFiles }: Props) {
  const [s, setS] = useState<ProjectionSettings>({
    ...initial,
    text_transform:      (initial.text_transform      ?? 'uppercase') as TextTransform,
    ann_text_transform:  (initial.ann_text_transform  ?? 'none')      as TextTransform,
    font_size_scale:     initial.font_size_scale     ?? 1.0,
    text_max_width:      initial.text_max_width      ?? 94,
    ann_bg_type:         initial.ann_bg_type         ?? 'color',
    ann_bg_color:        initial.ann_bg_color        ?? '#1e293b',
    ann_bg_gradient:     initial.ann_bg_gradient     ?? null,
    ann_bg_image_url:    initial.ann_bg_image_url    ?? null,
    ann_bg_blur:         initial.ann_bg_blur         ?? 0,
    ann_bg_overlay_opacity:    initial.ann_bg_overlay_opacity    ?? 0,
    ann_font_family:           initial.ann_font_family           ?? 'Inter',
    ann_text_color:            initial.ann_text_color            ?? '#ffffff',
    ann_text_shadow:           initial.ann_text_shadow           ?? false,
    ann_title_font_size_scale: initial.ann_title_font_size_scale ?? 1.1,
    ann_font_size_scale:       initial.ann_font_size_scale       ?? 0.7,
    ann_text_max_width:        initial.ann_text_max_width        ?? 94,
  })
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved]     = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Charger toutes les Google Fonts pour les aperçus
  useEffect(() => {
    FONTS.forEach(font => {
      if (font === 'Inter') return
      const id = `gfont-${font.replace(/\s+/g, '-').toLowerCase()}`
      if (document.getElementById(id)) return
      const link = document.createElement('link')
      link.id = id; link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:ital,wght@0,400;0,600;0,700;1,400&display=swap`
      document.head.appendChild(link)
    })
  }, [])

  function update<K extends keyof ProjectionSettings>(key: K, value: ProjectionSettings[K]) {
    setS(prev => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    setSaveError(null)
    startTransition(async () => {
      const result = await saveProjectionSettings(s)
      if (result.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
      else setSaveError(result.error ?? 'Erreur inconnue')
    })
  }

  // Styles d'aperçu
  const songBgStyle: React.CSSProperties =
    s.bg_type === 'gradient' ? { background: s.bg_gradient ?? '#000' } :
    s.bg_type === 'image'    ? { background: '#000', position: 'relative', overflow: 'hidden' } :
    { background: s.bg_color }

  const annBgStyle: React.CSSProperties =
    s.ann_bg_type === 'gradient' ? { background: s.ann_bg_gradient ?? '#1e293b' } :
    s.ann_bg_type === 'image'    ? { background: '#1e293b', position: 'relative', overflow: 'hidden' } :
    { background: s.ann_bg_color }

  const songTextStyle: React.CSSProperties = {
    color: s.text_color,
    fontFamily: `'${s.font_family}', sans-serif`,
    textShadow: s.text_shadow ? '0 2px 12px rgba(0,0,0,0.9)' : undefined,
    textTransform: s.text_transform === 'small-caps' || s.text_transform === 'none' ? 'none' : s.text_transform,
    fontVariant: s.text_transform === 'small-caps' ? 'small-caps' : undefined,
  }

  const annTextStyle: React.CSSProperties = {
    color: s.ann_text_color,
    fontFamily: `'${s.ann_font_family}', sans-serif`,
    textShadow: s.ann_text_shadow ? '0 2px 12px rgba(0,0,0,0.9)' : undefined,
    textTransform: s.ann_text_transform === 'small-caps' || s.ann_text_transform === 'none' ? 'none' : s.ann_text_transform,
    fontVariant: s.ann_text_transform === 'small-caps' ? 'small-caps' : undefined,
  }

  const HR = <div className="border-t border-gray-100" />

  return (
    <div className="space-y-6">

      {/* ── Aperçu chants ── */}
      <div className="bg-white rounded-2xl border border-teal/20 p-6 space-y-4">
        <p className="font-sans text-xs text-gray-400 uppercase tracking-widest">Aperçu — Chants</p>
        <div className="relative w-full rounded-xl overflow-hidden" style={{ aspectRatio: '16/9', ...songBgStyle }}>
          {s.bg_type === 'image' && s.bg_image_url && (
            <>
              <div className="absolute inset-0 bg-center bg-cover" style={{ backgroundImage: `url(${s.bg_image_url})`, filter: `blur(${s.bg_blur}px)`, transform: 'scale(1.1)' }} />
              <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${s.overlay_opacity})` }} />
            </>
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            style={{ paddingLeft: `${(100 - s.text_max_width) / 2}%`, paddingRight: `${(100 - s.text_max_width) / 2}%` }}>
            <span className="text-2xl font-semibold text-center leading-tight" style={songTextStyle}>Gloire à toi Seigneur</span>
            <span className="text-2xl font-semibold text-center leading-tight" style={songTextStyle}>Tu règnes pour toujours</span>
          </div>
        </div>
      </div>

      {/* ── Fond chants ── */}
      <div className="bg-white rounded-2xl border border-teal/20 p-6 space-y-4">
        <p className="font-sans text-xs text-gray-400 uppercase tracking-widest">Fond — Chants</p>
        <BackgroundPicker
          bgType={s.bg_type} bgColor={s.bg_color} bgGradient={s.bg_gradient}
          bgImageUrl={s.bg_image_url} bgBlur={s.bg_blur} overlayOpacity={s.overlay_opacity}
          mediaFiles={mediaFiles}
          onBgType={v => update('bg_type', v)} onBgColor={v => update('bg_color', v)}
          onBgGradient={v => update('bg_gradient', v)} onBgImageUrl={v => update('bg_image_url', v)}
          onBgBlur={v => update('bg_blur', v)} onOverlayOpacity={v => update('overlay_opacity', v)}
        />
      </div>

      {/* ── Texte chants ── */}
      <div className="bg-white rounded-2xl border border-teal/20 p-6 space-y-5">
        <p className="font-sans text-xs text-gray-400 uppercase tracking-widest">Texte — Chants</p>
        {HR}
        <TextSettingsPicker
          fontFamily={s.font_family} textColor={s.text_color} textShadow={s.text_shadow}
          textTransform={s.text_transform} fontSizeScale={s.font_size_scale} textMaxWidth={s.text_max_width}
          mediaFiles={mediaFiles}
          onFontFamily={v => update('font_family', v)} onTextColor={v => update('text_color', v)}
          onTextShadow={v => update('text_shadow', v)} onTextTransform={v => update('text_transform', v)}
          onFontSizeScale={v => update('font_size_scale', v)} onTextMaxWidth={v => update('text_max_width', v)}
        />
      </div>

      {/* ── Aperçu annonces ── */}
      <div className="bg-white rounded-2xl border border-teal/20 p-6 space-y-4">
        <p className="font-sans text-xs text-gray-400 uppercase tracking-widest">Aperçu — Annonces</p>
        <div className="relative w-full rounded-xl overflow-hidden" style={{ aspectRatio: '16/9', ...annBgStyle }}>
          {s.ann_bg_type === 'image' && s.ann_bg_image_url && (
            <>
              <div className="absolute inset-0 bg-center bg-cover" style={{ backgroundImage: `url(${s.ann_bg_image_url})`, filter: `blur(${s.ann_bg_blur}px)`, transform: 'scale(1.1)' }} />
              <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${s.ann_bg_overlay_opacity})` }} />
            </>
          )}
          <div className="absolute inset-0 flex flex-col justify-center"
            style={{ paddingLeft: `${(100 - s.ann_text_max_width) / 2}%`, paddingRight: `${(100 - s.ann_text_max_width) / 2}%` }}>
            <p className="text-xs uppercase tracking-[0.3em] opacity-50 mb-2" style={annTextStyle}>Programme</p>
            <p className="text-2xl font-semibold leading-tight" style={annTextStyle}>Assemblée générale</p>
            <p className="text-2xl font-semibold leading-tight" style={annTextStyle}>Dimanche 7 juin</p>
          </div>
        </div>
      </div>

      {/* ── Fond annonces ── */}
      <div className="bg-white rounded-2xl border border-teal/20 p-6 space-y-4">
        <div>
          <p className="font-sans text-xs text-gray-400 uppercase tracking-widest">Fond — Annonces</p>
          <p className="font-sans text-xs text-gray-300 mt-0.5">Fond indépendant affiché pendant les diapos d'annonces</p>
        </div>
        <BackgroundPicker
          bgType={s.ann_bg_type} bgColor={s.ann_bg_color} bgGradient={s.ann_bg_gradient}
          bgImageUrl={s.ann_bg_image_url} bgBlur={s.ann_bg_blur} overlayOpacity={s.ann_bg_overlay_opacity}
          mediaFiles={mediaFiles}
          onBgType={v => update('ann_bg_type', v)} onBgColor={v => update('ann_bg_color', v)}
          onBgGradient={v => update('ann_bg_gradient', v)} onBgImageUrl={v => update('ann_bg_image_url', v)}
          onBgBlur={v => update('ann_bg_blur', v)} onOverlayOpacity={v => update('ann_bg_overlay_opacity', v)}
        />
      </div>

      {/* ── Texte annonces ── */}
      <div className="bg-white rounded-2xl border border-teal/20 p-6 space-y-5">
        <p className="font-sans text-xs text-gray-400 uppercase tracking-widest">Texte — Annonces</p>
        {HR}
        {/* Taille titre */}
        <div className="space-y-2">
          <label className="font-sans text-xs text-gray-400 uppercase tracking-widest">Taille du titre</label>
          <SizePicker value={s.ann_title_font_size_scale} onChange={v => update('ann_title_font_size_scale', v)} />
        </div>
        {/* Taille corps */}
        <div className="space-y-2">
          <label className="font-sans text-xs text-gray-400 uppercase tracking-widest">Taille du corps</label>
          <SizePicker value={s.ann_font_size_scale} onChange={v => update('ann_font_size_scale', v)} />
        </div>
        {HR}
        <TextSettingsPicker
          fontFamily={s.ann_font_family} textColor={s.ann_text_color} textShadow={s.ann_text_shadow}
          textTransform={s.ann_text_transform} fontSizeScale={s.ann_font_size_scale} textMaxWidth={s.ann_text_max_width}
          mediaFiles={mediaFiles}
          onFontFamily={v => update('ann_font_family', v)} onTextColor={v => update('ann_text_color', v)}
          onTextShadow={v => update('ann_text_shadow', v)} onTextTransform={v => update('ann_text_transform', v)}
          onFontSizeScale={v => update('ann_font_size_scale', v)} onTextMaxWidth={v => update('ann_text_max_width', v)}
        />
      </div>

      {/* ── Sauvegarder ── */}
      <div className="flex items-center justify-end gap-3">
        {saveError && <span className="text-sm text-red-500 font-medium">✗ {saveError}</span>}
        {saved    && <span className="text-sm text-teal-600 font-medium">✓ Sauvegardé</span>}
        <button type="button" onClick={handleSave} disabled={isPending}
          className="px-6 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Sauvegarde…' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  )
}
