'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { saveSermonRecord, deleteSermon } from './sermon-actions'

export type Sermon = { id: string; title: string; url: string; storage_path: string; created_at: string }

type Props = { planId: string; initial: Sermon[]; canManage: boolean }

export default function SermonSection({ planId, initial, canManage }: Props) {
  const [sermons, setSermons]   = useState<Sermon[]>(initial)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [title, setTitle]       = useState('Prédication')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      setUploadError('Seuls les fichiers PDF sont acceptés.')
      return
    }
    setUploadError(null)
    setUploading(true)

    const safeName = file.name
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[''`´]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `sermons/${planId}/${Date.now()}-${safeName}`

    // 1. Upload du fichier directement depuis le client (Storage)
    const supabase = createClient()
    const { error: storageError } = await supabase.storage.from('media').upload(path, file)
    if (storageError) { setUploadError(storageError.message); setUploading(false); return }

    const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)

    // 2. Insertion en base via server action admin (bypass RLS)
    const result = await saveSermonRecord(planId, title.trim() || 'Prédication', path, urlData.publicUrl)
    if (!result.ok) { setUploadError(result.error); setUploading(false); return }
    setSermons(prev => [...prev, result.sermon])

    setUploading(false)
    setTitle('Prédication')
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleDelete(sermon: Sermon) {
    await deleteSermon(sermon.id, planId, sermon.storage_path)
    setSermons(prev => prev.filter(s => s.id !== sermon.id))
  }

  return (
    <div className="space-y-3">
      {sermons.length === 0 && (
        <p className="font-sans text-xs text-dark/30 italic px-1">Aucun PDF de prédication pour ce culte.</p>
      )}

      {sermons.map(sermon => (
        <div key={sermon.id} className="bg-white rounded-xl border border-teal/20 flex items-center gap-3 px-4 py-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-sans text-sm text-dark font-medium truncate">{sermon.title}</p>
            <a href={sermon.url} target="_blank" rel="noopener noreferrer"
              className="font-sans text-xs text-teal/70 hover:text-teal truncate block">
              Voir le PDF ↗
            </a>
          </div>
          {canManage && (
            <button onClick={() => handleDelete(sermon)}
              className="text-dark/25 hover:text-red-400 transition-colors font-sans text-lg leading-none shrink-0">
              ×
            </button>
          )}
        </div>
      ))}

      {canManage && (
        <div className="space-y-2">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Titre (ex : Prédication)"
            className="w-full border border-teal/20 rounded-xl px-4 py-2.5 text-sm font-sans text-dark placeholder:text-dark/30 focus:outline-none focus:border-teal/50 bg-white"
          />
          <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl transition-colors cursor-pointer ${uploading ? 'border-teal/30 bg-teal/5' : 'border-teal/30 bg-white hover:bg-teal/5 hover:border-teal/50'}`}>
            <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFile} disabled={uploading} />
            {uploading ? (
              <div className="flex items-center gap-2 text-teal/70">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                <span className="font-sans text-sm">Upload en cours…</span>
              </div>
            ) : (
              <div className="text-center">
                <p className="font-sans text-sm text-dark/50 font-medium">Cliquez pour importer un PDF</p>
                <p className="font-sans text-xs text-dark/30 mt-0.5">Présentation de prédication</p>
              </div>
            )}
          </label>
          {uploadError && (
            <p className="text-sm text-red-500 font-sans">{uploadError}</p>
          )}
        </div>
      )}
    </div>
  )
}
