'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV !== 'production') {
      // Ne pas l'enregistrer ne suffit pas : un worker installé lors d'une visite en
      // production sur le même origine (localhost) continue de contrôler la page et de
      // servir ses chunks `/_next/static/` en cache-first (voir public/sw.js). En dev,
      // Turbopack réutilise parfois la même URL de chunk après recompilation — on se
      // retrouve alors avec du code figé, et des exports qui paraissent `undefined`
      // alors que la source est correcte. On le retire activement, avec ses caches.
      navigator.serviceWorker.getRegistrations()
        .then(regs => Promise.all(regs.map(r => r.unregister())))
        .catch(() => { /* rien à désinstaller */ })
      if ('caches' in window) {
        caches.keys()
          .then(keys => Promise.all(keys.map(k => caches.delete(k))))
          .catch(() => { /* cache inaccessible (navigation privée) */ })
      }
      return
    }

    navigator.serviceWorker.register('/sw.js').catch(err =>
      console.error('[SW] Erreur enregistrement:', err)
    )
  }, [])
  return null
}
