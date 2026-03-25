export const EVENT_LIST_SORT_OPTIONS = [
  'trending',
  'volume',
  'created_at',
  'end_date',
] as const

export type EventListSortBy = typeof EVENT_LIST_SORT_OPTIONS[number]

export function isEventListSortBy(value: string | null | undefined): value is EventListSortBy {
  if (!value) {
    return false
  }

  return EVENT_LIST_SORT_OPTIONS.includes(value as EventListSortBy)
}
