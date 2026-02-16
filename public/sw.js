globalThis.addEventListener('install', () => {
  globalThis.skipWaiting()
})

globalThis.addEventListener('activate', (event) => {
  event.waitUntil(globalThis.clients.claim())
})

function resolveSafeNotificationUrl(rawUrl) {
  const fallbackUrl = `${globalThis.location.origin}/`

  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return fallbackUrl
  }

  try {
    const parsedUrl = new URL(rawUrl, globalThis.location.origin)

    if (parsedUrl.origin !== globalThis.location.origin) {
      return fallbackUrl
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return fallbackUrl
    }

    return parsedUrl.toString()
  }
  catch {
    return fallbackUrl
  }
}

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
  const url = resolveSafeNotificationUrl(data.url)

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

  const targetUrl = resolveSafeNotificationUrl(event.notification.data?.url)

  event.waitUntil((async () => {
    const windowClients = await globalThis.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })

    for (const client of windowClients) {
      if ('focus' in client && 'navigate' in client) {
        try {
          if (client.url !== targetUrl) {
            await client.navigate(targetUrl)
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
      await globalThis.clients.openWindow(targetUrl)
    }
  })())
})

// Keep a fetch handler so Chrome treats the app as installable.
globalThis.addEventListener('fetch', () => {
})
