export interface GammaMarketLike {
  conditionId?: string
  question?: string
  slug?: string
  icon?: string
  image?: string
  endDate?: string
  closed?: boolean
  active?: boolean
  acceptingOrders?: boolean
}

export interface GammaEventLike {
  id?: string | number
  slug?: string
  seriesSlug?: string
  series_slug?: string
  seriesRecurrence?: string
  series_recurrence?: string
  series?: Array<{ slug?: string; recurrence?: string }>
  closed?: boolean
  active?: boolean
  endDate?: string
  markets?: GammaMarketLike[]
}

export function gammaSeriesMetadata(event: GammaEventLike) {
  const slug = (event.seriesSlug ?? event.series_slug ?? event.series?.[0]?.slug)?.normalize('NFC').trim().toLowerCase()
  const recurrence =
    (event.seriesRecurrence ?? event.series_recurrence ?? event.series?.[0]?.recurrence)?.trim() || null
  return { slug: slug || null, recurrence }
}

export function kuestSeriesMetadata(
  seriesSlug: string | null | undefined,
  seriesRecurrence: string | null | undefined,
) {
  return {
    seriesSlug: seriesSlug?.normalize('NFC').trim().toLowerCase() || null,
    seriesRecurrence: seriesRecurrence?.trim() || null,
  }
}

export function getPolymarketRequestLimit(search: string, limit: number) {
  if (search) {
    return Math.min(Math.max(limit * 2, 40), 60)
  }
  return Math.min(Math.max(limit * 2, limit + 6), 60)
}

export function getPolymarketEndDateMin(search: string, minimumEnd: number, seriesMinimumEnd: number) {
  return search ? null : new Date(Math.min(minimumEnd, seriesMinimumEnd)).toISOString()
}

function eventKey(event: GammaEventLike) {
  return String(event.id ?? event.slug ?? '')
    .trim()
    .toLowerCase()
}

function uniqueEvents(events: GammaEventLike[]) {
  const seen = new Set<string>()
  return events.filter((event) => {
    const key = eventKey(event)
    if (!key || seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function isOpenMarket(market: GammaMarketLike, now: number) {
  if (!market.conditionId || market.closed === true || market.active === false || market.acceptingOrders === false) {
    return false
  }
  const endTimestamp = market.endDate ? Date.parse(market.endDate) : Number.NaN
  return !Number.isFinite(endTimestamp) || endTimestamp > now
}

function marketEndsAfter(market: GammaMarketLike, minimumEnd: number, eventEndDate?: string) {
  const endTimestamp = Date.parse(market.endDate || eventEndDate || '')
  return Number.isFinite(endTimestamp) && endTimestamp >= minimumEnd
}

export function filterEligiblePolymarketEvents(
  events: GammaEventLike[],
  now: number,
  minimumEnd: number,
  seriesMinimumEnd: number,
  limit: number,
) {
  return uniqueEvents(events)
    .flatMap((event) => {
      if (event.closed === true || event.active === false) {
        return []
      }
      const openMarkets = (event.markets ?? []).filter((market) => isOpenMarket(market, now))
      const recurring = Boolean(gammaSeriesMetadata(event).slug)
      const eligibleEnd = recurring ? seriesMinimumEnd : minimumEnd
      return openMarkets.length > 0 &&
        openMarkets.every((market) => marketEndsAfter(market, eligibleEnd, event.endDate))
        ? [{ ...event, markets: openMarkets }]
        : []
    })
    .slice(0, limit)
}

export function recurringConditionIds(events: GammaEventLike[]) {
  return events.flatMap((event) => {
    if (!gammaSeriesMetadata(event).slug) {
      return []
    }
    return (event.markets ?? []).flatMap((market) => {
      const conditionId = market.conditionId?.trim().toLowerCase()
      return conditionId ? [conditionId] : []
    })
  })
}

export function isPolymarketEventOnKuest(
  markets: Array<{ conditionId: string }>,
  mapping: ReadonlyMap<string, string>,
) {
  return markets.length > 0 && markets.every((market) => mapping.has(market.conditionId.toLowerCase()))
}
