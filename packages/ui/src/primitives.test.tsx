import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Card } from './Card'
import { SectionHeader } from './SectionHeader'
import { Badge } from './Badge'
import { EmptyState } from './EmptyState'
import { IconButton, CloseButton } from './IconButton'
import { cx } from './cx'

afterEach(cleanup)

describe('cx', () => {
  it('ignore les valeurs vides issues des conditions', () => {
    expect(cx('a', false, null, undefined, 'b')).toBe('a b')
  })
})

describe('Card', () => {
  it('applique la bordure teal par défaut — le traitement dominant', () => {
    render(<Card>contenu</Card>)
    const el = screen.getByText('contenu')
    expect(el.className).toContain('border-teal/20')
    expect(el.className).toContain('rounded-2xl')
  })

  it('remplace la bordure par une ombre en variante surélevée', () => {
    render(<Card variant="elevated">contenu</Card>)
    const el = screen.getByText('contenu')
    expect(el.className).toContain('shadow-')
    expect(el.className).not.toContain('border-teal/20')
  })

  it('ne met aucun espacement interne par défaut', () => {
    // Beaucoup de cartes contiennent leurs propres sections bordées et gèrent
    // elles-mêmes leur espacement : en imposer un les casserait.
    render(<Card>contenu</Card>)
    expect(screen.getByText('contenu').className).not.toMatch(/(^|\s)p-\d/)
  })
})

describe('SectionHeader', () => {
  it('rend des majuscules espacées', () => {
    render(<SectionHeader>Équipe du culte</SectionHeader>)
    const el = screen.getByText('Équipe du culte')
    expect(el.className).toContain('uppercase')
    expect(el.className).toContain('tracking-widest')
  })

  it('éclaircit le texte sur fond sombre', () => {
    render(<SectionHeader tone="onDark">Administration</SectionHeader>)
    expect(screen.getByText('Administration').className).toContain('text-white/30')
  })
})

describe('Badge', () => {
  it('rend le ton orange utilisé pour « À pourvoir »', () => {
    render(<Badge tone="orange">À pourvoir</Badge>)
    const el = screen.getByText('À pourvoir')
    expect(el.className).toContain('bg-orange-100')
    expect(el.className).toContain('rounded-full')
  })

  it('expose les six tons sans en laisser un sans style', () => {
    for (const tone of ['teal', 'orange', 'green', 'red', 'amber', 'neutral'] as const) {
      cleanup()
      render(<Badge tone={tone}>x</Badge>)
      expect(screen.getByText('x').className).toMatch(/bg-/)
    }
  })
})

describe('EmptyState', () => {
  it('rend une ligne discrète en variante intégrée', () => {
    render(<EmptyState>Aucun bénévole</EmptyState>)
    expect(screen.getByText('Aucun bénévole').className).toContain('italic')
  })

  it('centre le message en variante bloc', () => {
    render(<EmptyState variant="block">Aucun service à venir.</EmptyState>)
    expect(screen.getByText('Aucun service à venir.').parentElement?.className).toContain('text-center')
  })
})

describe('IconButton', () => {
  // 33 boutons « × » existaient en 27 styles, et un bouton sans texte visible
  // est muet pour un lecteur d'écran s'il n'est pas nommé.
  it('expose le nom accessible fourni', () => {
    render(<IconButton aria-label="Retirer le bénévole">×</IconButton>)
    expect(screen.getByRole('button', { name: 'Retirer le bénévole' })).toBeInTheDocument()
  })

  it('nomme la fermeture par défaut, sans exiger de le répéter', () => {
    render(<CloseButton />)
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument()
  })

  it('accepte un nom de fermeture plus précis', () => {
    render(<CloseButton aria-label="Fermer l'aperçu" />)
    expect(screen.getByRole('button', { name: "Fermer l'aperçu" })).toBeInTheDocument()
  })

  it('conserve un indicateur de focus clavier', () => {
    render(<IconButton aria-label="Supprimer">×</IconButton>)
    expect(screen.getByRole('button', { name: 'Supprimer' }).className).toContain('focus-visible:ring-2')
  })
})
