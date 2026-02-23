'use cache'

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import SportsContent from '@/app/[locale]/(platform)/sports/_components/SportsContent'
import { normalizeSportsSlug, resolveSportsTitleBySlug } from '@/app/[locale]/(platform)/sports/_components/sportsRouteUtils'

export const metadata: Metadata = {
  title: 'Sports Games',
}

export default async function SportsGamesBySportPage({
  params,
}: {
  params: Promise<{ locale: string, sportSlug: string }>
}) {
  const { locale, sportSlug } = await params
  setRequestLocale(locale)

  const normalizedSportSlug = normalizeSportsSlug(sportSlug)
  const selectedTitle = resolveSportsTitleBySlug(normalizedSportSlug)

  return (
    <SportsContent
      locale={locale}
      initialTag="sports"
      initialMode="all"
      sportsSportSlug={normalizedSportSlug}
      activeSportSlug={normalizedSportSlug}
      selectedTitle={selectedTitle ?? undefined}
    />
  )
}
