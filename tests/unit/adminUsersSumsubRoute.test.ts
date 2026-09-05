import { beforeEach, describe, expect, it, mock, jest } from 'bun:test'
import { NextRequest } from 'next/server'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  getCurrentUser: mock(),
  listUsers: mock(),
  getUsersByIds: mock(),
  getStatusesForUsers: mock(),
  getSettings: mock(),
}))

void mock.module('@/lib/db/queries/user', () => ({
  UserRepository: {
    getCurrentUser: mocks.getCurrentUser,
    listUsers: mocks.listUsers,
    getUsersByIds: mocks.getUsersByIds,
  },
}))
void mock.module('@/lib/db/queries/sumsub', () => ({
  SumsubRepository: { getStatusesForUsers: mocks.getStatusesForUsers },
}))
void mock.module('@/lib/sumsub/settings', () => ({ getSumsubSettings: mocks.getSettings }))
void mock.module('@/lib/admin', () => ({ isAdminWallet: () => false }))
void mock.module('@/lib/platform-routing', () => ({
  buildPublicProfilePath: () => '/profile/user',
  buildUsernameProfilePath: () => '/profile/referrer',
}))
void mock.module('@/lib/site-url', () => ({ default: () => 'https://example.test' }))
void mock.module('@/lib/storage', () => ({ getPublicAssetUrl: (path: string) => path }))

const { GET } = await import('@/app/[locale]/admin/api/users/route')

describe('admin users Sumsub status', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ id: 'admin', is_admin: true })
    mocks.listUsers.mockResolvedValue({
      data: [
        {
          id: 'user-1',
          username: 'trader',
          email: 'trader@example.test',
          address: '0x0000000000000000000000000000000000000001',
          deposit_wallet_address: null,
          created_at: '2026-07-19T10:00:00.000Z',
          image: null,
          referred_by_user_id: null,
        },
      ],
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
