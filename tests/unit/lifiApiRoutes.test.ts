import { beforeEach, describe, expect, it, vi } from 'vitest'
import { COLLATERAL_TOKEN_ADDRESS } from '@/lib/contracts'
import { DEFAULT_CHAIN_ID } from '@/lib/network'

const mocks = vi.hoisted(() => ({
  getQuote: vi.fn(),
  getStatus: vi.fn(),
  getLiFiTokens: vi.fn(),
  getLiFiServerActions: vi.fn(),
}))

vi.mock('@/lib/lifi', () => ({
  getLiFiTokens: (...args: unknown[]) => mocks.getLiFiTokens(...args),
  getLiFiServerActions: (...args: unknown[]) => mocks.getLiFiServerActions(...args),
}))

describe('lI.FI API routes', () => {
  beforeEach(() => {
    mocks.getQuote.mockReset()
    mocks.getStatus.mockReset()
    mocks.getLiFiTokens.mockReset()
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

  it.each([
    {
      name: 'null',
      body: null,
    },
    {
      name: 'non-string required fields',
      body: {
        txHash: { value: '0xabc' },
        fromChainId: 1,
        toChainId: 137,
      },
    },
    {
      name: 'non-string optional fields',
      body: {
        txHash: '0xabc',
        fromChainId: 1,
        toChainId: 137,
        bridge: { name: 'across' },
      },
    },
  ])('rejects $name transfer status bodies before calling LI.FI', async ({ body }) => {
    const { POST } = await import('@/app/api/lifi/status/route')

    const response = await POST(new Request('http://localhost/api/lifi/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }))

    expect(response.status).toBe(400)
    expect(mocks.getLiFiServerActions).not.toHaveBeenCalled()
  })

  it('rejects invalid token chain filters before calling LI.FI', async () => {
    const { POST } = await import('@/app/api/lifi/tokens/route')

    const response = await POST(new Request('http://localhost/api/lifi/tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chains: [1, '137'] }),
    }))

    expect(response.status).toBe(400)
    expect(mocks.getLiFiTokens).not.toHaveBeenCalled()
  })
})
