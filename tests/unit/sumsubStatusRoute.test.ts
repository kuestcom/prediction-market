import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getForUser: vi.fn(),
  consumeStatusRateLimit: vi.fn(),
  getSettings: vi.fn(),
}))

vi.mock('@/lib/db/queries/user', () => ({ UserRepository: { getCurrentUser: mocks.getCurrentUser } }))
vi.mock('@/lib/db/queries/sumsub', () => ({
  SumsubRepository: {
    getForUser: mocks.getForUser,
    consumeStatusRateLimit: mocks.consumeStatusRateLimit,
  },
}))
vi.mock('@/lib/sumsub/settings', () => ({
  getSumsubSettings: mocks.getSettings,
  sanitizeSumsubSettings: (settings: Record<string, unknown>) => ({
    enabled: settings.enabled,
    configured: settings.configured,
    effective: settings.effective,
    enforcement: settings.enforcement,
    levelName: settings.levelName,
  }),
}))

const { GET } = await import('@/app/api/sumsub/status/route')

describe('sumsub status route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
    mocks.consumeStatusRateLimit.mockResolvedValue(true)
    mocks.getSettings.mockResolvedValue({ enabled: true, configured: true, effective: true, enforcement: 'required', levelName: 'kyc' })
    mocks.getForUser.mockResolvedValue({
      level_name: 'kyc',
      status: 'approved',
      approved_at: new Date('2026-07-19T10:00:00Z'),
      updated_at: new Date('2026-07-19T10:01:00Z'),
    })
  })

  it('rejects unauthenticated requests', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
    expect(mocks.consumeStatusRateLimit).not.toHaveBeenCalled()
  })

  it('rate limits authenticated polling', async () => {
    mocks.consumeStatusRateLimit.mockResolvedValue(false)
    const response = await GET()
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('60')
    await expect(response.json()).resolves.toMatchObject({
      effective: true,
      enforcement: 'required',
      status: 'error',
      error: 'Too many status requests.',
    })
    expect(mocks.getSettings).toHaveBeenCalledOnce()
    expect(mocks.getForUser).not.toHaveBeenCalled()
  })

  it('returns only sanitized status fields for the configured level', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      enabled: true,
      configured: true,
      effective: true,
      enforcement: 'required',
      levelName: 'kyc',
      status: 'approved',
      approvedAt: '2026-07-19T10:00:00.000Z',
      updatedAt: '2026-07-19T10:01:00.000Z',
    })
  })

  it('returns not started when the applicant belongs to another level', async () => {
    mocks.getForUser.mockResolvedValue({
      level_name: 'previous-kyc',
      status: 'approved',
      approved_at: new Date('2026-07-19T10:00:00Z'),
      updated_at: new Date('2026-07-19T10:01:00Z'),
    })

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      status: 'not_started',
      approvedAt: null,
    })
  })

  it('returns 503 when verification status cannot be loaded', async () => {
    mocks.getSettings.mockRejectedValue(new Error('database unavailable'))

    const response = await GET()

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'Unable to load verification status.' })
  })

  it('preserves known enforcement when the applicant status cannot be loaded', async () => {
    mocks.getSettings.mockResolvedValue({
      enabled: false,
      configured: false,
      effective: false,
      enforcement: 'disabled',
      levelName: '',
    })
    mocks.getForUser.mockRejectedValue(new Error('database unavailable'))

    const response = await GET()

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      enabled: false,
      configured: false,
      effective: false,
      enforcement: 'disabled',
      levelName: '',
      status: 'error',
      approvedAt: null,
      updatedAt: null,
      error: 'Unable to load verification status.',
    })
  })
})
