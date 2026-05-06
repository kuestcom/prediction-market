import { ImageResponse } from 'next/og'
import { UserRepository } from '@/lib/db/queries/user'
import { truncateAddress } from '@/lib/formatters'
import { normalizePublicProfileSlug } from '@/lib/platform-routing'
import { fetchPortfolioSnapshot } from '@/lib/portfolio'
import siteUrlUtils from '@/lib/site-url'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

const OG_IMAGE_WIDTH = 1200
const OG_IMAGE_HEIGHT = 630
const DATA_API_URL = process.env.DATA_URL ?? ''
const { resolveSiteUrl } = siteUrlUtils

interface ProfilePositionRow {
  title: string
  iconUrl: string
  tradeValue: number
  currentValue: number
  outcomeLabel: 'Yes' | 'No'
  outcomePriceCents: number
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

function normalizePrice(rawValue: unknown) {
  const parsed = parseNumber(rawValue)
  if (!Number.isFinite(parsed)) {
    return null
  }

  let normalized = parsed
  if (normalized > 0) {
    while (normalized > 1) {
      normalized /= 100
    }
  }

  return Math.max(0, Math.min(1, normalized))
}

function resolvePositionIconUrl(rawIcon: unknown, siteUrl: string) {
  const icon = typeof rawIcon === 'string' ? rawIcon.trim() : ''
  if (!icon) {
    return ''
  }

  if (icon.startsWith('/')) {
    return new URL(icon, siteUrl).toString()
  }

  if (icon.startsWith('http://') || icon.startsWith('https://')) {
    return icon
  }

  return `https://gateway.irys.xyz/${icon}`
}

function resolveProfileAvatarUrl(rawAvatar: unknown, siteUrl: string) {
  const avatar = typeof rawAvatar === 'string' ? rawAvatar.trim() : ''
  if (!avatar) {
    return ''
  }

  if (avatar.startsWith('/')) {
    return new URL(avatar, siteUrl).toString()
  }

  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar
  }

  return ''
}

function resolveOutcomeLabel(rawPosition: Record<string, unknown>): 'Yes' | 'No' {
  const outcome = typeof rawPosition.outcome === 'string' ? rawPosition.outcome.trim().toLowerCase() : ''
  if (outcome.includes('no')) {
    return 'No'
  }

  const outcomeIndex = parseNumber(rawPosition.outcomeIndex ?? rawPosition.outcome_index)
  if (Number.isFinite(outcomeIndex) && outcomeIndex === 1) {
    return 'No'
  }

  return 'Yes'
}

function resolveOutcomePriceCents(rawPosition: Record<string, unknown>) {
  const normalizedPrice = normalizePrice(rawPosition.curPrice)
  if (normalizedPrice == null) {
    return 50
  }

  return Math.max(0, Math.min(99, Math.round(normalizedPrice * 100)))
}

function formatCompactCurrency(value: number) {
  if (!Number.isFinite(value)) {
    return '$0'
  }

  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    const compact = (abs / 1_000_000).toFixed(1).replace(/\.0$/, '')
    return `${value < 0 ? '-' : ''}$${compact}M`
  }

  if (abs >= 1_000) {
    const compact = (abs / 1_000).toFixed(1).replace(/\.0$/, '')
    return `${value < 0 ? '-' : ''}$${compact}K`
  }

  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: abs >= 10 ? 0 : 2,
    maximumFractionDigits: abs >= 10 ? 0 : 2,
  }).format(abs)

  return value < 0 ? `-${formatted}` : formatted
}

function formatSignedCurrency(value: number) {
  if (!Number.isFinite(value)) {
    return '$0.00'
  }

  const abs = Math.abs(value)
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs)

  if (value > 0) {
    return `+${formatted}`
  }

  if (value < 0) {
    return `-${formatted}`
  }

  return formatted
}

function buildSeed(text: string) {
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

function buildSparklineValues(seedText: string, profitLoss: number) {
  const seed = buildSeed(seedText)
  const points: number[] = []
  let value = 0
  const bias = profitLoss < 0 ? -0.08 : 0.08

  for (let index = 0; index < 24; index += 1) {
    const wave = Math.sin((seed % 97) + (index * 0.9)) * 0.14
    const noise = Math.cos((seed % 43) + (index * 1.3)) * 0.06
    value += bias + wave + noise
    points.push(value)
  }

  return points
}

function buildSparklinePath(values: number[], width: number, height: number) {
  if (values.length === 0) {
    return ''
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(1e-6, max - min)
  const innerWidth = width - 8
  const innerHeight = height - 8

  return values
    .map((value, index) => {
      const x = 4 + ((index / Math.max(values.length - 1, 1)) * innerWidth)
      const y = 4 + (((max - value) / span) * innerHeight)
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

async function fetchProfilePositions(userAddress: string, siteUrl: string): Promise<ProfilePositionRow[]> {
  if (!DATA_API_URL) {
    return []
  }

  const params = new URLSearchParams({
    user: userAddress,
    limit: '10',
    offset: '0',
    sizeThreshold: '0.01',
  })

  try {
    const response = await fetch(`${DATA_API_URL}/positions?${params.toString()}`, {
      next: {
        revalidate: 60,
      },
    })

    if (!response.ok) {
      return []
    }

    const payload = await response.json().catch(() => null)
    if (!Array.isArray(payload)) {
      return []
    }

    return payload
      .map((entry) => {
        const raw = (entry ?? {}) as Record<string, unknown>
        const title = normalizeText(typeof raw.title === 'string' ? raw.title : 'Untitled market', 52) ?? 'Untitled market'
        const size = parseNumber(raw.size)
        const avgPrice = normalizePrice(raw.avgPrice)
        const currentValueRaw = parseNumber(raw.currentValue)
        const tradeValueFromSize = Number.isFinite(size) && size > 0 && avgPrice != null
          ? size * avgPrice
          : Number.NaN
        const tradeValue = Number.isFinite(tradeValueFromSize)
          ? tradeValueFromSize
          : 0
        const currentValue = Number.isFinite(currentValueRaw)
          ? currentValueRaw
          : tradeValue

        return {
          title,
          iconUrl: resolvePositionIconUrl(raw.icon, siteUrl),
          tradeValue,
          currentValue,
          outcomeLabel: resolveOutcomeLabel(raw),
          outcomePriceCents: resolveOutcomePriceCents(raw),
        } satisfies ProfilePositionRow
      })
      .filter(position => position.currentValue > 0 || position.tradeValue > 0)
      .sort((left, right) => right.currentValue - left.currentValue)
      .slice(0, 8)
  }
  catch {
    return []
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawSlug = searchParams.get('slug')?.trim() ?? ''
  if (!rawSlug) {
    return new Response('Missing slug query parameter.', { status: 400 })
  }

  const normalized = normalizePublicProfileSlug(rawSlug)
  if (normalized.type === 'invalid') {
    return new Response('Invalid profile slug.', { status: 400 })
  }

  try {
    const [runtimeTheme, profileResult] = await Promise.all([
      loadRuntimeThemeState(),
      UserRepository.getProfileByUsernameOrDepositWalletAddress(normalized.value),
    ])
    const profile = profileResult.data
    const profileUsername = normalizeText(profile?.username ?? null, 28)
    const displayName = profileUsername
      ?? (normalized.type === 'username' ? normalized.value : truncateAddress(normalized.value))
    const siteUrl = resolveSiteUrl(process.env)
    const avatarUrl = resolveProfileAvatarUrl(profile?.image, siteUrl)
    const resolvedAddress = profile?.deposit_wallet_address
      ?? (normalized.type === 'address' ? normalized.value : null)

    const [snapshot, positions] = await Promise.all([
      fetchPortfolioSnapshot(resolvedAddress),
      resolvedAddress ? fetchProfilePositions(resolvedAddress, siteUrl) : Promise.resolve([]),
    ])

    const sparklineValues = buildSparklineValues(resolvedAddress ?? rawSlug, snapshot.profitLoss)
    const sparklinePath = buildSparklinePath(sparklineValues, 520, 122)
    const pnlLabel = formatSignedCurrency(snapshot.profitLoss)
    const pnlColor = snapshot.profitLoss < 0 ? '#ff4b5c' : '#23c36b'
    const rowPlaceholders = positions.length > 0
      ? positions
      : Array.from({ length: 6 }).map((_, index) => ({
          title: `Position ${index + 1}`,
          iconUrl: '',
          tradeValue: 0,
          currentValue: 0,
          outcomeLabel: index % 2 === 0 ? 'Yes' : 'No',
          outcomePriceCents: 50,
        } satisfies ProfilePositionRow))

    const response = new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            backgroundColor: '#0a0c11',
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
          }}
        >
          <div
            style={{
              width: '50%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              padding: '28px 32px',
              background: 'linear-gradient(180deg, #b447d0 0%, #40124f 32%, #0a0c11 70%, #05070a 100%)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              {runtimeTheme.site.logoUrl
                ? (
                    // eslint-disable-next-line next/no-img-element
                    <img
                      src={runtimeTheme.site.logoUrl}
                      alt=""
                      width={36}
                      height={36}
                      style={{
                        width: '36px',
                        height: '36px',
                        objectFit: 'contain',
                        filter: 'brightness(0) invert(1)',
                      }}
                    />
                  )
                : null}
              <div style={{ display: 'flex', color: '#f4f6fb', fontSize: '43px', fontWeight: 600, letterSpacing: '-0.02em' }}>
                {normalizeText(runtimeTheme.site.name, 18) ?? 'Market'}
              </div>
            </div>

            <div
              style={{
                marginTop: '88px',
                width: '94px',
                height: '94px',
                display: 'flex',
                borderRadius: '999px',
                boxShadow: '0 22px 42px rgba(7, 10, 16, 0.45)',
                overflow: 'hidden',
                background: 'radial-gradient(circle at 35% 28%, #ff76df 0%, #b447d0 52%, #31d35b 100%)',
              }}
            >
              {avatarUrl
                ? (
                    // eslint-disable-next-line next/no-img-element
                    <img
                      src={avatarUrl}
                      alt=""
                      width={94}
                      height={94}
                      style={{
                        width: '94px',
                        height: '94px',
                        objectFit: 'cover',
                      }}
                    />
                  )
                : null}
            </div>

            <div
              style={{
                marginTop: '24px',
                display: 'flex',
                color: '#f2f5fb',
                fontSize: '64px',
                fontWeight: 500,
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              {displayName}
            </div>

            <div
              style={{
                marginTop: '10px',
                display: 'flex',
                color: pnlColor,
                fontSize: '70px',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              {pnlLabel}
            </div>

            <div
              style={{
                marginTop: 'auto',
                width: '100%',
                height: '170px',
                borderRadius: '14px',
                backgroundColor: 'rgba(5, 7, 10, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                padding: '18px 16px',
              }}
            >
              <svg
                width="100%"
                height="122"
                viewBox="0 0 520 122"
                role="img"
                aria-label="Profile performance chart"
              >
                <path
                  d={sparklinePath}
                  fill="none"
                  stroke={pnlColor}
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          <div
            style={{
              width: '50%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#f4f4f5',
              borderLeft: '6px solid #0a0c11',
              padding: '28px 28px 20px 28px',
            }}
          >
            <div style={{ display: 'flex', fontSize: '55px', fontWeight: 700, color: '#12151b' }}>
              Positions
            </div>

            <div
              style={{
                marginTop: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {rowPlaceholders.map((position, index) => {
                const isPositiveOutcome = position.outcomeLabel === 'Yes'
                const badgeColor = isPositiveOutcome ? '#2f9e62' : '#d74b52'
                const badgeBackground = isPositiveOutcome ? 'rgba(47, 158, 98, 0.12)' : 'rgba(215, 75, 82, 0.12)'

                return (
                  <div
                    key={`position-row-${index}`}
                    style={{
                      height: '67px',
                      borderRadius: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 12px',
                      backgroundColor: '#ffffff',
                      border: '1px solid rgba(15, 23, 42, 0.08)',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '11px',
                        overflow: 'hidden',
                        backgroundColor: '#dbe0e8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {position.iconUrl
                        ? (
                            // eslint-disable-next-line next/no-img-element
                            <img
                              src={position.iconUrl}
                              alt=""
                              width={38}
                              height={38}
                              style={{
                                width: '38px',
                                height: '38px',
                                objectFit: 'cover',
                              }}
                            />
                          )
                        : null}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          display: 'flex',
                          color: '#111827',
                          fontSize: '22px',
                          fontWeight: 600,
                          lineHeight: 1.15,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {position.title}
                      </div>
                      <div
                        style={{
                          marginTop: '5px',
                          display: 'flex',
                          color: '#22a06b',
                          fontSize: '22px',
                          fontWeight: 600,
                        }}
                      >
                        {`${formatCompactCurrency(position.tradeValue)} → ${formatCompactCurrency(position.currentValue)}`}
                      </div>
                    </div>

                    <div
                      style={{
                        minWidth: '128px',
                        height: '40px',
                        borderRadius: '12px',
                        backgroundColor: badgeBackground,
                        color: badgeColor,
                        fontSize: '24px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 10px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {`${position.outcomeLabel} @ ${position.outcomePriceCents}c`}
                    </div>
                  </div>
                )
              })}
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
    console.error('Failed to generate profile OG image', error)

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0a0c11',
            color: '#f4f6fb',
            fontSize: '64px',
            fontWeight: 700,
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
          }}
        >
          {normalized.type === 'username' ? `@${normalized.value}` : truncateAddress(normalized.value)}
        </div>
      ),
      {
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=1800',
        },
      },
    )
  }
}
