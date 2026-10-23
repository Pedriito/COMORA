/** Informations de la société et mode Stripe : fonctions pures, sans dépendance serveur (utilisées aussi par les scripts). */

/** Informations de la société imprimées sur les factures (renseignées quand elle existera). */
export function legalInfo() {
  const read = (name: string) => process.env[name]?.trim() ?? ''
  return { name: read('COMORA_LEGAL_NAME'), address: read('COMORA_LEGAL_ADDRESS'), siren: read('COMORA_LEGAL_SIREN') }
}

export function legalInfoComplete(): boolean {
  const { name, address, siren } = legalInfo()
  return !!(name && address && siren)
}

/** Mention portée sur chaque facture. */
export function invoiceFooter(): string {
  const { name, address, siren } = legalInfo()
  const base = 'TVA non applicable, art. 293 B du CGI'
  return name && address && siren ? `${base} — ${name}, ${address}, SIREN ${siren}` : base
}

export type StripeMode = 'test' | 'live'

export function stripeModeOf(key: string): StripeMode | null {
  return key.startsWith('sk_test_') || key.startsWith('rk_test_') ? 'test' : key.startsWith('sk_live_') || key.startsWith('rk_live_') ? 'live' : null
}

