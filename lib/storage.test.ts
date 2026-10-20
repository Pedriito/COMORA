import { describe, expect, it } from 'vitest'
import { churchFilePath, extensionFor, isChurchPath } from './storage'

const CHURCH = '0b6f6a3e-1c1e-4a57-9a43-2b1b8f1f4c11'

describe('stockage', () => {
  it("range chaque fichier dans le dossier de l'église, sous un nom aléatoire", () => {
    const a = churchFilePath(CHURCH, 'annonces', 'png')
    expect(a).toMatch(new RegExp(`^${CHURCH}/annonces/\\d+-[0-9a-f]{16}\\.png$`))
    expect(churchFilePath(CHURCH, 'annonces', 'png')).not.toBe(a)
    expect(churchFilePath(CHURCH, '../autre', 'png')).toMatch(new RegExp(`^${CHURCH}/autre/`))
  })

  it("n'accepte que les types de fichiers prévus", () => {
    expect(extensionFor('image', 'image/png')).toBe('png')
    expect(extensionFor('image', 'image/svg+xml')).toBeNull()
    expect(extensionFor('image', 'text/html')).toBeNull()
    expect(extensionFor('document', 'application/pdf')).toBe('pdf')
  })

  it("refuse un chemin hors du dossier de l'église", () => {
    expect(isChurchPath(CHURCH, `${CHURCH}/annonces/a.png`)).toBe(true)
    expect(isChurchPath(CHURCH, `autre/${CHURCH}/a.png`)).toBe(false)
    expect(isChurchPath(CHURCH, `${CHURCH}/../autre/a.png`)).toBe(false)
  })
})
