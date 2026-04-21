import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listHomeEventsPage: vi.fn(),
}))

vi.mock('@/lib/home-events-page', () => ({
  listHomeEventsPage: (...args: any[]) => mocks.listHomeEventsPage(...args),
}))

vi.mock('@/app/[locale]/(platform)/(home)/_components/HomeClient', () => ({
  default: () => null,
}))

describe('homeContent', () => {
  beforeEach(() => {
    mocks.listHomeEventsPage.mockReset()
  })

  it('uses the route main tag when fetching initial subcategory events', async () => {
    mocks.listHomeEventsPage.mockResolvedValueOnce({ data: [], error: null })

    const HomeContent = (await import('@/app/[locale]/(platform)/(home)/_components/HomeContent')).default
    await HomeContent({
      locale: 'en',
      initialTag: 'ai',
      initialMainTag: 'tech',
    })

    expect(mocks.listHomeEventsPage).toHaveBeenCalledWith(expect.objectContaining({
      tag: 'ai',
      mainTag: 'tech',
      locale: 'en',
      currentTimestamp: null,
    }))
  })
})
