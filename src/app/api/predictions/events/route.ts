import { NextResponse } from 'next/server'

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/locales'
import { rankCandidatesWithDecisionModel } from '@/lib/ai/decision-model'
import { loadOpenRouterProviderSettings } from '@/lib/ai/market-context-config'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'
import { isEventListSortBy, isEventListStatusFilter } from '@/lib/event-list-filters'
import { listPredictionResultsPage } from '@/lib/prediction-results-events'

function buildPredictionSearchDecisionCacheKey({
  model,
  locale,
  normalizedSearch,
  status,
  tag,
  mainTag,
  sortBy,
  candidates,
}: {
  model: string
  locale: string
  normalizedSearch: string
  status: string
  tag: string
  mainTag: string
  sortBy?: string
  candidates: readonly { id: string; slug: string }[]
}) {
  return JSON.stringify([
    'prediction-search',
    model,
    locale,
    normalizedSearch.toLowerCase(),
    status,
    tag,
    mainTag,
    sortBy ?? '',
    candidates.map((candidate) => [candidate.id, candidate.slug]),
  ])
}

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
  const locale = SUPPORTED_LOCALES.includes(localeParam as (typeof SUPPORTED_LOCALES)[number])
    ? (localeParam as (typeof SUPPORTED_LOCALES)[number])
    : DEFAULT_LOCALE
  const offset = Number.parseInt(searchParams.get('offset') || '0', 10)
  const clampedOffset = Number.isNaN(offset) ? 0 : Math.max(0, offset)

  if (!isEventListStatusFilter(status)) {
    return NextResponse.json({ error: 'Invalid status filter.' }, { status: 400 })
  }

  const normalizedSearch = search.trim()
  const shouldResolveCurrentUser = bookmarked || includeBookmarkState
  const user = shouldResolveCurrentUser ? await UserRepository.getCurrentUser({ minimal: true }) : null
  const userId = bookmarked || includeBookmarkState ? user?.id : undefined

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

    let rankedEvents = events
    const shouldRankFirstPage = clampedOffset === 0 && rankedEvents.length > 1
    if (shouldRankFirstPage && normalizedSearch.length >= 3) {
      try {
        const openRouterSettings = await loadOpenRouterProviderSettings()
        if (openRouterSettings.apiKey && openRouterSettings.decisionModel) {
          const candidatesToRank = rankedEvents.slice(0, 16)
          const cacheKey = buildPredictionSearchDecisionCacheKey({
            model: openRouterSettings.decisionModel,
            locale,
            normalizedSearch,
            status,
            tag,
            mainTag,
            sortBy,
            candidates: candidatesToRank,
          })

          const rankedCandidates = await rankCandidatesWithDecisionModel({
            apiKey: openRouterSettings.apiKey,
            model: openRouterSettings.decisionModel,
            candidates: candidatesToRank,
            state: {
              query: normalizedSearch,
              status,
              tag,
              mainTag,
            },
            serializeCandidate: (event) => ({
              slug: event.slug,
              title: event.title,
              rules: event.rules,
              additionalContext: event.additional_context,
              tags: event.tags.map((eventTag) => eventTag.slug),
              markets: event.markets.slice(0, 8).map((market) => ({
                title: market.title,
                question: market.question,
                outcomes: market.outcomes.map((outcome) => outcome.outcome_text).filter(Boolean),
              })),
            }),
            buildInstructions: (_event, index) =>
              `Score candidate ${index} for how well it matches the user's search query. Use the event title, rules, tags, and market questions; do not reward generic word overlap when the topic is different.`,
            timeoutMs: 5_000,
            cacheKey,
          })
          rankedEvents = [...rankedCandidates, ...rankedEvents.slice(candidatesToRank.length)]
        }
      } catch (error) {
        console.error('Prediction search decision model eligibility or ranking failed:', error)
      }
    }

    return NextResponse.json(rankedEvents)
  } catch (error) {
    console.error('Prediction results API error:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
