import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isBookmarked: vi.fn(),
  toggleBookmark: vi.fn(),
  updateTag: vi.fn(),
}))

vi.mock('next/cache', () => ({
  updateTag: (...args: any[]) => mocks.updateTag(...args),
}))

vi.mock('@/lib/db/queries/bookmark', () => ({
  BookmarkRepository: {
    isBookmarked: (...args: any[]) => mocks.isBookmarked(...args),
    toggleBookmark: (...args: any[]) => mocks.toggleBookmark(...args),
  },
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: {
    getCurrentUser: (...args: any[]) => mocks.getCurrentUser(...args),
  },
}))

describe('bookmark actions', () => {
  beforeEach(() => {
    mocks.getCurrentUser.mockReset()
    mocks.isBookmarked.mockReset()
    mocks.toggleBookmark.mockReset()
    mocks.updateTag.mockReset()
  })

  it('expires the acting user event-list cache after a bookmark toggle', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'user-1' })
    mocks.toggleBookmark.mockResolvedValueOnce({ data: true, error: null })

    const { toggleBookmarkAction } = await import('@/app/[locale]/(platform)/_actions/bookmark')
    const result = await toggleBookmarkAction('event-1')

    expect(result).toEqual({
      data: {
        isBookmarked: true,
        userId: 'user-1',
      },
      error: null,
    })
    expect(mocks.updateTag).toHaveBeenCalledWith('events:user-1')
  })

  it('does not expire event-list cache when the toggle fails', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'user-1' })
    mocks.toggleBookmark.mockResolvedValueOnce({ data: null, error: 'Failed' })

    const { toggleBookmarkAction } = await import('@/app/[locale]/(platform)/_actions/bookmark')
    await toggleBookmarkAction('event-1')

    expect(mocks.updateTag).not.toHaveBeenCalled()
  })
})
