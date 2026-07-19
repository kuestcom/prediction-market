import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/sumsub/access-token/route'

const mocks = vi.hoisted(() => ({
  attachApplicant: vi.fn(),
  consumeRateLimit: vi.fn(),
  createAccessToken: vi.fn(),
  ensureUser: vi.fn(),
  getApplicant: vi.fn(),
  getCurrentUser: vi.fn(),
  getSettings: vi.fn(),
}))

vi.mock('@/lib/db/queries/user', () => ({ UserRepository: { getCurrentUser: mocks.getCurrentUser } }))
vi.mock('@/lib/db/queries/sumsub', () => ({
  SumsubRepository: {
    attachApplicant: mocks.attachApplicant,
    consumeAccessTokenRateLimit: mocks.consumeRateLimit,
    ensureUser: mocks.ensureUser,
    syncApplicantStatus: vi.fn(),
  },
}))
vi.mock('@/lib/sumsub/settings', () => ({ getSumsubSettings: mocks.getSettings }))
vi.mock('@/lib/sumsub/client', () => ({
  normalizeSumsubApplicantStatus: vi.fn(() => 'pending'),
  SumsubClientError: class extends Error { status = 502 },
  SumsubClient: class {
    createAccessToken = mocks.createAccessToken
    getApplicantByExternalUserId = mocks.getApplicant
  },
}))

describe('sumsub access token route', () => {
  beforeEach(() => {
    mocks.getCurrentUser.mockReset().mockResolvedValue({ id: 'user-1' })
    mocks.getSettings.mockReset().mockResolvedValue({
      effective: true,
      levelName: 'basic-kyc-level',
      appToken: 'app',
      secretKey: 'secret',
    })
    mocks.consumeRateLimit.mockReset().mockResolvedValue(true)
    mocks.ensureUser.mockReset().mockResolvedValue({
      user_id: 'user-1',
      external_user_id: 'kuest:user-1',
      applicant_id: 'applicant-1',
    })
    mocks.getApplicant.mockReset().mockResolvedValue(null)
    mocks.createAccessToken.mockReset().mockResolvedValue('temporary-token')
  })

  it('rejects unauthenticated users', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    expect((await POST()).status).toBe(401)
    expect(mocks.createAccessToken).not.toHaveBeenCalled()
  })

  it('rejects inactive or incomplete integration', async () => {
    mocks.getSettings.mockResolvedValue({ effective: false })
    expect((await POST()).status).toBe(409)
    expect(mocks.createAccessToken).not.toHaveBeenCalled()
  })

  it('rate limits by authenticated user', async () => {
    mocks.consumeRateLimit.mockResolvedValue(false)
    const response = await POST()
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('60')
  })

  it('derives the external user and level exclusively on the server', async () => {
    const response = await POST()
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ token: 'temporary-token', levelName: 'basic-kyc-level' })
    expect(mocks.ensureUser).toHaveBeenCalledWith('user-1', 'basic-kyc-level')
    expect(mocks.createAccessToken).toHaveBeenCalledWith('kuest:user-1', 'basic-kyc-level')
  })
})
