export type ProjectionSettings = {
  id: string
  // ── Fond chants ──────────────────────────────────────────────────────────
  bg_type: 'color' | 'gradient' | 'image'
  bg_color: string
  bg_gradient: string | null
  bg_image_url: string | null
  bg_blur: number
  overlay_opacity: number
  // ── Texte chants ─────────────────────────────────────────────────────────
  font_family: string
  text_color: string
  text_shadow: boolean
  text_transform: 'uppercase' | 'capitalize' | 'small-caps' | 'none'
  font_size_scale: number   // multiplicateur 0.6 – 2.0, défaut 1.0
  text_max_width: number    // % de la largeur diapo, défaut 94
  // ── Fond annonces ────────────────────────────────────────────────────────
  ann_bg_type: 'color' | 'gradient' | 'image'
  ann_bg_color: string
  ann_bg_gradient: string | null
  ann_bg_image_url: string | null
  ann_bg_blur: number
  ann_bg_overlay_opacity: number
  // ── Texte annonces ───────────────────────────────────────────────────────
  ann_font_family: string
  ann_text_color: string
  ann_text_shadow: boolean
  ann_text_transform: 'uppercase' | 'capitalize' | 'small-caps' | 'none'
  ann_title_font_size_scale: number  // taille du titre (label)
  ann_font_size_scale: number        // taille du corps
  ann_text_max_width: number
}

export const SETTINGS_ID = '00000000-0000-0000-0000-000000000002'

export const DEFAULT_SETTINGS: ProjectionSettings = {
  id: SETTINGS_ID,
  // fond chants
  bg_type: 'color',
  bg_color: '#000000',
  bg_gradient: null,
  bg_image_url: null,
  bg_blur: 0,
  overlay_opacity: 0,
  // texte chants
  font_family: 'Inter',
  text_color: '#ffffff',
  text_shadow: false,
  text_transform: 'uppercase',
  font_size_scale: 1.0,
  text_max_width: 94,
  // fond annonces
  ann_bg_type: 'color',
  ann_bg_color: '#1e293b',
  ann_bg_gradient: null,
  ann_bg_image_url: null,
  ann_bg_blur: 0,
  ann_bg_overlay_opacity: 0,
  // texte annonces
  ann_font_family: 'Inter',
  ann_text_color: '#ffffff',
  ann_text_shadow: false,
  ann_text_transform: 'none',
  ann_title_font_size_scale: 1.1,
  ann_font_size_scale: 0.7,
  ann_text_max_width: 94,
}

export const PROJECTION_FONTS = [
  'Inter',
  'Montserrat',
  'Oswald',
  'Raleway',
  'Playfair Display',
  'Bebas Neue',
  'Poppins',
  'Lato',
  'Cinzel',
] as const

export const PRESET_GRADIENTS: { name: string; value: string }[] = [
  { name: 'Nuit profonde',  value: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' },
  { name: 'Aube marine',    value: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)' },
  { name: 'Forêt sombre',   value: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)' },
  { name: 'Bordeaux',       value: 'linear-gradient(135deg, #1a0a0a, #3d0000, #200000)' },
  { name: 'Violet profond', value: 'linear-gradient(135deg, #1a0033, #2d0057, #1a0033)' },
]

/** Fusionne les settings DB avec les defaults pour gérer les colonnes nulles */
export function mergeSettings(db: Partial<ProjectionSettings> | null): ProjectionSettings {
  return { ...DEFAULT_SETTINGS, ...(db ?? {}) } as ProjectionSettings
}

// ── Fond ─────────────────────────────────────────────────────────────────────

export function getBgStyle(s: ProjectionSettings): React.CSSProperties {
  if (s.bg_type === 'gradient' && s.bg_gradient) return { background: s.bg_gradient }
  if (s.bg_type === 'image' && s.bg_image_url) {
    return {
      backgroundImage: `url(${s.bg_image_url})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      filter: s.bg_blur > 0 ? `blur(${s.bg_blur}px)` : undefined,
    }
  }
  return { backgroundColor: s.bg_color }
}

export function getAnnBgStyle(s: ProjectionSettings): React.CSSProperties {
  return getBgStyle({
    ...s,
    bg_type: s.ann_bg_type,
    bg_color: s.ann_bg_color,
    bg_gradient: s.ann_bg_gradient,
    bg_image_url: s.ann_bg_image_url,
    bg_blur: s.ann_bg_blur,
    overlay_opacity: s.ann_bg_overlay_opacity,
  })
}

// ── Texte ─────────────────────────────────────────────────────────────────────

function textTransformStyle(tt: ProjectionSettings['text_transform']): React.CSSProperties {
  return {
    textTransform: tt === 'small-caps' || tt === 'none' ? 'none' : tt,
    fontVariant:   tt === 'small-caps' ? 'small-caps' : undefined,
  }
}

export function getTextStyle(s: ProjectionSettings): React.CSSProperties {
  const tt = s.text_transform ?? 'uppercase'
  return {
    color:      s.text_color,
    fontFamily: `'${s.font_family}', sans-serif`,
    textShadow: s.text_shadow
      ? '0 2px 16px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,0.8)'
      : undefined,
    ...textTransformStyle(tt),
  }
}

export function getAnnTextStyle(s: ProjectionSettings): React.CSSProperties {
  const tt = s.ann_text_transform ?? 'none'
  return {
    color:      s.ann_text_color ?? s.text_color,
    fontFamily: `'${s.ann_font_family ?? s.font_family}', sans-serif`,
    textShadow: s.ann_text_shadow
      ? '0 2px 16px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,0.8)'
      : undefined,
    ...textTransformStyle(tt),
  }
}

/** Calcule la taille de police dynamique (clamp) avec le facteur d'échelle */
export function calcFontSize(maxLineLen: number, scale: number): string {
  const s = scale ?? 1.0
  const vwBase = Math.min(90 / Math.max(maxLineLen, 1), 7.5)
  return `clamp(${(2.2 * s).toFixed(2)}rem, ${(vwBase * s).toFixed(2)}vw, ${(7 * s).toFixed(2)}rem)`
}

export function calcAnnFontSize(maxLineLen: number, scale: number): string {
  const s = scale ?? 1.0
  const vwBase = Math.min(80 / Math.max(maxLineLen, 1), 7)
  return `clamp(${(2 * s).toFixed(2)}rem, ${(vwBase * s).toFixed(2)}vw, ${(6 * s).toFixed(2)}rem)`
}

/** Charge dynamiquement une Google Font */
export function loadGoogleFont(fontFamily: string) {
  if (typeof document === 'undefined') return
  if (fontFamily === 'Inter') return
  const id = `gfont-${fontFamily.replace(/\s+/g, '-')}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:ital,wght@0,400;0,600;0,700;1,400&display=swap`
  document.head.appendChild(link)
}
