import { describe, it, expect } from 'vitest'
import { parseBibleRequest, parseReference } from './bible'

describe('parseBibleRequest', () => {
  it('accepte une version connue, un livre et un chapitre bornés', () => {
    expect(parseBibleRequest('BDS', '43', '3')).toEqual({ translation: 'BDS', book: 43, chapter: 3 })
    expect(parseBibleRequest('KJV', '1', '150')).toEqual({ translation: 'KJV', book: 1, chapter: 150 })
  })

  it('refuse une version hors liste', () => {
    expect(parseBibleRequest('XYZ', '43', '3')).toBeNull()
    expect(parseBibleRequest('BDS/../admin', '43', '3')).toBeNull()
    expect(parseBibleRequest(null, '43', '3')).toBeNull()
  })

  it('refuse un livre ou un chapitre non numérique ou hors bornes', () => {
    expect(parseBibleRequest('BDS', '0', '3')).toBeNull()
    expect(parseBibleRequest('BDS', '67', '3')).toBeNull()
    expect(parseBibleRequest('BDS', '43', '0')).toBeNull()
    expect(parseBibleRequest('BDS', '43', '151')).toBeNull()
    expect(parseBibleRequest('BDS', '4a', '3')).toBeNull()
    expect(parseBibleRequest('BDS', '43', '3/../../x')).toBeNull()
    expect(parseBibleRequest('BDS', null, '3')).toBeNull()
  })
})

describe('parseReference', () => {
  it('reconnaît une référence simple et une plage', () => {
    expect(parseReference('Jean 3:16')).toEqual({ bookNum: 43, chapter: 3, verseStart: 16, verseEnd: 16 })
    expect(parseReference('Ps 23:1-3')).toEqual({ bookNum: 19, chapter: 23, verseStart: 1, verseEnd: 3 })
  })
})
