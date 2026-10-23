import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildPreview, cleanPhone, decodeCsv, detectDelimiter, MAX_IMPORT_ROWS, parseBirthdate, parseDelimited, revalidateRows, TEMPLATE_CSV,
} from './members-import'
import { parsePositions, parseServiceDateTime, validateServiceTitle, validateTeamName } from './forms'
import { readMembersFile } from './read-file'

const csv = (text: string) => buildPreview(parseDelimited(text))

describe('lecture CSV', () => {
  it('reconnaît « ; », « , » et la tabulation', () => {
    expect(detectDelimiter('a;b;c')).toBe(';')
    expect(detectDelimiter('a,b,c')).toBe(',')
    expect(detectDelimiter('a\tb\tc')).toBe('\t')
  })

  it('gère les guillemets, les séparateurs et les retours à la ligne dans un champ, et le BOM', () => {
    const rows = parseDelimited('﻿nom;ville\r\n"Dupont; Jr";"Saint-""Étienne"""\r\n"a\nb";c')
    expect(rows).toEqual([['nom', 'ville'], ['Dupont; Jr', 'Saint-"Étienne"'], ['a\nb', 'c']])
  })

  it('décode du Windows-1252 quand ce n’est pas de l’UTF-8', () => {
    expect(decodeCsv(new Uint8Array([0x50, 0x72, 0xe9, 0x6e, 0x6f, 0x6d]))).toBe('Prénom')
    expect(decodeCsv(new TextEncoder().encode('Prénom'))).toBe('Prénom')
  })

  it('le modèle proposé est lu sans erreur', () => {
    const p = csv(TEMPLATE_CSV)
    expect(p.issues).toEqual([])
    expect(p.rows).toHaveLength(2)
    expect(p.rows[0]).toEqual({ first_name: 'Marie', last_name: 'Dupont', email: 'marie.dupont@exemple.fr', phone: '06 12 34 56 78', city: 'Lyon', birthdate: '1985-03-14' })
  })
})

describe('contrôle des lignes', () => {
  it('reconnaît les colonnes malgré accents, casse et synonymes', () => {
    const p = csv('PRENOM;Nom de famille;Courriel;Portable;Commune;Naissance\nAmélie;Roy;AMELIE@Exemple.fr;0612345678;Nantes;02/11/1990')
    expect(p.rows[0]).toMatchObject({ first_name: 'Amélie', last_name: 'Roy', email: 'amelie@exemple.fr', city: 'Nantes', birthdate: '1990-11-02' })
    expect(p.ignoredColumns).toEqual([])
  })

  it('signale les colonnes inconnues sans les importer', () => {
    expect(csv('Prénom;Salaire\nA;1').ignoredColumns).toEqual(['Salaire'])
  })

  it('sans colonne prénom, rien n’est importé', () => {
    const p = csv('Nom;Ville\nDupont;Lyon')
    expect(p.missingFirstName).toBe(true)
    expect(p.rows).toEqual([])
  })

  it('écarte et explique les lignes invalides, avec le numéro de ligne du tableur', () => {
    const p = csv('Prénom;Nom;E-mail;Téléphone;Naissance\n;X;;;\nA;B;pas-un-mail;;\nC;D;;abc;\nE;F;;;31/02/2000\nG;H;g@h.fr;;')
    expect(p.rows.map(r => r.first_name)).toEqual(['G'])
    expect(p.issues.map(i => i.line)).toEqual([2, 3, 4, 5])
  })

  it('écarte les doublons d’adresse du fichier, sans tenir compte de la casse', () => {
    const p = csv('Prénom;E-mail\nA;a@x.fr\nB;A@X.fr\nC;')
    expect(p.rows.map(r => r.first_name)).toEqual(['A', 'C'])
    expect(p.issues[0]).toMatchObject({ line: 3 })
  })

  it('ignore les lignes vides', () => {
    expect(csv('Prénom\nA\n;\n\nB').rows).toHaveLength(2)
  })

  it('limite à 2000 personnes et le dit', () => {
    const body = Array.from({ length: MAX_IMPORT_ROWS + 5 }, (_, i) => `P${i}`).join('\n')
    const p = csv(`Prénom\n${body}`)
    expect(p.rows).toHaveLength(MAX_IMPORT_ROWS)
    expect(p.issues.some(i => i.message.startsWith('Trop de lignes'))).toBe(true)
  })

  it('neutralise les formules de tableur (= + - @) dans les textes', () => {
    const p = csv('Prénom;Nom;Ville\n=CMD();@x;+SUM(A1)')
    expect(p.rows[0].first_name).toBe("'=CMD()")
    expect(p.rows[0].last_name).toBe("'@x")
    expect(p.rows[0].city).toBe("'+SUM(A1)")
    expect(csv('Prénom;Téléphone\nA;+33 6 12 34 56 78').rows[0].phone).toBe('+33 6 12 34 56 78')
  })

  it('refuse un prénom trop long', () => {
    expect(csv(`Prénom\n${'a'.repeat(81)}`).issues).toHaveLength(1)
  })
})

describe('valeurs', () => {
  it.each([
    ['14/03/1985', '1985-03-14'], ['1-2-1990', '1990-02-01'], ['1985-03-14', '1985-03-14'], ['', ''],
    ['31/02/2000', null], ['14/03/1850', null], ['demain', null], ['01/01/2999', null],
  ])('date %s', (input, expected) => expect(parseBirthdate(input)).toBe(expected))

  it.each([['06 12 34 56 78', '06 12 34 56 78'], ['+33 6 12 34 56 78', '+33 6 12 34 56 78'], ['', ''], ['abc', null], ['12', null]])(
    'téléphone %s',
    (input, expected) => expect(cleanPhone(input)).toBe(expected),
  )
})

describe('revalidation côté serveur', () => {
  it('le serveur ne croit pas l’aperçu : il contrôle à nouveau chaque ligne', () => {
    const forged = [
      { first_name: 'Ok', email: 'ok@x.fr' },
      { first_name: '', email: 'x@x.fr' },
      { first_name: 'Mauvais', email: 'pas-un-mail' },
      { first_name: 'Dup', email: 'ok@x.fr' },
      'n’importe quoi',
      null,
    ]
    const p = revalidateRows(forged)
    expect(p.rows.map(r => r.first_name)).toEqual(['Ok'])
    expect(revalidateRows('x').rows).toEqual([])
    expect(revalidateRows({ rows: [] }).rows).toEqual([])
  })

  it('ignore les champs inattendus (aucune colonne ajoutée par le navigateur)', () => {
    const p = revalidateRows([{ first_name: 'A', church_id: 'autre-eglise', status: 'inactive' }])
    expect(Object.keys(p.rows[0]).sort()).toEqual(['birthdate', 'city', 'email', 'first_name', 'last_name', 'phone'])
  })
})

describe('fichiers reçus', () => {
  const file = (bytes: BlobPart, name: string, type = '') => new File([bytes], name, { type })

  it('lit un vrai fichier Excel (.xlsx), dates comprises', async () => {
    const r = await readMembersFile(file(readFileSync(join(process.cwd(), 'tests/fixtures/membres.xlsx')), 'membres.xlsx'))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.preview.issues).toEqual([])
      expect(r.preview.rows).toEqual([
        { first_name: 'Marie', last_name: 'Dupont', email: 'marie@exemple.fr', phone: '06 12 34 56 78', city: 'Lyon', birthdate: '1985-03-14' },
        { first_name: 'Samuel', last_name: 'Martin', email: '', phone: '', city: '', birthdate: '' },
      ])
    }
  })

  it('lit un CSV en Windows-1252 exporté par un vieil Excel', async () => {
    const bytes = new Uint8Array([...'Prénom;Nom\r\nÉlie;Brûlé'].map(c => c.charCodeAt(0)))
    const r = await readMembersFile(file(bytes, 'liste.csv', 'text/csv'))
    expect(r.ok && r.preview.rows[0]).toMatchObject({ first_name: 'Élie', last_name: 'Brûlé' })
  })

  it('refuse proprement : vide, trop gros, ancien .xls, format inconnu, fichier abîmé', async () => {
    const message = async (f: File | null) => {
      const r = await readMembersFile(f)
      return r.ok ? 'ok' : r.error
    }
    expect(await message(null)).toMatch(/Choisissez/)
    expect(await message(file(new Uint8Array(2 * 1024 * 1024 + 1), 'gros.csv'))).toMatch(/volumineux/)
    expect(await message(file(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0]), 'vieux.xls'))).toMatch(/\.xlsx/)
    expect(await message(file('%PDF-1.4 …', 'liste.pdf', 'application/pdf'))).toMatch(/Format non pris en charge/)
    expect(await message(file(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]), 'abime.xlsx'))).toMatch(/pas pu être lu/)
  })
})

describe('petits formulaires du guide', () => {
  it('postes : séparés par ligne, virgule ou point-virgule, sans doublon', () => {
    expect(parsePositions('Accueil\n  Café ,Accueil; Parking').positions).toEqual(['Accueil', 'Café', 'Parking'])
    expect(parsePositions('').positions).toEqual([])
    expect(parsePositions('x'.repeat(81)).error).toBeDefined()
    expect(parsePositions(Array.from({ length: 31 }, (_, i) => `P${i}`).join('\n')).error).toBeDefined()
  })

  it('équipe, titre et date', () => {
    expect(validateTeamName('  ')).not.toBeNull()
    expect(validateTeamName('Accueil')).toBeNull()
    expect(validateServiceTitle('')).not.toBeNull()
    expect(validateServiceTitle('Culte')).toBeNull()
    expect(parseServiceDateTime('2027-01-10', '10:00')).toEqual({ local: '2027-01-10T10:00' })
    expect(parseServiceDateTime('2027-02-30', '10:00').error).toBeDefined()
    expect(parseServiceDateTime('2027-01-10', '25:00').error).toBeDefined()
    expect(parseServiceDateTime('', '').error).toBeDefined()
  })
})
