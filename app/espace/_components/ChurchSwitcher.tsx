'use client'

import { useRef } from 'react'
import { setActiveChurch } from '../church-actions'

/** Sélecteur d'église, pour un compte rattaché à plusieurs églises. */
export function ChurchSwitcher({ churches, activeChurchId }: { churches: { id: string; name: string }[]; activeChurchId: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  return (
    <form ref={formRef} action={setActiveChurch}>
      <label className="sr-only" htmlFor="church-switcher">Église</label>
      <select
        id="church-switcher"
        name="church_id"
        defaultValue={activeChurchId}
        onChange={() => formRef.current?.requestSubmit()}
        className="w-full rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 font-sans text-xs text-white/80 focus:outline-none focus:ring-2 focus:ring-teal/40"
      >
        {churches.map(c => (
          <option key={c.id} value={c.id} className="text-dark">{c.name}</option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="mt-1 font-sans text-xs text-white/60 underline">Changer</button>
      </noscript>
    </form>
  )
}
