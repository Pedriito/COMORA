'use client'

import { useEffect, useState } from 'react'

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null)
  const [showIos, setShowIos]               = useState(false)
  const [dismissed, setDismissed]           = useState(false)

  useEffect(() => {
    // Déjà installée en standalone → on ne montre rien
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // Déjà fermé dans cette session
    if (sessionStorage.getItem('pwa-dismissed')) { setDismissed(true); return }

    // iOS Safari (pas de beforeinstallprompt sur iOS)
    const ua = navigator.userAgent
    if (/iphone|ipad|ipod/i.test(ua) && !(navigator as any).standalone) {
      setShowIos(true)
    }

    // Chrome / Brave / Edge
    function onBeforeInstall(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  function install() {
    if (!deferredPrompt) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prompt = deferredPrompt as any
    prompt.prompt()
    prompt.userChoice.then(() => { setDeferredPrompt(null); setDismissed(true) })
  }

  function dismiss() {
    sessionStorage.setItem('pwa-dismissed', '1')
    setDismissed(true)
    setShowIos(false)
    setDeferredPrompt(null)
  }

  if (dismissed) return null

  // ── Chromium (Brave, Chrome, Edge) ─────────────────────────────────────────
  if (deferredPrompt) return (
    <div className="fixed bottom-[calc(88px_+_env(safe-area-inset-bottom, 0px))] lg:bottom-4 left-4 right-4 z-50 bg-dark text-white rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3 lg:left-56 lg:right-auto lg:max-w-sm">
      <span className="text-xl shrink-0">📲</span>
      <div className="flex-1 min-w-0">
        <p className="font-sans text-sm font-semibold leading-tight">Installer l'appli bénévoles</p>
        <p className="font-sans text-xs text-white/50 mt-0.5">Accès direct depuis votre écran d'accueil</p>
      </div>
      <button
        onClick={install}
        className="shrink-0 bg-teal hover:bg-teal/80 text-white px-3 py-1.5 rounded-lg font-sans text-xs font-semibold transition-colors"
      >
        Installer
      </button>
      <button onClick={dismiss} aria-label="Fermer" className="text-white/30 hover:text-white transition-colors shrink-0 leading-none text-lg">✕</button>
    </div>
  )

  // ── iOS Safari ──────────────────────────────────────────────────────────────
  if (showIos) return (
    <div className="fixed bottom-[calc(88px_+_env(safe-area-inset-bottom, 0px))] lg:bottom-4 left-4 right-4 z-50 bg-dark text-white rounded-2xl px-4 py-3 shadow-2xl flex items-start gap-3 lg:left-56 lg:right-auto lg:max-w-sm">
      <span className="text-xl shrink-0 mt-0.5">📲</span>
      <div className="flex-1 min-w-0">
        <p className="font-sans text-sm font-semibold leading-tight">Installer l'appli bénévoles</p>
        <p className="font-sans text-xs text-white/50 mt-1 leading-relaxed">
          Tap <span className="text-white/80 font-medium">Partager</span> <span className="text-white/40">⎋</span> → <span className="text-white/80 font-medium">Sur l'écran d'accueil</span>
        </p>
      </div>
      <button onClick={dismiss} className="text-white/30 hover:text-white transition-colors shrink-0 leading-none text-lg mt-0.5">✕</button>
    </div>
  )

  return null
}
