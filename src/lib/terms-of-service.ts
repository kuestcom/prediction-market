import type { SupportedLocale } from '@/i18n/locales'

import { SUPPORTED_LOCALES } from '@/i18n/locales'

export const TERMS_OF_SERVICE_CONTENT_MAX_LENGTH = 250_000
const TERMS_OF_SERVICE_TOTAL_CONTENT_MAX_LENGTH = 500_000

export type TermsOfServiceTranslations = Record<SupportedLocale, string>
export type TermsOfServiceTranslationsPatch = Partial<TermsOfServiceTranslations>

function getRawTermsOfServiceTranslations(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

export function parseTermsOfServiceTranslations(
  value: string | null | undefined,
  requiredLocales: readonly SupportedLocale[] = SUPPORTED_LOCALES,
) {
  if (typeof value !== 'string' || !value.trim()) {
    return { data: null as TermsOfServiceTranslationsPatch | null, error: 'Terms of Use content is required.' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return { data: null as TermsOfServiceTranslationsPatch | null, error: 'Terms of Use content is invalid.' }
  }

  const rawTranslations = getRawTermsOfServiceTranslations(parsed)
  if (!rawTranslations) {
    return { data: null as TermsOfServiceTranslationsPatch | null, error: 'Terms of Use content is invalid.' }
  }

  const localesToValidate = [...new Set(requiredLocales)]
  const translations = Object.fromEntries(
    localesToValidate.map((locale) => [
      locale,
      typeof rawTranslations[locale] === 'string' ? rawTranslations[locale].trim() : '',
    ]),
  ) as TermsOfServiceTranslationsPatch

  let totalContentLength = 0
  for (const locale of localesToValidate) {
    if (!translations[locale]) {
      return {
        data: null as TermsOfServiceTranslationsPatch | null,
        error: `Terms of Use content is missing for ${locale}.`,
      }
    }

    if (translations[locale]!.length > TERMS_OF_SERVICE_CONTENT_MAX_LENGTH) {
      return {
        data: null as TermsOfServiceTranslationsPatch | null,
        error: `Terms of Use content is too long for ${locale}.`,
      }
    }

    totalContentLength += translations[locale]!.length
  }

  if (totalContentLength > TERMS_OF_SERVICE_TOTAL_CONTENT_MAX_LENGTH) {
    return {
      data: null as TermsOfServiceTranslationsPatch | null,
      error: 'Terms of Use content exceeds the maximum total size.',
    }
  }

  return { data: translations, error: null as string | null }
}
