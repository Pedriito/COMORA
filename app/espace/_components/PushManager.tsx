'use client'

import { useEffect, useRef, useState } from 'react'
import { savePushSubscription, deletePushSubscription, sendTestPush } from '../push-actions'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

function vapidKeyMatchesSub(sub: PushSubscription): boolean {
  const subKey = sub.options?.applicationServerKey
  // Sur iOS, applicationServerKey peut être null → impossible de vérifier → on désinscrit par sécurité
  if (!subKey) return false
  const expected = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  const actual   = new Uint8Array(subKey as ArrayBuffer)
  return expected.length === actual.length && expected.every((b, i) => b === actual[i])
}

// iOS coupe la "user gesture chain" après un dialog natif (requestPermission).
// pushManager.subscribe() doit être appelé avec ZÉRO await préalable.
// Stratégie :
//   - useEffect : pré-cache reg, nettoie les vieilles subscriptions (pas de contrainte de geste)
//   - tap 1     : requestPermission() uniquement → status = 'permission_only'
//   - tap 2     : reg.pushManager.subscribe() sans aucun await avant (geste direct)

type Status = 'loading' | 'unsupported' | 'denied' | 'permission_only' | 'subscribed' | 'unsubscribed'

type Props = { variant?: 'toggle' }

export function PushManager({ variant }: Props = {}) {
  const [status, setStatus]       = useState<Status>('loading')
  const [endpoint, setEndpoint]   = useState<string | null>(null)
  const [testSent, setTestSent]   = useState(false)
  const [isPending, setIsPending] = useState(false)
  const regRef = useRef<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported'); return
    }
    if (Notification.permission === 'denied') {
      setStatus('denied'); return
    }

    // Affichage immédiat sans attendre le SW — état dérivé de permission + localStorage
    if (localStorage.getItem('push_subscribed') === '1') {
      setStatus('subscribed')
    } else {
      setStatus(Notification.permission === 'granted' ? 'permission_only' : 'unsubscribed')
    }

    // Validation en arrière-plan : pré-cache reg et nettoie les vieilles subscriptions
    navigator.serviceWorker.ready.then(async (reg) => {
      regRef.current = reg
      const sub = await reg.pushManager.getSubscription()

      if (!sub) {
        localStorage.removeItem('push_subscribed')
        setStatus(prev => prev === 'subscribed'
          ? (Notification.permission === 'granted' ? 'permission_only' : 'unsubscribed')
          : prev)
        return
      }

      const keyOk = vapidKeyMatchesSub(sub)
      if (!keyOk) {
        await sub.unsubscribe()
        localStorage.removeItem('push_subscribed')
        setStatus(Notification.permission === 'granted' ? 'permission_only' : 'unsubscribed')
        return
      }

      localStorage.setItem('push_subscribed', '1')
      setEndpoint(sub.endpoint)
      setStatus('subscribed')
    }).catch(() => { /* SW indisponible, on garde l'état courant */ })
  }, [])

  async function requestPermission() {
    // Tap 1 : uniquement la permission, rien d'autre
    setIsPending(true)
    try {
      const perm = await Notification.requestPermission()
      setStatus(perm === 'granted' ? 'permission_only' : 'denied')
    } finally {
      setIsPending(false)
    }
  }

  function subscribe() {
    const reg = regRef.current
    if (!reg) {
      console.error('[push] SW reg non disponible')
      return
    }

    setIsPending(true)
    const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer

    // Re-appel requestPermission() même si déjà 'granted' :
    // → retourne immédiatement (pas de dialog natif, pas de coupure de gesture chain)
    // → rafraîchit l'état push interne d'iOS qui peut se désynchroniser
    Notification.requestPermission()
      .then(perm => {
        if (perm !== 'granted') return Promise.reject(Object.assign(new Error('permission denied'), { name: 'NotAllowedError' }))
        return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
      })
      .then(async (sub) => {
        const json = sub.toJSON()
        console.log('[push] subscribed:', json.endpoint?.slice(0, 60))
        await savePushSubscription({
          endpoint: json.endpoint!,
          p256dh:   (json.keys as Record<string, string>).p256dh,
          auth:     (json.keys as Record<string, string>).auth,
        })
        localStorage.setItem('push_subscribed', '1')
        setEndpoint(json.endpoint!)
        setStatus('subscribed')
      })
      .catch((e: Error) => {
        console.error('[push] subscribe error:', e.name, e.message,
          '| permission:', Notification.permission,
          '| standalone:', (navigator as unknown as { standalone?: boolean }).standalone ?? 'n/a')
        if (e.name === 'NotAllowedError') setStatus('denied')
      })
      .finally(() => setIsPending(false))
  }

  async function unsubscribe() {
    setIsPending(true)
    try {
      const reg = regRef.current ?? await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        if (endpoint) await deletePushSubscription(endpoint)
      }
      localStorage.removeItem('push_subscribed')
      setEndpoint(null)
      setStatus('unsubscribed')
    } finally {
      setIsPending(false)
    }
  }

  async function test() {
    setIsPending(true)
    try {
      const result = await sendTestPush()
      console.log('[push] test result:', result)
      if (result.ok) {
        setTestSent(true)
        setTimeout(() => setTestSent(false), 3000)
      } else {
        console.warn('[push] sendTestPush ok:false — voir logs serveur')
      }
    } catch (e) {
      console.error('[push] test error:', e)
    } finally {
      setIsPending(false)
    }
  }

  if (variant === 'toggle') {
    if (status === 'loading') {
      return <div className="w-11 h-6 rounded-full bg-dark/10 animate-pulse shrink-0" />
    }
    if (status === 'unsupported') {
      return <span className="font-sans text-[11px] text-dark/35 shrink-0 text-right leading-snug">Installer<br />l&apos;app</span>
    }
    if (status === 'denied') {
      return <span className="font-sans text-[11px] text-dark/35 shrink-0">Bloquées</span>
    }

    const thumbStyle = (on: boolean): React.CSSProperties => ({
      position: 'absolute',
      top: 3, left: 3,
      width: 25, height: 25,
      borderRadius: '50%',
      background: 'white',
      boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
      transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      transform: on ? 'translateX(20px)' : 'translateX(0)',
    })

    if (status === 'permission_only') {
      return (
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            onClick={subscribe}
            disabled={isPending}
            aria-label="Confirmer l'activation"
            style={{ position: 'relative', width: 51, height: 31, borderRadius: 999, background: '#f59e0b', border: 'none', cursor: 'pointer', opacity: isPending ? 0.5 : 1 }}
          >
            <span style={thumbStyle(true)} />
          </button>
          <span className="font-sans text-[9px] text-amber-500 font-medium">Confirmer →</span>
        </div>
      )
    }

    const isOn = status === 'subscribed'
    return (
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <button
          onClick={isOn ? unsubscribe : requestPermission}
          disabled={isPending}
          aria-label={isOn ? 'Désactiver les notifications' : 'Activer les notifications'}
          style={{
            position: 'relative', width: 51, height: 31, borderRadius: 999,
            background: isOn ? 'var(--color-teal)' : 'rgba(0,0,0,0.15)',
            border: 'none', cursor: 'pointer',
            transition: 'background 0.3s',
            opacity: isPending ? 0.5 : 1,
          }}
        >
          <span style={thumbStyle(isOn)} />
        </button>
        {isOn && (
          <button
            onClick={test}
            disabled={isPending}
            className="font-sans text-[10px] text-teal border border-teal/30 px-2 py-0.5 rounded-full hover:bg-teal/5 transition-colors disabled:opacity-40"
          >
            {testSent ? '✓ Reçu !' : 'Tester'}
          </button>
        )}
      </div>
    )
  }

  if (status === 'loading')     return null
  if (status === 'unsupported') return null

  return (
    <div className="flex items-center gap-3">
      {status === 'denied' && (
        <p className="font-sans text-xs text-dark/40">
          🔕 Notifications bloquées dans les réglages du navigateur
        </p>
      )}
      {status === 'unsubscribed' && (
        <button onClick={requestPermission} disabled={isPending}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-teal/30 font-sans text-xs text-dark/60 hover:text-teal hover:border-teal/60 transition-colors disabled:opacity-40">
          🔔 Activer les rappels
        </button>
      )}
      {status === 'permission_only' && (
        <button onClick={subscribe} disabled={isPending}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-400 font-sans text-xs text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-40">
          ✓ Confirmer l&apos;activation
        </button>
      )}
      {status === 'subscribed' && (
        <>
          <span className="font-sans text-xs text-teal/70 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal inline-block" />
            Rappels activés
          </span>
          <button onClick={test} disabled={isPending}
            className="font-sans text-[10px] text-dark/30 hover:text-dark/60 transition-colors disabled:opacity-40">
            {testSent ? '✓ Envoyé !' : 'Tester'}
          </button>
          <button onClick={unsubscribe} disabled={isPending}
            className="font-sans text-[10px] text-dark/30 hover:text-red-400 transition-colors disabled:opacity-40">
            Désactiver
          </button>
        </>
      )}
    </div>
  )
}
