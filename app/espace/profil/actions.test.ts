import { describe, it, expect, vi, beforeEach } from 'vitest'

// `redirect()` de Next.js interrompt l'exécution en lançant une exception spéciale — on
// reproduit ce comportement pour que le test puisse la capturer tout en vérifiant l'écriture
// faite juste avant.
const { redirectMock, createClientMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
  createClientMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

const { saveProfile } = await import('./actions')

type ProfilePayload = Record<string, unknown>

/**
 * Client Supabase "cookie" minimal : auth.getUser() + `.from('profiles').update(...).eq(...)`,
 * en mémorisant le payload réellement envoyé à `.update()`.
 */
function fakeProfileClient(opts: {
  user?: { id: string; email: string } | null
  updateError?: { message: string } | null
  updateUserError?: { message: string } | null
} = {}) {
  const { user = { id: 'user-1', email: 'alice@example.fr' }, updateError = null, updateUserError = null } = opts
  const updates: { table: string; payload: ProfilePayload }[] = []
  const updateUser = vi.fn(() => Promise.resolve({ error: updateUserError }))

  return {
    updates,
    updateUser,
    client: {
      auth: {
        getUser: () => Promise.resolve({ data: { user } }),
        updateUser,
      },
      from: (table: string) => ({
        update: (payload: ProfilePayload) => {
          updates.push({ table, payload })
          return { eq: () => Promise.resolve({ error: updateError }) }
        },
      }),
    },
  }
}

function fd(entries: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.set(k, v)
  return f
}

/** Profil complet valide, dont on ne fait varier qu'un champ à la fois dans les tests. */
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

/** Exécute l'action en absorbant l'exception de `redirect()`, et renvoie l'URL redirigée. */
async function run(client: unknown, form: FormData): Promise<string> {
  createClientMock.mockResolvedValue(client)
  await expect(saveProfile(form)).rejects.toThrow('NEXT_REDIRECT')
  return redirectMock.mock.calls.at(-1)![0]
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('saveProfile — rythme souhaité (desired_frequency)', () => {
  // Ce champ alimente l'algorithme d'auto-remplissage : s'il n'est pas persisté,
  // le bénévole est traité comme « sans préférence ».
  it.each(['as_needed', 'twice_month', 'every_6_weeks', 'monthly', 'weekly'])(
    'enregistre la valeur « %s » envoyée dans le formulaire',
    async (frequency) => {
      const fake = fakeProfileClient()
      await run(fake.client, profileForm({ desired_frequency: frequency }))

      expect(fake.updates).toHaveLength(1)
      expect(fake.updates[0].table).toBe('profiles')
      expect(fake.updates[0].payload).toMatchObject({ desired_frequency: frequency })
    }
  )

  // Le formulaire n'expose qu'une liste déroulante, mais une requête forgée peut envoyer
  // n'importe quoi. La valeur doit être rejetée AVANT la base : l'écriture du profil a lieu
  // après la demande de changement d'email, donc un rejet par la contrainte CHECK laisserait
  // l'email engagé sans que le profil soit enregistré.
  it('ramène à `null` une valeur hors de la liste autorisée, sans la transmettre à la base', async () => {
    const fake = fakeProfileClient()
    await run(fake.client, profileForm({ desired_frequency: 'chaque_heure' }))

    expect(fake.updates).toHaveLength(1)
    expect(fake.updates[0].payload.desired_frequency).toBeNull()
  })

  // La contrainte CHECK en base n'accepte que les valeurs de la liste ou NULL : une chaîne
  // vide ferait échouer toute la mise à jour du profil.
  it('enregistre `null` (et non une chaîne vide) quand aucun rythme n’est choisi', async () => {
    const fake = fakeProfileClient()
    await run(fake.client, profileForm({ desired_frequency: '' }))

    expect(fake.updates[0].payload.desired_frequency).toBeNull()
  })

  it('enregistre `null` quand le champ est absent du formulaire', async () => {
    const form = profileForm()
    form.delete('desired_frequency')

    const fake = fakeProfileClient()
    await run(fake.client, form)

    expect(fake.updates[0].payload.desired_frequency).toBeNull()
  })

  it('enregistre `null` quand le champ ne contient que des espaces', async () => {
    const fake = fakeProfileClient()
    await run(fake.client, profileForm({ desired_frequency: '   ' }))

    expect(fake.updates[0].payload.desired_frequency).toBeNull()
  })
})

describe('saveProfile — non-régression des autres champs', () => {
  it('enregistre tous les champs du profil et le marque comme complété', async () => {
    const fake = fakeProfileClient()
    await run(fake.client, profileForm())

    expect(fake.updates[0].payload).toEqual({
      first_name: 'Alice',
      last_name: 'Martin',
      phone: '0612345678',
      birthdate: '1990-05-17',
      city: 'Nantes',
      desired_frequency: 'twice_month',
      email: 'alice@example.fr',
      profile_complete: true,
    })
  })

  it('nettoie les espaces autour des champs texte', async () => {
    const fake = fakeProfileClient()
    await run(fake.client, profileForm({ first_name: '  Alice  ', last_name: ' Martin ', city: ' Nantes ' }))

    expect(fake.updates[0].payload).toMatchObject({ first_name: 'Alice', last_name: 'Martin', city: 'Nantes' })
  })

  it('enregistre `null` pour les champs optionnels laissés vides', async () => {
    const fake = fakeProfileClient()
    await run(fake.client, profileForm({ phone: '', birthdate: '', city: '' }))

    expect(fake.updates[0].payload).toMatchObject({ phone: null, birthdate: null, city: null })
  })

  it("ne touche pas à l'email d'authentification quand il est inchangé", async () => {
    const fake = fakeProfileClient()
    await run(fake.client, profileForm())

    expect(fake.updateUser).not.toHaveBeenCalled()
    expect(fake.updates[0].payload).toMatchObject({ email: 'alice@example.fr' })
  })

  it('demande le changement d’email et enregistre la nouvelle adresse quand elle change', async () => {
    const fake = fakeProfileClient()
    await run(fake.client, profileForm({ email: 'nouvelle@example.fr' }))

    expect(fake.updateUser).toHaveBeenCalledWith({ email: 'nouvelle@example.fr' })
    expect(fake.updates[0].payload).toMatchObject({ email: 'nouvelle@example.fr' })
  })
})

describe('saveProfile — redirections', () => {
  it('renvoie vers le tableau de bord après un enregistrement sans changement d’email', async () => {
    const fake = fakeProfileClient()
    const url = await run(fake.client, profileForm())

    expect(url).toBe('/espace/dashboard')
  })

  it('renvoie vers le profil avec `email_sent=1` quand un email de confirmation est parti', async () => {
    const fake = fakeProfileClient()
    const url = await run(fake.client, profileForm({ email: 'nouvelle@example.fr' }))

    expect(url).toBe('/espace/profil?email_sent=1')
  })

  it('renvoie `error=email_taken` si la nouvelle adresse est déjà utilisée — sans rien écrire', async () => {
    const fake = fakeProfileClient({ updateUserError: { message: 'Email address already registered' } })
    const url = await run(fake.client, profileForm({ email: 'prise@example.fr' }))

    expect(url).toBe('/espace/profil?error=email_taken')
    expect(fake.updates).toEqual([])
  })

  it('renvoie `error=failed` si la mise à jour du profil échoue en base', async () => {
    const fake = fakeProfileClient({
      updateError: { message: 'new row violates check constraint "profiles_desired_frequency_check"' },
    })
    const url = await run(fake.client, profileForm())

    expect(url).toBe('/espace/profil?error=failed')
  })

  it("renvoie vers la page de connexion si personne n'est authentifié — sans rien écrire", async () => {
    const fake = fakeProfileClient({ user: null })
    const url = await run(fake.client, profileForm())

    expect(url).toBe('/espace/login')
    expect(fake.updates).toEqual([])
  })
})
