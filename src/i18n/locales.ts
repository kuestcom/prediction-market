export const SUPPORTED_LOCALES = ['en', 'de'] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: SupportedLocale = 'en'
export type NonDefaultLocale = Exclude<SupportedLocale, typeof DEFAULT_LOCALE>
export const NON_DEFAULT_LOCALES = SUPPORTED_LOCALES.filter(
  locale => locale !== DEFAULT_LOCALE,
) as NonDefaultLocale[]

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  de: 'Deutsch',
}

export const LOOP_LABELS: Record<SupportedLocale, string> = {
  en: 'Language',
  de: 'Sprache',
}

export function normalizeEnabledLocales(locales: string[]): SupportedLocale[] {
  const normalized = SUPPORTED_LOCALES.filter(locale => locales.includes(locale))
  if (!normalized.includes(DEFAULT_LOCALE)) {
    return [DEFAULT_LOCALE, ...normalized]
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
  }
  catch {
    return [...SUPPORTED_LOCALES]
  }
}
