import type { SupportedLocale } from '@/i18n/locales'
import type { conditions, outcomes } from '@/lib/db/schema/events/tables'
import type { ConditionChangeLogEntry, Event, QueryResult } from '@/types'
import { and, desc, eq, exists, ilike, inArray, sql } from 'drizzle-orm'
import { cacheTag } from 'next/cache'
import { DEFAULT_LOCALE } from '@/i18n/locales'
import { cacheTags } from '@/lib/cache-tags'
import { OUTCOME_INDEX } from '@/lib/constants'
import { bookmarks } from '@/lib/db/schema/bookmarks/tables'
import { conditions_audit, event_tags, events, markets, tag_translations, tags } from '@/lib/db/schema/events/tables'
import { runQuery } from '@/lib/db/utils/run-query'
import { db } from '@/lib/drizzle'
import { resolveDisplayPrice } from '@/lib/market-chance'
import { getSupabaseImageUrl } from '@/lib/supabase'

const HIDE_FROM_NEW_TAG_SLUG = 'hide-from-new'

type PriceApiResponse = Record<string, { BUY?: string, SELL?: string } | undefined>
interface OutcomePrices { buy: number, sell: number }
const MAX_PRICE_BATCH = 500

interface LastTradePriceEntry {
  token_id: string
  price: string
  side: 'BUY' | 'SELL'
}

interface FetchPriceBatchResult {
  data: PriceApiResponse | null
  aborted: boolean
}

function isPrerenderAbortError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false
  }

  const record = error as { digest?: string, name?: string, code?: string, message?: string }

  if (record.digest === 'HANGING_PROMISE_REJECTION') {
    return true
  }

  if (record.name === 'AbortError' || record.code === 'UND_ERR_ABORTED') {
    return true
  }

  if (typeof record.message === 'string' && record.message.includes('fetch() rejects when the prerender is complete')) {
    return true
  }

  return false
}

function normalizeTradePrice(value: string | undefined) {
  if (!value) {
    return null
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }
  if (parsed < 0) {
    return 0
  }
  if (parsed > 1) {
    return 1
  }
  return parsed
}

async function fetchPriceBatch(endpoint: string, tokenIds: string[]): Promise<FetchPriceBatchResult> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(tokenIds.map(tokenId => ({
        token_id: tokenId,
      }))),
    })

    if (!response.ok) {
      return { data: null, aborted: false }
    }

    return { data: await response.json() as PriceApiResponse, aborted: false }
  }
  catch (error) {
    const aborted = isPrerenderAbortError(error)
    if (!aborted) {
      console.error('Failed to fetch outcome prices batch from CLOB.', error)
    }
    return { data: null, aborted }
  }
}

async function fetchLastTradePrices(tokenIds: string[]): Promise<Map<string, number>> {
  const uniqueTokenIds = Array.from(new Set(tokenIds.filter(Boolean)))

  if (!uniqueTokenIds.length) {
    return new Map()
  }

  const endpoint = `${process.env.CLOB_URL!}/last-trades-prices`
  const lastTradeMap = new Map<string, number>()

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(uniqueTokenIds.map(tokenId => ({ token_id: tokenId }))),
    })

    if (!response.ok) {
      return lastTradeMap
    }

    const payload = await response.json() as LastTradePriceEntry[]
    payload.forEach((entry) => {
      const normalized = normalizeTradePrice(entry?.price)
      if (normalized != null && entry?.token_id) {
        lastTradeMap.set(entry.token_id, normalized)
      }
    })
  }
  catch (error) {
    if (!isPrerenderAbortError(error)) {
      console.error('Failed to fetch last trades prices', error)
    }
    return lastTradeMap
  }

  return lastTradeMap
}

function applyPriceBatch(
  data: PriceApiResponse | null,
  priceMap: Map<string, OutcomePrices>,
  missingTokenIds: Set<string>,
) {
  if (!data) {
    return
  }

  for (const [tokenId, priceBySide] of Object.entries(data ?? {})) {
    if (!priceBySide) {
      continue
    }

    const parsedBuy = priceBySide.BUY != null ? Number(priceBySide.BUY) : undefined
    const parsedSell = priceBySide.SELL != null ? Number(priceBySide.SELL) : undefined
    const normalizedBuy = parsedBuy != null && Number.isFinite(parsedBuy) ? parsedBuy : undefined
    const normalizedSell = parsedSell != null && Number.isFinite(parsedSell) ? parsedSell : undefined

    if (normalizedBuy == null && normalizedSell == null) {
      continue
    }

    priceMap.set(tokenId, {
      buy: normalizedSell ?? normalizedBuy ?? 0.5,
      sell: normalizedBuy ?? normalizedSell ?? 0.5,
    })
    missingTokenIds.delete(tokenId)
  }
}

async function fetchOutcomePrices(tokenIds: string[]): Promise<Map<string, OutcomePrices>> {
  const uniqueTokenIds = Array.from(new Set(tokenIds.filter(Boolean)))

  if (uniqueTokenIds.length === 0) {
    return new Map()
  }

  const endpoint = `${process.env.CLOB_URL!}/prices`
  const priceMap = new Map<string, OutcomePrices>()
  const missingTokenIds = new Set(uniqueTokenIds)
  let wasAborted = false

  for (let i = 0; i < uniqueTokenIds.length; i += MAX_PRICE_BATCH) {
    const batch = uniqueTokenIds.slice(i, i + MAX_PRICE_BATCH)
    const batchResult = await fetchPriceBatch(endpoint, batch)
    if (batchResult.aborted) {
      wasAborted = true
      break
    }

    if (batchResult.data) {
      applyPriceBatch(batchResult.data, priceMap, missingTokenIds)
      continue
    }

    const tokenResults = await Promise.allSettled(
      batch.map(tokenId => fetchPriceBatch(endpoint, [tokenId])),
    )

    for (const result of tokenResults) {
      if (result.status === 'fulfilled') {
        if (result.value.aborted) {
          wasAborted = true
          break
        }
        applyPriceBatch(result.value.data, priceMap, missingTokenIds)
      }
    }

    if (wasAborted) {
      break
    }
  }

  for (const tokenId of missingTokenIds) {
    priceMap.set(tokenId, { buy: 0.5, sell: 0.5 })
  }

  return priceMap
}

interface ListEventsProps {
  tag: string
  search?: string
  userId?: string | undefined
  bookmarked?: boolean
  status?: Event['status']
  offset?: number
  locale?: SupportedLocale
}

interface RelatedEventOptions {
  tagSlug?: string
}

type EventWithTags = typeof events.$inferSelect & {
  eventTags: (typeof event_tags.$inferSelect & {
    tag: typeof tags.$inferSelect
  })[]
}

type EventWithTagsAndMarkets = EventWithTags & {
  markets: (typeof markets.$inferSelect & {
    condition?: typeof conditions.$inferSelect & {
      outcomes: (typeof outcomes.$inferSelect)[]
    }
  })[]
}

type DrizzleEventResult = typeof events.$inferSelect & {
  markets: (typeof markets.$inferSelect & {
    condition: typeof conditions.$inferSelect & {
      outcomes: typeof outcomes.$inferSelect[]
    }
  })[]
  eventTags: (typeof event_tags.$inferSelect & {
    tag: typeof tags.$inferSelect
  })[]
  bookmarks?: typeof bookmarks.$inferSelect[]
}

interface RelatedEvent {
  id: string
  slug: string
  title: string
  icon_url: string
  common_tags_count: number
  chance: number | null
}

async function getLocalizedTagNamesById(tagIds: number[], locale: SupportedLocale): Promise<Map<number, string>> {
  if (!tagIds.length || locale === DEFAULT_LOCALE) {
    return new Map()
  }

  const rows = await db
    .select({
      tag_id: tag_translations.tag_id,
      name: tag_translations.name,
    })
    .from(tag_translations)
    .where(and(
      inArray(tag_translations.tag_id, tagIds),
      eq(tag_translations.locale, locale),
    ))

  return new Map(rows.map(row => [row.tag_id, row.name]))
}

function eventResource(
  event: DrizzleEventResult,
  userId: string,
  priceMap: Map<string, OutcomePrices>,
  localizedTagNamesById: Map<number, string> = new Map(),
): Event {
  const tagRecords = (event.eventTags ?? [])
    .map(et => et.tag)
    .filter(tag => Boolean(tag?.slug))
    .map(tag => ({
      ...tag,
      name: localizedTagNamesById.get(tag.id) ?? tag.name,
    }))

  const marketsWithDerivedValues = event.markets.map((market: any) => {
    const rawOutcomes = (market.condition?.outcomes || []) as Array<typeof outcomes.$inferSelect>
    const normalizedOutcomes = rawOutcomes.map((outcome) => {
      const outcomePrice = outcome.token_id ? priceMap.get(outcome.token_id) : undefined
      const buyPrice = outcomePrice?.buy ?? 0.5
      const sellPrice = outcomePrice?.sell ?? 0.5

      return {
        ...outcome,
        outcome_index: Number(outcome.outcome_index || 0),
        payout_value: outcome.payout_value != null ? Number(outcome.payout_value) : undefined,
        buy_price: buyPrice,
        sell_price: sellPrice,
      }
    })

    const primaryOutcome = normalizedOutcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.YES) ?? normalizedOutcomes[0]
    const yesBuyPrice = primaryOutcome?.buy_price ?? 0.5
    const yesSellPrice = primaryOutcome?.sell_price ?? yesBuyPrice
    const yesMidPrice = (yesBuyPrice + yesSellPrice) / 2
    const probability = yesMidPrice * 100
    const normalizedCurrentVolume24h = Number(market.volume_24h || 0)
    const normalizedTotalVolume = Number(market.volume || 0)

    return {
      ...market,
      neg_risk: Boolean(market.neg_risk),
      neg_risk_other: Boolean(market.neg_risk_other),
      end_time: market.end_time?.toISOString?.() ?? null,
      question_id: market.condition?.question_id || '',
      title: market.short_title || market.title,
      probability,
      price: yesMidPrice,
      volume: normalizedTotalVolume,
      volume_24h: normalizedCurrentVolume24h,
      outcomes: normalizedOutcomes,
      icon_url: getSupabaseImageUrl(market.icon_url),
      condition: market.condition
        ? {
            ...market.condition,
            outcome_slot_count: Number(market.condition.outcome_slot_count || 0),
            payout_denominator: market.condition.payout_denominator ? Number(market.condition.payout_denominator) : undefined,
            volume: Number(market.condition.volume || 0),
            open_interest: Number(market.condition.open_interest || 0),
            active_positions_count: Number(market.condition.active_positions_count || 0),
          }
        : null,
    }
  })

  const totalRecentVolume = marketsWithDerivedValues.reduce(
    (sum: number, market: any) => sum + (typeof market.volume_24h === 'number' ? market.volume_24h : 0),
    0,
  )
  const isRecentlyUpdated = event.updated_at instanceof Date
    ? (Date.now() - event.updated_at.getTime()) < 1000 * 60 * 60 * 24 * 3
    : false
  const isTrending = totalRecentVolume > 0 || isRecentlyUpdated

  return {
    id: event.id || '',
    slug: event.slug || '',
    title: event.title || '',
    creator: event.creator || '',
    icon_url: getSupabaseImageUrl(event.icon_url),
    show_market_icons: event.show_market_icons ?? true,
    enable_neg_risk: Boolean(event.enable_neg_risk),
    neg_risk_augmented: Boolean(event.neg_risk_augmented),
    neg_risk: Boolean(event.neg_risk),
    neg_risk_market_id: event.neg_risk_market_id || undefined,
    status: (event.status ?? 'draft') as Event['status'],
    rules: event.rules || undefined,
    active_markets_count: Number(event.active_markets_count || 0),
    total_markets_count: Number(event.total_markets_count || 0),
    created_at: event.created_at?.toISOString() || new Date().toISOString(),
    updated_at: event.updated_at?.toISOString() || new Date().toISOString(),
    end_date: event.end_date?.toISOString() ?? null,
    resolved_at: event.resolved_at?.toISOString() ?? null,
    volume: marketsWithDerivedValues.reduce(
      (sum: number, market: { volume: number }) => sum + (market.volume ?? 0),
      0,
    ),
    markets: marketsWithDerivedValues,
    tags: tagRecords.map(tag => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      isMainCategory: Boolean(tag.is_main_category),
    })),
    main_tag: getEventMainTag(tagRecords),
    is_bookmarked: event.bookmarks?.some(bookmark => bookmark.user_id === userId) || false,
    is_trending: isTrending,
  }
}

async function buildEventResource(
  eventResult: DrizzleEventResult,
  userId: string,
  locale: SupportedLocale = DEFAULT_LOCALE,
): Promise<Event> {
  const outcomeTokenIds = (eventResult.markets ?? []).flatMap((market: any) =>
    (market.condition?.outcomes ?? []).map((outcome: any) => outcome.token_id).filter(Boolean),
  )

  const tagIds = Array.from(new Set(
    (eventResult.eventTags ?? [])
      .map(eventTag => eventTag.tag?.id)
      .filter((tagId): tagId is number => typeof tagId === 'number'),
  ))
  const [priceMap, localizedTagNamesById] = await Promise.all([
    fetchOutcomePrices(outcomeTokenIds),
    getLocalizedTagNamesById(tagIds, locale),
  ])
  return eventResource(eventResult, userId, priceMap, localizedTagNamesById)
}

function getEventMainTag(tags: any[] | undefined): string {
  if (!tags?.length) {
    return 'World'
  }

  const mainTag = tags.find(tag => tag.is_main_category)
  return mainTag?.name || tags[0].name
}

export const EventRepository = {
  async listEvents({
    tag = 'trending',
    search = '',
    userId = '',
    bookmarked = false,
    status = 'active',
    offset = 0,
    locale = DEFAULT_LOCALE,
  }: ListEventsProps): Promise<QueryResult<Event[]>> {
    'use cache'
    cacheTag(cacheTags.events(userId || 'guest'))
    cacheTag(cacheTags.eventsGlobal)

    return await runQuery(async () => {
      const limit = 40
      const validOffset = Number.isNaN(offset) || offset < 0 ? 0 : offset

      const whereConditions = []

      whereConditions.push(eq(events.status, status))

      if (search) {
        const normalizedSearch = search.trim().toLowerCase()
        const searchTerms = normalizedSearch.split(/\s+/).filter(Boolean)

        if (searchTerms.length > 0) {
          const loweredTitle = sql<string>`LOWER(${events.title})`
          whereConditions.push(
            and(...searchTerms.map(term => ilike(loweredTitle, `%${term}%`))),
          )
        }
      }

      if (tag && tag !== 'trending' && tag !== 'new') {
        whereConditions.push(
          exists(
            db.select()
              .from(event_tags)
              .innerJoin(tags, eq(event_tags.tag_id, tags.id))
              .where(and(
                eq(event_tags.event_id, events.id),
                eq(tags.slug, tag),
              )),
          ),
        )
      }

      if (tag === 'new') {
        whereConditions.push(
          sql`NOT ${exists(
            db.select()
              .from(event_tags)
              .innerJoin(tags, eq(event_tags.tag_id, tags.id))
              .where(and(
                eq(event_tags.event_id, events.id),
                eq(tags.slug, HIDE_FROM_NEW_TAG_SLUG),
              )),
          )}`,
        )
      }

      if (bookmarked && userId) {
        whereConditions.push(
          exists(
            db.select()
              .from(bookmarks)
              .where(and(
                eq(bookmarks.event_id, events.id),
                eq(bookmarks.user_id, userId),
              )),
          ),
        )
      }

      whereConditions[0] = and(
        eq(events.status, status),
        sql`NOT EXISTS (
          SELECT 1
          FROM ${event_tags} et
          JOIN ${tags} t ON t.id = et.tag_id
          WHERE et.event_id = ${events.id} AND t.hide_events = TRUE
        )`,
      )

      const baseWhere = and(...whereConditions)

      let eventsData: DrizzleEventResult[] = []

      if (tag === 'trending') {
        const trendingVolumeOrder = sql<number>`COALESCE(
          NULLIF((
            SELECT SUM(${markets.volume_24h})
            FROM ${markets}
            WHERE ${markets.event_id} = ${events.id}
          ), 0),
          (
            SELECT SUM(${markets.volume})
            FROM ${markets}
            WHERE ${markets.event_id} = ${events.id}
          ),
          0
        )`

        const trendingEventIds = await db
          .select({ id: events.id })
          .from(events)
          .where(baseWhere)
          .orderBy(desc(trendingVolumeOrder), desc(events.created_at))
          .limit(limit)
          .offset(validOffset)

        if (trendingEventIds.length === 0) {
          return { data: [], error: null }
        }

        const orderedIds = trendingEventIds.map(event => event.id)
        const orderIndex = new Map(orderedIds.map((id, index) => [id, index]))

        const trendingData = await db.query.events.findMany({
          where: and(
            baseWhere,
            inArray(events.id, orderedIds),
          ),
          with: {
            markets: {
              with: {
                condition: {
                  with: { outcomes: true },
                },
              },
            },

            eventTags: {
              with: { tag: true },
            },

            ...(userId && {
              bookmarks: {
                where: eq(bookmarks.user_id, userId),
              },
            }),
          },
        }) as DrizzleEventResult[]

        eventsData = trendingData.sort((a, b) => {
          const aIndex = orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER
          const bIndex = orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER
          return aIndex - bIndex
        })
      }
      else {
        const orderByClause = tag === 'new'
          ? [desc(events.created_at)]
          : [desc(events.id)]

        eventsData = await db.query.events.findMany({
          where: baseWhere,
          with: {
            markets: {
              with: {
                condition: {
                  with: { outcomes: true },
                },
              },
            },

            eventTags: {
              with: { tag: true },
            },

            ...(userId && {
              bookmarks: {
                where: eq(bookmarks.user_id, userId),
              },
            }),
          },
          limit,
          offset: validOffset,
          orderBy: orderByClause,
        }) as DrizzleEventResult[]
      }

      const tokensForPricing = eventsData.flatMap(event =>
        (event.markets ?? []).flatMap(market =>
          (market.condition?.outcomes ?? []).map(outcome => outcome.token_id).filter(Boolean),
        ),
      )

      const tagIds = Array.from(new Set(
        eventsData.flatMap(event =>
          (event.eventTags ?? [])
            .map(eventTag => eventTag.tag?.id)
            .filter((tagId): tagId is number => typeof tagId === 'number'),
        ),
      ))
      const [priceMap, localizedTagNamesById] = await Promise.all([
        fetchOutcomePrices(tokensForPricing),
        getLocalizedTagNamesById(tagIds, locale),
      ])

      const eventsWithMarkets = eventsData
        .filter(event => event.markets?.length > 0)
        .map(event => eventResource(event as DrizzleEventResult, userId, priceMap, localizedTagNamesById))

      return { data: eventsWithMarkets, error: null }
    })
  },

  async getIdBySlug(slug: string): Promise<QueryResult<{ id: string }>> {
    'use cache'

    return runQuery(async () => {
      const result = await db
        .select({ id: events.id })
        .from(events)
        .where(eq(events.slug, slug))
        .limit(1)

      if (result.length === 0) {
        throw new Error('Event not found')
      }

      return { data: result[0], error: null }
    })
  },

  async getEventTitleBySlug(slug: string): Promise<QueryResult<{ title: string }>> {
    'use cache'

    return runQuery(async () => {
      const result = await db
        .select({ title: events.title })
        .from(events)
        .where(eq(events.slug, slug))
        .limit(1)

      if (result.length === 0) {
        throw new Error('Event not found')
      }

      return { data: result[0], error: null }
    })
  },

  async getEventConditionChangeLogBySlug(slug: string): Promise<QueryResult<ConditionChangeLogEntry[]>> {
    return runQuery(async () => {
      const eventResult = await db
        .select({ id: events.id })
        .from(events)
        .where(eq(events.slug, slug))
        .limit(1)

      if (!eventResult.length) {
        throw new Error('Event not found')
      }

      const eventId = eventResult[0]!.id

      const rows = await db
        .select({
          condition_id: conditions_audit.condition_id,
          created_at: conditions_audit.created_at,
          old_values: conditions_audit.old_values,
          new_values: conditions_audit.new_values,
        })
        .from(conditions_audit)
        .innerJoin(markets, eq(markets.condition_id, conditions_audit.condition_id))
        .where(eq(markets.event_id, eventId))
        .orderBy(desc(conditions_audit.created_at))

      const data = rows.map(row => ({
        condition_id: row.condition_id,
        created_at: row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at as unknown as string).toISOString(),
        old_values: row.old_values as Record<string, unknown>,
        new_values: row.new_values as Record<string, unknown>,
      }))

      return { data, error: null }
    })
  },

  async getEventMarketMetadata(slug: string): Promise<QueryResult<{
    condition_id: string
    title: string
    slug: string
    is_active: boolean
    is_resolved: boolean
    neg_risk: boolean
    event_enable_neg_risk: boolean
    outcomes: Array<{
      token_id: string
      outcome_text: string
      outcome_index: number
    }>
  }[]>> {
    return runQuery(async () => {
      interface MarketMetadataRow {
        condition_id: string
        title: string
        slug: string
        is_active: boolean | null
        is_resolved: boolean | null
        neg_risk: boolean | null
        condition: {
          outcomes: Array<{
            token_id: string
            outcome_text: string | null
            outcome_index: number | null
          }>
        } | null
      }
      interface EventMarketMetadataRow {
        enable_neg_risk: boolean | null
        markets?: MarketMetadataRow[]
      }

      const eventResult = await db.query.events.findFirst({
        where: eq(events.slug, slug),
        columns: {
          id: true,
          enable_neg_risk: true,
        },
        with: {
          markets: {
            columns: {
              condition_id: true,
              title: true,
              slug: true,
              is_active: true,
              is_resolved: true,
              neg_risk: true,
            },
            with: {
              condition: {
                columns: { id: true },
                with: {
                  outcomes: {
                    columns: {
                      token_id: true,
                      outcome_text: true,
                      outcome_index: true,
                    },
                  },
                },
              },
            },
          },
        },
      }) as EventMarketMetadataRow | undefined

      if (!eventResult) {
        throw new Error('Event not found')
      }

      const markets = (eventResult.markets ?? []).map(market => ({
        condition_id: market.condition_id,
        title: market.title,
        slug: market.slug,
        is_active: Boolean(market.is_active),
        is_resolved: Boolean(market.is_resolved),
        neg_risk: Boolean(market.neg_risk),
        event_enable_neg_risk: Boolean(eventResult.enable_neg_risk),
        outcomes: (market.condition?.outcomes ?? []).map(outcome => ({
          token_id: outcome.token_id,
          outcome_text: outcome.outcome_text || '',
          outcome_index: typeof outcome.outcome_index === 'number'
            ? outcome.outcome_index
            : Number(outcome.outcome_index || 0),
        })),
      }))

      return { data: markets, error: null }
    })
  },

  async getEventBySlug(
    slug: string,
    userId: string = '',
    locale: SupportedLocale = DEFAULT_LOCALE,
  ): Promise<QueryResult<Event>> {
    return runQuery(async () => {
      const eventResult = await db.query.events.findFirst({
        where: eq(events.slug, slug),
        with: {
          markets: {
            with: {
              condition: {
                with: { outcomes: true },
              },
            },
          },
          eventTags: {
            with: { tag: true },
          },
          ...(userId && {
            bookmarks: {
              where: eq(bookmarks.user_id, userId),
            },
          }),
        },
      }) as DrizzleEventResult

      if (!eventResult) {
        throw new Error('Event not found')
      }

      const transformedEvent = await buildEventResource(eventResult as DrizzleEventResult, userId, locale)

      return { data: transformedEvent, error: null }
    })
  },

  async getRelatedEventsBySlug(slug: string, options: RelatedEventOptions = {}): Promise<QueryResult<RelatedEvent[]>> {
    'use cache'

    return runQuery(async () => {
      const tagSlug = options.tagSlug?.toLowerCase()

      const currentEvent = await db.query.events.findFirst({
        where: eq(events.slug, slug),
        with: {
          eventTags: {
            with: { tag: true },
          },
        },
      }) as EventWithTags | undefined

      if (!currentEvent) {
        return { data: [], error: null }
      }

      let selectedTagIds = currentEvent.eventTags.map(et => et.tag_id)
      if (tagSlug && tagSlug !== 'all' && tagSlug.trim() !== '') {
        const matchingTags = currentEvent.eventTags.filter(et => et.tag.slug === tagSlug)
        selectedTagIds = matchingTags.map(et => et.tag_id)

        if (selectedTagIds.length === 0) {
          return { data: [], error: null }
        }
      }

      if (selectedTagIds.length === 0) {
        return { data: [], error: null }
      }

      const relatedEvents = await db.query.events.findMany({
        where: sql`${events.slug} != ${slug}`,
        with: {
          eventTags: true,
          markets: {
            columns: {
              icon_url: true,
            },
            with: {
              condition: {
                with: {
                  outcomes: {
                    columns: {
                      token_id: true,
                      outcome_index: true,
                    },
                  },
                },
              },
            },
          },
        },
        limit: 50,
      }) as EventWithTagsAndMarkets[]

      const results = relatedEvents
        .filter((event) => {
          if (event.markets.length !== 1) {
            return false
          }

          const eventTagIds = event.eventTags.map(et => et.tag_id)
          return eventTagIds.some(tagId => selectedTagIds.includes(tagId))
        })
        .map((event) => {
          const eventTagIds = event.eventTags.map(et => et.tag_id)
          const commonTagsCount = eventTagIds.filter(tagId => selectedTagIds.includes(tagId)).length

          const market = event.markets[0]
          const outcomes = market?.condition?.outcomes ?? []
          const yesOutcome = outcomes.find(outcome => Number(outcome.outcome_index) === OUTCOME_INDEX.YES)
            ?? outcomes[0]
          const yesTokenId = yesOutcome?.token_id

          return {
            id: event.id,
            slug: event.slug,
            title: event.title,
            icon_url: event.markets[0]?.icon_url || '',
            common_tags_count: commonTagsCount,
            yes_token_id: yesTokenId,
          }
        })
        .filter(event => event.common_tags_count > 0)
        .sort((a, b) => b.common_tags_count - a.common_tags_count)
        .slice(0, 20)

      if (!results?.length) {
        return { data: [], error: null }
      }

      const topResults = results
        .filter(event => event.common_tags_count > 0)
        .slice(0, 3)

      const tokenIds = topResults
        .map(event => event.yes_token_id)
        .filter((tokenId): tokenId is string => Boolean(tokenId))
      const priceMap = await fetchOutcomePrices(tokenIds)
      const lastTradesByToken = await fetchLastTradePrices(tokenIds)

      const transformedResults = topResults.map((row) => {
        const price = row.yes_token_id ? priceMap.get(row.yes_token_id) : undefined
        const lastTrade = row.yes_token_id ? lastTradesByToken.get(row.yes_token_id) : null
        const displayPrice = resolveDisplayPrice({
          bid: price?.sell ?? null,
          ask: price?.buy ?? null,
          lastTrade,
        })
        const chance = displayPrice != null ? displayPrice * 100 : null

        return {
          id: String(row.id),
          slug: String(row.slug),
          title: String(row.title),
          icon_url: getSupabaseImageUrl(String(row.icon_url || '')),
          common_tags_count: Number(row.common_tags_count),
          chance,
        }
      })

      return { data: transformedResults, error: null }
    })
  },
}
