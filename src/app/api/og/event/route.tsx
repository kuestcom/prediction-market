import type { SupportedLocale } from '@/i18n/locales'
import type { Event } from '@/types'
import { Buffer } from 'node:buffer'
import { ImageResponse } from 'next/og'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/locales'
import { oklchToRenderableColor } from '@/lib/color'
import { OUTCOME_INDEX } from '@/lib/constants'
import { EventRepository } from '@/lib/db/queries/event'
import { formatCentsLabel, formatCompactCurrency, formatPercent } from '@/lib/formatters'
import { resolveOutcomeButtonTheme } from '@/lib/outcome-theme'
import { readResponseBodyWithLimit } from '@/lib/read-response-body-with-limit'
import siteUrlUtils from '@/lib/site-url'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

const { resolveSiteUrl } = siteUrlUtils

const IMAGE_WIDTH = 1200
const IMAGE_HEIGHT = 630
const CHART_WIDTH = 598
const CHART_HEIGHT = 120
const MAX_CHART_POINTS = 28
// Keep the OG inline image budget aligned with the current public asset size limit.
const MAX_OG_REMOTE_IMAGE_BYTES = 2 * 1024 * 1024
const SOCIAL_IMAGE_FETCH_TIMEOUT_MS = 1200
const SOCIAL_HISTORY_FETCH_TIMEOUT_MS = 1500
const IMAGE_DATA_URI_CONTENT_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/svg+xml',
  'image/webp',
])
const THEME_PRESET_PRIMARY_COLOR = {
  amber: 'oklch(0.881 0.168 94.237)',
  default: 'oklch(0.55 0.2 255)',
  lime: 'oklch(0.67 0.2 145)',
  midnight: 'oklch(0.577 0.209 273.85)',
} as const

type EventMarket = Event['markets'][number]
type MarketOutcome = EventMarket['outcomes'][number]
type ChangeDirection = 'flat' | 'down' | 'up'

interface PriceHistoryPoint {
  t: number
  p: number
}

interface OutcomeButton {
  label: string
  price: number | null
  priceLabel: string
  background: string
  color: string
}

interface ChartData {
  points: Array<{
    x: number
    y: number
    value: number
  }>
  path: string
  changeDirection: ChangeDirection
  changeLabel: string | null
  changeColor: string
}

function resolveThemePrimaryColor(primaryValue: string | null | undefined, presetId: string) {
  const normalizedPrimary = primaryValue?.trim()
  if (normalizedPrimary) {
    if (normalizedPrimary.startsWith('#') || normalizedPrimary.startsWith('rgb')) {
      return normalizedPrimary
    }

    const converted = oklchToRenderableColor(normalizedPrimary)
    if (converted) {
      return converted
    }
  }

  const presetFallback = THEME_PRESET_PRIMARY_COLOR[presetId as keyof typeof THEME_PRESET_PRIMARY_COLOR]
    ?? THEME_PRESET_PRIMARY_COLOR.default

  return oklchToRenderableColor(presetFallback) ?? '#3468d6'
}

function normalizeQueryValue(value: string | null) {
  return value?.trim() ?? ''
}

function resolveLocale(value: string | null): SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale)
    ? value as SupportedLocale
    : DEFAULT_LOCALE
}

function sanitizeImageUrl(rawUrl: string | null | undefined, siteUrl: string) {
  const trimmed = rawUrl?.trim()
  if (!trimmed) {
    return ''
  }

  try {
    const parsed = new URL(trimmed, `${siteUrl}/`)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return ''
    }
    return parsed.toString()
  }
  catch {
    return ''
  }
}

async function fetchImageDataUrl(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      next: {
        revalidate: 300,
      },
      signal: AbortSignal.timeout(SOCIAL_IMAGE_FETCH_TIMEOUT_MS),
    })

    if (!response.ok) {
      return ''
    }

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
    if (!IMAGE_DATA_URI_CONTENT_TYPES.has(contentType)) {
      return ''
    }

    const imageBytes = await readResponseBodyWithLimit(response, MAX_OG_REMOTE_IMAGE_BYTES)
    if (!imageBytes || imageBytes.byteLength === 0) {
      return ''
    }

    const base64 = Buffer.from(imageBytes).toString('base64')
    return `data:${contentType};base64,${base64}`
  }
  catch {
    return ''
  }
}

function resolveFocusedMarket(event: Event, marketSlug: string) {
  const normalizedMarketSlug = marketSlug.trim().toLowerCase()
  if (normalizedMarketSlug) {
    const exactMatch = event.markets.find(market => market.slug.trim().toLowerCase() === normalizedMarketSlug) ?? null
    if (exactMatch) {
      return exactMatch
    }
  }

  return [...event.markets]
    .sort((left, right) => {
      const volumeDelta = (right.volume ?? 0) - (left.volume ?? 0)
      if (volumeDelta !== 0) {
        return volumeDelta
      }

      return (right.probability ?? 0) - (left.probability ?? 0)
    })[0] ?? null
}

async function resolveEventImage(event: Event, focusedMarket: EventMarket | null, siteUrl: string) {
  const imageCandidate = [
    focusedMarket?.icon_url,
    event.icon_url,
    event.sports_team_logo_urls?.[0],
  ]
    .map(candidate => sanitizeImageUrl(candidate, siteUrl))
    .find(Boolean)

  if (!imageCandidate) {
    return ''
  }

  return fetchImageDataUrl(imageCandidate)
}

function resolveBinaryOutcome(market: EventMarket, outcomeIndex: number, fallbackIndex: number) {
  return market.outcomes.find(outcome => outcome.outcome_index === outcomeIndex) ?? market.outcomes[fallbackIndex] ?? null
}

function resolveOutcomePrice(market: EventMarket, outcome: MarketOutcome | null) {
  if (!outcome) {
    return null
  }

  if (typeof outcome.buy_price === 'number' && Number.isFinite(outcome.buy_price)) {
    return outcome.buy_price
  }

  if (outcome.outcome_index === OUTCOME_INDEX.YES) {
    return market.price
  }

  if (outcome.outcome_index === OUTCOME_INDEX.NO && Number.isFinite(market.price)) {
    return 1 - market.price
  }

  return null
}

function resolveBinaryOutcomeButtons(market: EventMarket) {
  const yesOutcome = resolveBinaryOutcome(market, OUTCOME_INDEX.YES, 0)
  const noOutcome = resolveBinaryOutcome(market, OUTCOME_INDEX.NO, 1)
  const orderedOutcomes = [yesOutcome, noOutcome].filter((outcome): outcome is MarketOutcome => outcome !== null)

  return orderedOutcomes.slice(0, 2).map((outcome, index) => {
    const theme = resolveOutcomeButtonTheme(outcome.outcome_text || '', index)
    const price = resolveOutcomePrice(market, outcome)

    return {
      label: outcome.outcome_text?.trim() || (index === 0 ? 'Yes' : 'No'),
      price,
      priceLabel: formatCentsLabel(price, { fallback: '—' }),
      background: theme.background,
      color: theme.color,
    }
  })
}

function resolveMarketButtons(event: Event) {
  return [...event.markets]
    .sort((left, right) => (right.probability ?? 0) - (left.probability ?? 0))
    .slice(0, 2)
    .map((market, index) => {
      const label = market.title?.trim() || `Outcome ${index + 1}`
      const theme = resolveOutcomeButtonTheme(label, index)

      return {
        label,
        price: market.price,
        priceLabel: formatCentsLabel(market.price, { fallback: '—' }),
        background: theme.background,
        color: theme.color,
      }
    })
}

function resolveOutcomeButtons(event: Event, focusedMarket: EventMarket | null, explicitMarketRequested: boolean) {
  if (!focusedMarket) {
    return resolveMarketButtons(event)
  }

  if (event.total_markets_count <= 1 || explicitMarketRequested) {
    return resolveBinaryOutcomeButtons(focusedMarket)
  }

  return resolveMarketButtons(event)
}

function resolveHeadlineMetric(event: Event, focusedMarket: EventMarket | null, explicitMarketRequested: boolean) {
  if (!focusedMarket) {
    return {
      label: '',
      price: null,
    }
  }

  if (event.total_markets_count <= 1 || explicitMarketRequested) {
    const yesOutcome = resolveBinaryOutcome(focusedMarket, OUTCOME_INDEX.YES, 0)
    return {
      label: yesOutcome?.outcome_text?.trim() || 'Yes',
      price: resolveOutcomePrice(focusedMarket, yesOutcome),
    }
  }

  return {
    label: focusedMarket.title?.trim() || '',
    price: focusedMarket.price,
  }
}

function resolveChartTokenId(market: EventMarket | null) {
  if (!market) {
    return ''
  }

  const yesOutcome = resolveBinaryOutcome(market, OUTCOME_INDEX.YES, 0)
  return yesOutcome?.token_id ?? market.outcomes[0]?.token_id ?? ''
}

function parseResolvedAtSeconds(resolvedAt?: string | null) {
  if (!resolvedAt) {
    return Number.NaN
  }

  const resolved = new Date(resolvedAt)
  const resolvedMs = resolved.getTime()
  if (!Number.isFinite(resolvedMs)) {
    return Number.NaN
  }

  return Math.floor(resolvedMs / 1000)
}

function resolveCreatedRange(createdAt: string, resolvedAt?: string | null) {
  const created = new Date(createdAt)
  const createdSeconds = Number.isFinite(created.getTime())
    ? Math.floor(created.getTime() / 1000)
    : Math.floor(Date.now() / 1000) - (60 * 60 * 24)
  const realNowSeconds = Math.floor(Date.now() / 1000)
  const resolvedSeconds = parseResolvedAtSeconds(resolvedAt)
  const baseEndSeconds = Number.isFinite(resolvedSeconds)
    ? Math.min(realNowSeconds, resolvedSeconds)
    : realNowSeconds
  const nowSeconds = Math.max(createdSeconds + 60, baseEndSeconds)
  const ageSeconds = Math.max(0, nowSeconds - createdSeconds)

  return {
    createdSeconds,
    nowSeconds,
    ageSeconds,
  }
}

function resolveFidelityForSpan(spanSeconds: number) {
  if (spanSeconds <= 2 * 24 * 60 * 60) {
    return 5
  }
  if (spanSeconds <= 7 * 24 * 60 * 60) {
    return 30
  }
  if (spanSeconds <= 30 * 24 * 60 * 60) {
    return 180
  }
  return 720
}

function buildPriceHistoryFilters(createdAt: string, resolvedAt?: string | null) {
  const { createdSeconds, nowSeconds, ageSeconds } = resolveCreatedRange(createdAt, resolvedAt)

  return {
    fidelity: resolveFidelityForSpan(ageSeconds).toString(),
    startTs: createdSeconds.toString(),
    endTs: nowSeconds.toString(),
  }
}

async function fetchMarketPriceHistory(tokenId: string, createdAt: string, resolvedAt?: string | null) {
  if (!tokenId || !process.env.CLOB_URL) {
    return [] as PriceHistoryPoint[]
  }

  const filters = buildPriceHistoryFilters(createdAt, resolvedAt)
  const url = new URL(`${process.env.CLOB_URL}/prices-history`)
  url.searchParams.set('market', tokenId)

  Object.entries(filters).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  try {
    const response = await fetch(url.toString(), {
      next: {
        revalidate: 300,
      },
      signal: AbortSignal.timeout(SOCIAL_HISTORY_FETCH_TIMEOUT_MS),
    })

    if (!response.ok) {
      return []
    }

    const payload = await response.json() as { history?: PriceHistoryPoint[] }
    return (payload.history ?? [])
      .map(point => ({
        t: Number(point.t),
        p: Number(point.p),
      }))
      .filter(point => Number.isFinite(point.t) && Number.isFinite(point.p))
      .filter(point => point.p >= 0 && point.p <= 1)
      .sort((left, right) => left.t - right.t)
  }
  catch {
    return []
  }
}

function buildFallbackHistory(price: number | null) {
  const safePrice = Number.isFinite(price) ? Math.max(0, Math.min(1, price ?? 0.5)) : 0.5

  return Array.from({ length: 8 }, (_, index) => ({
    t: index,
    p: safePrice,
  }))
}

function samplePriceHistory(points: PriceHistoryPoint[], maxPoints = MAX_CHART_POINTS) {
  if (points.length <= maxPoints) {
    return points
  }

  const sampled: PriceHistoryPoint[] = []
  const seenIndexes = new Set<number>()

  for (let index = 0; index < maxPoints; index += 1) {
    const pointIndex = Math.round((index * (points.length - 1)) / (maxPoints - 1))
    if (seenIndexes.has(pointIndex)) {
      continue
    }
    seenIndexes.add(pointIndex)
    const point = points[pointIndex]
    if (point) {
      sampled.push(point)
    }
  }

  return sampled
}

function buildChartData(points: PriceHistoryPoint[]): ChartData {
  const safePoints = samplePriceHistory(points.length > 1 ? points : buildFallbackHistory(points[0]?.p ?? 0.5))
  const values = safePoints.map(point => point.p)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const padding = Math.max(0.02, (maxValue - minValue) * 0.2)
  const chartMin = Math.max(0, minValue - padding)
  const chartMax = Math.min(1, maxValue + padding)
  const chartRange = Math.max(chartMax - chartMin, 0.04)

  const plottedPoints = safePoints.map((point, index) => {
    const x = safePoints.length === 1
      ? CHART_WIDTH / 2
      : (index * CHART_WIDTH) / (safePoints.length - 1)
    const normalized = (point.p - chartMin) / chartRange
    const y = CHART_HEIGHT - (normalized * CHART_HEIGHT)

    return {
      x,
      y,
      value: point.p,
    }
  })

  const path = plottedPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')

  const firstValue = plottedPoints[0]?.value
  const lastValue = plottedPoints[plottedPoints.length - 1]?.value
  const delta = typeof firstValue === 'number' && typeof lastValue === 'number'
    ? (lastValue - firstValue) * 100
    : 0
  const roundedDelta = Math.round(delta)
  const changeDirection: ChangeDirection = roundedDelta > 0 ? 'up' : roundedDelta < 0 ? 'down' : 'flat'

  return {
    points: plottedPoints,
    path,
    changeDirection,
    changeLabel: plottedPoints.length > 1 ? `${Math.abs(roundedDelta)}%` : null,
    changeColor: roundedDelta >= 0 ? '#2b9a68' : '#d65757',
  }
}

function renderOutcomeButton(button: OutcomeButton, index: number) {
  return (
    <div
      key={`${button.label}-${index}`}
      style={{
        minWidth: 0,
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        borderRadius: '18px',
        background: button.background,
        padding: '18px 24px',
      }}
    >
      <div
        style={{
          minWidth: 0,
          display: 'flex',
          fontSize: '18px',
          fontWeight: 700,
          lineHeight: 1.1,
          color: button.color,
        }}
      >
        {button.label}
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: '18px',
          fontWeight: 800,
          color: button.color,
        }}
      >
        {button.priceLabel}
      </div>
    </div>
  )
}

function renderChangeDirectionIcon(direction: ChangeDirection, color: string) {
  if (direction === 'flat') {
    return null
  }

  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      style={{
        display: 'flex',
      }}
    >
      <path
        d={direction === 'up' ? 'M7 2 L12 11 H2 Z' : 'M2 3 H12 L7 12 Z'}
        fill={color}
      />
    </svg>
  )
}

function renderFallbackImage(title: string) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
        padding: '40px',
      }}
    >
      <div
        style={{
          display: 'flex',
          fontSize: '66px',
          fontWeight: 800,
          lineHeight: 1,
          textAlign: 'center',
          color: '#ffffff',
        }}
      >
        {title}
      </div>
    </div>
  )
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = normalizeQueryValue(searchParams.get('slug'))
  const locale = resolveLocale(searchParams.get('locale'))
  const marketSlug = normalizeQueryValue(searchParams.get('market'))

  if (!slug) {
    return new Response('Missing event slug.', { status: 400 })
  }

  const [runtimeTheme, eventResult] = await Promise.all([
    loadRuntimeThemeState(),
    EventRepository.getEventBySlug(slug, '', locale),
  ])

  if (eventResult.error || !eventResult.data) {
    return new Response('Event not found.', { status: 404 })
  }

  const event = eventResult.data
  const siteUrl = resolveSiteUrl(process.env)
  const siteName = runtimeTheme.site.name
  const primaryColor = resolveThemePrimaryColor(
    runtimeTheme.theme.light.primary ?? runtimeTheme.theme.dark.primary ?? null,
    runtimeTheme.theme.presetId,
  )
  const explicitMarketRequested = Boolean(marketSlug)
  const focusedMarket = resolveFocusedMarket(event, marketSlug)
  const chartTokenId = resolveChartTokenId(focusedMarket)
  const [eventImageUrl, chartHistory] = await Promise.all([
    resolveEventImage(event, focusedMarket, siteUrl),
    fetchMarketPriceHistory(chartTokenId, event.created_at, event.resolved_at),
  ])
  const outcomeButtons = resolveOutcomeButtons(event, focusedMarket, explicitMarketRequested)
  const headlineMetric = resolveHeadlineMetric(event, focusedMarket, explicitMarketRequested)
  const chartData = buildChartData(chartHistory.length > 0 ? chartHistory : buildFallbackHistory(focusedMarket?.price ?? null))
  const headlinePriceLabel = headlineMetric.price !== null && headlineMetric.price !== undefined
    ? formatPercent((headlineMetric.price ?? 0) * 100, { digits: 0 })
    : null
  const volumeLabel = event.volume > 0 ? `${formatCompactCurrency(event.volume)} Vol.` : 'New market'
  const marketLabel = focusedMarket?.title?.trim() ?? ''
  const imageTitle = marketLabel || event.title
  const chartEndPoint = chartData.points[chartData.points.length - 1] ?? null

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f4f4f5',
          padding: '24px',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            overflow: 'hidden',
            borderRadius: '30px',
            border: '1px solid #d4d4d8',
            background: '#ffffff',
            boxShadow: '0 14px 40px rgba(15, 23, 42, 0.08)',
          }}
        >
          <div
            style={{
              width: '494px',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
              background: '#e5e7eb',
            }}
          >
            {eventImageUrl
              ? (
                  // eslint-disable-next-line next/no-img-element
                  <img
                    src={eventImageUrl}
                    alt=""
                    width={494}
                    height={630}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                )
              : renderFallbackImage(event.title)}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.02) 0%, rgba(15, 23, 42, 0.48) 100%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: '22px',
                right: '22px',
                bottom: '20px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  maxWidth: '100%',
                  borderRadius: '14px',
                  background: 'rgba(17, 24, 39, 0.78)',
                  padding: '10px 14px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    fontSize: '18px',
                    fontWeight: 700,
                    lineHeight: 1.2,
                    color: '#ffffff',
                  }}
                >
                  {imageTitle}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              width: '1px',
              height: '100%',
              background: '#e5e7eb',
            }}
          />

          <div
            style={{
              flex: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '28px 30px 24px',
              background: '#ffffff',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '20px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    fontSize: '19px',
                    fontWeight: 700,
                    color: '#94a3b8',
                  }}
                >
                  {volumeLabel}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: '999px',
                    background: '#f8fafc',
                    padding: '8px 14px',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#94a3b8',
                  }}
                >
                  {siteName}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  fontSize: '54px',
                  fontWeight: 800,
                  lineHeight: 1.03,
                  letterSpacing: '-0.03em',
                  color: '#111827',
                }}
              >
                {event.title}
              </div>

              {marketLabel && event.total_markets_count > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignSelf: 'flex-start',
                    borderRadius: '999px',
                    background: '#f8fafc',
                    padding: '8px 14px',
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#64748b',
                  }}
                >
                  {marketLabel}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '20px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      fontSize: '28px',
                      fontWeight: 800,
                      lineHeight: 1,
                      color: '#111827',
                    }}
                  >
                    {headlinePriceLabel ?? '—'}
                    {' '}
                    chance
                  </div>
                  {chartData.changeLabel && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '20px',
                        fontWeight: 700,
                        lineHeight: 1,
                        color: chartData.changeDirection === 'flat' ? '#64748b' : chartData.changeColor,
                      }}
                    >
                      {renderChangeDirectionIcon(
                        chartData.changeDirection,
                        chartData.changeDirection === 'flat' ? '#64748b' : chartData.changeColor,
                      )}
                      {chartData.changeLabel}
                    </div>
                  )}
                </div>

              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: `${CHART_WIDTH}px`,
                  height: `${CHART_HEIGHT}px`,
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '20px',
                  background: '#f8fafc',
                  padding: '18px 16px',
                }}
              >
                <svg
                  width={CHART_WIDTH}
                  height={CHART_HEIGHT}
                  viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                  style={{
                    display: 'block',
                  }}
                >
                  <path
                    d={chartData.path}
                    fill="none"
                    stroke={primaryColor}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {chartEndPoint && (
                    <circle
                      cx={chartEndPoint.x}
                      cy={chartEndPoint.y}
                      r="5"
                      fill={primaryColor}
                    />
                  )}
                </svg>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '14px',
                }}
              >
                {outcomeButtons.length > 0
                  ? outcomeButtons.map((button, index) => renderOutcomeButton(button, index))
                  : (
                      <div
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '18px',
                          background: '#f3f4f6',
                          padding: '20px 24px',
                          fontSize: '18px',
                          fontWeight: 700,
                          color: '#6b7280',
                        }}
                      >
                        Market pricing unavailable
                      </div>
                    )}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      headers: {
        'cache-control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
      },
    },
  )
}
