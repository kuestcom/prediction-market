'use cache'

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import SportsContent from '@/app/[locale]/(platform)/sports/_components/SportsContent'
import { normalizeSportsSlug } from '@/app/[locale]/(platform)/sports/_components/sportsRouteUtils'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export const metadata: Metadata = {
  title: 'Sports Futures',
}

export async function generateStaticParams() {
  return [{ sportSlug: STATIC_PARAMS_PLACEHOLDER }]
}

export default async function SportsFuturesBySportPage({
  params,
}: {
  params: Promise<{ locale: string, sportSlug: string }>
}) {
  const { locale, sportSlug } = await params
  setRequestLocale(locale)
  if (sportSlug === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

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
