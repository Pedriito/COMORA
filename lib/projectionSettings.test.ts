import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS, PROJECTION_SETTINGS_COLUMNS, mergeSettings, projectionChannel } from './projectionSettings'

describe('mergeSettings', () => {
  it('renvoie les réglages par défaut sans ligne en base', () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS)
  })

  it('garde les valeurs valides et ignore les champs inconnus', () => {
    const s = mergeSettings({
      bg_type: 'gradient',
      bg_gradient: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
      font_family: 'Oswald',
      text_color: '#ff00aa',
      font_size_scale: 1.5,
      // @ts-expect-error champ hors liste (ancienne colonne)
      calendar_token: 'secret',
    })
    expect(s.bg_type).toBe('gradient')
    expect(s.bg_gradient).toBe('linear-gradient(135deg, #0f0c29, #302b63, #24243e)')
    expect(s.font_family).toBe('Oswald')
    expect(s.text_color).toBe('#ff00aa')
    expect(s.font_size_scale).toBe(1.5)
    expect(s).not.toHaveProperty('calendar_token')
    expect(s).not.toHaveProperty('id')
  })

  it('remplace les valeurs invalides par les valeurs par défaut', () => {
    const s = mergeSettings({
      bg_type: 'video',
      bg_color: 'red; background: url(x)',
      bg_gradient: 'linear-gradient(url(https://evil.example/x.png))',
      bg_image_url: 'javascript:alert(1)',
      font_family: 'Comic Sans',
      text_transform: 'blink',
      overlay_opacity: 5,
      text_shadow: 'oui',
    })
    expect(s.bg_type).toBe('color')
    expect(s.bg_color).toBe(DEFAULT_SETTINGS.bg_color)
    expect(s.bg_gradient).toBeNull()
    expect(s.bg_image_url).toBeNull()
    expect(s.font_family).toBe('Inter')
    expect(s.text_transform).toBe('uppercase')
    expect(s.overlay_opacity).toBe(1)
    expect(s.text_shadow).toBe(false)
  })

  it('accepte une image https', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/public/church-public/c/mediatheque/1.jpg'
    expect(mergeSettings({ bg_image_url: url }).bg_image_url).toBe(url)
  })
})

describe('colonnes et canal', () => {
  it('liste exactement les champs d’affichage', () => {
    expect(PROJECTION_SETTINGS_COLUMNS.split(', ').sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort())
  })

  it('nomme le canal privé de l’église', () => {
    expect(projectionChannel('abc')).toBe('church:abc:projection')
  })
})
