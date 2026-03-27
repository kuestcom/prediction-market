'use cache'

import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { redirect } from '@/i18n/navigation'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'

export const metadata: Metadata = {
  title: 'Esports',
}

export default async function EsportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const { data: landingHref } = await SportsMenuRepository.getLandingHref('esports')
  if (!landingHref) {
    notFound()
  }

  redirect({
    href: landingHref,
    locale: locale as SupportedLocale,
  })
}
