/** Extrait l'ID YouTube depuis différents formats d'URL */
export function getYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m?.[1] ?? null
}

/** Extrait l'ID Vimeo */
export function getVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/)
  return m?.[1] ?? null
}

/** Retourne l'URL d'embed depuis une URL YouTube ou Vimeo, null si non reconnue */
export function getEmbedUrl(url: string): string | null {
  const ytId = getYoutubeId(url)
  if (ytId) return `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1`
  const vimeoId = getVimeoId(url)
  if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}?autoplay=1`
  return null
}

/** Retourne l'URL de la miniature YouTube */
export function getYoutubeThumbnail(url: string): string | null {
  const ytId = getYoutubeId(url)
  if (!ytId) return null
  return `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`
}

/** Label de la plateforme */
export function getPlatformLabel(url: string): 'YouTube' | 'Vimeo' | null {
  if (getYoutubeId(url)) return 'YouTube'
  if (getVimeoId(url)) return 'Vimeo'
  return null
}
