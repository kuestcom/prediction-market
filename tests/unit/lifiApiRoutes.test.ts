import { beforeEach, describe, expect, it, vi } from 'vitest'
import { COLLATERAL_TOKEN_ADDRESS } from '@/lib/contracts'
import { DEFAULT_CHAIN_ID } from '@/lib/network'

const mocks = vi.hoisted(() => ({
  getQuote: vi.fn(),
  getStatus: vi.fn(),
  getLiFiServerActions: vi.fn(),
}))

vi.mock('@/lib/lifi', () => ({
  getLiFiServerActions: (...args: unknown[]) => mocks.getLiFiServerActions(...args),
}))

describe('lI.FI API routes', () => {
  beforeEach(() => {
    mocks.getQuote.mockReset()
    mocks.getStatus.mockReset()
    mocks.getLiFiServerActions.mockReset()
    mocks.getLiFiServerActions.mockResolvedValue({
      getQuote: mocks.getQuote,
      getStatus: mocks.getStatus,
    })
  })

  it('quotes from the selected source chain into collateral on the platform chain', async () => {
    const quote = { id: 'quote-1' }
    mocks.getQuote.mockResolvedValue(quote)
    const { POST } = await import('@/app/api/lifi/quote/route')

    const response = await POST(new Request('http://localhost/api/lifi/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fromChainId: 1,
        fromTokenAddress: '0x0000000000000000000000000000000000000001',
        fromTokenDecimals: 6,
        fromAddress: '0x0000000000000000000000000000000000000002',
        toAddress: '0x0000000000000000000000000000000000000003',
        amount: '12.5',
      }),
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ quote })
    expect(mocks.getQuote).toHaveBeenCalledWith({
      fromChain: 1,
      toChain: DEFAULT_CHAIN_ID,
      fromToken: '0x0000000000000000000000000000000000000001',
      toToken: COLLATERAL_TOKEN_ADDRESS,
      fromAddress: '0x0000000000000000000000000000000000000002',
      toAddress: '0x0000000000000000000000000000000000000003',
      fromAmount: '12500000',
    })
  })

  it('forwards the bridge identifiers needed for destination status', async () => {
    mocks.getStatus.mockResolvedValue({
      status: 'PENDING',
      substatus: 'WAIT_DESTINATION_TRANSACTION',
      substatusMessage: 'Waiting for destination transaction.',
    })
    const { POST } = await import('@/app/api/lifi/status/route')

    const response = await POST(new Request('http://localhost/api/lifi/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        txHash: '0xabc',
        fromChainId: 1,
        toChainId: 137,
        bridge: 'across',
        fromAddress: '0x0000000000000000000000000000000000000002',
        transactionId: 'transaction-1',
      }),
    }))

    expect(response.status).toBe(200)
    expect(mocks.getStatus).toHaveBeenCalledWith({
      txHash: '0xabc',
      fromChain: 1,
      toChain: 137,
      bridge: 'across',
      fromAddress: '0x0000000000000000000000000000000000000002',
      transactionId: 'transaction-1',
    })
  })
})
