import { beforeEach, describe, expect, it, vi } from 'vitest'
import { COLLATERAL_TOKEN_ADDRESS } from '@/lib/contracts'

const mocks = vi.hoisted(() => ({
  assertIdentityAccess: vi.fn(),
  getCurrentUser: vi.fn(),
  getLiFiServerActions: vi.fn(),
  getQuote: vi.fn(),
  getTokens: vi.fn(),
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: { getCurrentUser: mocks.getCurrentUser },
}))

vi.mock('@/lib/identity/access', () => ({
  assertIdentityAccess: mocks.assertIdentityAccess,
}))

vi.mock('@/lib/lifi', () => ({
  getLiFiServerActions: mocks.getLiFiServerActions,
}))

function quoteRequest() {
  return new Request('https://example.test/api/lifi/quote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fromChainId: 137,
      fromTokenAddress: '0x0000000000000000000000000000000000000001',
      fromTokenDecimals: 6,
      fromAddress: '0x0000000000000000000000000000000000000002',
      toAddress: '0x0000000000000000000000000000000000000003',
      amount: '1',
    }),
  })
}

describe('li.fi quote identity boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
    mocks.getLiFiServerActions.mockResolvedValue({
      getQuote: mocks.getQuote,
      getTokens: mocks.getTokens,
    })
  })

  it('denies the quote before exposing an approval target when deposit access is blocked', async () => {
    mocks.assertIdentityAccess.mockRejectedValue(new Error('IDENTITY_REQUIRED'))
    const { POST } = await import('@/app/api/lifi/quote/route')

    const response = await POST(quoteRequest())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'IDENTITY_REQUIRED' })
    expect(mocks.assertIdentityAccess).toHaveBeenCalledWith('user-1', 'deposit')
    expect(mocks.getLiFiServerActions).not.toHaveBeenCalled()
    expect(mocks.getQuote).not.toHaveBeenCalled()
  })

  it('preserves quote creation after deposit access is granted', async () => {
    mocks.assertIdentityAccess.mockResolvedValue(undefined)
    mocks.getTokens.mockResolvedValue({
      tokens: {
        137: [{ address: COLLATERAL_TOKEN_ADDRESS, symbol: 'USDC' }],
      },
    })
    mocks.getQuote.mockResolvedValue({ estimate: { approvalAddress: '0x0000000000000000000000000000000000000004' } })
    const { POST } = await import('@/app/api/lifi/quote/route')

    const response = await POST(quoteRequest())

    expect(response.status).toBe(200)
    expect(mocks.getQuote).toHaveBeenCalledTimes(1)
  })
})
