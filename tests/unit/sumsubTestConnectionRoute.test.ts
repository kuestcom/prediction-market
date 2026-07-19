import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getSettings: vi.fn(),
  testConnection: vi.fn(),
}))

class MockSumsubClientError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message)
  }
}

vi.mock('@/lib/db/queries/user', () => ({ UserRepository: { getCurrentUser: mocks.getCurrentUser } }))
vi.mock('@/lib/sumsub/settings', () => ({
  getSumsubSettings: mocks.getSettings,
  SUMSUB_LIMITS: { appToken: 256, secretKey: 256, levelName: 128 },
}))
vi.mock('@/lib/sumsub/client', () => ({
  SumsubClientError: MockSumsubClientError,
  SumsubClient: class {
    testConnection = mocks.testConnection

    constructor(readonly credentials: unknown) {}
  },
}))

const { POST } = await import('@/app/[locale]/admin/api/sumsub/test-connection/route')
let userSequence = 0

function request(input: Record<string, unknown>) {
  return new Request('http://localhost/en/admin/api/sumsub/test-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

describe('sumsub admin connection test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userSequence += 1
    mocks.getCurrentUser.mockResolvedValue({ id: `admin-${userSequence}`, is_admin: true })
    mocks.getSettings.mockResolvedValue({ appToken: 'stored-app', secretKey: 'stored-secret' })
    mocks.testConnection.mockResolvedValue(undefined)
  })

  it('requires an administrator', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user', is_admin: false })
    expect((await POST(request({}))).status).toBe(401)
    expect(mocks.testConnection).not.toHaveBeenCalled()
  })

  it('tests unsaved credentials and the requested level', async () => {
    const response = await POST(request({
      appToken: 'draft-app',
      secretKey: 'draft-secret',
      levelName: 'draft-level',
    }))
    expect(response.status).toBe(200)
    expect(mocks.testConnection).toHaveBeenCalledWith('draft-level')
    await expect(response.json()).resolves.toEqual({
      ok: true,
      webhookNote: 'Webhook Secret is validated only when a real webhook is received.',
    })
  })

  it('resolves empty masked secret inputs from server-side settings', async () => {
    expect((await POST(request({ appToken: '', secretKey: '', levelName: 'kyc' }))).status).toBe(200)
    expect(mocks.getSettings).toHaveBeenCalledOnce()
  })

  it('rejects an incomplete or missing level before contacting Sumsub', async () => {
    mocks.getSettings.mockResolvedValue({ appToken: '', secretKey: '' })
    expect((await POST(request({ levelName: '' }))).status).toBe(400)
    expect(mocks.testConnection).not.toHaveBeenCalled()
  })

  it.each([
    [new MockSumsubClientError('Sumsub credentials were rejected.', 401), 401],
    [new MockSumsubClientError('Sumsub connection timed out.', 504), 504],
    [new MockSumsubClientError('The requested Sumsub resource was not found.', 404), 404],
  ])('returns normalized provider failures without secrets', async (error, status) => {
    mocks.testConnection.mockRejectedValue(error)
    const response = await POST(request({ levelName: 'missing-level' }))
    expect(response.status).toBe(status)
    expect(JSON.stringify(await response.json())).not.toContain('stored-secret')
  })

  it('rate limits repeated admin tests', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'rate-limited-admin', is_admin: true })
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await POST(request({ levelName: 'kyc' }))).status).toBe(200)
    }
    expect((await POST(request({ levelName: 'kyc' }))).status).toBe(429)
  })
})
