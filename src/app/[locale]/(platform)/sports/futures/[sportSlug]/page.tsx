'use cache'

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import SportsContent from '@/app/[locale]/(platform)/sports/_components/SportsContent'
import { findSportsHrefBySlug } from '@/app/[locale]/(platform)/sports/_utils/sports-menu-routing'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'
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

  const [{ data: canonicalSportSlug }, { data: layoutData }] = await Promise.all([
    SportsMenuRepository.resolveCanonicalSlugByAlias(sportSlug),
    SportsMenuRepository.getLayoutData('sports'),
  ])
  if (
    !canonicalSportSlug
    || !findSportsHrefBySlug({
      menuEntries: layoutData?.menuEntries,
      canonicalSportSlug,
      hrefPrefix: '/sports/futures/',
    })
  ) {
    notFound()
  }

  return (
    <div className="grid gap-4">
      <SportsContent
        locale={locale}
        initialTag="sports"
        initialMode="futures"
        sportsSportSlug={canonicalSportSlug}
      />
    </div>
  )
}
