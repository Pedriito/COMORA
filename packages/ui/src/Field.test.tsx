import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { TextField, Textarea, Select, FieldLabel, ErrorText, fieldClasses } from './Field'

afterEach(cleanup)

describe('fieldClasses — zoom iOS', () => {
  // Deux champs de date de l'application forçaient 13px et déclenchaient le zoom
  // automatique d'iOS, qu'ils cherchaient justement à éviter : Safari zoome sous
  // 16px à la prise de focus. `text-base` vaut 16px ; la taille réduite ne
  // s'applique qu'à partir du palier `sm`, hors écrans tactiles étroits.
  it('ne descend jamais sous 16px sur mobile, quelle que soit la taille', () => {
    for (const size of ['sm', 'md'] as const) {
      const c = fieldClasses({ size })
      expect(c).toContain('text-base')
      expect(c).toMatch(/sm:text-(xs|sm)/)
    }
  })

  it('ne contient aucune taille de police mobile inférieure à 16px', () => {
    for (const size of ['sm', 'md'] as const) {
      expect(fieldClasses({ size })).not.toMatch(/(^|\s)text-(xs|sm|\[1[0-5]px\])(\s|$)/)
    }
  })
})

describe('fieldClasses — focus et erreur', () => {
  it('remplace toujours le contour supprimé par un anneau visible', () => {
    const c = fieldClasses()
    expect(c).toContain('focus:outline-none')
    expect(c).toContain('focus:ring-2')
  })

  it('bascule l’anneau en rouge quand le champ est invalide', () => {
    expect(fieldClasses({ invalid: true })).toContain('focus:ring-red-200')
    expect(fieldClasses({ invalid: false })).toContain('focus:ring-teal/30')
  })

  // Émettre à la fois la bordure de surface et la bordure d'erreur laissait l'ordre de la
  // feuille de style trancher : `border-teal/30` y figure après `border-red-300`, si bien
  // qu'un champ en erreur restait bordé de teal sur deux surfaces sur trois — l'erreur
  // n'était plus signalée que par son message.
  it("n'émet jamais deux couleurs de bordure concurrentes", () => {
    for (const surface of ['sand', 'tealSoft', 'plain'] as const) {
      const invalide = fieldClasses({ surface, invalid: true })
      expect(invalide).toContain('border-red-300')
      expect(invalide).not.toMatch(/border-(teal|dark)\//)

      const valide = fieldClasses({ surface, invalid: false })
      expect(valide).toMatch(/border-(teal|dark)\//)
      expect(valide).not.toContain('border-red-300')
    }
  })

  it('propose les trois surfaces réellement présentes dans l’application', () => {
    expect(fieldClasses({ surface: 'sand' })).toContain('bg-sand')
    expect(fieldClasses({ surface: 'tealSoft' })).toContain('bg-teal-50')
    expect(fieldClasses({ surface: 'plain' })).toContain('bg-white')
  })
})

describe('Champs', () => {
  it('marque le champ invalide pour les lecteurs d’écran, pas seulement visuellement', () => {
    render(<TextField invalid aria-label="Email" defaultValue="" />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it("n'ajoute pas aria-invalid quand le champ est valide", () => {
    render(<TextField aria-label="Nom" defaultValue="" />)
    expect(screen.getByLabelText('Nom')).not.toHaveAttribute('aria-invalid')
  })

  it('empêche le redimensionnement manuel des zones de texte', () => {
    render(<Textarea aria-label="Notes" defaultValue="" />)
    expect(screen.getByLabelText('Notes').className).toContain('resize-none')
  })

  it('rend les options transmises à la liste déroulante', () => {
    render(<Select aria-label="Rythme"><option value="a">Chaque semaine</option></Select>)
    expect(screen.getByRole('option', { name: 'Chaque semaine' })).toBeInTheDocument()
  })

  it('associe le libellé à son champ', () => {
    render(<><FieldLabel htmlFor="ville">Ville</FieldLabel><TextField id="ville" /></>)
    expect(screen.getByLabelText('Ville')).toBeInTheDocument()
  })

  it('annonce les erreurs de façon assertive', () => {
    render(<ErrorText>Adresse invalide</ErrorText>)
    expect(screen.getByRole('alert')).toHaveTextContent('Adresse invalide')
  })
})
