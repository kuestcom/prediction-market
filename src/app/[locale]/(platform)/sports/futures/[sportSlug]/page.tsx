'use cache'

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import SportsContent from '@/app/[locale]/(platform)/sports/_components/SportsContent'
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

  const { data: canonicalSportSlug } = await SportsMenuRepository.resolveCanonicalSlugByAlias(sportSlug)
  if (!canonicalSportSlug) {
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
