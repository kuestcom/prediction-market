import { beforeEach, describe, expect, it, mock } from 'bun:test'
import * as actualNextCache from 'next/cache'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  getSettings: mock(),
  getPublicAssetUrl: mock((path: string | null) => (path ? `https://assets.example/${path}` : '')),
}))

void mock.module('next-intl/server', () => ({
  getExtracted:
    async ({ locale }: { locale: string }) =>
    (message: string, values?: Record<string, string>) => {
      const translations: Record<string, string> = {
        '{categoryName} leads volume': '{categoryName}成交量领先',
        '{volume} tracked across active and recently settled markets.': '活跃及近期结算市场累计追踪{volume}。',
      }
      const translated = locale === 'zh' ? (translations[message] ?? message) : message

      return translated.replace(/\{(\w+)\}/g, (_match, key: string) => values?.[key] ?? `{${key}}`)
    },
}))

void mock.module('next/cache', () => {
  return {
    ...actualNextCache,
    cacheLife: mock(),
    cacheTag: mock(),
  }
})

void mock.module('@/lib/db/queries/settings', () => ({
  SettingsRepository: {
    getSettings: (...args: unknown[]) => mocks.getSettings(...args),
  },
}))

void mock.module('@/lib/storage', () => ({
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
    expect(sideCard.slides.some((slide) => slide.type === 'image' && !slide.imageUrl)).toBe(false)
  })

  it('localizes generated title and body templates for Chinese pages', async () => {
    mocks.getSettings.mockResolvedValue({
      data: {
        home_featured: {
          side_card_slides_v1: {
            value: JSON.stringify([
              {
                id: 'generated-text',
                type: 'text',
                enabled: true,
                title: '',
                text: '',
                useAi: true,
              },
            ]),
            updated_at: '',
          },
        },
      },
      error: null,
    })

    const { getHomeFeaturedSideCard } = await import('@/lib/home-featured-events')
    const sideCard = await getHomeFeaturedSideCard(
      [],
      [
        {
          label: '政治',
          slug: 'politics',
          href: '/zh/markets/politics',
          volume24h: 21_194,
        } as any,
      ],
      'zh',
    )

    expect(sideCard.slides[0]).toMatchObject({
      title: '政治成交量领先',
      text: '活跃及近期结算市场累计追踪$21,194。',
    })
  })
})
