import type { ActivityOrder } from '@/types'

export const GLOBAL_ACTIVITY_PAGE_SIZE = 50
export const GLOBAL_ACTIVITY_MAX_OFFSET = 10_000
export const GLOBAL_ACTIVITY_MAX_ITEMS = 200

export interface GlobalActivityItem {
  id: string
  categoryTags: string[]
  order: ActivityOrder
}

export interface ActivityFeedItem {
  id: string
  categories: string[]
  order: ActivityOrder
}

export interface GlobalActivityPage {
  items: GlobalActivityItem[]
  hasMore: boolean
  nextOffset: number | null
}

export function getNextGlobalActivityPageParam(
  lastPage: GlobalActivityPage,
  allPages: GlobalActivityPage[],
): number | undefined {
  const loadedItems = allPages.reduce((total, page) => total + page.items.length, 0)
  if (loadedItems >= GLOBAL_ACTIVITY_MAX_ITEMS) {
    return undefined
  }

  return lastPage.hasMore ? (lastPage.nextOffset ?? undefined) : undefined
}

function activityTimestamp(activity: ActivityFeedItem) {
  const timestamp = Date.parse(activity.order.created_at)
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function mergeGlobalActivityItems(...groups: ActivityFeedItem[][]) {
  const uniqueItems = new Map<string, ActivityFeedItem>()

  for (const group of groups) {
    for (const item of group) {
      const existing = uniqueItems.get(item.id)
      if (!existing) {
        uniqueItems.set(item.id, item)
        continue
      }

      const categories = Array.from(new Set([...existing.categories, ...item.categories]))
      const hasSameCategories =
        categories.length === existing.categories.length &&
        categories.every((category) => existing.categories.includes(category))
      if (!hasSameCategories) {
        uniqueItems.set(item.id, { ...existing, categories })
      }
    }
  }

  return [...uniqueItems.values()]
    .sort((left, right) => activityTimestamp(right) - activityTimestamp(left) || right.id.localeCompare(left.id))
    .slice(0, GLOBAL_ACTIVITY_MAX_ITEMS)
}
