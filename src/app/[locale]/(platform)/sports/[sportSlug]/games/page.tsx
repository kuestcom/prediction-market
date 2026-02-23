'use cache'

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import SportsContent from '@/app/[locale]/(platform)/sports/_components/SportsContent'
import { normalizeSportsSlug } from '@/app/[locale]/(platform)/sports/_components/sportsRouteUtils'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export const metadata: Metadata = {
  title: 'Sports Games',
}

export async function generateStaticParams() {
  return [{ sportSlug: STATIC_PARAMS_PLACEHOLDER }]
}

export default async function SportsGamesBySportPage({
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
  if (!normalizedSportSlug) {
    notFound()
  }

  return (
    <div className="grid gap-4">
      <SportsContent
        locale={locale}
        initialTag="sports"
        initialMode="all"
        sportsSportSlug={normalizedSportSlug}
        sportsSection="games"
      />
    </div>
  )
}
