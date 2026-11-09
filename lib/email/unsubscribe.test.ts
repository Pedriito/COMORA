import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { signToken } from '@/lib/tokens'

const { setUnsubscribed, createAdminClient } = vi.hoisted(() => ({ setUnsubscribed: vi.fn(), createAdminClient: vi.fn(() => ({})) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))

const real = await import('./unsubscribe')
vi.mock('./unsubscribe', async (importOriginal) => ({ ...(await importOriginal<typeof import('./unsubscribe')>()), setUnsubscribed }))
const { POST, GET } = await import('../../app/api/desinscription/[token]/route')

const USER = '0b9f5c1e-6d1a-4d0b-9a77-2a3d6a1f0c11'
const previous = process.env.APP_TOKEN_SECRET
beforeEach(() => {
  process.env.APP_TOKEN_SECRET = 'secret-de-test-suffisamment-long-0123456789'
  setUnsubscribed.mockReset()
  setUnsubscribed.mockResolvedValue(undefined)
})
afterEach(() => { process.env.APP_TOKEN_SECRET = previous })

const call = (method: typeof POST, token: string) => method(new Request('http://x/api/desinscription/' + token, { method: 'POST' }), { params: Promise.resolve({ token }) })

describe('jeton de désinscription', () => {
  it('retrouve la personne', () => {
    expect(real.verifyUnsubscribeToken(real.unsubscribeToken(USER))).toBe(USER)
  })

  it('refuse un jeton modifié, vide, ou signé pour un autre usage', () => {
    const token = real.unsubscribeToken(USER)
    expect(real.verifyUnsubscribeToken(token.slice(0, -2) + 'xx')).toBeNull()
    expect(real.verifyUnsubscribeToken('')).toBeNull()
    expect(real.verifyUnsubscribeToken(signToken('assignment-response', USER, new Date(Date.now() + 1e9)))).toBeNull()
  })

  it('refuse un jeton expiré ou dont la charge n\'est pas un identifiant', () => {
    expect(real.verifyUnsubscribeToken(signToken(real.UNSUBSCRIBE_PURPOSE, USER, new Date(Date.now() - 1000)))).toBeNull()
    expect(real.verifyUnsubscribeToken(signToken(real.UNSUBSCRIBE_PURPOSE, 'pas-un-uuid', new Date(Date.now() + 1e9)))).toBeNull()
  })

  it('les liens ne contiennent aucune adresse e-mail et pointent vers la page et l\'API', () => {
    const { page, oneClick } = real.unsubscribeLinks(USER)
    expect(page).toContain('/espace/desinscription/')
    expect(oneClick).toContain('/api/desinscription/')
    expect(page + oneClick).not.toContain('@')
  })

  it('en-têtes List-Unsubscribe conformes au « un clic »', () => {
    expect(real.unsubscribeHeaders('https://x.fr/api/desinscription/t')).toEqual({
      'List-Unsubscribe': '<https://x.fr/api/desinscription/t>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    })
  })
})

describe('POST /api/desinscription/[token]', () => {
  it('désinscrit la personne du jeton', async () => {
    const response = await call(POST, real.unsubscribeToken(USER))
    expect(response.status).toBe(200)
    expect(setUnsubscribed).toHaveBeenCalledWith(expect.anything(), USER, true)
  })

  it('refuse un jeton invalide sans rien écrire', async () => {
    expect((await call(POST, 'faux.jeton.ici')).status).toBe(400)
    expect(setUnsubscribed).not.toHaveBeenCalled()
  })

  it('répond 500 sans détail si la base échoue', async () => {
    setUnsubscribed.mockRejectedValue(new Error('détail interne'))
    const response = await call(POST, real.unsubscribeToken(USER))
    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain('détail interne')
  })

  it('un GET (antivirus, aperçu de lien) ne désinscrit personne : il renvoie à la page de confirmation', async () => {
    const response = await GET(new Request('http://x/api/desinscription/abc'), { params: Promise.resolve({ token: 'abc' }) })
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toContain('/espace/desinscription/abc')
    expect(setUnsubscribed).not.toHaveBeenCalled()
  })
})
