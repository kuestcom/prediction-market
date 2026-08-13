import { describe, expect, it } from 'vitest'

import { parseTradeAlertPayload } from '@/lib/trade-alerts'

const origin = 'https://example.com'

function payload(overrides: Record<string, unknown> = {}) {
  const now = Date.now()
  return {
    notification_id: 'notification-1',
    profile_id: 'profile-1',
    followed_wallet: '0xABC',
    condition_id: '0xDEF',
    message: 'Bruno bought 420 YES in Market',
    market_title: 'Market',
    market_icon: '/market.png',
    url: `${origin}/event/example/market`,
    created_at: new Date(now - 1_000).toISOString(),
    expires_at: new Date(now + 14 * 60_000).toISOString(),
    ...overrides,
  }
}

describe('trade alert validation', () => {
  it('accepts a fresh same-origin payload and canonicalizes identifiers', () => {
    const parsed = parseTradeAlertPayload(payload(), { origin })

    expect(parsed).toMatchObject({
      notification_id: 'notification-1',
      followed_wallet: '0xabc',
      condition_id: '0xdef',
      url: `${origin}/event/example/market`,
    })
  })

  it('rejects expired payloads and replaces cross-origin URLs with the site home', () => {
    const expired = parseTradeAlertPayload(payload({ expires_at: new Date(Date.now() - 1).toISOString() }), { origin })
    const safe = parseTradeAlertPayload(payload({ url: 'https://attacker.invalid/market' }), { origin })

    expect(expired).toBeNull()
    expect(safe?.url).toBe(origin)
  })
})
