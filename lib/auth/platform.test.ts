import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getUser, rpc, getAal } = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), getAal: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ rpc, auth: { getUser, mfa: { getAuthenticatorAssuranceLevel: getAal } } }),
}))
vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NOT_FOUND') },
  redirect: (url: string) => { throw new Error(`REDIRECT:${url}`) },
}))

const { getPlatformAdmin, requirePlatformAdmin } = await import('./platform')

function session({ user = true, admin = true, level = 'aal2' }: { user?: boolean; admin?: boolean; level?: string } = {}) {
  getUser.mockResolvedValue({ data: { user: user ? { id: 'u1' } : null } })
  rpc.mockResolvedValue({ data: admin })
  getAal.mockResolvedValue({ data: { currentLevel: level } })
}

beforeEach(() => vi.clearAllMocks())

describe('accès au back-office', () => {
  it('sans session : connexion', async () => {
    session({ user: false })
    await expect(requirePlatformAdmin()).rejects.toThrow('REDIRECT:/espace/login')
  })

  it('un compte qui n\'est pas de l\'équipe reçoit une 404, même avec la deuxième étape', async () => {
    session({ admin: false, level: 'aal2' })
    await expect(requirePlatformAdmin()).rejects.toThrow('NOT_FOUND')
    await expect(getPlatformAdmin()).rejects.toThrow('NOT_FOUND')
  })

  it('un compte de l\'équipe sans deuxième étape est envoyé à la vérification', async () => {
    session({ level: 'aal1' })
    await expect(requirePlatformAdmin()).rejects.toThrow('REDIRECT:/espace/plateforme/verification')
    expect((await getPlatformAdmin()).secondFactorDone).toBe(false)
  })

  it('un compte de l\'équipe en deux étapes entre', async () => {
    session()
    const ctx = await requirePlatformAdmin()
    expect(ctx.userId).toBe('u1')
    expect(rpc).toHaveBeenCalledWith('is_platform_admin')
  })

  it('une erreur de la base n\'ouvre jamais l\'accès', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    rpc.mockResolvedValue({ data: null, error: { message: 'panne' } })
    getAal.mockResolvedValue({ data: { currentLevel: 'aal2' } })
    await expect(requirePlatformAdmin()).rejects.toThrow('NOT_FOUND')
  })
})
