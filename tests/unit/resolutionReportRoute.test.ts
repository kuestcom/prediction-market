import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RESOLUTION_REWARDS_ADDRESS } from '@/lib/contracts'
import { getResolutionRewardMarketId } from '@/lib/resolution-rewards'

const ORACLE = '0x1111111111111111111111111111111111111111'
const DEPOSIT_WALLET = '0x2222222222222222222222222222222222222222'
const ANCILLARY_DATA = '0x1234'
const TRANSACTION_HASH = `0x${'a'.repeat(64)}`

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTarget: vi.fn(),
  recordVerifiedProposal: vi.fn(),
  readContract: vi.fn(),
  getTransactionReceipt: vi.fn(),
  parseEventLogs: vi.fn(),
}))

vi.mock('@/lib/db/queries/resolution-report', () => ({
  ResolutionReportRepository: {
    getTarget: mocks.getTarget,
    recordVerifiedProposal: mocks.recordVerifiedProposal,
  },
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: { getCurrentUser: mocks.getCurrentUser },
}))

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: () => ({
      readContract: mocks.readContract,
      getTransactionReceipt: mocks.getTransactionReceipt,
    }),
    parseEventLogs: mocks.parseEventLogs,
  }
})

describe('resolution report route', () => {
  beforeEach(() => {
    vi.resetModules()
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.getCurrentUser.mockResolvedValue({
      id: 'user-1',
      address: '0x3333333333333333333333333333333333333333',
      deposit_wallet_address: DEPOSIT_WALLET,
    })
    mocks.getTarget.mockResolvedValue({
      conditionId: 'condition-1',
      eventId: '01K3EVENT00000000000000000',
      eventStatus: 'active',
      marketActive: true,
      marketResolved: false,
      conditionResolved: false,
      negRisk: false,
      resolver: null,
      oracle: ORACLE,
      adapterQuestionId: `0x${'b'.repeat(64)}`,
      metadata: JSON.stringify({ resolution_type: 'dro_moov2' }),
    })
    mocks.readContract.mockResolvedValue({ ancillaryData: ANCILLARY_DATA })
    mocks.getTransactionReceipt.mockResolvedValue({
      status: 'success',
      logs: [{ address: RESOLUTION_REWARDS_ADDRESS }],
    })
    mocks.recordVerifiedProposal.mockResolvedValue({ id: 'report-1' })
  })

  it('records only a matching on-chain ProposalSubmitted event', async () => {
    const marketId = getResolutionRewardMarketId(ORACLE, ANCILLARY_DATA)
    mocks.parseEventLogs.mockReturnValue([
      {
        args: {
          proposalId: 7n,
          marketId,
          wallet: DEPOSIT_WALLET,
          side: 2,
        },
      },
    ])

    const { POST } = await import('@/app/api/resolution-reports/route')
    const response = await POST(
      new Request('https://example.test/api/resolution-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conditionId: 'condition-1',
          eventId: '01K3EVENT00000000000000000',
          marketId,
          outcome: 'yes',
          transactionHash: TRANSACTION_HASH,
        }),
      }) as never,
    )

    expect(response.status).toBe(200)
    expect(mocks.recordVerifiedProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: '7',
        reporterAddress: DEPOSIT_WALLET,
        outcome: 'yes',
      }),
    )
  })
})
