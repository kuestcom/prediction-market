import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}))

vi.mock('@/lib/drizzle', () => ({
  db: { execute: mocks.execute },
}))

describe('identity operation rate limit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('consumes a slot through one atomic upsert statement', async () => {
    mocks.execute.mockResolvedValue([{ attempt_count: 1 }])
    const { consumeIdentityRateLimit } = await import('@/lib/identity/rate-limit')

    await expect(consumeIdentityRateLimit('user-1', 'upload_document', 10, 60_000)).resolves.toBeUndefined()
    expect(mocks.execute).toHaveBeenCalledTimes(1)
  })

  it('fails closed when the atomic conflict update returns no quota row', async () => {
    mocks.execute.mockResolvedValue([])
    const { consumeIdentityRateLimit } = await import('@/lib/identity/rate-limit')

    await expect(consumeIdentityRateLimit('user-1', 'upload_document', 10, 60_000)).rejects.toThrow('IDENTITY_RATE_LIMITED')
  })

  it('rejects invalid quota configuration before querying the database', async () => {
    const { consumeIdentityRateLimit } = await import('@/lib/identity/rate-limit')

    await expect(consumeIdentityRateLimit('user-1', 'upload_document', 0, 60_000)).rejects.toThrow('configuration is invalid')
    expect(mocks.execute).not.toHaveBeenCalled()
  })
})
