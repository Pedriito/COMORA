import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ok, makeFakeSupabase } from '@/tests/helpers/fakeSupabase'

const { redirectMock, revalidatePathMock, revalidateTagMock, createAdminClientMock, requireChurchMock, churchOrNullMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
  revalidatePathMock: vi.fn(),
  revalidateTagMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  requireChurchMock: vi.fn(),
  churchOrNullMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock, revalidateTag: revalidateTagMock }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }))
vi.mock('@/lib/auth/church', () => ({ requireChurch: requireChurchMock, churchOrNull: churchOrNullMock }))

const { addTeamMember, removeTeamMember, toggleMemberPosition, updateMemberRole } = await import('./actions')

type Queues = Parameters<typeof makeFakeSupabase>[0]

/** Contexte d'église : `role` d'église, `memberId` du compte, et réponses de la session (RLS). */
function useContext(role: 'admin' | 'responsable' | 'membre', queues: Queues) {
  const ctx = {
    supabase: makeFakeSupabase(queues),
    userId: 'user-1',
    memberId: 'me-1',
    church: { churchId: 'church-1', role, isPastoral: false },
  }
  requireChurchMock.mockResolvedValue(ctx)
  churchOrNullMock.mockResolvedValue(ctx)
  return ctx
}

function fd(entries: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.set(k, v)
  return f
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('addTeamMember', () => {
  it('un coordinateur ajoute un membre avec la session (RLS) et invalide `team-members`', async () => {
    useContext('responsable', { teams: [ok({ id: 'team-1' })], members: [ok({ id: 'm-1' })], team_members: [ok(null)] })

    const result = await addTeamMember(null, fd({ team_id: 'team-1', member_id: 'm-1', role: 'member' }))

    expect(result).toBeNull()
    expect(createAdminClientMock).not.toHaveBeenCalled()
    expect(revalidateTagMock).toHaveBeenCalledWith('team-members', 'max')
    expect(revalidatePathMock).toHaveBeenCalledWith('/espace/admin/equipes/team-1')
  })

  it('un responsable de cette équipe peut ajouter (clé secrète, après vérification)', async () => {
    useContext('membre', { teams: [ok({ id: 'team-1' })], team_members: [ok({ role: 'leader' })], members: [ok({ id: 'm-1' })] })
    createAdminClientMock.mockReturnValue(makeFakeSupabase({ team_members: [ok(null)] }))

    const result = await addTeamMember(null, fd({ team_id: 'team-1', member_id: 'm-1', role: 'member' }))

    expect(result).toBeNull()
    expect(createAdminClientMock).toHaveBeenCalledTimes(1)
  })

  it('refuse un simple membre de l’équipe', async () => {
    useContext('membre', { teams: [ok({ id: 'team-1' })], team_members: [ok({ role: 'member' })] })

    const result = await addTeamMember(null, fd({ team_id: 'team-1', member_id: 'm-1', role: 'member' }))

    expect(result).toEqual({ error: 'Accès refusé.' })
    expect(createAdminClientMock).not.toHaveBeenCalled()
    expect(revalidateTagMock).not.toHaveBeenCalled()
  })

  it('refuse une équipe d’une autre église (introuvable avec le filtre d’église)', async () => {
    useContext('admin', { teams: [ok(null)] })

    const result = await addTeamMember(null, fd({ team_id: 'team-autre', member_id: 'm-1', role: 'member' }))

    expect(result).toEqual({ error: 'Accès refusé.' })
  })

  it('refuse une personne introuvable dans l’église courante', async () => {
    useContext('admin', { teams: [ok({ id: 'team-1' })], members: [ok(null)] })

    const result = await addTeamMember(null, fd({ team_id: 'team-1', member_id: 'm-autre', role: 'member' }))

    expect(result).toEqual({ error: 'Personne introuvable.' })
  })

  it("n'invalide rien si l'écriture échoue, sans détail technique", async () => {
    useContext('admin', {
      teams: [ok({ id: 'team-1' })],
      members: [ok({ id: 'm-1' })],
      team_members: [{ data: null, error: { message: 'duplicate key value violates…' } }],
    })

    const result = await addTeamMember(null, fd({ team_id: 'team-1', member_id: 'm-1', role: 'member' }))

    expect(result?.error).not.toContain('duplicate')
    expect(revalidateTagMock).not.toHaveBeenCalled()
  })
})

describe('removeTeamMember', () => {
  it("invalide `team-members` ET `member-positions` quand l'équipe a des postes nommés", async () => {
    useContext('admin', {
      teams: [ok({ id: 'team-1' })],
      team_members: [ok(null)],
      positions: [ok([{ id: 'pos-1' }, { id: 'pos-2' }])],
      member_positions: [ok(null)],
    })

    await removeTeamMember(fd({ team_id: 'team-1', member_id: 'm-1' }))

    expect(revalidateTagMock).toHaveBeenCalledWith('member-positions', 'max')
    expect(revalidateTagMock).toHaveBeenCalledWith('team-members', 'max')
  })

  it("n'invalide pas `member-positions` quand l'équipe n'a aucun poste nommé", async () => {
    useContext('responsable', { teams: [ok({ id: 'team-1' })], team_members: [ok(null)], positions: [ok([])] })

    await removeTeamMember(fd({ team_id: 'team-1', member_id: 'm-1' }))

    expect(revalidateTagMock).not.toHaveBeenCalledWith('member-positions', 'max')
    expect(revalidateTagMock).toHaveBeenCalledWith('team-members', 'max')
  })

  it('redirige un simple membre vers le tableau de bord', async () => {
    useContext('membre', { teams: [ok({ id: 'team-1' })], team_members: [ok({ role: 'member' })] })

    await expect(removeTeamMember(fd({ team_id: 'team-1', member_id: 'm-1' }))).rejects.toThrow('NEXT_REDIRECT:/espace/dashboard')
  })
})

describe('updateMemberRole', () => {
  it('ignore un rôle hors de la liste fermée', async () => {
    const ctx = useContext('admin', { team_members: [ok(null)] })
    const spy = vi.spyOn(ctx.supabase, 'from')

    await updateMemberRole(fd({ team_id: 'team-1', member_id: 'm-1', role: 'owner' }))

    expect(spy).not.toHaveBeenCalled()
  })

  it('invalide `team-members` pour un rôle valide', async () => {
    useContext('responsable', { team_members: [ok(null)] })

    await updateMemberRole(fd({ team_id: 'team-1', member_id: 'm-1', role: 'leader' }))

    expect(revalidateTagMock).toHaveBeenCalledWith('team-members', 'max')
  })
})

describe('toggleMemberPosition', () => {
  it.each(['add', 'remove'])("invalide `member-positions` pour l'action %s", async (action) => {
    useContext('admin', {
      teams: [ok({ id: 'team-1' })],
      positions: [ok({ id: 'pos-1' })],
      team_members: [ok({ member_id: 'm-1' })],
      member_positions: [ok(null)],
    })

    await toggleMemberPosition(fd({ team_id: 'team-1', member_id: 'm-1', position_id: 'pos-1', action }))

    expect(revalidateTagMock).toHaveBeenCalledWith('member-positions', 'max')
  })

  it("n'écrit rien si le poste n'appartient pas à l'équipe de l'église", async () => {
    useContext('admin', {
      teams: [ok({ id: 'team-1' })],
      positions: [ok(null)],
      team_members: [ok({ member_id: 'm-1' })],
    })

    await toggleMemberPosition(fd({ team_id: 'team-1', member_id: 'm-1', position_id: 'pos-autre', action: 'add' }))

    expect(revalidateTagMock).not.toHaveBeenCalled()
  })
})
