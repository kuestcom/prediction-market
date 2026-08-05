import { hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'
import { locale } from 'next/root-params'

import type { SupportedLocale } from '@/i18n/locales'

import { routing } from '@/i18n/routing'

export async function getRootLocale(): Promise<SupportedLocale> {
  const value = await locale()

  if (!hasLocale(routing.locales, value)) {
    notFound()
  }

  return value
}
