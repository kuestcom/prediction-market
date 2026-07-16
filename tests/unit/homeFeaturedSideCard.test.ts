import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  getPublicAssetUrl: vi.fn((path: string | null) => path ? `https://assets.example/${path}` : ''),
}))

vi.mock('@/lib/db/queries/settings', () => ({
  SettingsRepository: {
    getSettings: (...args: unknown[]) => mocks.getSettings(...args),
  },
}))

vi.mock('@/lib/storage', () => ({
  getPublicAssetUrl: (path: string | null) => mocks.getPublicAssetUrl(path),
}))

describe('home featured side card', () => {
  beforeEach(() => {
    mocks.getSettings.mockReset()
    mocks.getPublicAssetUrl.mockClear()
  })

  it('returns no slides when every configured slide is disabled', async () => {
    mocks.getSettings.mockResolvedValue({
      data: {
        home_featured: {
          side_card_slides_v1: {
            value: JSON.stringify([
              { id: 'disabled-text', type: 'text', enabled: false, title: 'Hidden', text: 'Hidden slide' },
            ]),
            updated_at: '',
          },
        },
      },
      error: null,
    })

    const { getHomeFeaturedSideCard } = await import('@/lib/home-featured-events')
    const sideCard = await getHomeFeaturedSideCard([], [])

    expect(sideCard.slides).toEqual([])
  })

  it('excludes an enabled image slide until it has a public image URL', async () => {
    mocks.getSettings.mockResolvedValue({
      data: {
        home_featured: {
          side_card_slides_v1: {
            value: JSON.stringify([
              { id: 'unfinished-image', type: 'image', enabled: true, imagePath: '' },
              { id: 'ready-text', type: 'text', enabled: true, title: 'Visible', text: 'Ready slide' },
            ]),
            updated_at: '',
          },
        },
      },
      error: null,
    })

    const { getHomeFeaturedSideCard } = await import('@/lib/home-featured-events')
    const sideCard = await getHomeFeaturedSideCard([], [])

    expect(sideCard.slides).toHaveLength(1)
    expect(sideCard.slides[0]).toMatchObject({ id: 'ready-text', type: 'text' })
    expect(sideCard.slides.some(slide => slide.type === 'image' && !slide.imageUrl)).toBe(false)
  })
})
