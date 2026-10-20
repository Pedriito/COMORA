import type { CSSProperties } from 'react'

/**
 * Identité visuelle propre à une église (offre Signature), stockée dans
 * `churches.branding`. Tout champ absent ou invalide retombe sur le thème Comora.
 */
export type ChurchBranding = {
  /** Couleur principale, en hexadécimal (#rrggbb). Remplace le bleu-vert Comora. */
  primary?: string | null
  /** Couleur d'accent, en hexadécimal (#rrggbb). Remplace le corail Comora. */
  accent?: string | null
  /** Logo de l'église (URL https). */
  logo_url?: string | null
}

const HEX = /^#[0-9a-f]{6}$/i

function validColor(value: unknown): string | null {
  return typeof value === 'string' && HEX.test(value.trim()) ? value.trim().toLowerCase() : null
}

/** Logo de l'église s'il est défini et servi en https, sinon null (logo Comora). */
export function churchLogoUrl(branding: ChurchBranding | null | undefined): string | null {
  const url = branding?.logo_url
  return typeof url === 'string' && url.startsWith('https://') ? url : null
}

/**
 * Variables CSS qui remplacent les jetons Comora par les couleurs de l'église.
 * Les nuances sont dérivées avec color-mix pour rester cohérentes entre elles.
 * Renvoie undefined quand il n'y a rien à remplacer (thème Comora).
 */
export function churchThemeStyle(branding: ChurchBranding | null | undefined): CSSProperties | undefined {
  const primary = validColor(branding?.primary)
  const accent = validColor(branding?.accent)
  if (!primary && !accent) return undefined

  const vars: Record<string, string> = {}
  if (primary) {
    vars['--color-teal'] = primary
    vars['--color-teal-dark'] = `color-mix(in srgb, ${primary} 78%, black)`
    vars['--color-teal-light'] = `color-mix(in srgb, ${primary} 12%, white)`
    vars['--color-teal-50'] = `color-mix(in srgb, ${primary} 7%, white)`
    vars['--color-teal-pale'] = `color-mix(in srgb, ${primary} 55%, white)`
  }
  if (accent) {
    vars['--color-coral'] = accent
    vars['--color-coral-light'] = `color-mix(in srgb, ${accent} 65%, white)`
    vars['--color-coral-50'] = `color-mix(in srgb, ${accent} 12%, white)`
    vars['--color-coral-deep'] = `color-mix(in srgb, ${accent} 72%, black)`
  }
  return vars as CSSProperties
}
