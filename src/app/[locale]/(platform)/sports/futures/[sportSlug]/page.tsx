'use cache'

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import SportsContent from '@/app/[locale]/(platform)/sports/_components/SportsContent'
import { normalizeSportsSlug } from '@/app/[locale]/(platform)/sports/_components/sportsRouteUtils'

export const metadata: Metadata = {
  title: 'Sports Futures',
}

export default async function SportsFuturesBySportPage({
  params,
}: {
  params: Promise<{ locale: string, sportSlug: string }>
}) {
  const { locale, sportSlug } = await params
  setRequestLocale(locale)

  const normalizedSportSlug = normalizeSportsSlug(sportSlug)

  return (
    <SportsContent
      locale={locale}
      initialTag="sports"
      initialMode="futures"
      sportsSportSlug={normalizedSportSlug}
      activeSportSlug={normalizedSportSlug}
      selectedTitle="Futures"
    />
  )
}
