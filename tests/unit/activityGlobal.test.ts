import { describe, expect, it } from 'bun:test'

import {
  getNextGlobalActivityPageParam,
  GLOBAL_ACTIVITY_MAX_ITEMS,
  mergeGlobalActivityItems,
  type ActivityFeedItem,
  type GlobalActivityPage,
} from '@/lib/activity/global'

function createActivity(id: string, categories: string[], createdAt = '2026-01-01T00:00:00.000Z') {
  return {
    id,
    categories,
    order: { created_at: createdAt },
  } as unknown as ActivityFeedItem
}

function createPage(itemCount: number, hasMore = true, nextOffset: number | null = itemCount) {
  return {
    items: Array.from({ length: itemCount }, (_, index) => ({
      id: `item-${index}`,
      categoryTags: [],
      order: { created_at: '2026-01-01T00:00:00.000Z' },
    })),
    hasMore,
    nextOffset,
  } as unknown as GlobalActivityPage
}

describe('global activity helpers', () => {
  it('merges categories when a live item duplicates a historical item', () => {
    const merged = mergeGlobalActivityItems(
      [createActivity('trade-1', ['politics'])],
      [createActivity('trade-1', ['sports'])],
    )

    expect(merged).toHaveLength(1)
    expect(merged[0]?.categories).toEqual(['politics', 'sports'])
  })

  it('stops requesting historical pages once the rendered activity cap is loaded', () => {
    const pages = [createPage(50), createPage(50), createPage(50), createPage(50)]

    expect(getNextGlobalActivityPageParam(pages[3]!, pages)).toBeUndefined()
    expect(getNextGlobalActivityPageParam(pages[0]!, [pages[0]!])).toBe(50)
    expect(GLOBAL_ACTIVITY_MAX_ITEMS).toBe(200)
  })
})
