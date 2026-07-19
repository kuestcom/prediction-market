import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listUsers: vi.fn(),
  getUsersByIds: vi.fn(),
  getStatusesForUsers: vi.fn(),
  getSettings: vi.fn(),
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: {
    getCurrentUser: mocks.getCurrentUser,
    listUsers: mocks.listUsers,
    getUsersByIds: mocks.getUsersByIds,
  },
}))
vi.mock('@/lib/db/queries/sumsub', () => ({
  SumsubRepository: { getStatusesForUsers: mocks.getStatusesForUsers },
}))
vi.mock('@/lib/sumsub/settings', () => ({ getSumsubSettings: mocks.getSettings }))
vi.mock('@/lib/admin', () => ({ isAdminWallet: () => false }))
vi.mock('@/lib/platform-routing', () => ({
  buildPublicProfilePath: () => '/profile/user',
  buildUsernameProfilePath: () => '/profile/referrer',
}))
vi.mock('@/lib/site-url', () => ({ default: () => 'https://example.test' }))
vi.mock('@/lib/storage', () => ({ getPublicAssetUrl: (path: string) => path }))

const { GET } = await import('@/app/[locale]/admin/api/users/route')

describe('admin users Sumsub status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ id: 'admin', is_admin: true })
    mocks.listUsers.mockResolvedValue({
      data: [{
        id: 'user-1',
        username: 'trader',
        email: 'trader@example.test',
        address: '0x0000000000000000000000000000000000000001',
        deposit_wallet_address: null,
        created_at: '2026-07-19T10:00:00.000Z',
        image: null,
        referred_by_user_id: null,
      }],
      count: 1,
      error: null,
    })
    mocks.getUsersByIds.mockResolvedValue({ data: [], error: null })
    mocks.getStatusesForUsers.mockResolvedValue(new Map([['user-1', 'approved']]))
  })

  it('does not query or expose KYC state when Sumsub is inactive', async () => {
    mocks.getSettings.mockResolvedValue({ effective: false, levelName: 'kyc' })
    const response = await GET(new NextRequest('http://localhost/en/admin/api/users'))
    expect(response.status).toBe(200)
    expect(mocks.getStatusesForUsers).not.toHaveBeenCalled()
    const payload = await response.json()
    expect(payload.sumsubActive).toBe(false)
    expect(payload.data[0].sumsub_status).toBe('not_started')
  })

  it('loads the current-level states in one batch without applicant identifiers', async () => {
    mocks.getSettings.mockResolvedValue({ effective: true, levelName: 'kyc-current' })
    const response = await GET(new NextRequest('http://localhost/en/admin/api/users'))
    expect(mocks.getStatusesForUsers).toHaveBeenCalledOnce()
    expect(mocks.getStatusesForUsers).toHaveBeenCalledWith(['user-1'], 'kyc-current')
    const payload = await response.json()
    expect(payload.sumsubActive).toBe(true)
    expect(payload.data[0].sumsub_status).toBe('approved')
    expect(JSON.stringify(payload)).not.toMatch(/applicant_id|external_user_id|review_answer/i)
  })
})
