'use client'

import { useState } from 'react'
import { SongForm } from './SongForm'
import { SongImport } from './SongImport'

type ImportedSong = {
  title:  string
  artist: string | null
  key:    string | null
  bpm:    number | null
  chart:  string
}

export function NewSongForm() {
  const [imported, setImported] = useState<ImportedSong | null>(null)
  const [formKey, setFormKey]   = useState(0)  // force re-mount après import

  function handleImport(song: ImportedSong) {
    setImported(song)
    setFormKey(k => k + 1)
  }

  return (
    <div className="space-y-4">
      {/* Bouton import shir.fr */}
      <div className="flex items-center gap-3 flex-wrap">
        <SongImport onImport={handleImport} />
        {imported && (
          <span className="font-sans text-xs text-teal/70">
            ✓ « {imported.title} » importé — vérifie et enregistre
          </span>
        )}
      </div>

      {/* Formulaire (re-monté avec les valeurs importées) */}
      <div className="bg-white rounded-2xl border border-teal/20 p-6">
        <SongForm
          key={formKey}
          mode="create"
          importedValues={imported ?? undefined}
        />
      </div>
    </div>
  )
}
