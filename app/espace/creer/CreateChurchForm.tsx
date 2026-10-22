'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { Field, inputClass, primaryButtonClass } from '@/components/account/fields'
import { COUNTRIES, SIZE_BRACKETS } from '@/lib/church/options'
import { slugify, SLUG_MAX } from '@/lib/church/slug'
import { LEGAL_DOCUMENTS } from '@/lib/legal'
import { checkSlug, createChurchSpace, type CreateChurchState, type SlugCheck } from './actions'

const initial: CreateChurchState = { status: 'idle' }

/** Délai avant de vérifier l'adresse : on attend que la saisie se calme. */
const CHECK_DELAY_MS = 400

type CheckState = SlugCheck | { state: 'idle' } | { state: 'checking' }

export function CreateChurchForm({ rootDomain }: { rootDomain: string }) {
  const [state, action, pending] = useActionState(createChurchSpace, initial)
  const error = state.status === 'error' ? state : null

  // Tous les champs sont contrôlés : React vide les champs non contrôlés après chaque envoi,
  // et une saisie refusée (case oubliée, adresse prise) ne doit jamais faire tout retaper.
  const [name, setName] = useState(error?.values.name ?? '')
  const [city, setCity] = useState(error?.values.city ?? '')
  const [country, setCountry] = useState<string>(error?.values.country || 'FR')
  const [size, setSize] = useState(error?.values.size ?? '')
  const [accept, setAccept] = useState(error?.values.accept ?? false)
  const [slug, setSlug] = useState(error?.values.slug ?? '')
  // Tant que la personne n'a pas modifié l'adresse à la main, elle suit le nom
  const slugEdited = useRef(Boolean(error?.values.slug))
  const [check, setCheck] = useState<CheckState>({ state: 'idle' })
  const requestId = useRef(0)

  useEffect(() => {
    if (!slug) { setCheck({ state: 'idle' }); return }
    setCheck({ state: 'checking' })
    const id = ++requestId.current
    const timer = setTimeout(async () => {
      const result = await checkSlug(slug)
      // Une réponse tardive ne doit pas écraser celle d'une saisie plus récente
      if (id === requestId.current) setCheck(result)
    }, CHECK_DELAY_MS)
    return () => clearTimeout(timer)
  }, [slug])

  const slugProblem = error?.errors.slug ?? (check.state === 'invalid' || check.state === 'taken' ? check.message : undefined)
  const slugOk = check.state === 'available' && !error?.errors.slug

  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label="Nom de l’église" id="name" error={error?.errors.name}>
        <input
          id="name" name="name" type="text" required maxLength={160} autoComplete="organization"
          value={name} placeholder="Église de la Source" className={inputClass}
          onChange={(e) => {
            setName(e.target.value)
            if (!slugEdited.current) setSlug(slugify(e.target.value))
          }}
          aria-invalid={error?.errors.name ? true : undefined}
          aria-describedby={error?.errors.name ? 'name-error' : undefined}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Ville" id="city" error={error?.errors.city}>
          <input
            id="city" name="city" type="text" required maxLength={100} autoComplete="address-level2"
            value={city} onChange={(e) => setCity(e.target.value)} className={inputClass}
            aria-invalid={error?.errors.city ? true : undefined}
            aria-describedby={error?.errors.city ? 'city-error' : undefined}
          />
        </Field>
        <Field label="Pays" id="country" error={error?.errors.country}>
          <select id="country" name="country" required value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass}>
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Taille de l’église" id="size" error={error?.errors.size}>
        <select id="size" name="size" required value={size} onChange={(e) => setSize(e.target.value)} className={inputClass}
          aria-invalid={error?.errors.size ? true : undefined}
          aria-describedby={error?.errors.size ? 'size-error' : undefined}>
          <option value="" disabled>Choisir…</option>
          {SIZE_BRACKETS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </Field>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="slug" className="text-[14px] font-semibold text-mist">Adresse de votre église</label>
        <div className="flex items-stretch">
          <input
            id="slug" name="slug" type="text" required minLength={3} maxLength={SLUG_MAX} spellCheck={false}
            autoCapitalize="none" autoComplete="off" value={slug}
            onChange={(e) => { slugEdited.current = true; setSlug(e.target.value.toLowerCase()) }}
            className={`${inputClass} rounded-r-none border-r-0`}
            aria-invalid={slugProblem ? true : undefined}
            aria-describedby="slug-status"
          />
          <span className="flex items-center rounded-r-xl border border-moss-light bg-ink px-3.5 text-[15px] text-mist-dark">
            .{rootDomain}
          </span>
        </div>
        <p
          id="slug-status" role="status" aria-live="polite"
          className={`min-h-5 text-[14px] ${slugProblem ? 'font-semibold text-coral-light' : slugOk ? 'font-semibold text-teal-pale' : 'text-mist-dark'}`}
        >
          {slugProblem ?? (check.state === 'checking' ? 'Vérification…' : slugOk ? `${slug}.${rootDomain} est disponible.` : 'Proposée à partir du nom, vous pouvez la modifier.')}
          {check.state === 'taken' && check.suggestion && !error?.errors.slug && (
            <>
              {' '}
              <button type="button" className="cursor-pointer underline underline-offset-2" onClick={() => { slugEdited.current = true; setSlug(check.suggestion!) }}>
                Utiliser {check.suggestion}
              </button>
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-[1.5] text-mist">
          <input
            type="checkbox" name="accept" required checked={accept} onChange={(e) => setAccept(e.target.checked)}
            className="mt-1 size-5 flex-none cursor-pointer accent-coral"
            aria-invalid={error?.errors.accept ? true : undefined}
            aria-describedby={error?.errors.accept ? 'accept-error' : undefined}
          />
          <span>
            J’ai lu et j’accepte les{' '}
            <Link href={LEGAL_DOCUMENTS.cgv.path} target="_blank" className="font-semibold text-sand underline underline-offset-2">conditions générales de vente</Link>
            {' '}et la{' '}
            <Link href={LEGAL_DOCUMENTS.confidentialite.path} target="_blank" className="font-semibold text-sand underline underline-offset-2">politique de confidentialité</Link>.
          </span>
        </label>
        {error?.errors.accept && <p id="accept-error" role="alert" className="text-[14px] font-semibold text-coral-light">{error.errors.accept}</p>}
      </div>

      <button type="submit" disabled={pending || check.state === 'taken' || check.state === 'invalid'} className={primaryButtonClass}>
        {pending ? 'Création de votre espace…' : 'Créer l’espace de mon église'}
      </button>
      <p role="alert" className="min-h-6 text-[15px] leading-[1.5] font-semibold text-coral-light">{error?.message}</p>
    </form>
  )
}
