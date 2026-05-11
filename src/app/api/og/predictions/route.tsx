import { ImageResponse } from 'next/og'
import OgImage from '@/app/api/og/_components/OgImage'
import { oklchToRenderableColor } from '@/lib/color'
import { humanizePredictionSearchSlug } from '@/lib/prediction-search'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

const OG_IMAGE_WIDTH = 1200
const OG_IMAGE_HEIGHT = 630
const THEME_PRESET_PRIMARY_COLOR = {
  amber: 'oklch(0.881 0.168 94.237)',
  default: 'oklch(0.55 0.2 255)',
  lime: 'oklch(0.67 0.2 145)',
  midnight: 'oklch(0.577 0.209 273.85)',
} as const

function normalizeText(value: string | null, maxLength: number) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (trimmed.length <= maxLength) {
    return trimmed
  }

  return `${trimmed.slice(0, maxLength - 1)}…`
}

function toTitleCase(value: string) {
  return value.replace(/\b\w/g, char => char.toUpperCase())
}

function resolveDisplayLabel(labelParam: string | null, slugParam: string | null) {
  const normalizedLabel = normalizeText(labelParam, 46)
  if (normalizedLabel) {
    return normalizedLabel
  }

  const normalizedSlug = normalizeText(slugParam, 120)
  if (!normalizedSlug) {
    return 'Prediction Markets'
  }

  const humanized = humanizePredictionSearchSlug(normalizedSlug)
  const titled = toTitleCase(humanized)
  return normalizeText(titled, 46) ?? 'Prediction Markets'
}

function resolveFocusFontSize(label: string) {
  if (label.length >= 34) {
    return 66
  }

  if (label.length >= 24) {
    return 78
  }

  return 92
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const label = resolveDisplayLabel(searchParams.get('label'), searchParams.get('slug'))
  const focusFontSize = resolveFocusFontSize(label)
  const runtimeTheme = await loadRuntimeThemeState()
  const primaryColor = resolveThemePrimaryColor(
    runtimeTheme.theme.light.primary ?? runtimeTheme.theme.dark.primary ?? null,
    runtimeTheme.theme.presetId,
  )
  const siteName = normalizeText(runtimeTheme.site.name, 30) ?? 'Prediction Markets'
  const siteLogoSrc = runtimeTheme.site.logoUrl?.trim() ?? ''
  const cards = [
    { left: 34, top: 18, width: 360, height: 238, opacity: 0.88 },
    { left: 416, top: 18, width: 240, height: 238, opacity: 0.76 },
    { left: -40, top: 272, width: 342, height: 238, opacity: 0.6 },
    { left: 326, top: 272, width: 334, height: 238, opacity: 0.52 },
  ]

  const response = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
          backgroundColor: '#0a0c12',
        }}
      >
        <div
          style={{
            width: '52%',
            height: '100%',
            display: 'flex',
            position: 'relative',
            overflow: 'hidden',
            background: 'radial-gradient(circle at 18% 12%, #202634 0%, #090c14 58%, #07090f 100%)',
          }}
        >
          {cards.map((card, index) => (
            <div
              key={`bg-card-${index}`}
              style={{
                position: 'absolute',
                left: `${card.left}px`,
                top: `${card.top}px`,
                width: `${card.width}px`,
                height: `${card.height}px`,
                borderRadius: '26px',
                background: 'linear-gradient(180deg, rgba(38, 45, 60, 0.75) 0%, rgba(12, 16, 25, 0.75) 100%)',
                opacity: card.opacity,
                border: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                padding: '22px 22px 18px 22px',
              }}
            >
              <div
                style={{
                  width: '58px',
                  height: '58px',
                  borderRadius: '18px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                }}
              />
              <div
                style={{
                  marginTop: '24px',
                  width: '100%',
                  height: '6px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(255, 255, 255, 0.16)',
                }}
              />
              <div
                style={{
                  marginTop: '16px',
                  width: '74%',
                  height: '6px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(255, 255, 255, 0.14)',
                }}
              />
            </div>
          ))}

          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(8, 10, 16, 0.1) 42%, rgba(6, 8, 13, 0.8) 100%)',
            }}
          />

          <div
            style={{
              position: 'absolute',
              left: '36px',
              bottom: '28px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            {siteLogoSrc
              ? (
                  <OgImage
                    src={siteLogoSrc}
                    alt=""
                    width={56}
                    height={56}
                    style={{
                      width: '56px',
                      height: '56px',
                      objectFit: 'contain',
                      filter: 'brightness(0) invert(1)',
                    }}
                  />
                )
              : null}
            <div
              style={{
                display: 'flex',
                fontSize: '60px',
                lineHeight: 1,
                fontWeight: 700,
                color: '#f8fafc',
                letterSpacing: '-0.03em',
              }}
            >
              {siteName}
            </div>
          </div>
        </div>

        <div
          style={{
            width: '48%',
            height: '100%',
            backgroundColor: '#f4f5f8',
            borderLeft: '2px solid rgba(17, 24, 39, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            padding: '30px 36px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              position: 'relative',
              display: 'flex',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '28px',
                height: '28px',
                border: '4px solid #b7bcc5',
                borderRadius: '999px',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: '24px',
                top: '23px',
                width: '16px',
                height: '4px',
                borderRadius: '999px',
                backgroundColor: '#b7bcc5',
                transform: 'rotate(45deg)',
                transformOrigin: 'left center',
              }}
            />
          </div>

          <div
            style={{
              marginTop: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div
              style={{
                display: 'flex',
                color: '#c0c4cc',
                fontSize: '84px',
                fontWeight: 600,
                lineHeight: 1,
                letterSpacing: '-0.03em',
              }}
            >
              Trade on
            </div>
            <div
              style={{
                display: 'flex',
                color: '#090c12',
                fontSize: `${focusFontSize}px`,
                fontWeight: 700,
                lineHeight: 1.02,
                letterSpacing: '-0.03em',
                maxWidth: '96%',
              }}
            >
              {label}
            </div>
          </div>

          <div
            style={{
              marginTop: 'auto',
              width: '100%',
              height: '98px',
              borderRadius: '20px',
              backgroundColor: primaryColor,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 30px',
              boxShadow: '0 18px 28px rgba(17, 24, 39, 0.22)',
            }}
          >
            <div style={{ display: 'flex', fontSize: '42px', fontWeight: 600, lineHeight: 1 }}>
              View markets
            </div>
            <div style={{ display: 'flex', fontSize: '56px', lineHeight: 1, fontWeight: 600 }}>
              ›
            </div>
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
