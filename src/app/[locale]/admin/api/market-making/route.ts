import type { NextRequest } from 'next/server'

import { and, desc, eq, gt, ilike, inArray, isNotNull, notInArray, or, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import type {
  MarketMakingDiscoveryItem,
  MarketMakingDiscoveryMarket,
  MarketMakingDiscoveryResponse,
  MarketMakingSourceFilter,
} from '@/lib/admin-market-making'

import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { POLY_SYNCER_CREATOR_ADDRESS } from '@/lib/contracts'
import { UserRepository } from '@/lib/db/queries/user'
import { events, markets, outcomes } from '@/lib/db/schema/events/tables'
import { db } from '@/lib/drizzle'
import {
  filterEligiblePolymarketEvents,
  gammaSeriesMetadata,
  getPolymarketEndDateMin,
  getPolymarketRequestLimit,
  kuestSeriesMetadata,
  recurringConditionIds,
} from '@/lib/market-making-discovery'
import { resolvePublicRuntimeEnv } from '@/lib/public-runtime-config.shared'
import { readResponseBodyWithLimit } from '@/lib/read-response-body-with-limit'
import { getPublicAssetUrl } from '@/lib/storage'

const REQUEST_TIMEOUT_MS = 6500
const MAX_RESPONSE_BYTES = 9_000_000
const DEFAULT_LIMIT = 18
const MAX_LIMIT = 30
const DEFAULT_SERVICE_START_DELAY_SECONDS = 86_400
const DEFAULT_MINIMUM_SERVICE_DURATION_SECONDS = 86_400
const DEFAULT_POLYMARKET_IMPORT_LEAD_SECONDS = 259_200

interface EscrowConfigResponse {
  pricingConfig?: {
    defaultServiceStartDelaySeconds?: number
    minimumServiceDurationSeconds?: number
  }
  importConfig?: { minimumEventLeadTimeSeconds?: number }
}

interface GammaMarket {
  conditionId?: string
  question?: string
  slug?: string
  icon?: string
  image?: string
  endDate?: string
  volume?: string | number
  volumeNum?: number
  volume24hr?: number
  liquidity?: string | number
  liquidityNum?: number
  liquidityClob?: number
  closed?: boolean
  active?: boolean
  acceptingOrders?: boolean
  negRisk?: boolean
}

interface GammaEvent {
  id?: string | number
  slug?: string
  title?: string
  icon?: string
  image?: string
  endDate?: string
  closed?: boolean
  active?: boolean
  negRisk?: boolean
  showMarketImages?: boolean
  showMarketIcons?: boolean
  markets?: GammaMarket[]
  seriesSlug?: string
  series_slug?: string
  seriesRecurrence?: string
  series_recurrence?: string
  series?: Array<{ slug?: string; recurrence?: string }>
}

interface GammaSearchResponse {
  events?: GammaEvent[]
}

interface ClobVolumeResponseItem {
  condition_id?: string
  status?: number
  volume?: string
  volume_24h?: string
}

interface ClobBookResponseItem {
  asset_id?: string
  bids?: Array<{ price?: string; size?: string }>
  asks?: Array<{ price?: string; size?: string }>
}

function isSourceFilter(value: string | null): value is MarketMakingSourceFilter {
  return value === 'all' || value === 'mine' || value === 'kuest' || value === 'polymarket'
}

function normalizeNumericValue(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function normalizeAddress(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function resolveImageUrl(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? getPublicAssetUrl(normalized) || null : null
}

async function parseLimitedJson(response: Response) {
  const bytes = await readResponseBodyWithLimit(response, MAX_RESPONSE_BYTES)
  if (!bytes) {
    throw new Error('Remote response exceeded the allowed size.')
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown
}

async function loadEligibilityWindows() {
  const { escrowUrl } = resolvePublicRuntimeEnv(process.env)
  try {
    const response = await fetch(`${escrowUrl.replace(/\/+$/, '')}/api/config`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      next: { revalidate: 300 },
    })
    if (!response.ok) {
      throw new Error(`Escrow config request failed with status ${response.status}.`)
    }
    const config = (await response.json()) as EscrowConfigResponse
    const pricing = config.pricingConfig
    return {
      kuestSeconds:
        (pricing?.defaultServiceStartDelaySeconds ?? DEFAULT_SERVICE_START_DELAY_SECONDS) +
        (pricing?.minimumServiceDurationSeconds ?? DEFAULT_MINIMUM_SERVICE_DURATION_SECONDS),
      polymarketSeconds: config.importConfig?.minimumEventLeadTimeSeconds ?? DEFAULT_POLYMARKET_IMPORT_LEAD_SECONDS,
    }
  } catch (error) {
    console.warn('Could not load escrow eligibility config; using conservative defaults.', error)
    return {
      kuestSeconds: DEFAULT_SERVICE_START_DELAY_SECONDS + DEFAULT_MINIMUM_SERVICE_DURATION_SECONDS,
      polymarketSeconds: DEFAULT_POLYMARKET_IMPORT_LEAD_SECONDS,
    }
  }
}

async function fetchPolymarketEvents(search: string, limit: number, minimumEnd: number, seriesMinimumEnd: number) {
  const { polymarketGammaUrl } = resolvePublicRuntimeEnv(process.env)
  const endpoint = new URL(search ? '/public-search' : '/events', polymarketGammaUrl)
  if (search) {
    endpoint.searchParams.set('q', search)
    endpoint.searchParams.set('events_status', 'active')
    endpoint.searchParams.set('keep_closed_markets', '0')
    // Search results are filtered locally for active markets and the minimum lead time.
    // Keep the over-fetch bounded so large Gamma market payloads stay within the response byte limit.
    endpoint.searchParams.set('limit_per_type', String(Math.min(Math.max(limit * 2, 40), 60)))
    endpoint.searchParams.set('page', '1')
    endpoint.searchParams.set('search_profiles', 'false')
    endpoint.searchParams.set('search_tags', 'false')
  } else {
    endpoint.searchParams.set('limit', String(getPolymarketRequestLimit(search, limit)))
    endpoint.searchParams.set('closed', 'false')
    endpoint.searchParams.set('active', 'true')
    const endDateMin = getPolymarketEndDateMin(search, minimumEnd, seriesMinimumEnd)
    if (endDateMin) {
      endpoint.searchParams.set('end_date_min', endDateMin)
    }
    endpoint.searchParams.set('order', 'createdAt')
    endpoint.searchParams.set('ascending', 'false')
    endpoint.searchParams.set('include_chat', 'false')
    endpoint.searchParams.set('include_template', 'false')
  }

  const response = await fetch(endpoint.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    next: { revalidate: 60 },
  })
  if (!response.ok) {
    throw new Error(`Polymarket Gamma request failed with status ${response.status}.`)
  }

  const body = await parseLimitedJson(response)
  const gammaEvents = search
    ? ((body as GammaSearchResponse).events ?? [])
    : Array.isArray(body)
      ? (body as GammaEvent[])
      : []
  const now = Date.now()

  return filterEligiblePolymarketEvents(gammaEvents, now, minimumEnd, seriesMinimumEnd, limit) as GammaEvent[]
}

async function listKuestEvents(
  search: string,
  excludedCreatorAddresses: string[],
  hiddenMirrorCreatorAddresses: string[],
  limit: number,
  minimumEnd: Date,
  seriesMinimumEnd: Date,
) {
  const searchTerm = search.trim()
  const searchCondition = searchTerm
    ? or(
        ilike(markets.title, `%${searchTerm}%`),
        ilike(markets.question, `%${searchTerm}%`),
        ilike(events.title, `%${searchTerm}%`),
        ilike(markets.condition_id, `%${searchTerm}%`),
      )
    : undefined
  const creatorCondition =
    excludedCreatorAddresses.length > 0
      ? notInArray(
          sql<string>`LOWER(COALESCE(${events.creator}, ''))`,
          excludedCreatorAddresses.map((address) => address.toLowerCase()),
        )
      : undefined
  const visibilityCondition =
    hiddenMirrorCreatorAddresses.length > 0
      ? or(
          eq(events.is_hidden, false),
          and(
            inArray(
              sql<string>`LOWER(COALESCE(${events.creator}, ''))`,
              hiddenMirrorCreatorAddresses.map((address) => address.toLowerCase()),
            ),
            isNotNull(markets.polymarket_condition_id),
          ),
        )
      : eq(events.is_hidden, false)
  const openMarketCondition = and(
    eq(markets.is_active, true),
    eq(markets.is_resolved, false),
    visibilityCondition,
    or(
      gt(markets.end_time, minimumEnd),
      and(sql`TRIM(COALESCE(${events.series_slug}, '')) <> ''`, gt(markets.end_time, seriesMinimumEnd)),
    ),
  )

  const eventRows = await db
    .select({
      eventId: events.id,
      slug: events.slug,
      title: events.title,
      iconUrl: events.icon_url,
      endDate: events.end_date,
      creator: events.creator,
      showMarketIcons: events.show_market_icons,
      seriesSlug: events.series_slug,
      seriesRecurrence: events.series_recurrence,
      storedVolume24h: sql<number>`COALESCE(SUM(${markets.volume_24h}), 0)`,
      storedVolume: sql<number>`COALESCE(SUM(${markets.volume}), 0)`,
    })
    .from(events)
    .innerJoin(markets, eq(markets.event_id, events.id))
    .where(and(openMarketCondition, searchCondition, creatorCondition))
    .groupBy(
      events.id,
      events.slug,
      events.title,
      events.icon_url,
      events.end_date,
      events.creator,
      events.show_market_icons,
      events.series_slug,
      events.series_recurrence,
    )
    .orderBy(desc(sql`COALESCE(SUM(${markets.volume_24h}), 0)`), desc(sql`COALESCE(SUM(${markets.volume}), 0)`))
    .limit(limit)

  if (eventRows.length === 0) {
    return { eventRows, marketRows: [] }
  }

  const marketRows = await db
    .select({
      eventId: markets.event_id,
      conditionId: markets.condition_id,
      polymarketConditionId: markets.polymarket_condition_id,
      title: markets.question,
      marketTitle: markets.title,
      iconUrl: markets.icon_url,
      endDate: markets.end_time,
      volume: markets.volume,
      volume24h: markets.volume_24h,
    })
    .from(markets)
    .innerJoin(events, eq(events.id, markets.event_id))
    .where(
      and(
        openMarketCondition,
        inArray(
          markets.event_id,
          eventRows.map((event) => event.eventId),
        ),
      ),
    )
    .orderBy(desc(markets.volume_24h), desc(markets.volume), desc(markets.created_at))

  return { eventRows, marketRows }
}

async function loadPolymarketMappings(
  conditionIds: string[],
  minimumEnd: Date,
  seriesMinimumEnd: Date,
  seriesConditionIds: string[],
) {
  if (conditionIds.length === 0) {
    return new Map<string, string>()
  }

  const endCondition =
    seriesConditionIds.length > 0
      ? or(
          gt(markets.end_time, minimumEnd),
          and(inArray(markets.polymarket_condition_id, seriesConditionIds), gt(markets.end_time, seriesMinimumEnd)),
        )
      : gt(markets.end_time, minimumEnd)

  const rows = await db
    .select({
      kuestConditionId: markets.condition_id,
      polymarketConditionId: markets.polymarket_condition_id,
    })
    .from(markets)
    .innerJoin(events, eq(events.id, markets.event_id))
    .where(
      and(
        inArray(markets.polymarket_condition_id, conditionIds),
        eq(markets.is_active, true),
        eq(markets.is_resolved, false),
        eq(events.is_hidden, false),
        endCondition,
      ),
    )

  return new Map(
    rows.flatMap((row) =>
      row.polymarketConditionId ? [[row.polymarketConditionId.toLowerCase(), row.kuestConditionId] as const] : [],
    ),
  )
}

function bookLiquidity(book: ClobBookResponseItem | undefined) {
  return [...(book?.bids ?? []), ...(book?.asks ?? [])].reduce((total, level) => {
    const price = normalizeNumericValue(level.price)
    const size = normalizeNumericValue(level.size)
    return total + price * size
  }, 0)
}

async function loadClobMetrics(conditionIds: string[]) {
  if (conditionIds.length === 0) {
    return new Map<string, { liquidity: number; volume: number; volume24h: number }>()
  }

  const tokenRows = await db
    .select({ conditionId: outcomes.condition_id, tokenId: outcomes.token_id, outcomeIndex: outcomes.outcome_index })
    .from(outcomes)
    .where(inArray(outcomes.condition_id, conditionIds))

  const tokensByCondition = new Map<string, string[]>()
  for (const row of tokenRows.sort((a, b) => a.outcomeIndex - b.outcomeIndex)) {
    const tokens = tokensByCondition.get(row.conditionId) ?? []
    tokens.push(row.tokenId)
    tokensByCondition.set(row.conditionId, tokens)
  }

  const conditions = conditionIds.flatMap((conditionId) => {
    const tokenIds = tokensByCondition.get(conditionId)?.slice(0, 2)
    return tokenIds?.length === 2 ? [{ condition_id: conditionId, token_ids: tokenIds }] : []
  })
  if (conditions.length === 0) {
    return new Map<string, { liquidity: number; volume: number; volume24h: number }>()
  }

  const { clobUrl } = resolvePublicRuntimeEnv(process.env)
  const [volumeResponse, booksResponse] = await Promise.all([
    fetch(`${clobUrl}/data/volumes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ include_24h: true, conditions }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }),
    fetch(`${clobUrl}/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokenRows.map((row) => ({ token_id: row.tokenId }))),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }),
  ])
  if (!volumeResponse.ok || !booksResponse.ok) {
    throw new Error(`CLOB metrics request failed with status ${volumeResponse.status}/${booksResponse.status}.`)
  }

  const [volumeBody, booksBody] = await Promise.all([parseLimitedJson(volumeResponse), parseLimitedJson(booksResponse)])
  if (!Array.isArray(volumeBody) || !Array.isArray(booksBody)) {
    throw new TypeError('Unexpected CLOB metrics response shape.')
  }

  const booksByToken = new Map(
    (booksBody as ClobBookResponseItem[]).flatMap((book) => (book.asset_id ? [[book.asset_id, book] as const] : [])),
  )
  const liquidityByCondition = new Map(
    conditions.map((condition) => [
      condition.condition_id,
      condition.token_ids.reduce((total, tokenId) => total + bookLiquidity(booksByToken.get(tokenId)), 0),
    ]),
  )

  return new Map(
    (volumeBody as ClobVolumeResponseItem[])
      .filter((entry) => entry.status === 200 && entry.condition_id)
      .map((entry) => [
        entry.condition_id!,
        {
          liquidity: liquidityByCondition.get(entry.condition_id!) ?? 0,
          volume: normalizeNumericValue(entry.volume),
          volume24h: normalizeNumericValue(entry.volume_24h),
        },
      ]),
  )
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await UserRepository.getCurrentUser({ minimal: true })
    if (!currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('q') ?? '').trim().slice(0, 120)
    const requestedSource = searchParams.get('source')
    const source = isSourceFilter(requestedSource) ? requestedSource : 'all'
    const requestedLimit = Number.parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), MAX_LIMIT) : DEFAULT_LIMIT
    const polySyncerCreatorAddresses = [POLY_SYNCER_CREATOR_ADDRESS].map(normalizeAddress).filter(Boolean)
    const eligibility = await loadEligibilityWindows()
    const now = Date.now()
    const kuestMinimumEnd = new Date(now + eligibility.kuestSeconds * 1_000)
    const seriesMinimumEnd = new Date(now + 10_800_000)

    const shouldLoadKuest = source !== 'polymarket'
    const shouldLoadPolymarket = source === 'all' || source === 'polymarket'
    const kuestPromise = shouldLoadKuest
      ? listKuestEvents(
          search,
          source === 'mine' ? polySyncerCreatorAddresses : [],
          polySyncerCreatorAddresses,
          limit,
          kuestMinimumEnd,
          seriesMinimumEnd,
        )
      : Promise.resolve({ eventRows: [], marketRows: [] })
    const polymarketPromise = shouldLoadPolymarket
      ? fetchPolymarketEvents(search, limit, now + eligibility.polymarketSeconds * 1_000, seriesMinimumEnd.getTime())
      : Promise.resolve([])
    const [{ eventRows: kuestEventRows, marketRows: kuestMarketRows }, polymarketEvents] = await Promise.all([
      kuestPromise,
      polymarketPromise,
    ])

    const polymarketIds = polymarketEvents.flatMap((event) =>
      (event.markets ?? []).flatMap((market) => (market.conditionId ? [market.conditionId.trim().toLowerCase()] : [])),
    )
    const mapping = await loadPolymarketMappings(
      polymarketIds,
      kuestMinimumEnd,
      seriesMinimumEnd,
      recurringConditionIds(polymarketEvents),
    )

    let clobMetrics = new Map<string, { liquidity: number; volume: number; volume24h: number }>()
    let volumeSource: MarketMakingDiscoveryResponse['volumeSource'] = 'database'
    if (kuestMarketRows.length > 0) {
      try {
        clobMetrics = await loadClobMetrics(kuestMarketRows.map((row) => row.conditionId))
        volumeSource =
          clobMetrics.size === kuestMarketRows.length ? 'clob' : clobMetrics.size > 0 ? 'mixed' : 'database'
      } catch (error) {
        console.warn('Could not refresh market-making discovery volumes from the CLOB; using stored volumes.', error)
      }
    }

    const marketsByEvent = new Map<string, MarketMakingDiscoveryMarket[]>()
    for (const row of kuestMarketRows) {
      const liveMetrics = clobMetrics.get(row.conditionId)
      const market: MarketMakingDiscoveryMarket = {
        id: `kuest:${row.conditionId}`,
        title: row.title?.trim() || row.marketTitle,
        conditionId: row.conditionId,
        kuestConditionId: row.conditionId,
        polymarketConditionId: row.polymarketConditionId?.toLowerCase() ?? null,
        iconUrl: resolveImageUrl(row.iconUrl),
        endDate: row.endDate?.toISOString() ?? null,
        liquidity: liveMetrics?.liquidity ?? 0,
        volume: liveMetrics?.volume ?? normalizeNumericValue(row.volume),
        volume24h: liveMetrics?.volume24h ?? normalizeNumericValue(row.volume24h),
      }
      const eventMarkets = marketsByEvent.get(row.eventId) ?? []
      eventMarkets.push(market)
      marketsByEvent.set(row.eventId, eventMarkets)
    }

    const polySyncerCreators = new Set(polySyncerCreatorAddresses)
    const kuestItems: MarketMakingDiscoveryItem[] = kuestEventRows.flatMap((event) => {
      const eventMarkets = marketsByEvent.get(event.eventId) ?? []
      if (eventMarkets.length === 0) {
        return []
      }
      return [
        {
          id: `kuest:${event.eventId}`,
          source: 'kuest',
          title: event.title,
          slug: event.slug,
          iconUrl: resolveImageUrl(event.iconUrl) || eventMarkets.find((market) => market.iconUrl)?.iconUrl || null,
          endDate:
            event.endDate?.toISOString() ??
            eventMarkets
              .map((market) => market.endDate)
              .filter((endDate): endDate is string => Boolean(endDate))
              .sort((first, second) => first.localeCompare(second))
              .at(0) ??
            null,
          volume: eventMarkets.reduce((total, market) => total + market.volume, 0),
          volume24h: eventMarkets.reduce((total, market) => total + market.volume24h, 0),
          liquidity: eventMarkets.reduce((total, market) => total + market.liquidity, 0),
          markets: eventMarkets,
          isMine: !polySyncerCreators.has(normalizeAddress(event.creator)),
          isOnKuest: true,
          hedgeAvailable: eventMarkets.some((market) => Boolean(market.polymarketConditionId)),
          needsDeployment: false,
          isNegRisk: false,
          showMarketIcons: event.showMarketIcons ?? true,
          ...kuestSeriesMetadata(event.seriesSlug, event.seriesRecurrence),
          creatorFilter: normalizeAddress(event.creator) || null,
        } satisfies MarketMakingDiscoveryItem,
      ]
    })

    const includedPolymarketIds = new Set(
      kuestItems.flatMap((item) =>
        item.markets.flatMap((market) => (market.polymarketConditionId ? [market.polymarketConditionId] : [])),
      ),
    )
    const polymarketItems: MarketMakingDiscoveryItem[] = polymarketEvents.flatMap((event) => {
      const eventMarkets = (event.markets ?? []).flatMap((market) => {
        const conditionId = market.conditionId?.trim()
        if (!conditionId) {
          return []
        }
        const kuestConditionId = mapping.get(conditionId.toLowerCase()) ?? null
        return [
          {
            id: `polymarket:${conditionId}`,
            title: market.question?.trim() || market.slug?.trim() || conditionId,
            conditionId,
            kuestConditionId,
            polymarketConditionId: conditionId,
            iconUrl: market.icon || market.image || null,
            endDate: market.endDate ?? null,
            liquidity: normalizeNumericValue(market.liquidityNum ?? market.liquidityClob ?? market.liquidity),
            volume: normalizeNumericValue(market.volumeNum ?? market.volume),
            volume24h: normalizeNumericValue(market.volume24hr),
          } satisfies MarketMakingDiscoveryMarket,
        ]
      })
      if (eventMarkets.every((market) => includedPolymarketIds.has(market.conditionId.toLowerCase()))) {
        return []
      }
      const isOnKuest = eventMarkets.every((market) => Boolean(market.kuestConditionId))
      const series = gammaSeriesMetadata(event)
      const eventKey = String(event.id ?? event.slug ?? eventMarkets[0]!.conditionId)
      return [
        {
          id: `polymarket:${eventKey}`,
          source: 'polymarket',
          title: event.title?.trim() || eventMarkets[0]!.title,
          slug: event.slug?.trim() || null,
          iconUrl: event.icon || event.image || eventMarkets.find((market) => market.iconUrl)?.iconUrl || null,
          endDate:
            eventMarkets
              .map((market) => market.endDate)
              .filter((endDate): endDate is string => Boolean(endDate))
              .sort((first, second) => first.localeCompare(second))
              .at(0) ??
            event.endDate ??
            null,
          volume: eventMarkets.reduce((total, market) => total + market.volume, 0),
          volume24h: eventMarkets.reduce((total, market) => total + market.volume24h, 0),
          liquidity: eventMarkets.reduce((total, market) => total + market.liquidity, 0),
          markets: eventMarkets,
          isMine: false,
          isOnKuest,
          hedgeAvailable: true,
          needsDeployment: !isOnKuest,
          isNegRisk: event.negRisk === true || (event.markets ?? []).some((market) => market.negRisk === true),
          showMarketIcons: event.showMarketImages ?? event.showMarketIcons ?? true,
          seriesSlug: series.slug,
          seriesRecurrence: series.recurrence,
          creatorFilter: POLY_SYNCER_CREATOR_ADDRESS.toLowerCase(),
        } satisfies MarketMakingDiscoveryItem,
      ]
    })

    const data = [...kuestItems, ...polymarketItems]
      .sort((a, b) => b.volume24h - a.volume24h || b.volume - a.volume)
      .slice(0, limit)

    return NextResponse.json({ data, volumeSource } satisfies MarketMakingDiscoveryResponse)
  } catch (error) {
    console.error('Market-making discovery API error:', error)
    return NextResponse.json(
      {
        error: DEFAULT_ERROR_MESSAGE,
        ...(process.env.NODE_ENV !== 'production'
          ? { detail: error instanceof Error ? error.message : String(error) }
          : {}),
      },
      { status: 500 },
    )
  }
}
