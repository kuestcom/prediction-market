import { sanitizeSvg } from '@/lib/utils'

export const THEME_SITE_LOGO_MODES = ['svg', 'image'] as const
export type ThemeSiteLogoMode = typeof THEME_SITE_LOGO_MODES[number]

const THEME_SITE_LOGO_MODE_SET = new Set<string>(THEME_SITE_LOGO_MODES)
const DEFAULT_SITE_NAME_FALLBACK = 'Kuest'
const DEFAULT_SITE_DESCRIPTION_FALLBACK = 'Decentralized Prediction Markets'
const DEFAULT_SITE_LOGO_SVG_FALLBACK = `
<svg viewBox="0 0 339 320" xmlns="http://www.w3.org/2000/svg">
    <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        <g id="kuest-white" transform="translate(-87.000000, -96.000000)" fill="#FFFFFF">
            <path d="M236.307692,394.69011 L304.949451,284.975824 L373.591209,394.69011 L236.307692,394.69011 Z M130.531868,256.281319 L208.457143,130.438443 L287.337853,256.281319 L208.457143,381.468132 L130.531868,256.281319 Z M400.879121,87.2087912 C406.224176,87.2087912 411.287912,90.3032967 414.101099,95.0857143 C416.914286,99.8681319 416.632967,105.775824 413.81978,110.558242 L322.672527,256.281319 L413.81978,402.004396 C416.632967,406.505495 416.914286,412.413187 413.538462,416.914286 C411.006593,421.696703 405.942857,424.791209 400.316484,424.791209 L205.362637,424.791209 C205.081319,424.791209 204.518681,424.50989 204.237363,424.50989 L203.956044,424.50989 C203.674725,424.228571 203.674725,424.228571 203.393407,424.228571 C203.112088,423.947253 202.830769,423.947253 202.830769,423.947253 L201.142857,423.103297 C201.142857,423.103297 200.861538,423.103297 200.58022,422.821978 L200.298901,422.821978 C200.298901,422.540659 200.017582,422.540659 199.736264,422.259341 C199.454945,422.259341 199.454945,422.259341 199.173626,421.978022 C198.892308,421.978022 198.892308,421.696703 198.610989,421.696703 L198.32967,421.415385 L196.641758,419.727473 C196.641758,419.446154 196.36044,419.446154 196.36044,419.164835 L196.079121,418.883516 C196.079121,418.602198 195.797802,418.602198 195.797802,418.320879 L99.5868132,264.43956 C96.4923077,259.375824 96.4923077,253.186813 99.5868132,248.123077 L195.797802,94.5230769 C198.610989,90.021978 203.393407,87.2087912 208.738462,87.2087912 Z M373.591209,116.184615 L236.307692,116.184615 L304.949451,225.898901 L373.591209,116.184615 Z" id="Shape" transform="translate(256.670765, 256.000000) rotate(-90.000000) translate(-256.670765, -256.000000) "></path>
        </g>
    </g>
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

function sanitizeDefaultLogo() {
  const sanitized = sanitizeSvg(DEFAULT_SITE_LOGO_SVG_FALLBACK).trim()
  if (!sanitized || !/<svg[\s>]/i.test(sanitized)) {
    return sanitizeSvg(DEFAULT_SITE_LOGO_SVG_FALLBACK).trim()
  }

  return sanitized
}

export const DEFAULT_THEME_SITE_NAME = DEFAULT_SITE_NAME_FALLBACK
export const DEFAULT_THEME_SITE_DESCRIPTION = DEFAULT_SITE_DESCRIPTION_FALLBACK
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
