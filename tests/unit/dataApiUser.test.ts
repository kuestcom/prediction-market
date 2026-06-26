import { describe, expect, it } from 'vitest'
import { mapDataApiActivityToActivityOrder } from '@/lib/data-api/user'

describe('mapDataApiActivityToActivityOrder', () => {
  it('uses proxyWallet as the activity user address for DATA_URL responses', () => {
    const proxyWallet = '0xa6a0413f8fa248df51a49bfc759ff190d24fe25b'

    const activity = mapDataApiActivityToActivityOrder({
      proxyWallet,
      side: 'SELL',
      conditionId: '0x8d0af56260655c6c6d61949c76196114766112ebce7d32ea6acc43b779732c13',
      size: 19.66,
      price: 0.3,
      timestamp: 1779198845,
      transactionHash: '0xbdedb891c9e999602f9cb3416592fffbee8d0ec8eb4962906e3f92bdea4125d7',
      usdcSize: 5.898,
      title: 'Dogecoin Up or Down on May 19?',
      slug: 'dogecoin-up-or-down-on-may-19-2026',
      eventSlug: 'dogecoin-up-or-down-on-may-19-2026',
      outcome: 'Down',
      outcomeIndex: 1,
    })

    expect(activity.user.id).toBe(proxyWallet)
    expect(activity.user.address).toBe(proxyWallet)
    expect(activity.user.username).toBe(proxyWallet)
    expect(activity.side).toBe('sell')
  })

  it('prefers the external profile pseudonym over proxyWallet for display name', () => {
    const activity = mapDataApiActivityToActivityOrder({
      proxyWallet: '0xa6a0413f8fa248df51a49bfc759ff190d24fe25b',
      pseudonym: 'doge.trader',
      conditionId: '0x8d0af56260655c6c6d61949c76196114766112ebce7d32ea6acc43b779732c13',
      size: 1,
      price: 0.5,
      timestamp: 1779198845,
    })

    expect(activity.user.username).toBe('doge.trader')
  })

  it('maps zero-value redeem activity as a loss row', () => {
    const activity = mapDataApiActivityToActivityOrder({
      proxyWallet: '0xa6a0413f8fa248df51a49bfc759ff190d24fe25b',
      type: 'REDEEM',
      conditionId: '0x8d0af56260655c6c6d61949c76196114766112ebce7d32ea6acc43b779732c13',
      size: 0,
      usdcSize: 0,
      price: 0,
      timestamp: 1779198845,
      transactionHash: '0xbdedb891c9e999602f9cb3416592fffbee8d0ec8eb4962906e3f92bdea4125d7',
      outcomeIndex: 999,
      outcome: '',
    })

    expect(activity.type).toBe('loss')
    expect(activity.outcome.text).toBe('Outcome')
    expect(activity.total_value).toBe(0)
  })
})
