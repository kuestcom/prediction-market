import type { Metadata } from 'next'
import {
  generateSportsVerticalSectionMetadata,
  renderSportsVerticalSectionPage,
} from '@/app/[locale]/(platform)/sports/_utils/sports-section-page'
import { getPublicShellStaticParams, STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export const instant = false

export async function generateStaticParams() {
  return getPublicShellStaticParams({
    sport: STATIC_PARAMS_PLACEHOLDER,
    week: STATIC_PARAMS_PLACEHOLDER,
  })
}

async function generateCachedMetadata(locale: string, sport: string, week: string) {
  'use cache'

  return await generateSportsVerticalSectionMetadata({
    locale,
    sport,
    week,
    vertical: 'esports',
    section: 'games',
  })
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/esports/[sport]/games/week/[week]'>): Promise<Metadata> {
  const { locale, sport, week } = await params

  return await generateCachedMetadata(locale, sport, week)
}

async function renderCachedPage(locale: string, sport: string, week: string) {
  'use cache'

  return await renderSportsVerticalSectionPage({
    locale,
    sport,
    week,
    vertical: 'esports',
    section: 'games',
  })
}

export default async function EsportsGamesBySportWeekPage({
  params,
}: PageProps<'/[locale]/esports/[sport]/games/week/[week]'>) {
  const { locale, sport, week } = await params

  return await renderCachedPage(locale, sport, week)
}
