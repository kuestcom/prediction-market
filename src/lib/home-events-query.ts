import type { FilterState } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import type { HomeEventsApiPage } from '@/lib/events-api'

import { fetchHomeEventsPageApi } from '@/lib/events-api'

export const HOME_FEED_REFRESH_INTERVAL_MS = 60_000

export type HomeFeedClockState = 'clock-ready' | 'clock-pending' | 'clock-static'

export type HomeEventsQueryKey = readonly [
  'events',
  string,
  string,
  string,
  boolean,
  FilterState['frequency'],
  FilterState['sortBy'],
  FilterState['status'],
  boolean,
  boolean,
  boolean,
  string,
  string,
  HomeFeedClockState,
]

export function getHomeEventsQueryKey({
  filters,
  locale,
  queryUserScope,
  homeFeedClockState,
}: {
  filters: FilterState
  homeFeedClockState: HomeFeedClockState
  locale: string
  queryUserScope: string
}): HomeEventsQueryKey {
  return [
    'events',
    filters.tag,
    filters.mainTag,
    filters.search,
    filters.bookmarked,
    filters.frequency,
    filters.sortBy,
    filters.status,
    filters.hideSports,
    filters.hideCrypto,
    filters.hideEarnings,
    locale,
    queryUserScope,
    homeFeedClockState,
  ]
}

export async function fetchHomeEventsQueryPage({
  pageParam,
  currentTimestamp,
  filters,
  locale,
}: {
  currentTimestamp: number | null
  filters: FilterState
  locale: string
  pageParam: number
}): Promise<HomeEventsApiPage> {
  return fetchHomeEventsPageApi({
    tag: filters.tag,
    mainTag: filters.mainTag,
    search: filters.search,
    bookmarked: filters.bookmarked,
    frequency: filters.frequency,
    status: filters.status,
    sort: filters.sortBy,
    offset: pageParam,
    locale,
    currentTimestamp,
    hideSports: filters.hideSports,
    hideCrypto: filters.hideCrypto,
    hideEarnings: filters.hideEarnings,
  })
}

export function getHomeEventsNextPageParam(lastPage: HomeEventsApiPage, allPages: HomeEventsApiPage[]) {
  return lastPage.hasMore ? allPages.reduce((offset, page) => offset + page.events.length, 0) : undefined
}
