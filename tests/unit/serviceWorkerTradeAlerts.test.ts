import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

describe('trade alert service worker', () => {
  const source = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8')

  it('uses the deterministic notification id for operating-system deduplication', () => {
    expect(source).toContain('showNotification(alert.title || alert.message')
    expect(source).toContain('body: alert.message')
    expect(source).toContain('tag: alert.notification_id')
    expect(source).toContain('renotify: false')
    expect(source).toContain('icon: alert.trader_avatar || alert.icon')
  })

  it('only suppresses native notifications while a focused visible client can display the toast', () => {
    expect(source).toContain("client.focused && client.visibilityState === 'visible'")
    expect(source.indexOf('if (focusedClient)')).toBeLessThan(
      source.indexOf('globalThis.registration.showNotification'),
    )
    expect(source).not.toContain('|| visibleClients[0]')
  })

  it('deduplicates native push independently from IndexedDB bell persistence', () => {
    expect(source).toContain('native_notified: markNativeNotified')
    expect(source).toContain('existing.native_notified !== true')
    expect(source).toContain('persistTradeAlert(alert, { markNativeNotified: true })')
  })

  it('rejects stale trade jobs and records push subscription reconciliation', () => {
    expect(source).toContain('expiresAt <= now')
    expect(source).toContain("globalThis.addEventListener('pushsubscriptionchange'")
    expect(source).toContain('push_subscription_needs_sync')
  })
})
