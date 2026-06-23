import type { EventListSortBy, EventListStatusFilter } from '@/lib/event-list-filters'
import type { Event } from '@/types'

interface BuildPredictionResultsApiSearchParamsOptions {
  bookmarked?: boolean
  locale: string
  mainTag?: string
  offset?: number
  search?: string
  sort?: EventListSortBy
  status?: EventListStatusFilter
  tag: string
}

function buildPredictionResultsApiSearchParams({
  bookmarked = false,
  locale,
  mainTag,
  offset = 0,
  search = '',
  sort,
  status = 'active',
  tag,
}: BuildPredictionResultsApiSearchParamsOptions) {
  const params = new URLSearchParams({
    bookmarked: String(bookmarked),
    locale,
    offset: offset.toString(),
    status,
    tag,
  })

  const normalizedMainTag = mainTag?.trim()
  if (normalizedMainTag) {
    params.set('mainTag', normalizedMainTag)
  }

  const normalizedSearch = search.trim()
  if (normalizedSearch) {
    params.set('search', normalizedSearch)
  }

  if (sort) {
    params.set('sort', sort)
  }

  return params
}

export async function fetchPredictionResultsApi(options: BuildPredictionResultsApiSearchParamsOptions): Promise<Event[]> {
  const params = buildPredictionResultsApiSearchParams(options)
  const response = await fetch(`/api/predictions/events?${params.toString()}`)

  if (!response.ok) {
    throw new Error('Failed to fetch prediction results')
  }

  return response.json()
}
