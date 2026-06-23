import type { SupportedLocale } from '@/i18n/locales'
import type { EventListSortBy, EventListStatusFilter } from '@/lib/event-list-filters'
import type { Event } from '@/types'
import { EventRepository } from '@/lib/db/queries/event'
import { PREDICTION_RESULTS_PAGE_SIZE } from '@/lib/prediction-results-constants'

interface ListPredictionResultsPageOptions {
  bookmarked: boolean
  locale: SupportedLocale
  mainTag: string
  offset?: number
  search?: string
  sortBy?: EventListSortBy
  status?: EventListStatusFilter
  tag: string
  userId: string
}

export async function listPredictionResultsPage({
  bookmarked,
  locale,
  mainTag,
  offset = 0,
  search = '',
  sortBy,
  status = 'active',
  tag,
  userId,
}: ListPredictionResultsPageOptions): Promise<{
  data: Event[]
  error: string | null
}> {
  const targetOffset = Math.max(0, offset)
  const { data, error } = await EventRepository.listEvents({
    bookmarked,
    excludeSportsAuxiliary: true,
    limit: PREDICTION_RESULTS_PAGE_SIZE,
    locale,
    mainTag,
    offset: targetOffset,
    preferResolvedDateOrder: status === 'resolved' && !sortBy,
    search,
    skipLivePricing: status === 'resolved',
    sortBy,
    status,
    tag,
    userId,
  })

  return {
    data: data ?? [],
    error,
  }
}
