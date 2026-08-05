import type { Metadata } from 'next'

import {
  generateSportsVerticalSectionMetadata,
  renderSportsVerticalSectionPage,
} from '@/app/[locale]/(platform)/sports/_utils/sports-section-page'
import { getPublicShellStaticParams, STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export const instant = false

export async function generateStaticParams() {
  return getPublicShellStaticParams({ sport: STATIC_PARAMS_PLACEHOLDER })
}

async function generateCachedMetadata(sport: string) {
  'use cache'

  return await generateSportsVerticalSectionMetadata({
    sport,
    vertical: 'esports',
    section: 'games',
  })
}

export async function generateMetadata({ params }: PageProps<'/[locale]/esports/[sport]/games'>): Promise<Metadata> {
  const { sport } = await params

  return await generateCachedMetadata(sport)
}

async function renderCachedPage(sport: string) {
  'use cache'

  return await renderSportsVerticalSectionPage({
    sport,
    vertical: 'esports',
    section: 'games',
  })
}

export default async function EsportsGamesBySportPage({ params }: PageProps<'/[locale]/esports/[sport]/games'>) {
  const { sport } = await params

  return await renderCachedPage(sport)
}
