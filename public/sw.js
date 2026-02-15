globalThis.addEventListener('install', () => {
  globalThis.skipWaiting()
})

globalThis.addEventListener('activate', (event) => {
  event.waitUntil(globalThis.clients.claim())
})

// Keep a fetch handler so Chrome treats the app as installable.
globalThis.addEventListener('fetch', () => {
})
