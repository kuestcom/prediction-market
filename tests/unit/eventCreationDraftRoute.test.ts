import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  updateDraftCoreFields: vi.fn(),
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: {
    getCurrentUser: (...args: any[]) => mocks.getCurrentUser(...args),
  },
}))

vi.mock('@/lib/db/queries/event-creations', () => ({
  EventCreationRepository: {
    updateDraftCoreFields: (...args: any[]) => mocks.updateDraftCoreFields(...args),
  },
}))

const { PATCH } = await import('@/app/[locale]/admin/api/event-creations/[id]/route')

describe('event creation draft route', () => {
  beforeEach(() => {
    mocks.getCurrentUser.mockReset()
    mocks.updateDraftCoreFields.mockReset()
  })

  it('keeps omitted fields undefined during partial updates', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.updateDraftCoreFields.mockResolvedValueOnce({
      data: {
        id: 'draft-1',
        title: 'Updated title',
        slug: null,
        titleTemplate: null,
        slugTemplate: null,
        creationMode: 'single',
        status: 'draft',
        startAt: null,
        deployAt: null,
        recurrenceUnit: null,
        recurrenceInterval: null,
        recurrenceUntil: null,
        walletAddress: null,
        updatedAt: new Date().toISOString(),
      },
      error: null,
    })

    const response = await PATCH(new Request('https://example.com/admin/api/event-creations/draft-1', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Updated title',
      }),
    }) as any, {
      params: Promise.resolve({ id: 'draft-1', locale: 'en' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.updateDraftCoreFields).toHaveBeenCalledWith(expect.objectContaining({
      draftId: 'draft-1',
      title: 'Updated title',
      slug: undefined,
      startAt: undefined,
      deployAt: undefined,
      endDate: undefined,
      walletAddress: undefined,
      recurrenceInterval: undefined,
      draftPayload: undefined,
      marketMode: undefined,
      binaryQuestion: undefined,
      resolutionRules: undefined,
    }))
  })
})
