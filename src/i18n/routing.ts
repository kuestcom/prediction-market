import { defineRouting } from 'next-intl/routing'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/locales'

export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'as-needed',
  localeDetection: false,
})
