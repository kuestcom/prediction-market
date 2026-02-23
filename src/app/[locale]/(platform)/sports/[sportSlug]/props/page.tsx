'use cache'

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import SportsContent from '@/app/[locale]/(platform)/sports/_components/SportsContent'
import { normalizeSportsSlug, resolveSportsTitleBySlug } from '@/app/[locale]/(platform)/sports/_components/sportsRouteUtils'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export const metadata: Metadata = {
  title: 'Sports Props',
}

export async function generateStaticParams() {
  return [{ sportSlug: STATIC_PARAMS_PLACEHOLDER }]
}

export default async function SportsPropsBySportPage({
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
