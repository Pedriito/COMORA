import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { daysFromNow, generateToken, hashToken, isWellFormedToken, signToken, verifyToken } from './tokens'

describe('jetons opaques', () => {
  it('sont aléatoires, bien formés, et seule leur empreinte est stable', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a).not.toBe(b)
    expect(isWellFormedToken(a)).toBe(true)
    expect(hashToken(a)).toBe(hashToken(a))
    expect(hashToken(a)).not.toContain(a)
    expect(isWellFormedToken('../../etc/passwd')).toBe(false)
  })
})

describe('jetons signés', () => {
  const previous = process.env.APP_TOKEN_SECRET
  beforeEach(() => { process.env.APP_TOKEN_SECRET = 'secret-de-test-suffisamment-long-0123456789' })
  afterEach(() => { process.env.APP_TOKEN_SECRET = previous })

  it('restituent la charge utile', () => {
    const token = signToken('reponse', 'affectation-1', daysFromNow(7))
    expect(verifyToken('reponse', token)).toBe('affectation-1')
  })

  it('refusent un jeton modifié, expiré ou destiné à un autre usage', () => {
    const token = signToken('reponse', 'affectation-1', daysFromNow(7))
    const [, exp, sig] = token.split('.')
    expect(verifyToken('reponse', `${Buffer.from('affectation-2').toString('base64url')}.${exp}.${sig}`)).toBeNull()
    expect(verifyToken('autre', token)).toBeNull()
    expect(verifyToken('reponse', signToken('reponse', 'x', new Date(Date.now() - 1000)))).toBeNull()
    expect(verifyToken('reponse', 'nimporte.quoi')).toBeNull()
  })

  it('exigent un secret serveur suffisamment long', () => {
    process.env.APP_TOKEN_SECRET = 'court'
    expect(() => signToken('reponse', 'x', daysFromNow(1))).toThrow()
  })
})
