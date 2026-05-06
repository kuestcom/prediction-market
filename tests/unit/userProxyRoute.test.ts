import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isDepositWalletDeployed: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  eq: vi.fn((..._args: any[]) => ({ eq: true })),
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: { getCurrentUser: (...args: any[]) => mocks.getCurrentUser(...args) },
}))

vi.mock('@/lib/deposit-wallet', () => ({
  isDepositWalletDeployed: (...args: any[]) => mocks.isDepositWalletDeployed(...args),
}))

vi.mock('drizzle-orm', () => ({
  eq: (...args: any[]) => mocks.eq(...args),
}))

vi.mock('@/lib/db/schema/auth/tables', () => ({
  users: { id: 'id' },
}))

vi.mock('@/lib/drizzle', () => {
  mocks.where.mockResolvedValue({ ok: true })
  mocks.set.mockReturnValue({ where: mocks.where })
  mocks.update.mockReturnValue({ set: mocks.set })

  return {
    db: { update: mocks.update },
  }
})

const { GET } = await import('@/app/api/user/deposit-wallet/route')

describe('user deposit wallet route', () => {
  it('returns 401 when unauthenticated', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null)
    const response = await GET()
    expect(response.status).toBe(401)
  })

  it('updates status to deployed when contract is deployed', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({
      id: 'user-1',
      deposit_wallet_address: '0x0000000000000000000000000000000000000002',
      deposit_wallet_status: 'deploying',
      deposit_wallet_signature: 'sig',
      deposit_wallet_signed_at: 1,
      deposit_wallet_tx_hash: '0xtx',
    })
    mocks.isDepositWalletDeployed.mockResolvedValueOnce(true)

    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.deposit_wallet_status).toBe('deployed')
    expect(mocks.update).toHaveBeenCalled()
    expect(mocks.set).toHaveBeenCalledWith({ deposit_wallet_status: 'deployed', deposit_wallet_tx_hash: null })
  })

  it('downgrades status to deploying when contract is not deployed', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({
      id: 'user-1',
      deposit_wallet_address: '0x0000000000000000000000000000000000000002',
      deposit_wallet_status: 'deployed',
      deposit_wallet_signature: null,
      deposit_wallet_signed_at: null,
      deposit_wallet_tx_hash: null,
    })
    mocks.isDepositWalletDeployed.mockResolvedValueOnce(false)

    const response = await GET()
    const body = await response.json()
    expect(body.deposit_wallet_status).toBe('deploying')
    expect(mocks.set).toHaveBeenCalledWith({ deposit_wallet_status: 'deploying' })
  })
})
