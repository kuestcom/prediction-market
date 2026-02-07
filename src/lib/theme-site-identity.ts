import { sanitizeSvg } from '@/lib/utils'

export const THEME_SITE_LOGO_MODES = ['svg', 'image'] as const
export type ThemeSiteLogoMode = typeof THEME_SITE_LOGO_MODES[number]

const THEME_SITE_LOGO_MODE_SET = new Set<string>(THEME_SITE_LOGO_MODES)
const DEFAULT_SITE_NAME_FALLBACK = 'Prediction Market'
const DEFAULT_SITE_DESCRIPTION_FALLBACK = 'Trade event markets in real time.'
const DEFAULT_SITE_LOGO_SVG_FALLBACK = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <rect x="2" y="2" width="20" height="20" rx="6" fill="currentColor" opacity="0.16" />
  <path d="M7.5 7.5V16.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  <path d="M7.5 12L15.5 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M11.5 12L15.5 16.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
</svg>
`

export interface ThemeSiteIdentity {
  name: string
  description: string
  logoMode: ThemeSiteLogoMode
  logoSvg: string
  logoImagePath: string | null
  logoImageUrl: string | null
  logoUrl: string
}

function normalizeRequiredString(value: string | undefined, fallback: string) {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : fallback
}

function sanitizeDefaultLogo() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_LOGO_SVG
  const candidate = typeof fromEnv === 'string' && fromEnv.trim().length > 0
    ? fromEnv
    : DEFAULT_SITE_LOGO_SVG_FALLBACK

  const sanitized = sanitizeSvg(candidate).trim()
  if (!sanitized || !/<svg[\s>]/i.test(sanitized)) {
    return sanitizeSvg(DEFAULT_SITE_LOGO_SVG_FALLBACK).trim()
  }

  return sanitized
}

export const DEFAULT_THEME_SITE_NAME = normalizeRequiredString(process.env.NEXT_PUBLIC_SITE_NAME, DEFAULT_SITE_NAME_FALLBACK)
export const DEFAULT_THEME_SITE_DESCRIPTION = normalizeRequiredString(
  process.env.NEXT_PUBLIC_SITE_DESCRIPTION,
  DEFAULT_SITE_DESCRIPTION_FALLBACK,
)
export const DEFAULT_THEME_SITE_LOGO_SVG = sanitizeDefaultLogo()

export function buildSvgDataUri(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export function createDefaultThemeSiteIdentity(): ThemeSiteIdentity {
  const logoSvg = DEFAULT_THEME_SITE_LOGO_SVG

  return {
    name: DEFAULT_THEME_SITE_NAME,
    description: DEFAULT_THEME_SITE_DESCRIPTION,
    logoMode: 'svg',
    logoSvg,
    logoImagePath: null,
    logoImageUrl: null,
    logoUrl: buildSvgDataUri(logoSvg),
  }
}

export function validateThemeSiteName(value: string | null | undefined, sourceLabel: string) {
  const normalized = typeof value === 'string' ? value.trim() : ''

  if (!normalized) {
    return { value: null, error: `${sourceLabel} is required.` }
  }

  if (normalized.length > 80) {
    return { value: null, error: `${sourceLabel} must be at most 80 characters.` }
  }

  return { value: normalized, error: null }
}

export function validateThemeSiteDescription(value: string | null | undefined, sourceLabel: string) {
  const normalized = typeof value === 'string' ? value.trim() : ''

  if (!normalized) {
    return { value: null, error: `${sourceLabel} is required.` }
  }

  if (normalized.length > 180) {
    return { value: null, error: `${sourceLabel} must be at most 180 characters.` }
  }

  return { value: normalized, error: null }
}

export function isThemeSiteLogoMode(value: string): value is ThemeSiteLogoMode {
  return THEME_SITE_LOGO_MODE_SET.has(value)
}

export function validateThemeSiteLogoMode(value: string | null | undefined, sourceLabel: string) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''

  if (!normalized) {
    return { value: null, error: `${sourceLabel} is required.` }
  }

  if (!isThemeSiteLogoMode(normalized)) {
    return { value: null, error: `${sourceLabel} is invalid.` }
  }

  return { value: normalized, error: null }
}

export function sanitizeThemeSiteLogoSvg(value: string | null | undefined, sourceLabel: string) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) {
    return { value: null, error: `${sourceLabel} is required.` }
  }

  const sanitized = sanitizeSvg(normalized).trim()
  if (!sanitized || !/<svg[\s>]/i.test(sanitized)) {
    return { value: null, error: `${sourceLabel} must be a valid SVG.` }
  }

  if (sanitized.length > 100_000) {
    return { value: null, error: `${sourceLabel} is too large.` }
  }

  return { value: sanitized, error: null }
}

export function validateThemeSiteLogoImagePath(value: string | null | undefined, sourceLabel: string) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) {
    return { value: null, error: null }
  }

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return { value: normalized, error: null }
  }

  if (normalized.length > 256) {
    return { value: null, error: `${sourceLabel} is too long.` }
  }

  if (/[^\w./-]/.test(normalized)) {
    return { value: null, error: `${sourceLabel} contains unsupported characters.` }
  }

  return { value: normalized, error: null }
}
