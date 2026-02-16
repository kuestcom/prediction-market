globalThis.addEventListener('install', () => {
  globalThis.skipWaiting()
})

globalThis.addEventListener('activate', (event) => {
  event.waitUntil(globalThis.clients.claim())
})

globalThis.addEventListener('push', (event) => {
  if (!event.data) {
    return
  }

  let data = {}

  try {
    data = event.data.json()
  }
  catch {
    data = { body: event.data.text() }
  }

  const title = typeof data.title === 'string' && data.title.trim()
    ? data.title
    : 'New notification'
  const body = typeof data.body === 'string' ? data.body : ''
  const icon = typeof data.icon === 'string' && data.icon.trim()
    ? data.icon
    : '/images/pwa/default-icon-192.png'
  const badge = typeof data.badge === 'string' && data.badge.trim()
    ? data.badge
    : '/images/pwa/default-icon-192.png'
  const url = typeof data.url === 'string' && data.url.trim() ? data.url : '/'

  event.waitUntil(
    globalThis.registration.showNotification(title, {
      body,
      icon,
      badge,
      data: { url },
    }),
  )
})

globalThis.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const fallbackUrl = '/'
  const targetUrl = typeof event.notification.data?.url === 'string'
    ? event.notification.data.url
    : fallbackUrl

  event.waitUntil((async () => {
    const absoluteTargetUrl = new URL(targetUrl, globalThis.location.origin).toString()
    const windowClients = await globalThis.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })

    for (const client of windowClients) {
      if ('focus' in client && 'navigate' in client) {
        try {
          if (client.url !== absoluteTargetUrl) {
            await client.navigate(absoluteTargetUrl)
          }

          await client.focus()
          return
        }
        catch {
          //
        }
      }
    }

    if ('openWindow' in globalThis.clients) {
      await globalThis.clients.openWindow(absoluteTargetUrl)
    }
  })())
})

// Keep a fetch handler so Chrome treats the app as installable.
globalThis.addEventListener('fetch', () => {
})
