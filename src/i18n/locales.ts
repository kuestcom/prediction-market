export const SUPPORTED_LOCALES = ['en', 'de', 'es', 'pt', 'fr', 'zh', 'ja', 'ar', 'ru', 'it', 'pl', 'ko'] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: SupportedLocale = 'en'
export type NonDefaultLocale = Exclude<SupportedLocale, typeof DEFAULT_LOCALE>
export const NON_DEFAULT_LOCALES = SUPPORTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE) as NonDefaultLocale[]

export function resolveSupportedLocale(locale: string | null | undefined): SupportedLocale {
  const normalized = locale?.trim().toLowerCase()

  return SUPPORTED_LOCALES.includes(normalized as SupportedLocale) ? (normalized as SupportedLocale) : DEFAULT_LOCALE
}

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
  pt: 'Português',
  fr: 'Français',
  zh: '中文',
  ja: '日本語',
  ar: 'العربية',
  ru: 'Русский',
  it: 'Italiano',
  pl: 'Polski',
  ko: '한국어',
}

export function getLocaleFlagSrc(locale: SupportedLocale) {
  return `/images/flags/${locale}.svg`
}

export const LOOP_LABELS: Record<SupportedLocale, string> = {
  en: 'Language',
  de: 'Sprache',
  es: 'Idioma',
  pt: 'Língua',
  fr: 'Langue',
  zh: '语言',
  ja: '言語',
  ar: 'اللغة',
  ru: 'Язык',
  it: 'Lingua',
  pl: 'Język',
  ko: '언어',
}

export function normalizeEnabledLocales(locales: string[]): SupportedLocale[] {
  const seen = new Set<SupportedLocale>()
  const normalized: SupportedLocale[] = []

  for (const locale of locales) {
    if (!SUPPORTED_LOCALES.includes(locale as SupportedLocale)) {
      continue
    }

    const supportedLocale = locale as SupportedLocale
    if (seen.has(supportedLocale)) {
      continue
    }

    seen.add(supportedLocale)
    normalized.push(supportedLocale)
  }

  return [DEFAULT_LOCALE, ...normalized.filter((locale) => locale !== DEFAULT_LOCALE)]
}

export function normalizeLocaleOrder(
  locales: readonly string[],
  supportedLocales: readonly SupportedLocale[] = SUPPORTED_LOCALES,
): SupportedLocale[] {
  const supportedSet = new Set(supportedLocales)
  const seen = new Set<SupportedLocale>()
  const normalized: SupportedLocale[] = []

  function addLocale(locale: string) {
    if (!supportedSet.has(locale as SupportedLocale)) {
      return
    }

    const supportedLocale = locale as SupportedLocale
    if (seen.has(supportedLocale)) {
      return
    }

    seen.add(supportedLocale)
    normalized.push(supportedLocale)
  }

  addLocale(DEFAULT_LOCALE)
  for (const locale of locales) {
    addLocale(locale)
  }
  for (const locale of supportedLocales) {
    addLocale(locale)
  }

  return normalized
}

export function parseEnabledLocales(value?: string | null): SupportedLocale[] {
  if (!value) {
    return [...SUPPORTED_LOCALES]
  }

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return [...SUPPORTED_LOCALES]
    }
    const filtered = parsed.filter((locale): locale is string => typeof locale === 'string')
    const normalized = normalizeEnabledLocales(filtered)
    return normalized.length > 0 ? normalized : [DEFAULT_LOCALE]
  } catch {
    return [...SUPPORTED_LOCALES]
  }
}
