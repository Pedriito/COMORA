import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/env', () => ({ supabaseUrl: () => 'http://x', supabasePublishableKey: () => 'k' }))
const { isPublicEspacePath } = await import('../../proxy')

describe('pages de l\'espace sans connexion', () => {
  it('la page de désinscription est publique (le lien arrive par e-mail, sans session)', () => {
    expect(isPublicEspacePath('/espace/desinscription/abc')).toBe(true)
  })
  it('les pages de gestion restent protégées', () => {
    expect(isPublicEspacePath('/espace/admin')).toBe(false)
    expect(isPublicEspacePath('/espace/abonnement')).toBe(false)
  })
})
