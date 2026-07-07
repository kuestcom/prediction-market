'use cache'

import type { Metadata } from 'next'
import {
  generateSportsVerticalSectionMetadata,
  renderSportsVerticalSectionPage,
} from '@/app/[locale]/(platform)/sports/_utils/sports-section-page'
import { getPublicShellStaticParams, STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export async function generateStaticParams() {
  return getPublicShellStaticParams({ sport: STATIC_PARAMS_PLACEHOLDER })
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/sports/[sport]/games'>): Promise<Metadata> {
  const { locale, sport } = await params

  return await generateSportsVerticalSectionMetadata({
    locale,
    sport,
    vertical: 'sports',
    section: 'games',
  })
}

export default async function SportsGamesBySportPage({
  params,
}: PageProps<'/[locale]/sports/[sport]/games'>) {
  const { locale, sport } = await params

  return await renderSportsVerticalSectionPage({
    locale,
    sport,
    vertical: 'sports',
    section: 'games',
  })
}
