import { ImageResponse } from 'next/og'
import { oklchToRenderableColor } from '@/lib/color'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

const OG_IMAGE_WIDTH = 1200
const OG_IMAGE_HEIGHT = 630
const THEME_PRESET_PRIMARY_COLOR = {
  amber: 'oklch(0.881 0.168 94.237)',
  default: 'oklch(0.55 0.2 255)',
  lime: 'oklch(0.67 0.2 145)',
  midnight: 'oklch(0.577 0.209 273.85)',
} as const

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

  return oklchToRenderableColor(presetFallback) ?? '#2f6aff'
}

function resolveDescriptionFontSize(description: string) {
  if (description.length >= 64) {
    return 56
  }

  if (description.length >= 48) {
    return 66
  }

  return 84
}

export async function GET() {
  const runtimeTheme = await loadRuntimeThemeState()
  const siteName = normalizeText(runtimeTheme.site.name, 24) ?? 'Prediction Market'
  const siteDescription = normalizeText(runtimeTheme.site.description, 74) ?? 'Trade live prediction markets in real time.'
  const siteLogoSrc = runtimeTheme.site.logoUrl?.trim() ?? ''
  const primaryColor = resolveThemePrimaryColor(
    runtimeTheme.theme.light.primary ?? runtimeTheme.theme.dark.primary ?? null,
    runtimeTheme.theme.presetId,
  )
  const descriptionFontSize = resolveDescriptionFontSize(siteDescription)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
          backgroundColor: '#f5f6f8',
        }}
      >
        <div
          style={{
            width: '49%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: primaryColor,
            borderTopLeftRadius: '14px',
            borderBottomLeftRadius: '14px',
            padding: '30px 30px 26px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
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
                color: '#eff6ff',
                fontSize: '43px',
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {siteName}
            </div>
          </div>

          <div
            style={{
              marginTop: 'auto',
              display: 'flex',
              color: '#f8fbff',
              fontSize: `${descriptionFontSize}px`,
              fontWeight: 700,
              lineHeight: 1.04,
              letterSpacing: '-0.03em',
              maxWidth: '98%',
            }}
          >
            {siteDescription}
          </div>
        </div>

        <div
          style={{
            width: '51%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#0b1222',
            borderTopRightRadius: '14px',
            borderBottomRightRadius: '14px',
            borderLeft: '4px solid #0f172a',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '62%',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              background: 'linear-gradient(180deg, #0a0f1f 0%, #111c34 100%)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: '24px 28px 24px 28px',
                display: 'flex',
                borderRadius: '18px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                backgroundColor: 'rgba(15, 23, 42, 0.36)',
              }}
            />

            <svg
              width="520"
              height="260"
              viewBox="0 0 520 260"
              role="img"
              aria-label="Upward market chart"
              style={{
                display: 'flex',
              }}
            >
              <defs>
                <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(34,197,94,0.38)" />
                  <stop offset="100%" stopColor="rgba(34,197,94,0.02)" />
                </linearGradient>
              </defs>
              <path
                d="M12 220 L82 204 L138 186 L186 168 L242 150 L292 136 L340 120 L388 98 L436 74 L508 52 L508 248 L12 248 Z"
                fill="url(#chartFill)"
              />
              <path
                d="M12 220 L82 204 L138 186 L186 168 L242 150 L292 136 L340 120 L388 98 L436 74 L508 52"
                fill="none"
                stroke="#4ade80"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line x1="12" y1="248" x2="508" y2="248" stroke="rgba(148,163,184,0.34)" strokeWidth="2" />
              <line x1="12" y1="188" x2="508" y2="188" stroke="rgba(148,163,184,0.18)" strokeWidth="1.5" />
              <line x1="12" y1="126" x2="508" y2="126" stroke="rgba(148,163,184,0.18)" strokeWidth="1.5" />
              <line x1="12" y1="64" x2="508" y2="64" stroke="rgba(148,163,184,0.18)" strokeWidth="1.5" />
            </svg>
          </div>

          <div
            style={{
              height: '38%',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#f4f5f8',
              padding: '20px 28px 16px',
              gap: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  color: '#0f172a',
                  fontSize: '46px',
                  lineHeight: 1.08,
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  maxWidth: '70%',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span>Will&nbsp;</span>
                  <span
                    style={{
                      display: 'flex',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      letterSpacing: '-0.14em',
                    }}
                  >
                    _____
                  </span>
                  <span>&nbsp;happen</span>
                </span>
                <span>this year?</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  color: '#0f172a',
                  fontSize: '62px',
                  fontWeight: 800,
                  lineHeight: 0.96,
                  letterSpacing: '-0.03em',
                }}
              >
                51%
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                width: '100%',
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: '54px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(34, 197, 94, 0.12)',
                  color: '#22a06b',
                  fontSize: '34px',
                  fontWeight: 700,
                }}
              >
                Yes 51¢
              </div>
              <div
                style={{
                  flex: 1,
                  height: '54px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  color: '#d74b52',
                  fontSize: '34px',
                  fontWeight: 700,
                }}
              >
                No 49¢
              </div>
            </div>
          </div>
        </div>
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
