import { describe, it, expect } from 'vitest'
import { transposeChart } from './transpose'

describe('transposeChart — alignement accord/parole', () => {
  it("préserve la colonne du 2e accord quand le 1er devient plus long après transposition", () => {
    // "F" (1 car) -> "F#" (2 cars) : il faut retirer un espace du blanc qui suit
    // pour que le 2e accord reste à la même colonne qu'avant transposition.
    const original = 'F    Am'
    const result = transposeChart(`${original}\nParoles ici`, 'C', 'C#')
    const [chordLine, lyricsLine] = result.split('\n')

    expect(chordLine.startsWith('F#')).toBe(true)
    const secondChord = chordLine.trim().split(/\s+/)[1]
    expect(chordLine.indexOf(secondChord)).toBe(original.indexOf('Am'))
    expect(lyricsLine).toBe('Paroles ici')
  })

  it("préserve la colonne du 2e accord quand le 1er devient plus court après transposition", () => {
    // "F#" (2 cars) -> "F" (1 car) : il faut ajouter un espace au blanc qui suit
    // pour que le 2e accord reste à la même colonne qu'avant transposition.
    const original = 'F#   G'
    const result = transposeChart(original, 'Gb', 'F')

    expect(result.startsWith('F ')).toBe(true) // "F#" (2 cars) devenu "F" (1 car)
    const secondChord = result.trim().split(/\s+/)[1]
    expect(result.indexOf(secondChord)).toBe(original.indexOf('G'))
  })

  it('préserve les colonnes en cascade sur une ligne à plus de deux accords', () => {
    const original = 'F    C    Am   G'
    const result = transposeChart(original, 'C', 'C#')
    const originalChords = original.trim().split(/\s+/)
    const resultChords = result.trim().split(/\s+/)

    expect(resultChords).toHaveLength(originalChords.length)
    // Chaque accord transposé doit démarrer à la même colonne que l'accord
    // d'origine qu'il remplace, quel que soit le changement de longueur des
    // accords précédents sur la ligne.
    originalChords.forEach((chord, i) => {
      expect(result.indexOf(resultChords[i])).toBe(original.indexOf(chord))
    })
  })

  it('laisse la ligne de paroles totalement inchangée', () => {
    const chart = 'F    Am\nGloire à Dieu dans les cieux'
    const result = transposeChart(chart, 'C', 'C#')
    const [, lyricsLine] = result.split('\n')
    expect(lyricsLine).toBe('Gloire à Dieu dans les cieux')
  })

  it("ne modifie rien si la tonalité de départ et d'arrivée sont identiques", () => {
    const chart = 'F#   G'
    expect(transposeChart(chart, 'F#', 'F#')).toBe(chart)
  })
})
