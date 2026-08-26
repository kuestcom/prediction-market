import { beforeEach, describe, expect, it, vi } from 'vitest'

import { cacheTags } from '@/lib/cache-tags'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  revalidatePath: vi.fn(),
  updateEventTranslationsById: vi.fn(),
  updateTag: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: (...args: any[]) => mocks.revalidatePath(...args),
  updateTag: (...args: any[]) => mocks.updateTag(...args),
}))

vi.mock('@/lib/db/queries/event', () => ({
  EventRepository: {
    updateEventTranslationsById: (...args: any[]) => mocks.updateEventTranslationsById(...args),
  },
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: {
    getCurrentUser: (...args: any[]) => mocks.getCurrentUser(...args),
  },
}))

const { updateEventTranslationsAction } = await import('@/app/[locale]/admin/events/_actions/update-event-translations')

describe('updateEventTranslationsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates event translations and invalidates public event caches', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.updateEventTranslationsById.mockResolvedValueOnce({
      data: {
        slug: 'event-slug',
        translations: { pt: 'Título traduzido' },
      },
      error: null,
    })

    const result = await updateEventTranslationsAction('event-1', {
      pt: ' Título traduzido ',
      fr: '',
    })

    expect(result).toEqual({
      success: true,
      data: { pt: 'Título traduzido' },
    })
    expect(mocks.updateEventTranslationsById).toHaveBeenCalledWith('event-1', {
      pt: ' Título traduzido ',
      fr: '',
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/[locale]/admin/events', 'page')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/[locale]/event/[slug]', 'page')
    expect(mocks.updateTag).toHaveBeenCalledWith(cacheTags.eventsList)
    expect(mocks.updateTag).toHaveBeenCalledWith(cacheTags.event('event-slug'))
    expect(mocks.updateTag).toHaveBeenCalledWith(cacheTags.events('admin-1'))
  })

  it('rejects non-admin users before writing translations', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null)

    await expect(updateEventTranslationsAction('event-1', { pt: 'Título' })).resolves.toEqual({
      success: false,
      error: 'Unauthorized. Admin access required.',
    })
    expect(mocks.updateEventTranslationsById).not.toHaveBeenCalled()
  })
})
