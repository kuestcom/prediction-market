import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { locale as rootLocale } from 'next/root-params'

import { routing } from './routing'

export default getRequestConfig(async ({ locale: localeOverride }) => {
  const requested = localeOverride ?? (await rootLocale())
  if (!hasLocale(routing.locales, requested)) {
    notFound()
  }

  return {
    locale: requested,
    timeZone: 'America/New_York',
    messages: (await import(`./messages/${requested}.json`)).default,
  }
})
