import type { MarketQuote } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMidPrices'
import type { Event } from '@/types'

const CHART_COLOR_VARIABLES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)']
const MAX_SERIES = 4
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000

export function getMaxSeriesCount() {
  return MAX_SERIES
}

export function areNumberMapsEqual(a: Record<string, number>, b: Record<string, number>) {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) {
    return false
  }
  return aKeys.every(key => Object.is(a[key], b[key]))
}

export function areQuoteMapsEqual(a: Record<string, MarketQuote>, b: Record<string, MarketQuote>) {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) {
    return false
  }
  return aKeys.every((key) => {
    const aQuote = a[key]
    const bQuote = b[key]
    if (!aQuote || !bQuote) {
      return false
    }
    return Object.is(aQuote.bid, bQuote.bid)
      && Object.is(aQuote.ask, bQuote.ask)
      && Object.is(aQuote.mid, bQuote.mid)
  })
}

export function buildMarketSignature(event: Event) {
  return event.markets
    .map((market) => {
      const outcomeSignature = market.outcomes
        .map(outcome => `${outcome.token_id}:${outcome.updated_at}`)
        .join(',')
      return `${market.condition_id}:${market.updated_at}:${outcomeSignature}`
    })
    .join('|')
}

export function computeChanceChanges(
  points: Array<Record<string, number | Date> & { date: Date }>,
  currentOverrides: Record<string, number> = {},
) {
  if (!points.length) {
    return {}
  }

  const latestPoint = points[points.length - 1]
  const targetTime = latestPoint.date.getTime() - TWELVE_HOURS_MS
  let baselinePoint = points[0]

  for (let index = points.length - 1; index >= 0; index -= 1) {
    const currentPoint = points[index]
    if (currentPoint.date.getTime() <= targetTime) {
      baselinePoint = currentPoint
      break
    }
  }

  const changes: Record<string, number> = {}

  Object.entries(latestPoint).forEach(([key, value]) => {
    if (key === 'date') {
      return
    }

    const overrideValue = currentOverrides[key]
    const resolvedCurrent = typeof overrideValue === 'number' && Number.isFinite(overrideValue)
      ? overrideValue
      : value
    if (typeof resolvedCurrent !== 'number' || !Number.isFinite(resolvedCurrent)) {
      return
    }

    const baselineValue = baselinePoint[key]
    const numericBaseline = typeof baselineValue === 'number' && Number.isFinite(baselineValue)
      ? baselineValue
      : resolvedCurrent

    changes[key] = resolvedCurrent - numericBaseline
  })

  return changes
}

export function filterChartDataForSeries(
  points: Array<Record<string, number | Date> & { date: Date }>,
  seriesKeys: string[],
) {
  if (!points.length || !seriesKeys.length) {
    return []
  }

  return points.map((point) => {
    const filtered: Record<string, number | Date> & { date: Date } = { date: point.date }
    seriesKeys.forEach((key) => {
      if (typeof point[key] === 'number') {
        filtered[key] = point[key]
      }
    })
    return filtered
  })
}

export function getTopMarketIds(chances: Record<string, number>, limit: number) {
  return Object.entries(chances)
    .filter(([, value]) => Number.isFinite(value))
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([key]) => key)
}

function isDefaultMarketLabel(label?: string | null) {
  if (!label) {
    return true
  }
  return /^(?:outcome|token)\s*\d+$/i.test(label.trim())
}

export function getMarketSeriesLabel(market: Event['markets'][number]) {
  const metadata = (market.metadata ?? {}) as Record<string, unknown>
  const metadataShortTitle = typeof metadata.short_title === 'string' ? metadata.short_title.trim() : ''
  const shortTitle = market.short_title?.trim()
  const outcomeLabel = market.outcomes?.[0]?.outcome_text?.trim()

  if (metadataShortTitle && !isDefaultMarketLabel(metadataShortTitle)) {
    return metadataShortTitle
  }

  if (shortTitle && !isDefaultMarketLabel(shortTitle)) {
    return shortTitle
  }

  if (outcomeLabel) {
    return outcomeLabel
  }

  return market.title
}

export function getOutcomeLabelForMarket(
  market: Event['markets'][number] | undefined,
  outcomeIndex: number,
) {
  const outcome = market?.outcomes.find(item => item.outcome_index === outcomeIndex)
  const label = outcome?.outcome_text?.trim()

  if (label) {
    return label
  }

  return outcomeIndex === 0 ? 'Yes' : 'No'
}

export function buildChartSeries(event: Event, marketIds: string[]) {
  return marketIds
    .map((conditionId, index) => {
      const market = event.markets.find(current => current.condition_id === conditionId)
      if (!market) {
        return null
      }
      return {
        key: conditionId,
        name: getMarketSeriesLabel(market),
        color: CHART_COLOR_VARIABLES[index % CHART_COLOR_VARIABLES.length],
      }
    })
    .filter((entry): entry is { key: string, name: string, color: string } => entry !== null)
}
