import { describe, it, expect, vi, beforeEach } from 'vitest'

// `redirect()` de Next.js interrompt l'exécution en lançant une exception spéciale — on
// reproduit ce comportement pour que le test puisse la capturer tout en vérifiant l'écriture
// faite juste avant.
const { redirectMock, createClientMock, getChurchContextMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
  createClientMock: vi.fn(),
  getChurchContextMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))
vi.mock('@/lib/auth/church', () => ({ getChurchContext: getChurchContextMock }))

const { saveProfile } = await import('./actions')

type Payload = Record<string, unknown>
type Write = { table: string; op: 'update' | 'upsert'; payload: Payload }

/**
 * Client Supabase minimal : auth.getUser(), updateUser() et les écritures
 * `.update(...).eq(...)` / `.upsert(...)`, en mémorisant ce qui est envoyé.
 */
function fakeClient(opts: {
  user?: { id: string; email: string } | null
  failTable?: string
  updateUserError?: { message: string } | null
  memberId?: string | null
} = {}) {
  const { user = { id: 'user-1', email: 'alice@example.fr' }, failTable, updateUserError = null, memberId = 'member-1' } = opts
  const writes: Write[] = []
  const updateUser = vi.fn(() => Promise.resolve({ error: updateUserError }))
  const result = (table: string) => Promise.resolve({ error: table === failTable ? { message: 'boom' } : null })

  const client = {
    auth: { getUser: () => Promise.resolve({ data: { user } }), updateUser },
    from: (table: string) => ({
      update: (payload: Payload) => {
        writes.push({ table, op: 'update', payload })
        const chain: { eq: () => typeof chain } & PromiseLike<{ error: unknown }> = {
          eq: () => chain,
          then: (res, rej) => result(table).then(res, rej),
        }
        return chain
      },
      upsert: (payload: Payload) => {
        writes.push({ table, op: 'upsert', payload })
        return result(table)
      },
    }),
  }
  getChurchContextMock.mockResolvedValue(memberId ? { memberId, church: { churchId: 'church-1' } } : { memberId: null, church: { churchId: 'church-1' } })
  return { writes, updateUser, client }
}

function fd(entries: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.set(k, v)
  return f
}

function profileForm(overrides: Record<string, string> = {}) {
  return fd({
    first_name: 'Alice',
    last_name: 'Martin',
    email: 'alice@example.fr',
    phone: '0612345678',
    birthdate: '1990-05-17',
    city: 'Nantes',
    desired_frequency: 'twice_month',
    ...overrides,
  })
}

async function run(client: unknown, form: FormData): Promise<string> {
  createClientMock.mockResolvedValue(client)
  await expect(saveProfile(form)).rejects.toThrow('NEXT_REDIRECT')
  return redirectMock.mock.calls.at(-1)![0]
}

const memberWrite = (w: Write[]) => w.find(x => x.table === 'members')!
const contactWrite = (w: Write[]) => w.find(x => x.table === 'member_contacts')!

beforeEach(() => {
  vi.clearAllMocks()
})

describe('saveProfile — rythme souhaité (desired_frequency)', () => {
  it.each(['as_needed', 'twice_month', 'every_6_weeks', 'monthly', 'weekly'])(
    'enregistre la valeur « %s » sur la fiche de la personne',
    async (frequency) => {
      const fake = fakeClient()
      await run(fake.client, profileForm({ desired_frequency: frequency }))
      expect(memberWrite(fake.writes).payload).toMatchObject({ desired_frequency: frequency })
    }
  )

  // Une requête forgée peut envoyer n'importe quoi : rejeté avant la base.
  it.each([
    ['hors liste', 'chaque_heure'],
    ['vide', ''],
    ['espaces', '   '],
    ['clé héritée du prototype', 'constructor'],
  ])('enregistre `null` pour une valeur %s', async (_label, value) => {
    const fake = fakeClient()
    await run(fake.client, profileForm({ desired_frequency: value }))
    expect(memberWrite(fake.writes).payload.desired_frequency).toBeNull()
  })

  it('enregistre `null` quand le champ est absent', async () => {
    const form = profileForm()
    form.delete('desired_frequency')
    const fake = fakeClient()
    await run(fake.client, form)
    expect(memberWrite(fake.writes).payload.desired_frequency).toBeNull()
  })
})

describe('saveProfile — écritures', () => {
  it('met à jour le compte, sa propre fiche et ses coordonnées dans l’église courante', async () => {
    const fake = fakeClient()
    await run(fake.client, profileForm())

    expect(fake.writes.find(w => w.table === 'profiles')!.payload).toEqual({ first_name: 'Alice', last_name: 'Martin' })
    expect(memberWrite(fake.writes).payload).toEqual({ first_name: 'Alice', last_name: 'Martin', desired_frequency: 'twice_month' })
    expect(contactWrite(fake.writes).payload).toMatchObject({
      member_id: 'member-1',
      church_id: 'church-1',
      email: 'alice@example.fr',
      phone: '0612345678',
      city: 'Nantes',
      birthdate: '1990-05-17',
    })
  })

  it('nettoie les espaces autour des champs texte', async () => {
    const fake = fakeClient()
    await run(fake.client, profileForm({ first_name: '  Alice  ', last_name: ' Martin ', city: ' Nantes ' }))
    expect(memberWrite(fake.writes).payload).toMatchObject({ first_name: 'Alice', last_name: 'Martin' })
    expect(contactWrite(fake.writes).payload).toMatchObject({ city: 'Nantes' })
  })

  it('enregistre `null` pour les champs optionnels vides, dont la date de naissance', async () => {
    const fake = fakeClient()
    await run(fake.client, profileForm({ phone: '', birthdate: '', city: '' }))
    expect(contactWrite(fake.writes).payload).toMatchObject({ phone: null, birthdate: null, city: null })
  })

  it('ignore une date de naissance mal formée', async () => {
    const fake = fakeClient()
    await run(fake.client, profileForm({ birthdate: 'pas-une-date' }))
    expect(contactWrite(fake.writes).payload.birthdate).toBeNull()
  })

  it('n’écrit pas de fiche quand le compte n’a pas de personne dans cette église', async () => {
    const fake = fakeClient({ memberId: null })
    await run(fake.client, profileForm())
    expect(fake.writes.map(w => w.table)).toEqual(['profiles'])
  })

  it("ne touche pas à l'email d'authentification quand il est inchangé", async () => {
    const fake = fakeClient()
    await run(fake.client, profileForm())
    expect(fake.updateUser).not.toHaveBeenCalled()
  })

  it('demande le changement d’email et enregistre la nouvelle adresse de contact', async () => {
    const fake = fakeClient()
    await run(fake.client, profileForm({ email: 'nouvelle@example.fr' }))
    expect(fake.updateUser).toHaveBeenCalledWith({ email: 'nouvelle@example.fr' })
    expect(contactWrite(fake.writes).payload).toMatchObject({ email: 'nouvelle@example.fr' })
  })
})

describe('saveProfile — redirections', () => {
  it('renvoie vers le tableau de bord après un enregistrement', async () => {
    expect(await run(fakeClient().client, profileForm())).toBe('/espace/dashboard')
  })

  it('renvoie vers le profil avec `email_sent=1` quand un email de confirmation est parti', async () => {
    expect(await run(fakeClient().client, profileForm({ email: 'nouvelle@example.fr' }))).toBe('/espace/profil?email_sent=1')
  })

  it('renvoie `error=email_taken` si la nouvelle adresse est déjà utilisée — sans rien écrire', async () => {
    const fake = fakeClient({ updateUserError: { message: 'Email address already registered' } })
    expect(await run(fake.client, profileForm({ email: 'prise@example.fr' }))).toBe('/espace/profil?error=email_taken')
    expect(fake.writes).toEqual([])
  })

  it.each(['profiles', 'members', 'member_contacts'])('renvoie `error=failed` si l’écriture de « %s » échoue', async (table) => {
    const fake = fakeClient({ failTable: table })
    expect(await run(fake.client, profileForm())).toBe('/espace/profil?error=failed')
  })

  it("renvoie vers la page de connexion si personne n'est authentifié — sans rien écrire", async () => {
    const fake = fakeClient({ user: null })
    expect(await run(fake.client, profileForm())).toBe('/espace/login')
    expect(fake.writes).toEqual([])
  })
})
