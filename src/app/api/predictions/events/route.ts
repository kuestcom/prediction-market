import { NextResponse } from 'next/server'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/locales'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'
import { isEventListSortBy, isEventListStatusFilter } from '@/lib/event-list-filters'
import { listPredictionResultsPage } from '@/lib/prediction-results-events'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tag = searchParams.get('tag') || 'trending'
  const mainTag = searchParams.get('mainTag') || ''
  const search = searchParams.get('search') || ''
  const bookmarked = searchParams.get('bookmarked') === 'true'
  const includeBookmarkState = searchParams.get('includeBookmarkState') !== 'false'
  const statusParam = searchParams.get('status')
  const status = statusParam ?? 'active'
  const sortParam = searchParams.get('sort')
  const sortBy = isEventListSortBy(sortParam) ? sortParam : undefined
  const localeParam = searchParams.get('locale') ?? DEFAULT_LOCALE
  const locale = SUPPORTED_LOCALES.includes(localeParam as typeof SUPPORTED_LOCALES[number])
    ? localeParam as typeof SUPPORTED_LOCALES[number]
    : DEFAULT_LOCALE
  const offset = Number.parseInt(searchParams.get('offset') || '0', 10)
  const clampedOffset = Number.isNaN(offset) ? 0 : Math.max(0, offset)

  if (!isEventListStatusFilter(status)) {
    return NextResponse.json({ error: 'Invalid status filter.' }, { status: 400 })
  }

  const shouldResolveCurrentUser = bookmarked || includeBookmarkState
  const user = shouldResolveCurrentUser
    ? await UserRepository.getCurrentUser({ minimal: true })
    : null
  const userId = user?.id

  try {
    if (bookmarked && !userId) {
      return NextResponse.json([])
    }

    const { data: events, error } = await listPredictionResultsPage({
      bookmarked,
      locale,
      mainTag,
      offset: clampedOffset,
      search,
      sortBy,
      status,
      tag,
      userId: userId ?? '',
    })

    if (error) {
      return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    return NextResponse.json(events)
  }
  catch (error) {
    console.error('Prediction results API error:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
