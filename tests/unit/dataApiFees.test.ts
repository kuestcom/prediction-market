import { afterEach, describe, expect, it, vi } from 'vitest'

import type { FeeReceiverTotal } from '@/lib/data-api/fees'

import { fetchFeeReceiverTotals, sumFeeTotals, sumFeeVolumes } from '@/lib/data-api/fees'

function total(totalAmount: string, totalVolume: string): FeeReceiverTotal {
  return {
    exchange: '0xexchange',
    receiver: '0xreceiver',
    tokenId: '0',
    feeType: 'AFFILIATE',
    totalAmount,
    totalVolume,
    updatedAt: 0,
  }
}

describe('Data API fee receiver totals', () => {
  afterEach(() => vi.restoreAllMocks())

  it('requests totals filtered to affiliate fee events', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([])))

    await fetchFeeReceiverTotals({ endpoint: 'referrers', address: '0xABC', feeType: 'AFFILIATE' })

    const requestInput = fetchMock.mock.calls[0][0]
    const requestUrl = new URL(
      typeof requestInput === 'string'
        ? requestInput
        : requestInput instanceof URL
          ? requestInput.href
          : requestInput.url,
    )
    expect(requestUrl.searchParams.get('address')).toBe('0xabc')
    expect(requestUrl.searchParams.get('feeType')).toBe('AFFILIATE')
  })

  it('sums decimal USDC amounts without discarding them', () => {
    const totals = [total('0.430515', '32.8795'), total('5.274777', '757.671261')]

    expect(sumFeeTotals(totals)).toBeCloseTo(5.705292, 6)
    expect(sumFeeVolumes(totals)).toBeCloseTo(790.550761, 6)
  })

  it('ignores malformed values and normalizes floating-point dust', () => {
    const totals = [total('invalid', 'invalid'), total('-4.5083985915177205e-14', '10')]

    expect(sumFeeTotals(totals)).toBeCloseTo(0, 6)
    expect(sumFeeVolumes(totals)).toBe(10)
  })
})
