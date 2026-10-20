'use client'

import { useEffect } from 'react'

export function AutoPrint() {
  useEffect(() => {
    // Petit délai pour que les polices soient chargées
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [])
  return null
}
