import { beforeEach, describe, expect, it, vi } from 'vitest'

const { deliver } = vi.hoisted(() => ({ deliver: vi.fn() }))
vi.mock('@/lib/email/espace', () => ({ deliver }))

const { runLifecycleEmails, sendLifecycleEmail, notifyChurch } = await import('./lifecycle-send')

process.env.APP_TOKEN_SECRET = 'secret-de-test-suffisamment-long-0123456789'

const DAY = 864e5
const NOW = new Date('2026-11-09T09:00:00Z')
const iso = (days: number) => new Date(NOW.getTime() + days * DAY).toISOString()

type Row = Record<string, unknown>
type Db = {
  churches: Row[]
  memberships: Row[] // { church_id, user_id, role, status }
  profiles: Row[]
  emails: Record<string, string>
  members: Record<string, number>
  skipped: Record<string, string[]>
  /** Personnes désinscrites des rappels ; « erreur » simule une base indisponible. */
  unsubscribed?: string[] | 'erreur'
}

/** Faux client admin : mémoire en main, avec une vraie réservation « une seule fois » par (église, compte, clé). */
function fakeAdmin(db: Db) {
  const claims = new Map<string, { sent: boolean }>()
  const claimKey = (c: string, u: string, k: string) => `${c}|${u}|${k}`
  const getUserById = vi.fn(async (id: string) => ({ data: { user: db.emails[id] ? { email: db.emails[id] } : null }, error: null }))

  function from(table: string) {
    const filters: Array<[string, unknown]> = []
    let op: 'select' | 'update' | 'delete' = 'select'
    let patch: Row = {}
    let head = false
    let notEq: [string, unknown] | null = null
    const rows = (): Row[] => {
      const source: Row[] =
        table === 'churches' ? db.churches
          : table === 'church_memberships' ? db.memberships
          : table === 'profiles' ? db.profiles
          : table === 'email_unsubscribes' && Array.isArray(db.unsubscribed) ? db.unsubscribed.map((user_id) => ({ user_id, category: 'rappels' }))
          : []
      return source.filter((r) => filters.every(([c, v]) => (Array.isArray(v) ? v.includes(r[c]) : r[c] === v)) && (!notEq || r[notEq[0]] !== notEq[1]))
    }
    const settle = () => {
      if (table === 'email_sends') {
        const church = filters.find(([c]) => c === 'church_id')?.[1] as string
        const user = filters.find(([c]) => c === 'user_id')?.[1] as string
        const kind = filters.find(([c]) => c === 'kind')?.[1] as string
        const k = claimKey(church, user, kind)
        if (op === 'update') { const c = claims.get(k); if (c) c.sent = true }
        if (op === 'delete') { const c = claims.get(k); if (c && !c.sent) claims.delete(k) }
        return { data: null, error: null }
      }
      if (table === 'members') return { data: null, count: db.members[filters.find(([c]) => c === 'church_id')?.[1] as string] ?? 0, error: null }
      if (table === 'onboarding_progress') {
        const skipped = db.skipped[filters.find(([c]) => c === 'church_id')?.[1] as string]
        return { data: skipped ? { skipped } : null, error: null }
      }
      void head
      void patch
      if (table === 'email_unsubscribes' && db.unsubscribed === 'erreur') return { data: null, error: { message: 'base indisponible' } }
      return { data: rows(), error: null }
    }
    const b: Record<string, unknown> = {
      select: (_cols?: string, opts?: { head?: boolean }) => { head = !!opts?.head; return b },
      update: (p: Row) => { op = 'update'; patch = p; return b },
      delete: () => { op = 'delete'; return b },
      eq: (c: string, v: unknown) => { filters.push([c, v]); return b },
      in: (c: string, v: unknown[]) => { filters.push([c, v]); return b },
      neq: (c: string, v: unknown) => { notEq = [c, v]; return b },
      is: () => b,
      maybeSingle: async () => { const r = settle(); return { ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data } },
      then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(settle()).then(ok, ko),
    }
    return b
  }

  const rpc = vi.fn(async (name: string, args: { p_church_id: string; p_user_id: string; p_kind: string }) => {
    if (name !== 'claim_email_send') throw new Error(name)
    const k = claimKey(args.p_church_id, args.p_user_id, args.p_kind)
    if (claims.has(k)) return { data: false, error: null }
    claims.set(k, { sent: false })
    return { data: true, error: null }
  })
  return { from, rpc, auth: { admin: { getUserById } }, claims, getUserById }
}

function database(over: Partial<Db> = {}): Db {
  return {
    churches: [],
    memberships: [
      { church_id: 'A', user_id: 'a-admin', role: 'admin', status: 'active' },
      { church_id: 'A', user_id: 'a-admin2', role: 'admin', status: 'active' },
      { church_id: 'A', user_id: 'a-resp', role: 'responsable', status: 'active' },
      { church_id: 'A', user_id: 'a-gone', role: 'admin', status: 'inactive' },
      { church_id: 'B', user_id: 'b-admin', role: 'admin', status: 'active' },
    ],
    profiles: [
      { id: 'a-admin', first_name: 'Camille' },
      { id: 'a-admin2', first_name: 'Noa' },
      { id: 'b-admin', first_name: 'Lou' },
    ],
    emails: { 'a-admin': 'camille@a.test', 'a-admin2': 'noa@a.test', 'a-resp': 'resp@a.test', 'a-gone': 'gone@a.test', 'b-admin': 'lou@b.test' },
    members: { A: 1, B: 1 },
    skipped: {},
    ...over,
  }
}

const church = (id: string, ageDays: number, over: Row = {}): Row => ({
  id,
  name: `Église ${id}`,
  timezone: 'Europe/Paris',
  billing_status: 'trialing',
  created_at: iso(-ageDays),
  trial_ends_at: iso(30 - ageDays),
  grace_ends_at: null,
  deletion_scheduled_at: null,
  ...over,
})

const recipients = () => deliver.mock.calls.map((c) => (c[1] as { to: string }).to).sort()

beforeEach(() => {
  deliver.mockReset()
  deliver.mockResolvedValue(undefined)
})

describe('choix des destinataires', () => {
  it('seuls les administrateurs actifs de l\'église reçoivent le message', async () => {
    const admin = fakeAdmin(database({ churches: [church('A', 0)] }))
    await runLifecycleEmails(admin as never, NOW)
    expect(recipients()).toEqual(['camille@a.test', 'noa@a.test'])
  })

  it('un message d\'une église ne part jamais vers les administrateurs d\'une autre', async () => {
    const admin = fakeAdmin(database({ churches: [church('A', 0), church('B', 29.5)] }))
    await runLifecycleEmails(admin as never, NOW)
    const toB = deliver.mock.calls.filter((c) => (c[1] as { to: string }).to.endsWith('@b.test'))
    const toA = deliver.mock.calls.filter((c) => (c[1] as { to: string }).to.endsWith('@a.test'))
    expect(toB).toHaveLength(1)
    expect((toB[0][1] as { subject: string }).subject).toBe("Dernier jour d'essai gratuit") // dû pour B uniquement
    expect(toA.every((c) => (c[1] as { subject: string }).subject.startsWith('Bienvenue'))).toBe(true)
  })

  it('personnalise avec le prénom de chaque administrateur', async () => {
    const admin = fakeAdmin(database({ churches: [church('A', 0)] }))
    await runLifecycleEmails(admin as never, NOW)
    const html = deliver.mock.calls.map((c) => (c[1] as { to: string; html: string })).find((m) => m.to === 'noa@a.test')!.html
    expect(html).toContain('Bonjour Noa,')
  })

  it('une église sans administrateur actif ne provoque aucun envoi ni erreur', async () => {
    const db = database({ churches: [church('C', 0)] })
    const summary = await runLifecycleEmails(fakeAdmin(db) as never, NOW)
    expect(deliver).not.toHaveBeenCalled()
    expect(summary.welcome).toEqual({ sent: 0, skipped: 0, failed: 0 })
  })
})

describe('jamais deux fois le même message', () => {
  it('une double exécution du cron n\'envoie rien de plus', async () => {
    const admin = fakeAdmin(database({ churches: [church('A', 0)] }))
    const first = await runLifecycleEmails(admin as never, NOW)
    const second = await runLifecycleEmails(admin as never, NOW)
    expect(first.welcome).toEqual({ sent: 2, skipped: 0, failed: 0 })
    expect(second.welcome).toEqual({ sent: 0, skipped: 2, failed: 0 })
    expect(deliver).toHaveBeenCalledTimes(2)
  })

  it('deux exécutions simultanées n\'envoient qu\'un message par personne', async () => {
    const admin = fakeAdmin(database({ churches: [church('A', 0)] }))
    await Promise.all([runLifecycleEmails(admin as never, NOW), runLifecycleEmails(admin as never, NOW)])
    expect(deliver).toHaveBeenCalledTimes(2)
  })

  it('chaque envoi porte une clé d\'idempotence propre à l\'église, à la personne et au message', async () => {
    const admin = fakeAdmin(database({ churches: [church('A', 0)] }))
    await runLifecycleEmails(admin as never, NOW)
    const keys = deliver.mock.calls.map((c) => (c[1] as { idempotencyKey: string }).idempotencyKey).sort()
    expect(keys).toEqual(['lifecycle/A/a-admin/welcome', 'lifecycle/A/a-admin2/welcome'])
  })

  it('les jours suivants, le message suivant part et pas le précédent', async () => {
    const admin = fakeAdmin(database({ churches: [church('A', 0)] }))
    await runLifecycleEmails(admin as never, NOW)
    deliver.mockClear()
    const later = new Date(NOW.getTime() + 23 * DAY)
    await runLifecycleEmails(admin as never, later)
    const subjects = new Set(deliver.mock.calls.map((c) => (c[1] as { subject: string }).subject))
    expect([...subjects]).toEqual(["Plus que 7 jours d'essai gratuit"])
  })
})

describe('échecs d\'envoi', () => {
  it('lève la réservation : le prochain passage réessaie, sans arrêter les autres envois', async () => {
    const admin = fakeAdmin(database({ churches: [church('A', 0)] }))
    deliver.mockRejectedValueOnce(new Error('Resend en panne'))
    const first = await runLifecycleEmails(admin as never, NOW)
    expect(first.welcome).toEqual({ sent: 1, skipped: 0, failed: 1 })

    const second = await runLifecycleEmails(admin as never, NOW)
    expect(second.welcome).toEqual({ sent: 1, skipped: 1, failed: 0 })
    expect(deliver).toHaveBeenCalledTimes(3)
  })

  it('n\'écrit ni adresse ni nom dans les journaux', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const admin = fakeAdmin(database({ churches: [church('A', 0)] }))
    deliver.mockRejectedValue(new Error('Resend welcome: Invalid `to` field camille@a.test'))
    await runLifecycleEmails(admin as never, NOW)
    const logged = spy.mock.calls.flat().join(' ')
    expect(logged).toContain('[adresse]')
    expect(logged).not.toMatch(/@a\.test|Camille|Noa/)
    spy.mockRestore()
  })
})

describe('relance d\'import', () => {
  it('part au jour 3 pour une église sans membres importés', async () => {
    const admin = fakeAdmin(database({ churches: [church('A', 3.5)] }))
    await runLifecycleEmails(admin as never, NOW)
    expect(deliver.mock.calls.some((c) => (c[1] as { subject: string }).subject.startsWith('Importez'))).toBe(true)
  })

  it('ne part pas si des membres ont déjà été importés', async () => {
    const admin = fakeAdmin(database({ churches: [church('A', 3.5)], members: { A: 40 } }))
    await runLifecycleEmails(admin as never, NOW)
    expect(deliver.mock.calls.some((c) => (c[1] as { subject: string }).subject.startsWith('Importez'))).toBe(false)
  })

  it('ne part pas si l\'étape « importer » a été écartée', async () => {
    const admin = fakeAdmin(database({ churches: [church('A', 3.5)], skipped: { A: ['import'] } }))
    await runLifecycleEmails(admin as never, NOW)
    expect(deliver.mock.calls.some((c) => (c[1] as { subject: string }).subject.startsWith('Importez'))).toBe(false)
  })
})

describe('messages déclenchés par un événement', () => {
  it('notifyChurch envoie une confirmation d\'abonnement une seule fois, même si l\'événement est rejoué', async () => {
    const admin = fakeAdmin(database({ churches: [church('A', 40, { billing_status: 'active' })] }))
    const extras = { offerName: 'Communauté', interval: 'month' as const }
    await notifyChurch(admin as never, 'A', 'subscription_confirmed', 'sub_1', extras)
    await notifyChurch(admin as never, 'A', 'subscription_confirmed', 'sub_1', extras)
    expect(deliver).toHaveBeenCalledTimes(2) // deux administrateurs, une seule fois chacun
    await notifyChurch(admin as never, 'A', 'subscription_confirmed', 'sub_2', extras) // autre abonnement : nouveau message
    expect(deliver).toHaveBeenCalledTimes(4)
  })

  it('notifyChurch ne lève jamais d\'erreur (un problème d\'e-mail ne bloque ni un paiement ni une inscription)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const admin = fakeAdmin(database({ churches: [church('A', 0)] }))
    deliver.mockRejectedValue(new Error('panne'))
    await expect(notifyChurch(admin as never, 'A', 'welcome')).resolves.toBeUndefined()
    await expect(notifyChurch(admin as never, 'inconnue', 'welcome')).resolves.toBeUndefined()
    spy.mockRestore()
  })

  it('sendLifecycleEmail utilise le fuseau et le nom de l\'église', async () => {
    const admin = fakeAdmin(database())
    await sendLifecycleEmail(admin as never, { id: 'A', name: 'Église de Montréal', timezone: 'America/Montreal' }, 'trial_ending_1', 'trial_ending_1', { trialEndsAt: '2026-11-14T22:59:59Z' })
    const html = (deliver.mock.calls[0][1] as { html: string }).html
    expect(html).toContain('Église de Montréal')
    expect(html).toContain('14 novembre à 17:59')
  })
})

describe('désinscription des rappels', () => {
  const lastDay = () => church('A', 29.5)
  const mailsTo = (email: string) => sentToEmail(email)
  function sentToEmail(email: string) {
    return deliver.mock.calls.map((c) => c[1] as { to: string; subject: string; html: string; headers?: Record<string, string> }).filter((m) => m.to === email)
  }

  it('un rappel porte le lien de désinscription et l\'en-tête « un clic »', async () => {
    const admin = fakeAdmin(database({ churches: [lastDay()] }))
    await runLifecycleEmails(admin as never, NOW)
    const [mail] = mailsTo('camille@a.test')
    expect(mail.html).toMatch(/href="[^"]*\/espace\/desinscription\/[^"]+"/)
    expect(mail.headers?.['List-Unsubscribe']).toMatch(/^<https:\/\/[^>]*\/api\/desinscription\/[^>]+>$/)
    expect(mail.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    expect(mail.html).not.toContain('camille@a.test') // le lien ne porte aucune adresse
  })

  it('une personne désinscrite ne reçoit plus de rappel, mais ses collègues oui', async () => {
    const admin = fakeAdmin(database({ churches: [lastDay()], unsubscribed: ['a-admin'] }))
    const summary = await runLifecycleEmails(admin as never, NOW)
    expect(mailsTo('camille@a.test')).toHaveLength(0)
    expect(mailsTo('noa@a.test')).toHaveLength(1)
    expect(summary.trial_ending_1).toEqual({ sent: 1, skipped: 1, failed: 0 })
  })

  it('un message de service part malgré la désinscription, sans lien ni en-tête', async () => {
    const late = church('A', 60, { billing_status: 'past_due', trial_ends_at: null, grace_ends_at: iso(5) })
    const admin = fakeAdmin(database({ churches: [late], unsubscribed: ['a-admin', 'a-admin2'] }))
    await runLifecycleEmails(admin as never, NOW)
    const [mail] = mailsTo('camille@a.test')
    expect(mail.subject).toBe("Le paiement de votre abonnement n'a pas abouti")
    expect(mail.html).not.toContain('Me désinscrire')
    expect(mail.headers).toBeUndefined()
  })

  it('une désinscription n\'est pas consommée : elle n\'enregistre aucun envoi', async () => {
    const admin = fakeAdmin(database({ churches: [lastDay()], unsubscribed: ['a-admin'] }))
    await runLifecycleEmails(admin as never, NOW)
    expect([...admin.claims.keys()].some((k) => k.includes('a-admin|'))).toBe(false)
  })

  it('si la liste des désinscrits est illisible, aucun rappel ne part', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const admin = fakeAdmin(database({ churches: [lastDay()], unsubscribed: 'erreur' }))
    const summary = await runLifecycleEmails(admin as never, NOW)
    expect(deliver).not.toHaveBeenCalled()
    expect(summary.trial_ending_1.failed).toBe(2)
    spy.mockRestore()
  })
})
