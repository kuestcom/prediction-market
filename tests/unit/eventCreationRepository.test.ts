import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runQuery: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
}))

vi.mock('@/lib/db/utils/run-query', () => ({
  runQuery: (...args: any[]) => mocks.runQuery(...args),
}))

vi.mock('@/lib/drizzle', () => ({
  db: {
    update: (...args: any[]) => mocks.update(...args),
  },
}))

const { EventCreationRepository } = await import('@/lib/db/queries/event-creations')

describe('event creation repository', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mocks.runQuery.mockReset()
    mocks.update.mockReset()
    mocks.set.mockReset()
    mocks.where.mockReset()
    mocks.returning.mockReset()

    mocks.runQuery.mockImplementation(async (callback: () => Promise<unknown>) => callback())
    mocks.returning.mockResolvedValue([{ id: 'draft-1' }])
    mocks.where.mockReturnValue({ returning: mocks.returning })
    mocks.set.mockReturnValue({ where: mocks.where })
    mocks.update.mockReturnValue({ set: mocks.set })
  })

  it('does not clear last_error when lastError is omitted', async () => {
    await EventCreationRepository.setExecutionState({
      draftId: 'draft-1',
      status: 'running',
      pendingRequestId: null,
    })

    const updateValues = mocks.set.mock.calls[0]?.[0]
    expect(updateValues).toMatchObject({
      status: 'running',
      pending_request_id: null,
    })
    expect(updateValues).not.toHaveProperty('last_error')
  })

  it('keeps explicit null as the signal to clear last_error', async () => {
    await EventCreationRepository.setExecutionState({
      draftId: 'draft-1',
      status: 'scheduled',
      lastError: null,
    })

    expect(mocks.set.mock.calls[0]?.[0]).toMatchObject({
      status: 'scheduled',
      last_error: null,
    })
  })
})
