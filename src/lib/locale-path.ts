import type { SupportedLocale } from '@/i18n/locales'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/locales'

function normalizePathname(pathname: string) {
  if (!pathname) {
    return '/'
  }

  return pathname.startsWith('/') ? pathname : `/${pathname}`
}

function normalizeSearch(search: string) {
  if (!search) {
    return ''
  }

  return search.startsWith('?') ? search : `?${search}`
}

function isSupportedLocale(value: string | undefined): value is SupportedLocale {
  return Boolean(value && SUPPORTED_LOCALES.includes(value as SupportedLocale))
}

export function getLocaleFromPathname(pathname: string): SupportedLocale {
  const normalizedPathname = normalizePathname(pathname)
  const [firstSegment] = normalizedPathname.split('/').filter(Boolean)

  if (isSupportedLocale(firstSegment)) {
    return firstSegment
  }

  return DEFAULT_LOCALE
}

export function stripLocalePrefix(pathname: string) {
  const normalizedPathname = normalizePathname(pathname)
  const segments = normalizedPathname.split('/').filter(Boolean)
  const [firstSegment, ...remainingSegments] = segments

  if (!isSupportedLocale(firstSegment)) {
    return normalizedPathname
  }

  if (remainingSegments.length === 0) {
    return '/'
  }

  return `/${remainingSegments.join('/')}`
}

export function withLocalePrefix(pathname: string, locale: SupportedLocale) {
  const normalizedPathname = normalizePathname(pathname)

  if (locale === DEFAULT_LOCALE) {
    return normalizedPathname
  }

  return normalizedPathname === '/'
    ? `/${locale}`
    : `/${locale}${normalizedPathname}`
}

export function localizePathname(pathname: string, currentPathname: string) {
  const locale = getLocaleFromPathname(currentPathname)
  return withLocalePrefix(pathname, locale)
}

export function buildTwoFactorRedirectPath(currentPathname: string, currentSearch = '') {
  const next = `${normalizePathname(currentPathname)}${normalizeSearch(currentSearch)}`
  const twoFactorPath = localizePathname('/2fa', currentPathname)
  const params = new URLSearchParams({ next })
  return `${twoFactorPath}?${params.toString()}`
}
