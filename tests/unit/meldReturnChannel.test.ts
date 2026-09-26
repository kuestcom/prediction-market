import { describe, expect, it } from 'bun:test'

import { isMeldCheckoutId, isMeldCheckoutReturnMessage } from '@/lib/payments/meld-return-channel'

describe('Meld checkout return channel', () => {
  const checkoutId = '32a336f3-0151-4460-8736-b77ce738c73d'

  it('accepts return and acknowledgement messages with a checkout ID', () => {
    expect(isMeldCheckoutId(checkoutId)).toBe(true)
    expect(isMeldCheckoutReturnMessage({ type: 'return', checkoutId })).toBe(true)
    expect(isMeldCheckoutReturnMessage({ type: 'ack', checkoutId })).toBe(true)
  })

  it('rejects malformed checkout IDs', () => {
    expect(isMeldCheckoutId('------------------------------------')).toBe(false)
    expect(isMeldCheckoutId('123e4567e-89b-12d3-a456-426614174000')).toBe(false)
    expect(isMeldCheckoutId('123e4567-e89b-12d3-a456-42661417400g')).toBe(false)
    expect(isMeldCheckoutReturnMessage({ type: 'ack', checkoutId: '12345678--------12345678901234567890' })).toBe(false)
    expect(isMeldCheckoutReturnMessage({ type: 'return', checkoutId: 'not-a-checkout' })).toBe(false)
    expect(isMeldCheckoutReturnMessage({ type: 'other', checkoutId })).toBe(false)
    expect(isMeldCheckoutReturnMessage(null)).toBe(false)
  })
})
