import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  deleteReturning: vi.fn(),
  insertValues: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/drizzle', () => {
  const tx = {
    delete: vi.fn(() => ({
      where: vi.fn(() => ({ returning: mocks.deleteReturning })),
    })),
    insert: vi.fn(() => ({ values: mocks.insertValues })),
  }

  return {
    db: {
      transaction: mocks.transaction.mockImplementation(async (callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    },
  }
})

import { bindPendingSiweNonce } from '@/lib/siwe-nonce-bridge'

describe('pending SIWE nonce bridge', () => {
  beforeEach(() => {
    mocks.deleteReturning.mockReset()
    mocks.insertValues.mockReset()
    mocks.deleteReturning.mockResolvedValue([{ expires_at: new Date(Date.now() + 60_000) }])
    mocks.insertValues.mockResolvedValue(undefined)
  })

  it('moves a pending nonce to the Better Auth verifier key', async () => {
    await expect(
      bindPendingSiweNonce({
        chainId: 137,
        nonce: 'nonce12345678',
        walletAddress: '0x1111111111111111111111111111111111111111',
      }),
    ).resolves.toEqual({
      ok: true,
      walletAddress: '0x1111111111111111111111111111111111111111',
    })

    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'siwe:nonce12345678',
        value: 'nonce12345678',
      }),
    )
  })
})
