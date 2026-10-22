'use client'

import { useActionState, useState } from 'react'
import { Field, inputClass, primaryButtonClass } from '@/components/account/fields'
import { PASSWORD_MIN } from '@/lib/church/signup'
import { sendMagicLink, signUpWithPassword, type SignupState } from './actions'

const initial: SignupState = { status: 'idle' }

type Mode = 'password' | 'magic'

export function SignupForm() {
  const [mode, setMode] = useState<Mode>('password')

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Méthode d’inscription" className="flex gap-1 rounded-full border border-moss-light bg-ink-card p-1">
        {([['password', 'Mot de passe'], ['magic', 'Lien par e-mail']] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={`h-10 flex-1 cursor-pointer rounded-full text-[15px] font-semibold transition-colors ${
              mode === value ? 'bg-sand text-ink' : 'text-mist hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'password' ? <PasswordForm /> : <MagicLinkForm />}
    </div>
  )
}

function Sent({ email, method }: { email: string; method: Mode }) {
  return (
    <div role="status" className="flex flex-col gap-4 text-center">
      <p className="text-[18px] leading-[1.5] font-semibold text-teal-pale">Vérifiez votre boîte mail</p>
      <p className="text-base leading-[1.6] text-mist">
        Nous avons envoyé {method === 'password' ? 'un lien de confirmation' : 'un lien de connexion'} à{' '}
        <strong className="text-sand">{email}</strong>. Cliquez dessus pour continuer : vous arriverez
        directement sur la création de l’espace de votre église.
      </p>
      <p className="text-[14px] leading-[1.5] text-mist-dark">
        Rien reçu au bout de quelques minutes ? Regardez dans vos courriers indésirables, puis recommencez avec la
        même adresse.
      </p>
    </div>
  )
}

function Identity({ state }: { state: SignupState }) {
  const error = state.status === 'error' ? state : null
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" id="first_name" error={error?.errors.firstName}>
          <input
            id="first_name" name="first_name" type="text" required maxLength={80} autoComplete="given-name"
            defaultValue={error?.values.firstName} className={inputClass}
            aria-invalid={error?.errors.firstName ? true : undefined}
            aria-describedby={error?.errors.firstName ? 'first_name-error' : undefined}
          />
        </Field>
        <Field label="Nom" id="last_name" error={error?.errors.lastName}>
          <input
            id="last_name" name="last_name" type="text" required maxLength={80} autoComplete="family-name"
            defaultValue={error?.values.lastName} className={inputClass}
            aria-invalid={error?.errors.lastName ? true : undefined}
            aria-describedby={error?.errors.lastName ? 'last_name-error' : undefined}
          />
        </Field>
      </div>
      <Field label="Adresse e-mail" id="email" error={error?.errors.email}>
        <input
          id="email" name="email" type="email" required maxLength={254} autoComplete="email"
          defaultValue={error?.values.email} className={inputClass}
          aria-invalid={error?.errors.email ? true : undefined}
          aria-describedby={error?.errors.email ? 'email-error' : undefined}
        />
      </Field>
    </>
  )
}

function FormMessage({ state }: { state: SignupState }) {
  return (
    <p role="alert" className="min-h-6 text-[15px] leading-[1.5] font-semibold text-coral-light">
      {state.status === 'error' ? state.message : null}
    </p>
  )
}

function PasswordForm() {
  const [state, action, pending] = useActionState(signUpWithPassword, initial)
  if (state.status === 'sent') return <Sent email={state.email} method="password" />
  const error = state.status === 'error' ? state : null

  return (
    <form action={action} className="flex flex-col gap-4">
      <Identity state={state} />
      <Field
        label="Mot de passe" id="password" error={error?.errors.password}
        hint={`${PASSWORD_MIN} caractères minimum, avec une minuscule, une majuscule et un chiffre.`}
      >
        <input
          id="password" name="password" type="password" required minLength={PASSWORD_MIN} maxLength={72}
          autoComplete="new-password" className={inputClass}
          aria-invalid={error?.errors.password ? true : undefined}
          aria-describedby={error?.errors.password ? 'password-error' : 'password-hint'}
        />
      </Field>
      <Field label="Confirmer le mot de passe" id="confirm" error={error?.errors.confirm}>
        <input
          id="confirm" name="confirm" type="password" required minLength={PASSWORD_MIN} maxLength={72}
          autoComplete="new-password" className={inputClass}
          aria-invalid={error?.errors.confirm ? true : undefined}
          aria-describedby={error?.errors.confirm ? 'confirm-error' : undefined}
        />
      </Field>
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? 'Création du compte…' : 'Créer mon compte'}
      </button>
      <FormMessage state={state} />
    </form>
  )
}

function MagicLinkForm() {
  const [state, action, pending] = useActionState(sendMagicLink, initial)
  if (state.status === 'sent') return <Sent email={state.email} method="magic" />

  return (
    <form action={action} className="flex flex-col gap-4">
      <Identity state={state} />
      <p className="text-[14px] leading-[1.5] text-mist-dark">
        Pas de mot de passe à retenir : nous vous envoyons un lien qui vous connecte directement.
      </p>
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? 'Envoi du lien…' : 'Recevoir mon lien de connexion'}
      </button>
      <FormMessage state={state} />
    </form>
  )
}
