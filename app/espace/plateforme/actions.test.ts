import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, requirePlatformAdmin, revalidatePath } = vi.hoisted(() => ({ rpc: vi.fn(), requirePlatformAdmin: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/platform', () => ({ requirePlatformAdmin }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`) } }))

const { extendTrial, approveSolidarity, revokeSolidarity } = await import('./actions')

const ID = '0b9f5c1e-6d1a-4d0b-9a77-2a3d6a1f0c11'
const form = (values: Record<string, string>) => Object.entries(values).reduce((f, [k, v]) => (f.set(k, v), f), new FormData())
const redirectedTo = async (action: Promise<unknown>) => {
  try { await action } catch (e) { return (e as Error).message.replace('REDIRECT:', '') }
  return null
}

beforeEach(() => {
  vi.clearAllMocks()
  requirePlatformAdmin.mockResolvedValue({ supabase: { rpc }, userId: 'u1' })
  rpc.mockResolvedValue({ data: { ok: true }, error: null })
})

describe('accès', () => {
  it('une action est refusée avant tout appel si le compte n\'est pas de l\'équipe en deux étapes', async () => {
    requirePlatformAdmin.mockRejectedValue(new Error('NOT_FOUND'))
    for (const action of [extendTrial, approveSolidarity, revokeSolidarity]) {
      await expect(action(form({ churchId: ID, days: '7' }))).rejects.toThrow('NOT_FOUND')
    }
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('prolonger un essai', () => {
  it('appelle la base avec l\'église et le nombre de jours', async () => {
    expect(await redirectedTo(extendTrial(form({ churchId: ID, days: '14' })))).toBe('/espace/plateforme?resultat=essai-prolonge')
    expect(rpc).toHaveBeenCalledWith('platform_extend_trial', { p_church: ID, p_days: 14 })
  })

  it.each([['0'], ['91'], ['-3'], ['2.5'], ['abc'], ['']])('refuse %j sans appeler la base', async (days) => {
    expect(await redirectedTo(extendTrial(form({ churchId: ID, days })))).toBe('/espace/plateforme?resultat=invalide')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('refuse un identifiant qui n\'en est pas un', async () => {
    expect(await redirectedTo(extendTrial(form({ churchId: "x'; drop table churches;--", days: '7' })))).toBe('/espace/plateforme?resultat=invalide')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('traduit les refus de la base sans en exposer le détail', async () => {
    rpc.mockResolvedValue({ data: { ok: false, error: 'not_extendable' }, error: null })
    expect(await redirectedTo(extendTrial(form({ churchId: ID, days: '7' })))).toBe('/espace/plateforme?resultat=non-prolongeable')
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'détail interne' } })
    expect(await redirectedTo(extendTrial(form({ churchId: ID, days: '7' })))).toBe('/espace/plateforme?resultat=refuse')
    rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'détail interne' } })
    expect(await redirectedTo(extendTrial(form({ churchId: ID, days: '7' })))).toBe('/espace/plateforme?resultat=erreur')
  })
})

describe('tarif solidaire', () => {
  it('valide et retire par les fonctions du back-office', async () => {
    expect(await redirectedTo(approveSolidarity(form({ churchId: ID })))).toBe('/espace/plateforme?resultat=solidaire-valide')
    expect(rpc).toHaveBeenLastCalledWith('platform_approve_solidarity', { p_church: ID })
    expect(await redirectedTo(revokeSolidarity(form({ churchId: ID })))).toBe('/espace/plateforme?resultat=solidaire-retire')
    expect(rpc).toHaveBeenLastCalledWith('platform_revoke_solidarity', { p_church: ID })
  })

  it('refuse un identifiant invalide sans appeler la base', async () => {
    expect(await redirectedTo(approveSolidarity(form({ churchId: 'nope' })))).toBe('/espace/plateforme?resultat=invalide')
    expect(await redirectedTo(revokeSolidarity(form({})))).toBe('/espace/plateforme?resultat=invalide')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('une demande refusée par la base est expliquée', async () => {
    rpc.mockResolvedValue({ data: { ok: false, error: 'too_many_members' }, error: null })
    expect(await redirectedTo(approveSolidarity(form({ churchId: ID })))).toBe('/espace/plateforme?resultat=trop-grande')
  })
})
