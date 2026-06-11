import type { EventListSortBy } from '@/lib/event-list-filters'

export function getDefaultHomeRouteSortBy(tag: string): EventListSortBy {
  return tag === 'new' ? 'created_at' : 'volume_24h'
}

export function getInitialHomeEventsSortBy(tag: string): EventListSortBy | undefined {
  return tag === 'new' ? undefined : getDefaultHomeRouteSortBy(tag)
}
