import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cacheTag: vi.fn(),
  revalidatePath: vi.fn(),
  runQuery: vi.fn(),
}))

vi.mock('next/cache', () => ({
  cacheTag: (...args: any[]) => mocks.cacheTag(...args),
  revalidatePath: (...args: any[]) => mocks.revalidatePath(...args),
}))

vi.mock('@/lib/db/utils/run-query', () => ({
  runQuery: (...args: any[]) => mocks.runQuery(...args),
}))

describe('tagRepository.getMainTags', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.cacheTag.mockReset()
    mocks.revalidatePath.mockReset()
    mocks.runQuery.mockReset()
  })

  it('keeps shared subcategories under each matching main category', async () => {
    const now = new Date('2026-03-11T00:00:00.000Z')

    mocks.runQuery
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            name: 'Tech',
            slug: 'tech',
            is_main_category: true,
            is_hidden: false,
            display_order: 1,
            active_markets_count: 2,
            created_at: now,
            updated_at: now,
          },
          {
            id: 2,
            name: 'World',
            slug: 'world',
            is_main_category: true,
            is_hidden: false,
            display_order: 2,
            active_markets_count: 2,
            created_at: now,
            updated_at: now,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            main_tag_id: 1,
            main_tag_slug: 'tech',
            main_tag_name: 'Tech',
            main_tag_is_hidden: false,
            sub_tag_id: 101,
            sub_tag_name: 'Shared',
            sub_tag_slug: 'shared',
            sub_tag_is_main_category: false,
            sub_tag_is_hidden: false,
            active_markets_count: 1,
            last_market_activity_at: now,
          },
          {
            main_tag_id: 2,
            main_tag_slug: 'world',
            main_tag_name: 'World',
            main_tag_is_hidden: false,
            sub_tag_id: 101,
            sub_tag_name: 'Shared',
            sub_tag_slug: 'shared',
            sub_tag_is_main_category: false,
            sub_tag_is_hidden: false,
            active_markets_count: 1,
            last_market_activity_at: now,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            event_id: 'event-tech',
            event_slug: 'event-tech',
            event_status: 'active',
            series_slug: null,
            end_date: now,
            created_at: now,
            updated_at: now,
            tag_slug: 'tech',
            tag_is_main_category: true,
          },
          {
            event_id: 'event-tech',
            event_slug: 'event-tech',
            event_status: 'active',
            series_slug: null,
            end_date: now,
            created_at: now,
            updated_at: now,
            tag_slug: 'shared',
            tag_is_main_category: false,
          },
          {
            event_id: 'event-world',
            event_slug: 'event-world',
            event_status: 'active',
            series_slug: null,
            end_date: now,
            created_at: now,
            updated_at: now,
            tag_slug: 'world',
            tag_is_main_category: true,
          },
          {
            event_id: 'event-world',
            event_slug: 'event-world',
            event_status: 'active',
            series_slug: null,
            end_date: now,
            created_at: now,
            updated_at: now,
            tag_slug: 'shared',
            tag_is_main_category: false,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ current_timestamp_ms: now.getTime() }],
        error: null,
      })

    const { TagRepository } = await import('@/lib/db/queries/tag')
    const result = await TagRepository.getMainTags('en')

    expect(result.error).toBeNull()
    expect(result.data).toMatchObject([
      {
        slug: 'tech',
        childs: [{ slug: 'shared', name: 'Shared', count: 1 }],
      },
      {
        slug: 'world',
        childs: [{ slug: 'shared', name: 'Shared', count: 1 }],
      },
    ])
    expect(result.globalChilds).toEqual([{ slug: 'shared', name: 'Shared', count: 2 }])
  })

  it('counts only the visible series winner for sidebar totals', async () => {
    const now = new Date('2026-03-12T12:00:00.000Z')
    const earlier = new Date('2026-03-11T12:00:00.000Z')

    mocks.runQuery
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            name: 'Finance',
            slug: 'finance',
            is_main_category: true,
            is_hidden: false,
            display_order: 1,
            active_markets_count: 5,
            created_at: now,
            updated_at: now,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            main_tag_id: 1,
            main_tag_slug: 'finance',
            main_tag_name: 'Finance',
            main_tag_is_hidden: false,
            sub_tag_id: 101,
            sub_tag_name: 'Stocks',
            sub_tag_slug: 'stocks',
            sub_tag_is_main_category: false,
            sub_tag_is_hidden: false,
            active_markets_count: 2,
            last_market_activity_at: now,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            event_id: 'finance-older',
            event_slug: 'finance-older',
            event_status: 'active',
            series_slug: 'stocks-series',
            end_date: now,
            created_at: earlier,
            updated_at: earlier,
            tag_slug: 'finance',
            tag_is_main_category: true,
          },
          {
            event_id: 'finance-older',
            event_slug: 'finance-older',
            event_status: 'active',
            series_slug: 'stocks-series',
            end_date: now,
            created_at: earlier,
            updated_at: earlier,
            tag_slug: 'stocks',
            tag_is_main_category: false,
          },
          {
            event_id: 'finance-newer',
            event_slug: 'finance-newer',
            event_status: 'active',
            series_slug: 'stocks-series',
            end_date: now,
            created_at: now,
            updated_at: now,
            tag_slug: 'finance',
            tag_is_main_category: true,
          },
          {
            event_id: 'finance-newer',
            event_slug: 'finance-newer',
            event_status: 'active',
            series_slug: 'stocks-series',
            end_date: now,
            created_at: now,
            updated_at: now,
            tag_slug: 'stocks',
            tag_is_main_category: false,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ current_timestamp_ms: now.getTime() }],
        error: null,
      })

    const { TagRepository } = await import('@/lib/db/queries/tag')
    const result = await TagRepository.getMainTags('en')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)
    expect(result.data?.[0]?.childs.find(child => child.slug === 'stocks')).toEqual({
      slug: 'stocks',
      name: 'Stocks',
      count: 1,
    })
    expect(result.data?.[0]?.sidebarItems?.find(item => item.type === 'link' && item.slug === 'finance')).toMatchObject({
      slug: 'finance',
      count: 1,
      isAll: true,
    })
    expect(result.data?.[0]?.sidebarItems?.find(item => item.type === 'link' && item.slug === 'stocks')).toMatchObject({
      slug: 'stocks',
      count: 1,
    })
  })

  it('uses the current timestamp to keep sidebar counts on the preferred series event', async () => {
    const now = new Date('2026-03-12T12:00:00.000Z')
    const earlier = new Date('2026-03-11T12:00:00.000Z')
    const soonerEnd = new Date('2026-03-13T12:00:00.000Z')
    const laterEnd = new Date('2026-03-20T12:00:00.000Z')

    mocks.runQuery
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            name: 'Finance',
            slug: 'finance',
            is_main_category: true,
            is_hidden: false,
            display_order: 1,
            active_markets_count: 5,
            created_at: now,
            updated_at: now,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            main_tag_id: 1,
            main_tag_slug: 'finance',
            main_tag_name: 'Finance',
            main_tag_is_hidden: false,
            sub_tag_id: 101,
            sub_tag_name: 'Stocks',
            sub_tag_slug: 'stocks',
            sub_tag_is_main_category: false,
            sub_tag_is_hidden: false,
            active_markets_count: 2,
            last_market_activity_at: now,
          },
          {
            main_tag_id: 1,
            main_tag_slug: 'finance',
            main_tag_name: 'Finance',
            main_tag_is_hidden: false,
            sub_tag_id: 102,
            sub_tag_name: 'Tech',
            sub_tag_slug: 'tech',
            sub_tag_is_main_category: false,
            sub_tag_is_hidden: false,
            active_markets_count: 2,
            last_market_activity_at: now,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            event_id: 'finance-sooner',
            event_slug: 'finance-sooner',
            event_status: 'active',
            series_slug: 'finance-series',
            end_date: soonerEnd,
            created_at: earlier,
            updated_at: earlier,
            tag_slug: 'finance',
            tag_is_main_category: true,
          },
          {
            event_id: 'finance-sooner',
            event_slug: 'finance-sooner',
            event_status: 'active',
            series_slug: 'finance-series',
            end_date: soonerEnd,
            created_at: earlier,
            updated_at: earlier,
            tag_slug: 'stocks',
            tag_is_main_category: false,
          },
          {
            event_id: 'finance-later',
            event_slug: 'finance-later',
            event_status: 'active',
            series_slug: 'finance-series',
            end_date: laterEnd,
            created_at: now,
            updated_at: now,
            tag_slug: 'finance',
            tag_is_main_category: true,
          },
          {
            event_id: 'finance-later',
            event_slug: 'finance-later',
            event_status: 'active',
            series_slug: 'finance-series',
            end_date: laterEnd,
            created_at: now,
            updated_at: now,
            tag_slug: 'tech',
            tag_is_main_category: false,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ current_timestamp_ms: now.getTime() }],
        error: null,
      })

    const { TagRepository } = await import('@/lib/db/queries/tag')
    const result = await TagRepository.getMainTags('en')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)
    expect(result.data?.[0]?.childs.find(child => child.slug === 'stocks')).toEqual({
      slug: 'stocks',
      name: 'Stocks',
      count: 1,
    })
    expect(result.data?.[0]?.childs.find(child => child.slug === 'tech')).toBeUndefined()
    expect(result.data?.[0]?.sidebarItems?.find(item => item.type === 'link' && item.slug === 'stocks')).toMatchObject({
      slug: 'stocks',
      count: 1,
    })
    expect(result.data?.[0]?.sidebarItems?.find(item => item.type === 'link' && item.slug === 'tech')).toBeUndefined()
  })
})

describe('tagRepository.listTags', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.cacheTag.mockReset()
    mocks.revalidatePath.mockReset()
    mocks.runQuery.mockReset()
  })

  it('derives visible active event counts and sorts by them', async () => {
    const now = new Date('2026-03-12T12:00:00.000Z')
    const earlier = new Date('2026-03-11T12:00:00.000Z')

    mocks.runQuery
      .mockResolvedValueOnce({
        data: [{ count: 2 }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 11,
            name: 'Weather',
            slug: 'weather',
            is_main_category: true,
            is_hidden: false,
            hide_events: false,
            display_order: 1,
            active_markets_count: 57,
            created_at: now,
            updated_at: now,
          },
          {
            id: 12,
            name: 'Sports',
            slug: 'sports',
            is_main_category: true,
            is_hidden: false,
            hide_events: false,
            display_order: 2,
            active_markets_count: 4,
            created_at: now,
            updated_at: now,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            event_id: 'weather-older',
            event_slug: 'weather-older',
            event_status: 'active',
            series_slug: 'weather-series',
            end_date: now,
            created_at: earlier,
            updated_at: earlier,
            tag_slug: 'weather',
          },
          {
            event_id: 'weather-newer',
            event_slug: 'weather-newer',
            event_status: 'active',
            series_slug: 'weather-series',
            end_date: now,
            created_at: now,
            updated_at: now,
            tag_slug: 'weather',
          },
          {
            event_id: 'weather-extra',
            event_slug: 'weather-extra',
            event_status: 'active',
            series_slug: null,
            end_date: now,
            created_at: now,
            updated_at: now,
            tag_slug: 'weather',
          },
          {
            event_id: 'sports-one',
            event_slug: 'sports-one',
            event_status: 'active',
            series_slug: null,
            end_date: now,
            created_at: now,
            updated_at: now,
            tag_slug: 'sports',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [],
        error: null,
      })

    const { TagRepository } = await import('@/lib/db/queries/tag')
    const result = await TagRepository.listTags({
      sortBy: 'active_events_count',
      sortOrder: 'desc',
    })

    expect(result.error).toBeNull()
    expect(result.totalCount).toBe(2)
    expect(result.data.map(tag => ({
      slug: tag.slug,
      active_events_count: tag.active_events_count,
      active_markets_count: tag.active_markets_count,
    }))).toEqual([
      {
        slug: 'weather',
        active_events_count: 2,
        active_markets_count: 57,
      },
      {
        slug: 'sports',
        active_events_count: 1,
        active_markets_count: 4,
      },
    ])
  })
})
