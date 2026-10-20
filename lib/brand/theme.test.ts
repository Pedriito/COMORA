import { describe, expect, it } from 'vitest'
import { churchLogoUrl, churchThemeStyle } from './theme'

describe('churchThemeStyle', () => {
  it('garde le thème Comora sans branding', () => {
    expect(churchThemeStyle(null)).toBeUndefined()
    expect(churchThemeStyle(undefined)).toBeUndefined()
    expect(churchThemeStyle({})).toBeUndefined()
  })

  it('ignore les couleurs invalides (repli sur Comora)', () => {
    expect(churchThemeStyle({ primary: 'red', accent: 'url(javascript:alert(1))' })).toBeUndefined()
    expect(churchThemeStyle({ primary: '#12345' })).toBeUndefined()
  })

  it('remplace la couleur principale et ses nuances', () => {
    const style = churchThemeStyle({ primary: '#1E40AF' }) as Record<string, string>
    expect(style['--color-teal']).toBe('#1e40af')
    expect(style['--color-teal-dark']).toContain('#1e40af')
    expect(style['--color-coral']).toBeUndefined()
  })

  it("remplace l'accent seul", () => {
    const style = churchThemeStyle({ accent: '#aa3300' }) as Record<string, string>
    expect(style['--color-coral']).toBe('#aa3300')
    expect(style['--color-teal']).toBeUndefined()
  })
})

describe('churchLogoUrl', () => {
  it("n'accepte que des URL https", () => {
    expect(churchLogoUrl({ logo_url: 'https://cdn.exemple.fr/logo.svg' })).toBe('https://cdn.exemple.fr/logo.svg')
    expect(churchLogoUrl({ logo_url: 'http://exemple.fr/logo.png' })).toBeNull()
    expect(churchLogoUrl({ logo_url: 'javascript:alert(1)' })).toBeNull()
    expect(churchLogoUrl(null)).toBeNull()
  })
})
