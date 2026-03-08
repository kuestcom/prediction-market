import type { SupportedLocale } from '@/i18n/locales'
import type { Event } from '@/types'
import { ImageResponse } from 'next/og'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/locales'
import { EventRepository } from '@/lib/db/queries/event'
import { formatCentsLabel, formatCompactCurrency, formatDate, formatPercent } from '@/lib/formatters'
import siteUrlUtils from '@/lib/site-url'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

const { resolveSiteUrl } = siteUrlUtils

const IMAGE_WIDTH = 1200
const IMAGE_HEIGHT = 630

type EventMarket = Event['markets'][number]

function normalizeQueryValue(value: string | null) {
  return value?.trim() ?? ''
}

function resolveLocale(value: string | null): SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale)
    ? value as SupportedLocale
    : DEFAULT_LOCALE
}

function formatLabel(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim()
  if (!normalized) {
    return fallback
  }

  return normalized
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, match => match.toUpperCase())
}

function sanitizeImageUrl(rawUrl: string | null | undefined, siteUrl: string) {
  const trimmed = rawUrl?.trim()
  if (!trimmed) {
    return ''
  }

  if (trimmed.startsWith('data:image/')) {
    return trimmed
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

function resolveHeroImages(event: Event, focusedMarket: EventMarket | null, siteUrl: string) {
  const uniqueImages = new Set<string>()

  function pushImage(value: string | null | undefined) {
    const normalized = sanitizeImageUrl(value, siteUrl)
    if (normalized) {
      uniqueImages.add(normalized)
    }
  }

  for (const logoUrl of event.sports_team_logo_urls ?? []) {
    pushImage(logoUrl)
    if (uniqueImages.size >= 2) {
      return [...uniqueImages]
    }
  }

  pushImage(focusedMarket?.icon_url)
  pushImage(event.icon_url)

  return [...uniqueImages].slice(0, 2)
}

function resolveStatusDisplay(event: Event) {
  if (event.status === 'resolved') {
    return {
      label: 'Resolved',
      background: 'rgba(34, 197, 94, 0.18)',
      border: 'rgba(34, 197, 94, 0.35)',
      color: '#dcfce7',
    }
  }

  if (event.sports_live) {
    return {
      label: 'Live',
      background: 'rgba(239, 68, 68, 0.18)',
      border: 'rgba(248, 113, 113, 0.35)',
      color: '#fee2e2',
    }
  }

  if (event.status === 'archived') {
    return {
      label: 'Archived',
      background: 'rgba(148, 163, 184, 0.18)',
      border: 'rgba(148, 163, 184, 0.3)',
      color: '#e2e8f0',
    }
  }

  if (event.status === 'draft') {
    return {
      label: 'Draft',
      background: 'rgba(245, 158, 11, 0.18)',
      border: 'rgba(251, 191, 36, 0.3)',
      color: '#fef3c7',
    }
  }

  return {
    label: 'Open',
    background: 'rgba(59, 130, 246, 0.18)',
    border: 'rgba(96, 165, 250, 0.35)',
    color: '#dbeafe',
  }
}

function resolveDateDisplay(event: Event) {
  const resolvedAt = event.resolved_at ? new Date(event.resolved_at) : null
  if (resolvedAt && !Number.isNaN(resolvedAt.getTime())) {
    return {
      label: 'Resolved',
      value: formatDate(resolvedAt),
    }
  }

  const startDate = event.sports_start_time ?? event.start_date
  if (startDate) {
    const parsedStartDate = new Date(startDate)
    if (!Number.isNaN(parsedStartDate.getTime())) {
      return {
        label: event.sports_live ? 'Started' : 'Starts',
        value: formatDate(parsedStartDate),
      }
    }
  }

  const endDate = event.end_date ? new Date(event.end_date) : null
  if (endDate && !Number.isNaN(endDate.getTime())) {
    return {
      label: 'Closes',
      value: formatDate(endDate),
    }
  }

  return {
    label: 'Status',
    value: 'Ongoing',
  }
}

function resolveMarketHighlights(event: Event, focusedMarket: EventMarket | null, explicitMarketRequested: boolean) {
  if (focusedMarket && explicitMarketRequested) {
    return [focusedMarket]
  }

  return [...event.markets]
    .sort((left, right) => {
      const volumeDelta = (right.volume ?? 0) - (left.volume ?? 0)
      if (volumeDelta !== 0) {
        return volumeDelta
      }

      return (right.probability ?? 0) - (left.probability ?? 0)
    })
    .slice(0, 3)
}

function renderMetricCard(label: string, value: string, accent?: string) {
  return (
    <div
      style={{
        minWidth: 0,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        borderRadius: '24px',
        border: '1px solid rgba(148, 163, 184, 0.18)',
        background: 'rgba(15, 23, 42, 0.62)',
        padding: '20px 22px',
      }}
    >
      <div
        style={{
          display: 'flex',
          fontSize: '20px',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: '#94a3b8',
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: '34px',
          fontWeight: 700,
          lineHeight: 1.05,
          color: accent ?? '#f8fafc',
        }}
      >
        {value}
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
  const statusDisplay = resolveStatusDisplay(event)
  const dateDisplay = resolveDateDisplay(event)
  const focusedMarket = resolveFocusedMarket(event, marketSlug)
  const explicitMarketRequested = Boolean(marketSlug)
  const marketHighlights = resolveMarketHighlights(event, focusedMarket, explicitMarketRequested)
  const heroImages = resolveHeroImages(event, focusedMarket, siteUrl)
  const focusLabel = focusedMarket?.title?.trim() ?? ''
  const focusProbability = focusedMarket && Number.isFinite(focusedMarket.probability)
    ? formatPercent(focusedMarket.probability, { digits: 0 })
    : null
  const categoryLabel = formatLabel(event.main_tag || event.sports_sport_slug, 'Prediction Market')
  const marketCountLabel = `${Math.max(event.total_markets_count, event.markets.length)}`
  const volumeLabel = formatCompactCurrency(event.volume)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background: 'radial-gradient(circle at top left, #1e293b 0%, #0f172a 42%, #020617 100%)',
          color: '#f8fafc',
          padding: '40px',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            left: '-120px',
            width: '360px',
            height: '360px',
            borderRadius: '999px',
            background: 'rgba(59, 130, 246, 0.16)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: '-80px',
            bottom: '-120px',
            width: '320px',
            height: '320px',
            borderRadius: '999px',
            background: 'rgba(16, 185, 129, 0.12)',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderRadius: '34px',
            border: '1px solid rgba(148, 163, 184, 0.16)',
            background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.82) 0%, rgba(2, 6, 23, 0.88) 100%)',
            padding: '34px',
            boxShadow: '0 30px 80px rgba(2, 6, 23, 0.35)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '24px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                borderRadius: '999px',
                background: 'rgba(15, 23, 42, 0.75)',
                padding: '12px 18px',
                fontSize: '24px',
                fontWeight: 700,
                letterSpacing: '0.01em',
              }}
            >
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '999px',
                  background: '#38bdf8',
                }}
              />
              {siteName}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '999px',
                  border: '1px solid rgba(96, 165, 250, 0.25)',
                  background: 'rgba(37, 99, 235, 0.15)',
                  padding: '10px 18px',
                  fontSize: '20px',
                  fontWeight: 600,
                  color: '#dbeafe',
                }}
              >
                {categoryLabel}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '999px',
                  border: `1px solid ${statusDisplay.border}`,
                  background: statusDisplay.background,
                  padding: '10px 18px',
                  fontSize: '20px',
                  fontWeight: 700,
                  color: statusDisplay.color,
                }}
              >
                {statusDisplay.label}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              gap: '28px',
              flex: 1,
              marginTop: '26px',
            }}
          >
            <div
              style={{
                minWidth: 0,
                flex: 1.45,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '28px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px',
                }}
              >
                {focusLabel && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '22px',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: '#38bdf8',
                    }}
                  >
                    {explicitMarketRequested ? 'Focused Market' : 'Featured Market'}
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    fontSize: '64px',
                    fontWeight: 800,
                    lineHeight: 1.02,
                    letterSpacing: '-0.03em',
                    color: '#f8fafc',
                  }}
                >
                  {event.title}
                </div>
                {focusLabel && (
                  <div
                    style={{
                      display: 'flex',
                      maxWidth: '90%',
                      borderRadius: '18px',
                      border: '1px solid rgba(56, 189, 248, 0.24)',
                      background: 'rgba(14, 165, 233, 0.12)',
                      padding: '14px 18px',
                      fontSize: '28px',
                      fontWeight: 600,
                      lineHeight: 1.15,
                      color: '#e0f2fe',
                    }}
                  >
                    {focusLabel}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '16px',
                }}
              >
                {renderMetricCard('Volume', volumeLabel)}
                {renderMetricCard(dateDisplay.label, dateDisplay.value)}
                {renderMetricCard(
                  focusProbability ? 'Yes Chance' : 'Markets',
                  focusProbability ?? marketCountLabel,
                  focusProbability ? '#93c5fd' : undefined,
                )}
              </div>
            </div>

            <div
              style={{
                width: '360px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '22px',
                borderRadius: '30px',
                border: '1px solid rgba(148, 163, 184, 0.16)',
                background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.88) 0%, rgba(15, 23, 42, 0.62) 100%)',
                padding: '24px',
              }}
            >
              <div
                style={{
                  minHeight: '200px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '18px',
                  borderRadius: '24px',
                  background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.92) 100%)',
                  padding: '24px',
                }}
              >
                {heroImages.length > 0
                  ? heroImages.map((imageUrl, index) => (
                    // eslint-disable-next-line next/no-img-element
                      <img
                        key={`${imageUrl}-${index}`}
                        src={imageUrl}
                        alt=""
                        width={heroImages.length > 1 ? 120 : 168}
                        height={heroImages.length > 1 ? 120 : 168}
                        style={{
                          width: heroImages.length > 1 ? '120px' : '168px',
                          height: heroImages.length > 1 ? '120px' : '168px',
                          borderRadius: '999px',
                          objectFit: 'cover',
                          border: '4px solid rgba(148, 163, 184, 0.14)',
                          background: '#0f172a',
                        }}
                      />
                    ))
                  : (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '100%',
                          fontSize: '42px',
                          fontWeight: 800,
                          textAlign: 'center',
                          lineHeight: 1.05,
                          letterSpacing: '-0.02em',
                          color: '#cbd5e1',
                        }}
                      >
                        {categoryLabel}
                      </div>
                    )}
              </div>

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
                    fontSize: '19px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: '#94a3b8',
                  }}
                >
                  {explicitMarketRequested ? 'Shared View' : 'Market Snapshot'}
                </div>
                {marketHighlights.length > 0
                  ? marketHighlights.map((market, index) => {
                      const label = market.title?.trim() || `Market ${index + 1}`
                      const probability = Number.isFinite(market.probability)
                        ? formatPercent(market.probability, { digits: 0 })
                        : '—'
                      const price = formatCentsLabel(market.price, { fallback: '—' })

                      return (
                        <div
                          key={`${market.slug || label}-${index}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '18px',
                            borderRadius: '18px',
                            border: '1px solid rgba(148, 163, 184, 0.14)',
                            background: 'rgba(15, 23, 42, 0.55)',
                            padding: '14px 16px',
                          }}
                        >
                          <div
                            style={{
                              minWidth: 0,
                              flex: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                fontSize: '22px',
                                fontWeight: 700,
                                lineHeight: 1.1,
                                color: '#f8fafc',
                              }}
                            >
                              {label}
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                fontSize: '18px',
                                fontWeight: 600,
                                color: '#94a3b8',
                              }}
                            >
                              Last price
                              {' '}
                              {price}
                            </div>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-end',
                              gap: '4px',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                fontSize: '28px',
                                fontWeight: 800,
                                color: '#93c5fd',
                              }}
                            >
                              {probability}
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                fontSize: '16px',
                                fontWeight: 600,
                                color: '#64748b',
                              }}
                            >
                              implied odds
                            </div>
                          </div>
                        </div>
                      )
                    })
                  : (
                      <div
                        style={{
                          display: 'flex',
                          borderRadius: '18px',
                          border: '1px solid rgba(148, 163, 184, 0.14)',
                          background: 'rgba(15, 23, 42, 0.55)',
                          padding: '18px 16px',
                          fontSize: '20px',
                          fontWeight: 600,
                          color: '#cbd5e1',
                        }}
                      >
                        Live event page and pricing snapshot
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
