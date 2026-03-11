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
          { main_tag_slug: 'tech', count: 2 },
          { main_tag_slug: 'world', count: 2 },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          { main_tag_slug: 'tech', sub_tag_slug: 'shared', count: 1 },
          { main_tag_slug: 'world', sub_tag_slug: 'shared', count: 1 },
        ],
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
})
