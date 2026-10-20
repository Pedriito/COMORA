'use client'

export function PrintActions() {
  return (
    <div className="no-print">
      <button className="btn" onClick={() => window.print()}>
        🖨 Imprimer / Enregistrer PDF
      </button>
      <button className="btn" onClick={() => window.close()}>
        × Fermer
      </button>
    </div>
  )
}
