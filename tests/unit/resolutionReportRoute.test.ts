import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const MARKET_ID = `0x${'a'.repeat(64)}`
const DEPOSIT_WALLET = '0x2222222222222222222222222222222222222222'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  fetchResolutionRewardAccountProposals: vi.fn(),
  fetchResolutionRewardMarket: vi.fn(),
  getMarketConfiguration: vi.fn(),
}))

vi.mock('@/lib/data-api/resolution-rewards', () => ({
  fetchResolutionRewardAccountProposals: mocks.fetchResolutionRewardAccountProposals,
  fetchResolutionRewardMarket: mocks.fetchResolutionRewardMarket,
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: { getCurrentUser: mocks.getCurrentUser },
}))

vi.mock('@/lib/db/queries/resolution-report-context', () => ({
  ResolutionReportContextRepository: { getMarketConfiguration: mocks.getMarketConfiguration },
}))

describe('resolution report route', () => {
  beforeEach(() => {
    vi.resetModules()
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.getCurrentUser.mockResolvedValue({
      id: 'user-1',
      address: '0x3333333333333333333333333333333333333333',
      deposit_wallet_address: DEPOSIT_WALLET,
      deposit_wallet_status: 'deployed',
    })
    mocks.getMarketConfiguration.mockResolvedValue({
      resolver: '0xc97c5aa5180731c7bB741Fc9B3c293272ca8d33D',
      oracle: '0x57827d48Da09ba227aFda89C083b4E35972Aa741',
      metadata: JSON.stringify({ resolution_type: 'dro_moov2' }),
    })
    mocks.fetchResolutionRewardAccountProposals.mockResolvedValue([])
    mocks.fetchResolutionRewardMarket.mockResolvedValue({
      id: MARKET_ID,
      conditionId: 'condition-1',
      bond: '300000000',
      rewardPool: '4000000',
      lockDuration: '172800',
      withdrawalDelay: '86400',
      status: 'active',
      noProposal: null,
      yesProposal: {
        id: '7',
        proposalId: '7',
        market: { id: MARKET_ID },
        creator: '0x3333333333333333333333333333333333333333',
        wallet: DEPOSIT_WALLET,
        side: 2,
        status: 'active',
        submittedAt: '1',
        withdrawalRequestedAt: null,
        withdrawalAvailableAt: null,
        correct: null,
        rewardEligible: true,
        bondBeneficiary: null,
        bondAmount: '300000000',
        rewardAmount: '0',
        transactionHash: `0x${'1'.repeat(64)}`,
        profile: { username: 'reporter', avatarUrl: 'https://example.test/avatar.png' },
        history: { correct: '4', incorrect: '1' },
      },
    })
  })

  it('returns active reporters with global profile and history from the Data API', async () => {
    const { GET } = await import('@/app/api/resolution-reports/route')
    const response = await GET(
      new NextRequest(`https://example.test/api/resolution-reports?conditionId=condition-1&marketId=${MARKET_ID}`),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.reporters).toEqual([
      expect.objectContaining({
        seed: DEPOSIT_WALLET,
        image: 'https://example.test/avatar.png',
        outcome: 'yes',
        historyCorrectCount: 4,
        historyIncorrectCount: 1,
      }),
    ])
  })

  it('rejects a reward market that is not mapped to the requested condition', async () => {
    mocks.fetchResolutionRewardMarket.mockResolvedValueOnce({ conditionId: 'another-condition' })
    const { GET } = await import('@/app/api/resolution-reports/route')
    const response = await GET(
      new NextRequest(`https://example.test/api/resolution-reports?conditionId=condition-1&marketId=${MARKET_ID}`),
    )

    expect(response.status).toBe(404)
  })

  it('rejects a locally configured non-DRO market', async () => {
    mocks.getMarketConfiguration.mockResolvedValueOnce({
      resolver: '0x1111111111111111111111111111111111111111',
      oracle: '0x2222222222222222222222222222222222222222',
      metadata: JSON.stringify({ resolution_type: 'uma_moov2' }),
    })
    const { GET } = await import('@/app/api/resolution-reports/route')
    const response = await GET(
      new NextRequest(`https://example.test/api/resolution-reports?conditionId=condition-1&marketId=${MARKET_ID}`),
    )

    expect(response.status).toBe(404)
  })

  it('reports a non-deployed Deposit Wallet as ineligible', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({
      id: 'user-1',
      address: '0x3333333333333333333333333333333333333333',
      deposit_wallet_address: DEPOSIT_WALLET,
      deposit_wallet_status: 'signed',
    })
    const { GET } = await import('@/app/api/resolution-reports/route')
    const response = await GET(
      new NextRequest(`https://example.test/api/resolution-reports?conditionId=condition-1&marketId=${MARKET_ID}`),
    )

    expect((await response.json()).eligibility).toBe('ineligible')
  })
})
