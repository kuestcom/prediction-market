'use client'

import { useEffect } from 'react'

function isLocalhostHost(hostname: string) {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '::1'
    || hostname === '[::1]'
    || hostname === '0.0.0.0'
}

export default function PwaServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return
    }

    if (process.env.NODE_ENV !== 'production' || isLocalhostHost(window.location.hostname)) {
      void navigator.serviceWorker.getRegistrations()
        .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
        .catch((error) => {
          console.error('Failed to unregister service workers', error)
        })
      if ('caches' in window) {
        void window.caches.keys()
          .then(cacheKeys => Promise.all(cacheKeys.map(cacheKey => window.caches.delete(cacheKey))))
          .catch((error) => {
            console.error('Failed to clear cache storage', error)
          })
      }
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
