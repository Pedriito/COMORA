import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ok, makeFakeSupabase } from '@/tests/helpers/fakeSupabase'

// `redirect()` de Next.js interrompt l'exécution en lançant une exception spéciale — on
// reproduit ce comportement pour que le test puisse la capturer.
const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
  revalidateTag: vi.fn(),
  createAdminClient: vi.fn(),
  requireChurch: vi.fn(),
  churchOrNull: vi.fn(),
  sendInviteEmail: vi.fn(),
  createActivation: vi.fn(),
  findOrCreateAccount: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('next/cache', () => ({ revalidateTag: mocks.revalidateTag }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/auth/church', () => ({ requireChurch: mocks.requireChurch, churchOrNull: mocks.churchOrNull }))
vi.mock('@/lib/email/espace', () => ({ sendInviteEmail: mocks.sendInviteEmail }))
vi.mock('../activer/activation', () => ({
  createActivation: mocks.createActivation,
  findOrCreateAccount: mocks.findOrCreateAccount,
  activationUrl: (t: string) => `https://comora.test/espace/activer/${t}`,
  isEmail: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
}))

const { inviteBenevole, updateBenevoleAdmin, deleteBenevole, resendInvite, resendInviteFromList } = await import('./actions')

type Queues = Parameters<typeof makeFakeSupabase>[0]

function useContext(role: 'admin' | 'responsable' | 'membre', queues: Queues) {
  const supabase = makeFakeSupabase(queues)
  const ctx = { supabase, userId: 'admin-1', memberId: 'me-1', church: { churchId: 'church-1', role, isPastoral: false } }
  mocks.requireChurch.mockResolvedValue(ctx)
  mocks.churchOrNull.mockResolvedValue(ctx)
  return supabase
}

function fd(entries: Record<string, string | string[]>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) {
    if (Array.isArray(v)) v.forEach(item => f.append(k, item))
    else f.set(k, v)
  }
  return f
}

async function redirectedTo(promise: Promise<unknown>): Promise<string> {
  await expect(promise).rejects.toThrow('NEXT_REDIRECT')
  return mocks.redirect.mock.calls.at(-1)![0]
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createAdminClient.mockReturnValue({
    auth: { admin: { getUserById: () => Promise.resolve({ data: { user: { email: 'a@b.fr' } } }) } },
    from: () => makeFakeSupabase({ account_activations: [ok(null)] }).from('account_activations'),
  })
  mocks.findOrCreateAccount.mockResolvedValue({ userId: 'new-user-1', created: true })
  mocks.createActivation.mockResolvedValue('jeton-en-clair')
  mocks.sendInviteEmail.mockResolvedValue(undefined)
})

describe('inviteBenevole', () => {
  const freshInvite: Queues = {
    church_memberships: [ok(null), ok(null)], // contrôle d'existence, puis insertion
    member_contacts: [ok(null), ok(null)], // personne déjà connue ?, puis insertion
    members: [ok({ id: 'member-1' })],
  }

  it('exige le rôle administrateur', async () => {
    useContext('admin', freshInvite)
    await redirectedTo(inviteBenevole(fd({ first_name: 'A', last_name: 'B', email: 'a@b.fr' })))
    expect(mocks.requireChurch).toHaveBeenCalledWith('admin')
  })

  it("crée la personne et l'appartenance « invité », puis envoie le lien d'activation", async () => {
    useContext('admin', freshInvite)

    const url = await redirectedTo(inviteBenevole(fd({ first_name: 'A', last_name: 'B', email: 'A@B.fr', role: 'responsable' })))

    expect(url).toBe('/espace/admin?success=invited')
    expect(mocks.findOrCreateAccount).toHaveBeenCalledWith(expect.anything(), { email: 'a@b.fr', firstName: 'A', lastName: 'B' })
    expect(mocks.createActivation).toHaveBeenCalledWith(expect.anything(), 'church-1', 'new-user-1')
    expect(mocks.sendInviteEmail).toHaveBeenCalledWith({
      to: 'a@b.fr',
      firstName: 'A',
      inviteLink: 'https://comora.test/espace/activer/jeton-en-clair',
    })
    expect(mocks.revalidateTag).toHaveBeenCalledWith('profiles', 'max')
    expect(mocks.revalidateTag).not.toHaveBeenCalledWith('team-members', 'max')
  })

  it("invalide `team-members` quand des équipes de l'église sont assignées", async () => {
    useContext('admin', { ...freshInvite, teams: [ok([{ id: 'team-1' }])], team_members: [ok(null)] })

    await redirectedTo(inviteBenevole(fd({ first_name: 'A', last_name: 'B', email: 'a@b.fr', team_ids: ['team-1'] })))

    expect(mocks.revalidateTag).toHaveBeenCalledWith('team-members', 'max')
  })

  it('refuse une adresse invalide sans rien créer', async () => {
    useContext('admin', freshInvite)
    const url = await redirectedTo(inviteBenevole(fd({ first_name: 'A', last_name: 'B', email: 'pas-un-mail' })))
    expect(url).toBe('/espace/admin/inviter?error=invalid')
    expect(mocks.findOrCreateAccount).not.toHaveBeenCalled()
  })

  it('refuse une personne qui fait déjà partie de l’église', async () => {
    useContext('admin', { church_memberships: [ok({ id: 'ms-1' })] })
    const url = await redirectedTo(inviteBenevole(fd({ first_name: 'A', last_name: 'B', email: 'a@b.fr' })))
    expect(url).toBe('/espace/admin/inviter?error=already_member')
    expect(mocks.sendInviteEmail).not.toHaveBeenCalled()
  })

  it("signale un e-mail non envoyé sans exposer de détail technique", async () => {
    useContext('admin', freshInvite)
    mocks.sendInviteEmail.mockRejectedValue(new Error('Resend: clé invalide re_xxx'))
    const url = await redirectedTo(inviteBenevole(fd({ first_name: 'A', last_name: 'B', email: 'a@b.fr' })))
    expect(url).toBe('/espace/admin?error=email_failed')
  })
})

describe('renvoi d’invitation', () => {
  const resendQueues: Queues = {
    members: [ok({ id: 'member-1', user_id: 'u-2', first_name: 'Eve', last_name: 'X', status: 'invited' })],
    church_memberships: [ok({ status: 'invited' })],
  }

  it('crée un nouveau lien d’activation (les précédents sont invalidés par createActivation)', async () => {
    useContext('admin', resendQueues)
    const res = await resendInviteFromList(null, fd({ member_id: 'member-1' }))
    expect(res).toEqual({ ok: true })
    expect(mocks.createActivation).toHaveBeenCalledWith(expect.anything(), 'church-1', 'u-2')
    expect(mocks.sendInviteEmail).toHaveBeenCalledTimes(1)
  })

  it('refuse un non-administrateur', async () => {
    mocks.churchOrNull.mockResolvedValue(null)
    const res = await resendInviteFromList(null, fd({ member_id: 'member-1' }))
    expect(res.ok).toBe(false)
    expect(mocks.sendInviteEmail).not.toHaveBeenCalled()
  })

  it('refuse une personne sans compte', async () => {
    useContext('admin', { members: [ok({ id: 'member-1', user_id: null, first_name: 'Eve', last_name: '', status: 'active' })] })
    const res = await resendInviteFromList(null, fd({ member_id: 'member-1' }))
    expect(res.ok).toBe(false)
  })

  it('resendInvite redirige vers la fiche avec `sent=1`', async () => {
    useContext('admin', resendQueues)
    expect(await redirectedTo(resendInvite(fd({ member_id: 'member-1' })))).toBe('/espace/admin/benevoles/member-1?sent=1')
  })
})

describe('updateBenevoleAdmin', () => {
  const person = { id: 'member-1', user_id: 'u-2', first_name: 'Eve', last_name: 'X', status: 'active' }
  const form = { member_id: 'member-1', first_name: 'Eve', last_name: 'X', email: 'e@x.fr', status: 'active' }

  it('un administrateur change le rôle et la case pastorale, et invalide `profiles`', async () => {
    const db = useContext('admin', {
      members: [ok(person), ok(null)],
      member_contacts: [ok(null)],
      church_memberships: [ok(null)],
    })

    const url = await redirectedTo(updateBenevoleAdmin(fd({ ...form, role: 'responsable', is_pastoral: 'on' })))

    expect(url).toBe('/espace/admin/benevoles/member-1?updated=1')
    expect(db.calls).toContain('church_memberships')
    expect(mocks.revalidateTag).toHaveBeenCalledWith('profiles', 'max')
  })

  it('un coordinateur modifie la fiche mais jamais le rôle ni les comptes', async () => {
    const db = useContext('responsable', { members: [ok(person), ok(null)], member_contacts: [ok(null)] })

    await redirectedTo(updateBenevoleAdmin(fd({ ...form, role: 'admin' })))

    expect(db.calls).not.toContain('church_memberships')
  })

  it('exige au moins le rôle coordinateur', async () => {
    useContext('responsable', { members: [ok(person), ok(null)], member_contacts: [ok(null)] })
    await redirectedTo(updateBenevoleAdmin(fd(form)))
    expect(mocks.requireChurch).toHaveBeenCalledWith('responsable')
  })

  it('affiche un message clair quand la base refuse de retirer le dernier administrateur', async () => {
    useContext('admin', {
      members: [ok(person), ok(null)],
      member_contacts: [ok(null)],
      church_memberships: [{ data: null, error: { message: 'Une église doit garder au moins un administrateur', code: '23514' } as never }],
    })

    const url = await redirectedTo(updateBenevoleAdmin(fd({ ...form, role: 'membre' })))

    expect(url).toBe('/espace/admin/benevoles/member-1/modifier?error=last_admin')
  })

  it('ignore un rôle hors de la liste fermée', async () => {
    const db = useContext('admin', { members: [ok(person), ok(null)], member_contacts: [ok(null)] })
    await redirectedTo(updateBenevoleAdmin(fd({ ...form, role: 'super_admin' })))
    expect(db.calls).not.toContain('church_memberships')
  })

  it("redirige si la personne n'est pas de l'église courante", async () => {
    useContext('admin', { members: [ok(null)] })
    expect(await redirectedTo(updateBenevoleAdmin(fd(form)))).toBe('/espace/admin')
  })
})

describe('deleteBenevole', () => {
  const person = { id: 'member-2', user_id: 'u-2', first_name: 'Eve', last_name: '', status: 'active' }

  it('retire l’appartenance et la personne, et invalide les caches liés', async () => {
    useContext('admin', { members: [ok(person), ok(null)], church_memberships: [ok(null)] })

    expect(await redirectedTo(deleteBenevole(fd({ member_id: 'member-2' })))).toBe('/espace/admin')

    expect(mocks.revalidateTag).toHaveBeenCalledWith('profiles', 'max')
    expect(mocks.revalidateTag).toHaveBeenCalledWith('team-members', 'max')
    expect(mocks.revalidateTag).toHaveBeenCalledWith('member-positions', 'max')
  })

  it('refuse de se retirer soi-même', async () => {
    useContext('admin', { members: [ok({ ...person, user_id: 'admin-1' })] })
    expect(await redirectedTo(deleteBenevole(fd({ member_id: 'member-2' })))).toBe('/espace/admin?error=self')
  })

  it('affiche un message clair pour le dernier administrateur', async () => {
    useContext('admin', {
      members: [ok(person)],
      church_memberships: [{ data: null, error: { message: 'x', code: '23514' } as never }],
    })
    expect(await redirectedTo(deleteBenevole(fd({ member_id: 'member-2' })))).toBe('/espace/admin?error=last_admin')
  })
})
