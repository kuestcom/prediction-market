import { sanitizeSvg } from '@/lib/utils'

export const THEME_SITE_LOGO_MODES = ['svg', 'image'] as const
export type ThemeSiteLogoMode = typeof THEME_SITE_LOGO_MODES[number]

export const THEME_SITE_SOCIAL_LINK_FIELDS = [
  'discordLink',
  'twitterLink',
  'facebookLink',
  'instagramLink',
  'tiktokLink',
  'linkedinLink',
  'youtubeLink',
] as const
export type ThemeSiteSocialLinkField = typeof THEME_SITE_SOCIAL_LINK_FIELDS[number]

const THEME_SITE_LOGO_MODE_SET = new Set<string>(THEME_SITE_LOGO_MODES)
const DEFAULT_SITE_NAME_FALLBACK = 'Kuest'
const DEFAULT_SITE_DESCRIPTION_FALLBACK = 'Decentralized Prediction Markets'
const DEFAULT_SITE_LOGO_SVG_FALLBACK = `
<svg viewBox="0 0 518 414" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        <g id="Transparent" transform="translate(-3204.425121, 0.000000)" fill="#CDFF00">
            <g id="k-transparent" transform="translate(3204.425121, 0.000000)">
                <path d="M237.172069,0 L343.777568,0 C354.823263,0 363.777568,8.954305 363.777568,20 L363.777568,175.074942 C363.777568,186.120637 372.731873,195.074942 383.777568,195.074942 L498,195.074942 C509.045695,195.074942 518,204.029247 518,215.074942 L518,394 C518,405.045695 509.045695,414 498,414 L401.842574,414 C355.099082,414 317.205994,376.106912 317.205994,329.36342 L317.205994,264.72684 C317.205994,253.681145 308.251689,244.72684 297.205994,244.72684 L284.301306,244.72684 C278.232047,244.72684 272.491137,247.482832 268.695367,252.218656 L145.032079,406.508184 C141.236309,411.244008 135.495399,414 129.42614,414 L17,414 C7.611159,414 0,406.388841 0,397 L0,289.368948 C0,285.034088 1.4823,280.829557 4.2009,277.453134 L221.594069,7.457038 C225.390585,2.741873 231.118449,0 237.172069,0 Z" id="Path"></path>
            </g>
        </g>
    </g>
</svg>
`

const SVG_ROOT_TAG_PATTERN = /<svg\b[^>]*>/i
const SVG_DIMENSION_ATTR_PATTERN = /\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi
const SVG_WIDTH_ATTR_PATTERN = /\swidth\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i
const SVG_HEIGHT_ATTR_PATTERN = /\sheight\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i
const SVG_VIEWBOX_ATTR_PATTERN = /\sviewbox\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i
const HTTP_URL_PROTOCOL_PATTERN = /^https?:\/\//i
const MAILTO_PROTOCOL_PATTERN = /^mailto:/i

export interface ThemeSiteSocialLinks {
  discordLink: string | null
  twitterLink: string | null
  facebookLink: string | null
  instagramLink: string | null
  tiktokLink: string | null
  linkedinLink: string | null
  youtubeLink: string | null
}

export interface ThemeSiteIdentity extends ThemeSiteSocialLinks {
  name: string
  description: string
  logoMode: ThemeSiteLogoMode
  logoSvg: string
  logoImagePath: string | null
  logoImageUrl: string | null
  logoUrl: string
  googleAnalyticsId: string | null
  supportUrl: string | null
  pwaIcon192Path: string | null
  pwaIcon512Path: string | null
  pwaIcon192Url: string
  pwaIcon512Url: string
  appleTouchIconUrl: string
}

function sanitizeDefaultLogo() {
  const sanitized = normalizeRootSvgDimensions(sanitizeSvg(DEFAULT_SITE_LOGO_SVG_FALLBACK).trim())
  if (!sanitized || !/<svg[\s>]/i.test(sanitized)) {
    return normalizeRootSvgDimensions(sanitizeSvg(DEFAULT_SITE_LOGO_SVG_FALLBACK).trim())
  }

  return sanitized
}

export const DEFAULT_THEME_SITE_NAME = DEFAULT_SITE_NAME_FALLBACK
export const DEFAULT_THEME_SITE_DESCRIPTION = DEFAULT_SITE_DESCRIPTION_FALLBACK
export const DEFAULT_THEME_SITE_LOGO_SVG = sanitizeDefaultLogo()
export const DEFAULT_THEME_SITE_PWA_ICON_192_URL = '/images/pwa/default-icon-192.png'
export const DEFAULT_THEME_SITE_PWA_ICON_512_URL = '/images/pwa/default-icon-512.png'

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
    googleAnalyticsId: null,
    discordLink: null,
    twitterLink: null,
    facebookLink: null,
    instagramLink: null,
    tiktokLink: null,
    linkedinLink: null,
    youtubeLink: null,
    supportUrl: null,
    pwaIcon192Path: null,
    pwaIcon512Path: null,
    pwaIcon192Url: DEFAULT_THEME_SITE_PWA_ICON_192_URL,
    pwaIcon512Url: DEFAULT_THEME_SITE_PWA_ICON_512_URL,
    appleTouchIconUrl: DEFAULT_THEME_SITE_PWA_ICON_192_URL,
  }
}

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized.length > 0 ? normalized : null
}

export function getThemeSiteSameAs(site: Pick<ThemeSiteSocialLinks, ThemeSiteSocialLinkField>) {
  const seen = new Set<string>()
  const sameAs: string[] = []

  for (const field of THEME_SITE_SOCIAL_LINK_FIELDS) {
    const value = site[field]?.trim()
    if (!value || seen.has(value)) {
      continue
    }

    seen.add(value)
    sameAs.push(value)
  }

  return sameAs
}

function extractAttributeValue(match: RegExpMatchArray | null) {
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim()
}

function parseSvgDimension(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed > 0
    ? Math.round(parsed * 1000) / 1000
    : null
}

function addViewBoxAttribute(svgRootTag: string, viewBoxValue: string) {
  if (svgRootTag.endsWith('/>')) {
    return `${svgRootTag.slice(0, -2)} viewBox="${viewBoxValue}" />`
  }
  return `${svgRootTag.slice(0, -1)} viewBox="${viewBoxValue}">`
}

function normalizeRootSvgDimensions(svg: string) {
  const rootTagMatch = svg.match(SVG_ROOT_TAG_PATTERN)
  if (!rootTagMatch) {
    return svg
  }

  const rootTag = rootTagMatch[0]
  const hasViewBox = SVG_VIEWBOX_ATTR_PATTERN.test(rootTag.toLowerCase())
  const widthValue = parseSvgDimension(extractAttributeValue(rootTag.match(SVG_WIDTH_ATTR_PATTERN)))
  const heightValue = parseSvgDimension(extractAttributeValue(rootTag.match(SVG_HEIGHT_ATTR_PATTERN)))

  let normalizedRootTag = rootTag.replace(SVG_DIMENSION_ATTR_PATTERN, '')

  if (!hasViewBox && widthValue && heightValue) {
    normalizedRootTag = addViewBoxAttribute(normalizedRootTag, `0 0 ${widthValue} ${heightValue}`)
  }

  return svg.replace(rootTag, normalizedRootTag)
}

export function validateThemeSiteGoogleAnalyticsId(value: string | null | undefined, sourceLabel: string) {
  const normalized = normalizeOptionalString(value)
  if (!normalized) {
    return { value: null, error: null as string | null }
  }

  if (normalized.length > 120) {
    return { value: null, error: `${sourceLabel} is too long.` }
  }

  if (!/^G-[A-Z0-9]+$/.test(normalized)) {
    return { value: null, error: `${sourceLabel} has an invalid format.` }
  }

  return { value: normalized, error: null }
}

function validateThemeSiteHttpUrl(normalized: string, sourceLabel: string) {
  if (normalized.length > 2048) {
    return { value: null, error: `${sourceLabel} is too long.` }
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized) && !/^https?:\/\//i.test(normalized)) {
    return { value: null, error: `${sourceLabel} must start with http:// or https://.` }
  }

  const withProtocol = HTTP_URL_PROTOCOL_PATTERN.test(normalized) ? normalized : `https://${normalized}`
  try {
    const parsed = new URL(withProtocol)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { value: null, error: `${sourceLabel} must start with http:// or https://.` }
    }
  }
  catch {
    return { value: null, error: `${sourceLabel} must be a valid URL.` }
  }

  return { value: withProtocol, error: null }
}

function looksLikeEmailAddress(value: string) {
  if (value.includes(' ') || /[/?#]/.test(value)) {
    return false
  }

  const atIndex = value.indexOf('@')
  if (atIndex <= 0 || atIndex !== value.lastIndexOf('@') || atIndex === value.length - 1) {
    return false
  }

  const localPart = value.slice(0, atIndex)
  const domain = value.slice(atIndex + 1)
  if (!localPart || !domain || domain.startsWith('.') || domain.endsWith('.') || !domain.includes('.')) {
    return false
  }

  return domain.split('.').every(label => label.length > 0)
}

function validateThemeSiteMailtoUrl(normalized: string, sourceLabel: string) {
  if (normalized.length > 2048) {
    return { value: null, error: `${sourceLabel} is too long.` }
  }

  try {
    const parsed = new URL(normalized)
    const emailAddress = decodeURIComponent(parsed.pathname).trim()

    if (parsed.protocol !== 'mailto:' || !looksLikeEmailAddress(emailAddress)) {
      return { value: null, error: `${sourceLabel} must contain a valid email address.` }
    }
  }
  catch {
    return { value: null, error: `${sourceLabel} must contain a valid email address.` }
  }

  return { value: normalized, error: null }
}

export function validateThemeSiteExternalUrl(value: string | null | undefined, sourceLabel: string) {
  const normalized = normalizeOptionalString(value)
  if (!normalized) {
    return { value: null, error: null as string | null }
  }

  return validateThemeSiteHttpUrl(normalized, sourceLabel)
}

export function validateThemeSiteSupportUrl(value: string | null | undefined, sourceLabel: string) {
  const normalized = normalizeOptionalString(value)
  if (!normalized) {
    return { value: null, error: null as string | null }
  }

  if (MAILTO_PROTOCOL_PATTERN.test(normalized)) {
    return validateThemeSiteMailtoUrl(normalized, sourceLabel)
  }

  if (looksLikeEmailAddress(normalized)) {
    return { value: `mailto:${normalized}`, error: null }
  }

  return validateThemeSiteHttpUrl(normalized, sourceLabel)
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

  const sanitized = normalizeRootSvgDimensions(sanitizeSvg(normalized).trim())
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
