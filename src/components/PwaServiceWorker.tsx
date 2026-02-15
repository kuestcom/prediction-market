'use client'

import { useEffect } from 'react'

export default function PwaServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      return
    }

    if (!('serviceWorker' in navigator)) {
      return
    }

    void navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Failed to register service worker', error)
    })
  }, [])

  return null
}
