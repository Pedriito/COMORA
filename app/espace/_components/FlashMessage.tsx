'use client'

import { useState, useEffect } from 'react'

const styles = {
  success: 'bg-green-50 border-green-200 text-green-700',
  error:   'bg-red-50 border-red-200 text-red-600',
  info:    'bg-blue-50 border-blue-200 text-blue-700',
}

export function FlashMessage({
  message,
  type = 'success',
}: {
  message: string
  type?: 'success' | 'error' | 'info'
}) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 5000)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null

  return (
    <div className={`flex items-center justify-between rounded-xl border px-4 py-3 font-sans text-sm ${styles[type]}`}>
      <span>{message}</span>
      <button
        onClick={() => setVisible(false)}
        className="ml-4 opacity-50 hover:opacity-100 transition-opacity text-lg leading-none"
      >
        ×
      </button>
    </div>
  )
}
