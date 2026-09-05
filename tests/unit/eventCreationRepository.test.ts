import { beforeEach, describe, expect, it, mock, jest } from 'bun:test'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  runQuery: mock(),
  update: mock(),
  set: mock(),
  where: mock(),
  returning: mock(),
}))

void mock.module('@/lib/db/utils/run-query', () => ({
  runQuery: (...args: any[]) => mocks.runQuery(...args),
}))

void mock.module('@/lib/drizzle', () => ({
  db: {
    update: (...args: any[]) => mocks.update(...args),
  },
}))

const { EventCreationRepository } = await import('@/lib/db/queries/event-creations')

describe('event creation repository', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
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
