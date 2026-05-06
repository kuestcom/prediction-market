import type { CategoryValue, OrderValue, PeriodValue } from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFilters'
import { ImageResponse } from 'next/og'
import {
  CATEGORY_OPTIONS,

  DEFAULT_FILTERS,
  ORDER_OPTIONS,

  PERIOD_OPTIONS,

  resolveCategoryApiValue,
  resolveOrderApiValue,
  resolvePeriodApiValue,
} from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFilters'
import { oklchToRenderableColor } from '@/lib/color'
import { truncateAddress } from '@/lib/formatters'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

const OG_IMAGE_WIDTH = 1200
const OG_IMAGE_HEIGHT = 630
const DATA_API_URL = process.env.DATA_URL?.trim().replace(/\/+$/, '') ?? ''
const LEADERBOARD_API_URL = DATA_API_URL
  ? (DATA_API_URL.endsWith('/v1') ? DATA_API_URL : `${DATA_API_URL}/v1`)
  : ''
const THEME_PRESET_PRIMARY_COLOR = {
  amber: 'oklch(0.881 0.168 94.237)',
  default: 'oklch(0.55 0.2 255)',
  lime: 'oklch(0.67 0.2 145)',
  midnight: 'oklch(0.577 0.209 273.85)',
} as const

interface LeaderboardRow {
  rank: number
  name: string
  pnl: number
  volume: number
}

function normalizeText(value: string | null | undefined, maxLength: number) {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) {
    return null
  }

  if (trimmed.length <= maxLength) {
    return trimmed
  }

  return `${trimmed.slice(0, maxLength - 1)}…`
}

function parseNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : Number.NaN
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : Number.NaN
  }

  return Number.NaN
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

function resolveString(entry: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = entry[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

function resolveFilterCategory(value: string | null): CategoryValue {
  const normalized = value?.trim().toLowerCase() ?? ''
  const matched = CATEGORY_OPTIONS.find(option => option.value === normalized)
  return matched?.value ?? DEFAULT_FILTERS.category
}

function resolveFilterPeriod(value: string | null): PeriodValue {
  const normalized = value?.trim().toLowerCase() ?? ''
  const matched = PERIOD_OPTIONS.find(option => option.value === normalized)
  return matched?.value ?? DEFAULT_FILTERS.period
}

function resolveFilterOrder(value: string | null): OrderValue {
  const normalized = value?.trim().toLowerCase() ?? ''
  const matched = ORDER_OPTIONS.find(option => option.value === normalized)
  return matched?.value ?? DEFAULT_FILTERS.order
}

function normalizeLeaderboardResponse(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(item => item && typeof item === 'object') as Record<string, unknown>[]
  }

  if (!payload || typeof payload !== 'object') {
    return []
  }

  const data = (payload as { data?: unknown }).data
  if (Array.isArray(data)) {
    return data.filter(item => item && typeof item === 'object') as Record<string, unknown>[]
  }

  const nested = (payload as { leaderboard?: unknown }).leaderboard
  if (Array.isArray(nested)) {
    return nested.filter(item => item && typeof item === 'object') as Record<string, unknown>[]
  }

  return []
}

function formatSignedCurrency(value: number) {
  if (!Number.isFinite(value)) {
    return '$0'
  }

  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.abs(value))

  if (value > 0) {
    return `+${formatted}`
  }

  if (value < 0) {
    return `-${formatted}`
  }

  return formatted
}

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) {
    return '$0'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.abs(value))
}

function formatPnlSummary(value: number) {
  if (!Number.isFinite(value)) {
    return '—'
  }

  const formatted = formatCurrency(value)
  return value < 0 ? `-${formatted}` : formatted
}

function buildAvatarGradient(name: string, rank: number) {
  let hash = rank
  for (let index = 0; index < name.length; index += 1) {
    hash = ((hash << 5) - hash) + name.charCodeAt(index)
    hash |= 0
  }

  const hueA = Math.abs(hash) % 360
  const hueB = (hueA + 104) % 360
  return `linear-gradient(135deg, hsl(${hueA} 78% 58%) 0%, hsl(${hueB} 72% 52%) 100%)`
}

async function fetchLeaderboardRows({
  category,
  period,
  order,
}: {
  category: CategoryValue
  period: PeriodValue
  order: OrderValue
}): Promise<LeaderboardRow[]> {
  if (!LEADERBOARD_API_URL) {
    return []
  }

  const params = new URLSearchParams({
    limit: '8',
    offset: '0',
    category: resolveCategoryApiValue(category),
    timePeriod: resolvePeriodApiValue(period),
    orderBy: resolveOrderApiValue(order),
  })

  try {
    const response = await fetch(`${LEADERBOARD_API_URL}/leaderboard?${params.toString()}`, {
      next: {
        revalidate: 60,
      },
    })

    if (!response.ok) {
      return []
    }

    const payload = await response.json().catch(() => null)
    const normalized = normalizeLeaderboardResponse(payload)
    if (normalized.length === 0) {
      return []
    }

    return normalized.slice(0, 8).map((entry, index) => {
      const name = normalizeText(
        resolveString(entry, ['userName', 'username', 'xUsername']),
        28,
      ) ?? normalizeText(truncateAddress(resolveString(entry, ['proxyWallet', 'deposit_wallet_address'])), 28)
      ?? `Trader ${index + 1}`

      const pnl = parseNumber(entry.pnl)
      const volume = parseNumber(entry.vol ?? entry.volume)
      const rank = parseNumber(entry.rank)

      return {
        rank: Number.isFinite(rank) ? Math.max(1, Math.round(rank)) : index + 1,
        name,
        pnl: Number.isFinite(pnl) ? pnl : 0,
        volume: Number.isFinite(volume) ? volume : 0,
      } satisfies LeaderboardRow
    })
  }
  catch {
    return []
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const category = resolveFilterCategory(searchParams.get('category'))
  const period = resolveFilterPeriod(searchParams.get('period'))
  const order = resolveFilterOrder(searchParams.get('order'))

  const categoryLabel = CATEGORY_OPTIONS.find(option => option.value === category)?.label ?? 'All Categories'
  const periodLabel = PERIOD_OPTIONS.find(option => option.value === period)?.label ?? 'Monthly'
  const metricLabel = ORDER_OPTIONS.find(option => option.value === order)?.label ?? 'Profit/Loss'

  try {
    const [runtimeTheme, rows] = await Promise.all([
      loadRuntimeThemeState(),
      fetchLeaderboardRows({ category, period, order }),
    ])
    const siteName = normalizeText(runtimeTheme.site.name, 24) ?? 'Prediction Market'
    const siteLogoSrc = runtimeTheme.site.logoUrl?.trim() ?? ''
    const primaryColor = resolveThemePrimaryColor(
      runtimeTheme.theme.light.primary ?? runtimeTheme.theme.dark.primary ?? null,
      runtimeTheme.theme.presetId,
    )
    const displayRows = rows.slice(0, 8)
    const isVolumeMetric = order === 'volume'
    const topRow = displayRows[0]
    const topValue = topRow
      ? (isVolumeMetric ? formatCurrency(topRow.volume) : formatPnlSummary(topRow.pnl))
      : '—'

    const response = new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
            backgroundColor: '#080b10',
          }}
        >
          <div
            style={{
              width: '52%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              padding: '30px 34px',
              background: 'radial-gradient(circle at 18% 12%, #212a38 0%, #0b1019 52%, #080b10 100%)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              {siteLogoSrc
                ? (
                    // eslint-disable-next-line next/no-img-element
                    <img
                      src={siteLogoSrc}
                      alt=""
                      width={34}
                      height={34}
                      style={{
                        width: '34px',
                        height: '34px',
                        objectFit: 'contain',
                        filter: 'brightness(0) invert(1)',
                      }}
                    />
                  )
                : null}
              <div
                style={{
                  display: 'flex',
                  color: '#f5f7fb',
                  fontSize: '42px',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                }}
              >
                {siteName}
              </div>
            </div>

            <div
              style={{
                marginTop: '42px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  color: '#f5f7fb',
                  fontSize: '68px',
                  fontWeight: 600,
                  lineHeight: 1.04,
                  letterSpacing: '-0.03em',
                }}
              >
                Top traders on
              </div>
              <div
                style={{
                  marginTop: '4px',
                  display: 'flex',
                  color: '#f5f7fb',
                  fontSize: '68px',
                  fontWeight: 600,
                  lineHeight: 1.04,
                  letterSpacing: '-0.03em',
                }}
              >
                {siteName}
              </div>
            </div>

            <div
              style={{
                marginTop: '26px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '48px',
                  padding: '0 20px',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(17, 24, 39, 0.84)',
                  color: '#e5e7eb',
                  fontSize: '30px',
                  fontWeight: 600,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                {categoryLabel}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '48px',
                  padding: '0 20px',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(17, 24, 39, 0.84)',
                  color: '#e5e7eb',
                  fontSize: '30px',
                  fontWeight: 600,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                {periodLabel}
              </div>
            </div>

            <div
              style={{
                marginTop: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div
                style={{
                  height: '62px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '14px',
                  padding: '0 16px',
                  background: 'rgba(20, 26, 37, 0.95)',
                  border: `2px solid ${primaryColor}`,
                }}
              >
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(255, 208, 70, 0.22)',
                    color: '#ffd870',
                    fontSize: '22px',
                    fontWeight: 700,
                  }}
                >
                  1
                </div>
                <div
                  style={{
                    marginLeft: '14px',
                    display: 'flex',
                    color: '#f7f8fb',
                    fontSize: '30px',
                    fontWeight: 700,
                  }}
                >
                  You
                </div>
                <div
                  style={{
                    marginLeft: 'auto',
                    display: 'flex',
                    color: '#e5e7eb',
                    fontSize: '30px',
                    fontWeight: 700,
                  }}
                >
                  {topValue}
                </div>
              </div>

              {[0, 1, 2].map(skeletonIndex => (
                <div
                  key={`left-skeleton-${skeletonIndex}`}
                  style={{
                    height: '62px',
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: '14px',
                    padding: '0 16px',
                    background: 'rgba(20, 26, 37, 0.82)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      color: '#8f9aae',
                      fontSize: '20px',
                      fontWeight: 700,
                    }}
                  >
                    {String(skeletonIndex + 2)}
                  </div>
                  <div
                    style={{
                      marginLeft: '14px',
                      display: 'flex',
                      width: '190px',
                      height: '14px',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    }}
                  />
                  <div
                    style={{
                      marginLeft: 'auto',
                      display: 'flex',
                      width: '122px',
                      height: '14px',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              width: '48%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#f6f7f9',
              borderLeft: '4px solid #0f141f',
              padding: '28px 24px 18px 24px',
            }}
          >
            <div
              style={{
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                borderBottom: '2px solid rgba(15, 23, 42, 0.18)',
                color: '#697386',
                fontSize: '24px',
                fontWeight: 700,
              }}
            >
              <div style={{ width: '70px', display: 'flex' }}>Rank</div>
              <div style={{ flex: 1, display: 'flex' }}>Name</div>
              <div style={{ width: '170px', display: 'flex', justifyContent: 'flex-end' }}>{metricLabel}</div>
            </div>

            <div
              style={{
                marginTop: '4px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {displayRows.length > 0
                ? displayRows.map((row, index) => (
                    <div
                      key={`right-row-${row.rank}-${index}`}
                      style={{
                        height: '68px',
                        display: 'flex',
                        alignItems: 'center',
                        borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
                        color: '#111827',
                      }}
                    >
                      <div
                        style={{
                          width: '70px',
                          display: 'flex',
                          color: '#8792a6',
                          fontSize: '28px',
                          fontWeight: 700,
                        }}
                      >
                        {String(row.rank)}
                      </div>

                      <div
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            display: 'flex',
                            borderRadius: '999px',
                            background: buildAvatarGradient(row.name, row.rank),
                          }}
                        />
                        <div
                          style={{
                            marginLeft: '12px',
                            display: 'flex',
                            color: '#1f2937',
                            fontSize: '24px',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {normalizeText(row.name, 24) ?? row.name}
                        </div>
                      </div>

                      <div
                        style={{
                          width: '170px',
                          display: 'flex',
                          justifyContent: 'flex-end',
                          color: isVolumeMetric ? '#111827' : (row.pnl < 0 ? '#dc2626' : '#16a34a'),
                          fontSize: '24px',
                          fontWeight: 700,
                        }}
                      >
                        {isVolumeMetric ? formatCurrency(row.volume) : formatSignedCurrency(row.pnl)}
                      </div>
                    </div>
                  ))
                : Array.from({ length: 8 }).map((_, index) => (
                    <div
                      key={`right-skeleton-${index}`}
                      style={{
                        height: '68px',
                        display: 'flex',
                        alignItems: 'center',
                        borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
                        color: '#111827',
                      }}
                    >
                      <div
                        style={{
                          width: '70px',
                          display: 'flex',
                          color: '#a5adbb',
                          fontSize: '28px',
                          fontWeight: 700,
                        }}
                      >
                        {String(index + 1)}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            display: 'flex',
                            borderRadius: '999px',
                            backgroundColor: 'rgba(100, 116, 139, 0.25)',
                          }}
                        />
                        <div
                          style={{
                            marginLeft: '12px',
                            display: 'flex',
                            width: '210px',
                            height: '14px',
                            borderRadius: '999px',
                            backgroundColor: 'rgba(100, 116, 139, 0.25)',
                          }}
                        />
                      </div>
                      <div
                        style={{
                          width: '170px',
                          display: 'flex',
                          justifyContent: 'flex-end',
                        }}
                      >
                        <div
                          style={{
                            width: '104px',
                            height: '14px',
                            display: 'flex',
                            borderRadius: '999px',
                            backgroundColor: 'rgba(100, 116, 139, 0.25)',
                          }}
                        />
                      </div>
                    </div>
                  ))}
            </div>
          </div>
        </div>
      ),
      {
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
      },
    )

    response.headers.set('Cache-Control', 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=1800')
    return response
  }
  catch (error) {
    console.error('Failed to generate leaderboard OG image', error)

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0b111d 0%, #111827 100%)',
            color: '#f9fafb',
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
            fontSize: '74px',
            fontWeight: 700,
          }}
        >
          Top Traders
        </div>
      ),
      {
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        headers: {
          'Cache-Control': 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=1800',
        },
      },
    )
  }
}
