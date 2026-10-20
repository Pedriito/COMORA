'use client'

import { useState, useTransition } from 'react'
import { createSong, updateSong, deleteSong } from './actions'
import { getEmbedUrl, getPlatformLabel } from '@/lib/videoEmbed'

type Arrangement = {
  id: string
  name: string
  chord_chart: string | null
  chord_chart_key: string | null
  youtube_url: string | null
  audio_url: string | null
}

type ImportedValues = {
  title:  string
  artist: string | null
  key:    string | null
  bpm:    number | null
  chart:  string
}

type Props = {
  mode: 'create' | 'edit'
  songId?: number
  arrangement?: Arrangement
  defaultValues?: { title: string }
  importedValues?: ImportedValues
}

export function SongForm({ mode, songId, arrangement, defaultValues, importedValues }: Props) {
  // Les valeurs importées priment sur les defaultValues
  const iv = importedValues
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDeleteTransition] = useTransition()
  const [youtubeUrl, setYoutubeUrl] = useState(arrangement?.youtube_url ?? '')
  const [youtubeError, setYoutubeError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      if (mode === 'create') await createSong(fd)
      else await updateSong(fd)
    })
  }

  function handleDelete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!confirm(`Supprimer ce chant définitivement ? Cette action est irréversible.`)) return
    const fd = new FormData(e.currentTarget)
    startDeleteTransition(async () => { await deleteSong(fd) })
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Champs cachés */}
        {mode === 'edit' && songId && (
          <input type="hidden" name="song_id" value={songId} />
        )}
        {mode === 'edit' && arrangement && (
          <input type="hidden" name="arrangement_id" value={arrangement.id} />
        )}

        {/* Titre */}
        <div>
          <label className="block font-sans text-sm text-dark/70 mb-1.5">Titre <span className="text-red-400">*</span></label>
          <input
            name="title"
            required
            defaultValue={iv?.title ?? defaultValues?.title ?? ''}
            placeholder="ex. Hosanna"
            className="w-full bg-white border border-teal/20 rounded-xl px-4 py-2.5 font-sans text-sm text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
        </div>

        {/* Nom de l'arrangement */}
        <div>
          <label className="block font-sans text-sm text-dark/70 mb-1.5">Nom de l'arrangement</label>
          <input
            name="arrangement_name"
            defaultValue={iv?.artist ?? arrangement?.name ?? 'Principal'}
            placeholder="Principal"
            className="w-full bg-white border border-teal/20 rounded-xl px-4 py-2.5 font-sans text-sm text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
          <p className="text-xs text-dark/35 font-sans mt-1">Laisse "Principal" si tu n'as qu'une version.</p>
        </div>

        {/* Tonalité */}
        <div>
          <label className="block font-sans text-sm text-dark/70 mb-1.5">Tonalité de base</label>
          <input
            name="chord_chart_key"
            defaultValue={iv?.key ?? arrangement?.chord_chart_key ?? ''}
            placeholder="ex. G, Am, Bb…"
            className="w-40 bg-white border border-teal/20 rounded-xl px-4 py-2.5 font-sans text-sm text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
        </div>

        {/* Paroles / accords */}
        <div>
          <label className="block font-sans text-sm text-dark/70 mb-1.5">Paroles et accords</label>
          <p className="text-xs text-dark/35 font-sans mb-2">
            Sections entre crochets : <code className="bg-teal/10 px-1 rounded text-teal">{"[Couplet 1]"}</code>.
            Lignes d'accords détectées automatiquement (Am G C…). Deux lignes de paroles = une diapo.
          </p>
          <textarea
            name="chord_chart"
            defaultValue={iv?.chart ?? arrangement?.chord_chart ?? ''}
            rows={20}
            placeholder={`[Couplet 1]\nAm       G\nLigne de paroles ici\nC        F\nDeuxième ligne ici\n\n[Refrain]\n...`}
            className="w-full bg-white border border-teal/20 rounded-xl px-4 py-3 font-mono text-sm text-dark placeholder:text-dark/20 focus:outline-none focus:ring-2 focus:ring-teal/30 resize-y"
          />
        </div>

        {/* YouTube */}
        <div>
          <label className="block font-sans text-sm text-dark/70 mb-1.5">Lien YouTube</label>
          <input
            name="youtube_url"
            value={youtubeUrl}
            onChange={e => { setYoutubeUrl(e.target.value); setYoutubeError(null) }}
            onBlur={() => {
              if (youtubeUrl.trim() && !getEmbedUrl(youtubeUrl.trim()))
                setYoutubeError('URL non reconnue — colle un lien YouTube ou Vimeo')
            }}
            placeholder="https://youtube.com/watch?v=…"
            className="w-full bg-white border border-teal/20 rounded-xl px-4 py-2.5 font-mono text-sm text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
          {youtubeError && <p className="text-xs text-red-500 mt-1">{youtubeError}</p>}
          {youtubeUrl.trim() && getEmbedUrl(youtubeUrl.trim()) && (
            <p className="text-xs text-teal/60 mt-1">✓ {getPlatformLabel(youtubeUrl.trim())} reconnu</p>
          )}
          <p className="text-xs text-dark/35 font-sans mt-1">Pour écouter le chant en répétition ou depuis la fiche.</p>
        </div>

        {/* Audio MP3 */}
        <div>
          <label className="block font-sans text-sm text-dark/70 mb-1.5">Lien audio (MP3)</label>
          <input
            name="audio_url"
            defaultValue={arrangement?.audio_url ?? ''}
            placeholder="https://drive.google.com/… ou Dropbox, SoundCloud…"
            className="w-full bg-white border border-teal/20 rounded-xl px-4 py-2.5 font-mono text-sm text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
          <p className="text-xs text-dark/35 font-sans mt-1">Lien direct vers un fichier MP3 accessible publiquement.</p>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 bg-teal hover:bg-teal-dark disabled:opacity-50 text-white rounded-xl font-sans text-sm font-semibold transition-colors"
        >
          {isPending ? 'Enregistrement…' : mode === 'create' ? '+ Créer le chant' : '✓ Enregistrer les modifications'}
        </button>
      </form>

      {/* Suppression */}
      {mode === 'edit' && songId && (
        <form onSubmit={handleDelete}>
          <input type="hidden" name="song_id" value={songId} />
          <button
            type="submit"
            disabled={isDeleting}
            className="w-full py-2.5 border border-red-200 text-red-400 hover:bg-red-50 disabled:opacity-50 rounded-xl font-sans text-sm transition-colors"
          >
            {isDeleting ? 'Suppression…' : '🗑 Supprimer ce chant'}
          </button>
        </form>
      )}
    </div>
  )
}
