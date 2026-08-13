import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('trade alert service worker', () => {
  const source = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8')

  it('uses the deterministic notification id for operating-system deduplication', () => {
    expect(source).toContain('tag: alert.notification_id')
    expect(source).toContain('renotify: false')
  })

  it('does not show native notifications while a visible client can display the toast', () => {
    expect(source).toContain("client.visibilityState === 'visible'")
    expect(source.indexOf('if (visibleClients.length > 0)')).toBeLessThan(
      source.indexOf('globalThis.registration.showNotification'),
    )
  })

  it('rejects stale trade jobs and records push subscription reconciliation', () => {
    expect(source).toContain('expiresAt <= now')
    expect(source).toContain("globalThis.addEventListener('pushsubscriptionchange'")
    expect(source).toContain('push_subscription_needs_sync')
  })
})
