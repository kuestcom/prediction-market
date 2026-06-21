import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createPublicClient: vi.fn(),
  http: vi.fn((url: string) => ({ url })),
  parseAbi: vi.fn((abi: string[]) => abi),
  readContract: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  updatePayloads: [] as Array<Record<string, unknown>>,
}))

vi.mock('viem', () => ({
  createPublicClient: (...args: unknown[]) => mocks.createPublicClient(...args),
  http: (...args: [string]) => mocks.http(...args),
  parseAbi: (...args: [string[]]) => mocks.parseAbi(...args),
}))

vi.mock('@/lib/viem-network', () => ({
  defaultViemNetwork: { id: 80002, name: 'amoy' },
  defaultViemRpcUrl: 'https://rpc-amoy.polygon.technology',
}))

vi.mock('@/lib/drizzle', () => ({
  db: {
    select: (...args: unknown[]) => mocks.select(...args),
    update: (...args: unknown[]) => mocks.update(...args),
  },
}))

function makeSelectChain(result: unknown[]) {
  const whereResult = {
    limit: async () => result,
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }

  return {
    from: () => ({
      where: () => whereResult,
    }),
  }
}

function makeUpdateChain(result: unknown[]) {
  return {
    set: (payload: Record<string, unknown>) => {
      mocks.updatePayloads.push(payload)
      return {
        where: () => ({
          returning: async () => result,
        }),
      }
    },
  }
}

describe('resolution payout sync', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.createPublicClient.mockReset()
    mocks.http.mockClear()
    mocks.parseAbi.mockClear()
    mocks.readContract.mockReset()
    mocks.select.mockReset()
    mocks.update.mockReset()
    mocks.updatePayloads.length = 0
    mocks.createPublicClient.mockReturnValue({ readContract: mocks.readContract })
  })

  it('repairs missing binary payouts from ConditionalTokens', async () => {
    mocks.select
      .mockReturnValueOnce(makeSelectChain([{ resolution_price: null }]))
      .mockReturnValueOnce(makeSelectChain([
        { outcome_index: 0, payout_value: null },
        { outcome_index: 1, payout_value: null },
      ]))
    mocks.update.mockImplementation(() => makeUpdateChain([{ id: 'changed' }]))
    mocks.readContract
      .mockResolvedValueOnce(1n)
      .mockResolvedValueOnce(1n)
      .mockResolvedValueOnce(0n)

    const { syncMissingOnChainResolvedPayouts } = await import('@/lib/resolution-payout-sync')
    const changed = await syncMissingOnChainResolvedPayouts(
      '0x261e5587c891b0ca15cf061286b8da346cb96ee414d6b4b827596797ba59bbc2',
    )

    expect(changed).toBe(true)
    expect(mocks.readContract).toHaveBeenCalledTimes(3)
    expect(mocks.updatePayloads).toContainEqual({ resolution_price: '1' })
    expect(mocks.updatePayloads).toContainEqual({
      is_winning_outcome: true,
      payout_value: '1',
    })
    expect(mocks.updatePayloads).toContainEqual({
      is_winning_outcome: false,
      payout_value: '0',
    })
  })

  it('skips chain reads when payout state is already present', async () => {
    mocks.select
      .mockReturnValueOnce(makeSelectChain([{ resolution_price: '1.000000' }]))
      .mockReturnValueOnce(makeSelectChain([
        { outcome_index: 0, payout_value: '1.000000' },
        { outcome_index: 1, payout_value: '0.000000' },
      ]))

    const { syncMissingOnChainResolvedPayouts } = await import('@/lib/resolution-payout-sync')
    const changed = await syncMissingOnChainResolvedPayouts(
      '0x261e5587c891b0ca15cf061286b8da346cb96ee414d6b4b827596797ba59bbc2',
    )

    expect(changed).toBe(false)
    expect(mocks.readContract).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
