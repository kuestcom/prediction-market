'use cache'

import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'

export const metadata: Metadata = {
  title: 'Sports',
}

export default async function SportsPage({ params }: PageProps<'/[locale]/sports'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const { data: landingHref } = await SportsMenuRepository.getLandingHref('sports')

  redirect({
    href: landingHref?.trim() || '/sports/live',
    locale: locale as SupportedLocale,
  })
}
