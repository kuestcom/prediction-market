'use cache'

import type { Metadata } from 'next'
import {
  generateSportsVerticalSectionMetadata,
  renderSportsVerticalSectionPage,
} from '@/app/[locale]/(platform)/sports/_utils/sports-section-page'
import { getPublicShellStaticParams, STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export async function generateStaticParams() {
  return getPublicShellStaticParams({
    sport: STATIC_PARAMS_PLACEHOLDER,
    week: STATIC_PARAMS_PLACEHOLDER,
  })
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/sports/[sport]/games/week/[week]'>): Promise<Metadata> {
  const { locale, sport, week } = await params

  return await generateSportsVerticalSectionMetadata({
    locale,
    sport,
    week,
    vertical: 'sports',
    section: 'games',
  })
}

export default async function SportsGamesBySportWeekPage({
  params,
}: PageProps<'/[locale]/sports/[sport]/games/week/[week]'>) {
  const { locale, sport, week } = await params

  return await renderSportsVerticalSectionPage({
    locale,
    sport,
    week,
    vertical: 'sports',
    section: 'games',
  })
}
