'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { deleteMediaFile, searchUnsplash, importUnsplashPhoto } from './actions'
import type { UnsplashPhoto, MediaFile } from './actions'

type Props = { initial: MediaFile[] }

type Tab = 'library' | 'unsplash'

export default function MediaLibrary({ initial }: Props) {
  const [tab, setTab]             = useState<Tab>('library')
  const [files, setFiles]         = useState<MediaFile[]>(initial)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [copiedId, setCopiedId]   = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Unsplash
  const [query, setQuery]               = useState('')
  const [results, setResults]           = useState<UnsplashPhoto[]>([])
  const [searching, setSearching]       = useState(false)
  const [searchError, setSearchError]   = useState<string | null>(null)
  const [importing, setImporting]       = useState<string | null>(null)  // photo.id en cours
  const [importedIds, setImportedIds]   = useState<Set<string>>(new Set())

  // ── Upload manuel ──────────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    if (selected.length === 0) return

    const images = selected.filter((f) => f.type.startsWith('image/'))
    if (images.length === 0) {
      setUploadError('Seules les images (JPEG, PNG, WebP, GIF) sont acceptées.')
      return
    }

    setUploadError(null)
    setUploading(true)

    const supabase = createClient()

    for (const file of images) {
      const safeName = file.name.replace(/\s+/g, '_')
      const path = `${Date.now()}-${safeName}`

      const { error: storageError } = await supabase.storage
        .from('media')
        .upload(path, file)

      if (storageError) {
        setUploadError(`Erreur lors de l'upload de ${file.name} : ${storageError.message}`)
        continue
      }

      const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)
      const publicUrl = urlData.publicUrl

      const { data: inserted, error: dbError } = await supabase
        .from('media_files')
        .insert({ name: file.name, type: 'image', storage_path: path, url: publicUrl })
        .select('id, name, url, created_at')
        .single()

      if (dbError) {
        setUploadError(`Fichier uploadé mais erreur en base : ${dbError.message}`)
        continue
      }

      if (inserted) setFiles((prev) => [inserted as MediaFile, ...prev])
    }

    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleCopy(file: MediaFile) {
    try {
      await navigator.clipboard.writeText(file.url)
      setCopiedId(file.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch { /* ignore */ }
  }

  async function handleDelete(file: MediaFile) {
    await deleteMediaFile(file.id, file.url)
    setFiles((prev) => prev.filter((f) => f.id !== file.id))
  }

  // ── Unsplash ───────────────────────────────────────────────────────────────
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setSearchError(null)
    setResults([])
    try {
      const res = await searchUnsplash(query.trim())
      setResults(res)
      if (res.length === 0) setSearchError('Aucun résultat pour cette recherche.')
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setSearching(false)
    }
  }

  async function handleImport(photo: UnsplashPhoto) {
    setImporting(photo.id)
    try {
      const newFile = await importUnsplashPhoto(photo)
      setFiles((prev) => [newFile, ...prev])
      setImportedIds((prev) => new Set([...prev, photo.id]))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de l\'import')
    } finally {
      setImporting(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="font-sans space-y-6">

      {/* Onglets */}
      <div className="flex gap-1 bg-white border border-teal/20 rounded-xl p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab('library')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'library'
              ? 'bg-teal text-white shadow-sm'
              : 'text-dark/50 hover:text-dark'
          }`}
        >
          Ma médiathèque
        </button>
        <button
          type="button"
          onClick={() => setTab('unsplash')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
            tab === 'unsplash'
              ? 'bg-teal text-white shadow-sm'
              : 'text-dark/50 hover:text-dark'
          }`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 32 32" fill="currentColor">
            <path d="M10 9V0h12v9H10zm12 5h10v18H0V14h10v9h12v-9z"/>
          </svg>
          Unsplash
        </button>
      </div>

      {/* ── Onglet Ma médiathèque ── */}
      {tab === 'library' && (
        <>
          {/* Zone d'upload */}
          <div className="flex flex-col items-center gap-3">
            <label className="flex flex-col items-center justify-center w-full max-w-md h-36 border-2 border-dashed border-teal-400 rounded-xl bg-teal-50 hover:bg-teal-100 transition-colors cursor-pointer">
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-2 text-teal-700">
                  <svg className="animate-spin h-8 w-8 text-teal-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span className="text-sm font-medium">Upload en cours…</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-teal-700">
                  <svg className="h-8 w-8 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4m0 0L8 8m4-4l4 4" />
                  </svg>
                  <span className="text-sm font-semibold">Cliquez pour importer des images</span>
                  <span className="text-xs text-teal-500">JPEG, PNG, WebP, GIF</span>
                </div>
              )}
            </label>
            {uploadError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 max-w-md w-full">
                {uploadError}
              </p>
            )}
          </div>

          {/* Grille */}
          {files.length === 0 ? (
            <p className="text-center text-dark/30 py-12 text-sm">
              Aucune image pour l'instant. Importez votre première image ou cherchez sur Unsplash.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="group relative bg-white rounded-xl overflow-hidden shadow-sm border border-teal/10 hover:shadow-md transition-shadow"
                >
                  <button
                    type="button"
                    onClick={() => handleCopy(file)}
                    className="relative block w-full aspect-square focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 focus-visible:ring-offset-2"
                    title="Cliquer pour copier l'URL"
                  >
                    <Image src={file.url} alt={file.name} fill sizes="(max-width:640px) 33vw, 25vw" className="object-cover" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs font-semibold bg-black/50 rounded px-2 py-1">
                        {copiedId === file.id ? '✓ Copié' : 'Copier l\'URL'}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(file)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    title="Supprimer"
                  >
                    ×
                  </button>
                  <div className="px-2 py-1.5">
                    <p className="text-xs text-dark/50 truncate" title={file.name}>{file.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Onglet Unsplash ── */}
      {tab === 'unsplash' && (
        <div className="space-y-5">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="culte, église, adoration, croix…"
              className="flex-1 border border-teal/20 rounded-xl px-4 py-2.5 text-sm font-sans text-dark placeholder:text-dark/30 focus:outline-none focus:border-teal/60 bg-white"
            />
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="bg-teal text-white font-sans text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-teal/90 disabled:opacity-40 transition-colors"
            >
              {searching ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : 'Rechercher'}
            </button>
          </form>

          {searchError && (
            <p className="text-sm text-dark/40 text-center py-4">{searchError}</p>
          )}

          {results.length > 0 && (
            <>
              <p className="text-xs text-dark/30 font-sans">
                Photos par{' '}
                <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-dark/60">
                  Unsplash
                </a>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {results.map((photo) => {
                  const isImported = importedIds.has(photo.id)
                  const isImporting = importing === photo.id
                  return (
                    <div
                      key={photo.id}
                      className="group relative bg-white rounded-xl overflow-hidden shadow-sm border border-teal/10 hover:shadow-md transition-shadow"
                    >
                      <Image
                        src={photo.urls.small}
                        alt={photo.description ?? photo.alt_description ?? ''}
                        fill
                        sizes="(max-width:640px) 33vw, 25vw"
                        className="aspect-square object-cover"
                      />
                      {/* Overlay import */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        {isImported ? (
                          <span className="text-white text-xs font-semibold bg-teal/80 rounded-lg px-3 py-1.5">
                            ✓ Importée
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleImport(photo)}
                            disabled={isImporting}
                            className="text-white text-xs font-semibold bg-black/60 hover:bg-teal/80 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                          >
                            {isImporting ? (
                              <span className="flex items-center gap-1.5">
                                <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                                Import…
                              </span>
                            ) : '+ Importer'}
                          </button>
                        )}
                      </div>
                      {/* Auteur */}
                      <div className="px-2 py-1.5">
                        <p className="text-xs text-dark/40 truncate">{photo.user.name}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {!searching && results.length === 0 && !searchError && (
            <div className="text-center py-16 text-dark/50 text-sm">
              <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              Recherchez des photos libres de droits
            </div>
          )}
        </div>
      )}
    </div>
  )
}
