'use client'

import { useState, useTransition, useRef } from 'react'
import Image from 'next/image'
import { saveChurchSettings } from './actions'
import type { ChurchSettings } from '@/lib/churchSettings'

export default function SiteSettingsForm({ initial }: { initial: ChurchSettings }) {
  const [isDirty, setIsDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setSaved(false)
    setError(null)
    startTransition(async () => {
      const res = await saveChurchSettings(fd)
      if (res.ok) {
        setSaved(true)
        setIsDirty(false)
      } else {
        setError(res.error ?? 'Erreur inconnue')
      }
    })
  }

  return (
    <>
      <form onSubmit={handleSubmit} onChange={() => setIsDirty(true)} className="space-y-6">

        {/* Infos générales */}
        <div className="bg-white rounded-2xl border border-teal/20 p-6 space-y-4">
          <p className="font-sans text-xs text-dark/40 uppercase tracking-widest">Infos générales</p>
          <Field label="Nom de l'église" name="church_name" defaultValue={initial.church_name} />
          <Field label="Phrase d'accroche" name="tagline" defaultValue={initial.tagline} />
          <Field label="Noms des pasteurs" name="pastors_names" defaultValue={initial.pastors_names} />

          {/* Photo des pasteurs */}
          <input type="hidden" name="pastors_photo_url" value={initial.pastors_photo_url} />
          <div className="space-y-2">
            <label className="font-sans text-xs text-dark/50">Photo des pasteurs</label>
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 rounded-xl bg-coral/15 border border-teal/10 flex items-center justify-center overflow-hidden shrink-0">
                {(photoPreview ?? initial.pastors_photo_url) ? (
                  <Image
                    src={photoPreview ?? initial.pastors_photo_url}
                    alt="Photo pasteurs"
                    fill
                    unoptimized
                    sizes="64px"
                    className="object-cover"
                  />
                ) : (
                  <svg className="w-7 h-7 text-coral/50" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                  </svg>
                )}
              </div>
              <div className="space-y-1.5">
                <input
                  ref={fileRef}
                  name="pastors_photo_file"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) {
                      setPhotoPreview(URL.createObjectURL(f))
                      setIsDirty(true)
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg border border-teal/20 font-sans text-xs text-dark/60 hover:bg-teal/5"
                >
                  Changer la photo…
                </button>
                {photoPreview && (
                  <p className="font-sans text-[11px] text-teal">Nouvelle photo sélectionnée — sera uploadée à l'enregistrement</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Adresse */}
        <div className="bg-white rounded-2xl border border-teal/20 p-6 space-y-4">
          <p className="font-sans text-xs text-dark/40 uppercase tracking-widest">Adresse</p>
          <Field label="Rue" name="address_street" defaultValue={initial.address_street} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Code postal" name="address_zip" defaultValue={initial.address_zip} />
            <Field label="Ville" name="address_city" defaultValue={initial.address_city} />
          </div>
          <Field label="Département" name="address_dept" defaultValue={initial.address_dept} />
          <Field label="Lien Google Maps" name="maps_url" defaultValue={initial.maps_url} type="url" />
        </div>

        {/* Contact & réseaux */}
        <div className="bg-white rounded-2xl border border-teal/20 p-6 space-y-4">
          <p className="font-sans text-xs text-dark/40 uppercase tracking-widest">Contact & réseaux</p>
          <Field label="Email de contact" name="email" defaultValue={initial.email} type="email" />
          <Field label="URL YouTube" name="youtube_url" defaultValue={initial.youtube_url} type="url" />
          <Field
            label="ID de la chaîne YouTube (optionnel)"
            name="youtube_channel_id"
            defaultValue={initial.youtube_channel_id ?? ''}
            hint="UCxxxxxxxxxxxxxxx — trouvable dans l'URL de ta chaîne. Permet l'affichage auto des dernières vidéos sur le site."
          />
        </div>


        {saved && (
          <p className="font-sans text-sm text-green-600 px-1">✓ Modifications enregistrées</p>
        )}
        {error && (
          <p className="font-sans text-sm text-red-500 px-1">{error}</p>
        )}

        {/* Sticky bottom save bar */}
        <div className={`fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-teal/20 px-6 py-3 flex items-center justify-between transition-all duration-200 ${isDirty ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500"/>
            <p className="font-sans text-xs text-dark/60">Modifications non enregistrées</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setIsDirty(false); window.location.reload() }}
              className="font-sans text-sm text-dark/60 hover:text-dark transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 rounded-xl bg-teal text-white font-sans text-sm font-medium hover:bg-teal/90 disabled:opacity-40 transition-colors"
            >
              {isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

function Field({
  label, name, defaultValue, type = 'text', hint,
}: {
  label: string; name: string; defaultValue: string; type?: string; hint?: string
}) {
  return (
    <div className="space-y-1">
      <label className="font-sans text-xs text-dark/50">{label}</label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoComplete="off"
        className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm font-sans text-dark placeholder:text-dark/30 focus:outline-none focus:border-teal/50"
      />
      {hint && <p className="font-sans text-[11px] text-dark/35">{hint}</p>}
    </div>
  )
}
