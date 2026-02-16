'use client'

import { useEffect } from 'react'

export default function PwaServiceWorker() {
  useEffect(() => {
    const enableInDevelopment = process.env.NEXT_PUBLIC_ENABLE_PWA_IN_DEV === 'true'

    if (process.env.NODE_ENV !== 'production' && !enableInDevelopment) {
      return
    }

    if (!('serviceWorker' in navigator)) {
      return
    }

    void navigator.serviceWorker
      .register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      })
      .catch((error) => {
        console.error('Failed to register service worker', error)
      })
  }, [])

  return null
}
