import type { CSSProperties } from 'react'

export type SlideLayout = 'fullscreen' | 'band'

export type SlideStyle = {
  preset?: string | null
  layout?: SlideLayout | null
  text_color?: string | null
  font_family?: string | null
  band_color?: string | null   // CSS rgba color for the band background
}

export type SlidePreset = {
  id: string
  label: string
  thumbnail: string  // static gradient for UI thumbnails
  bgStyle: CSSProperties
}

export const SLIDE_PRESETS: SlidePreset[] = [
  {
    id: 'dark-galaxy',
    label: 'Galaxie',
    thumbnail: 'linear-gradient(135deg, #0a0a1a 0%, #1a0530 50%, #0d1b3e 100%)',
    bgStyle: {
      background: 'linear-gradient(-45deg, #0a0a1a, #1a0530, #0d1b3e, #150520)',
      backgroundSize: '400% 400%',
      animation: 'sg-galaxy 12s ease infinite',
    },
  },
  {
    id: 'gold',
    label: 'Or & Lumière',
    thumbnail: 'linear-gradient(135deg, #0a0800 0%, #2a1f00 50%, #1a1500 100%)',
    bgStyle: {
      background: 'linear-gradient(-45deg, #0a0800, #2a1f00, #181200, #1a1500)',
      backgroundSize: '400% 400%',
      animation: 'sg-gold 15s ease infinite',
    },
  },
  {
    id: 'aurora',
    label: 'Aurore boréale',
    thumbnail: 'linear-gradient(135deg, #1a0533 0%, #0d3a2e 50%, #1a0040 100%)',
    bgStyle: {
      background: 'linear-gradient(-45deg, #1a0533, #0d3a2e, #1a0040, #0d2a3e, #2a0d33)',
      backgroundSize: '400% 400%',
      animation: 'sg-aurora 18s ease infinite',
    },
  },
  {
    id: 'fire',
    label: 'Feu',
    thumbnail: 'linear-gradient(135deg, #1a0500 0%, #3a1000 50%, #200800 100%)',
    bgStyle: {
      background: 'linear-gradient(-45deg, #1a0500, #3a1000, #200800, #2a0f00)',
      backgroundSize: '400% 400%',
      animation: 'sg-fire 10s ease infinite',
    },
  },
  {
    id: 'ocean',
    label: 'Océan',
    thumbnail: 'linear-gradient(135deg, #000d1a 0%, #001a30 50%, #00142a 100%)',
    bgStyle: {
      background: 'linear-gradient(-45deg, #000d1a, #001a30, #00142a, #001522)',
      backgroundSize: '400% 400%',
      animation: 'sg-ocean 14s ease infinite',
    },
  },
  {
    id: 'dawn',
    label: 'Crépuscule',
    thumbnail: 'linear-gradient(135deg, #1a0520 0%, #2a1000 50%, #1a0a1a 100%)',
    bgStyle: {
      background: 'linear-gradient(-45deg, #1a0520, #2a1000, #1a081a, #200f00)',
      backgroundSize: '400% 400%',
      animation: 'sg-dawn 16s ease infinite',
    },
  },
  {
    id: 'forest',
    label: 'Forêt',
    thumbnail: 'linear-gradient(135deg, #011a05 0%, #001500 50%, #031a08 100%)',
    bgStyle: {
      background: 'linear-gradient(-45deg, #011a05, #001500, #021505, #011a08)',
      backgroundSize: '400% 400%',
      animation: 'sg-forest 13s ease infinite',
    },
  },
  {
    id: 'night',
    label: 'Nuit étoilée',
    thumbnail: 'linear-gradient(135deg, #020206 0%, #050510 50%, #020208 100%)',
    bgStyle: {
      background: 'linear-gradient(-45deg, #020206, #060612, #040410, #02020a)',
      backgroundSize: '400% 400%',
      animation: 'sg-night 20s ease infinite',
    },
  },
]

export const PRESET_KEYFRAMES = `
@keyframes sg-galaxy { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
@keyframes sg-gold   { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
@keyframes sg-aurora { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
@keyframes sg-fire   { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
@keyframes sg-ocean  { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
@keyframes sg-dawn   { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
@keyframes sg-forest { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
@keyframes sg-night  { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
`

export function getPresetById(id: string | null | undefined): SlidePreset | null {
  if (!id) return null
  return SLIDE_PRESETS.find(p => p.id === id) ?? null
}
