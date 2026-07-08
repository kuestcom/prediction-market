import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listHomeEventsPage: vi.fn(),
}))

vi.mock('@/lib/home-events-page', () => ({
  listHomeEventsPage: (...args: any[]) => mocks.listHomeEventsPage(...args),
}))

vi.mock('next/cache', async () => {
  const actual = await vi.importActual<typeof import('next/cache')>('next/cache')

  return {
    ...actual,
    cacheLife: vi.fn(),
    cacheTag: vi.fn(),
  }
})

vi.mock('@/app/[locale]/(platform)/(home)/_components/HomeClient', () => ({
  default: () => null,
}))

describe('homeContent', () => {
  beforeEach(() => {
    mocks.listHomeEventsPage.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses the route main tag when fetching initial subcategory events', async () => {
    const currentTimestamp = Date.parse('2026-05-11T12:30:00.000Z')
    mocks.listHomeEventsPage.mockResolvedValueOnce({ data: [], error: null })

    const HomeContent = (await import('@/app/[locale]/(platform)/(home)/_components/HomeContent')).default
    await HomeContent({
      locale: 'en',
      initialTag: 'ai',
      initialMainTag: 'tech',
      currentTimestamp,
    })

    expect(mocks.listHomeEventsPage).toHaveBeenCalledWith(expect.objectContaining({
      tag: 'ai',
      mainTag: 'tech',
      locale: 'en',
      currentTimestamp,
    }))
  })

  it('uses the provided current timestamp for initial home events', async () => {
    const currentTimestamp = Date.parse('2026-05-11T12:34:00.000Z')
    mocks.listHomeEventsPage.mockResolvedValueOnce({ data: [], error: null, currentTimestamp })

    const HomeContent = (await import('@/app/[locale]/(platform)/(home)/_components/HomeContent')).default
    await HomeContent({
      locale: 'en',
      currentTimestamp,
    })

    expect(mocks.listHomeEventsPage).toHaveBeenCalledWith(expect.objectContaining({
      currentTimestamp,
    }))
  })

  it('omits sortBy for the new route so repository keeps newest-first default', async () => {
    mocks.listHomeEventsPage.mockResolvedValueOnce({ data: [], error: null })

    const HomeContent = (await import('@/app/[locale]/(platform)/(home)/_components/HomeContent')).default
    await HomeContent({
      locale: 'en',
      initialTag: 'new',
      currentTimestamp: Date.parse('2026-05-11T12:30:00.000Z'),
    })

    expect(mocks.listHomeEventsPage).toHaveBeenCalledWith(expect.not.objectContaining({
      sortBy: expect.anything(),
    }))
  })
})
