import { describe, expect, it } from 'bun:test'

import { isMeldCheckoutReturnMessage } from '@/lib/payments/meld-return-channel'

describe('Meld checkout return channel messages', () => {
  it('accepts return and acknowledgement messages with a checkout ID', () => {
    const checkoutId = '32a336f3-0151-4460-8736-b77ce738c73d'

    expect(isMeldCheckoutReturnMessage({ type: 'return', checkoutId })).toBe(true)
    expect(isMeldCheckoutReturnMessage({ type: 'ack', checkoutId })).toBe(true)
  })

  it('rejects unrelated or malformed channel messages', () => {
    expect(isMeldCheckoutReturnMessage({ type: 'return', checkoutId: 'not-a-checkout' })).toBe(false)
    expect(isMeldCheckoutReturnMessage({ type: 'other', checkoutId: '32a336f3-0151-4460-8736-b77ce738c73d' })).toBe(
      false,
    )
    expect(isMeldCheckoutReturnMessage(null)).toBe(false)
  })
})
