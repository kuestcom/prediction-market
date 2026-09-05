import type { Metadata } from 'next'

import { getExtracted } from 'next-intl/server'

import SportsFeedPageContent from '@/app/[locale]/(platform)/sports/_components/SportsFeedPageContent'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted()

  const runtimeTheme = await loadRuntimeThemeState()
  const siteName = runtimeTheme.site.name

  return {
    title: t('Esports Prediction Markets & Live Odds'),
    description: t(
      `Trade on live esports matches in real time on {siteName}. Trade on CS2, Dota 2, LoL, Valorant, and more with moneyline, spread, and total markets.`,
      { siteName },
    ),
  }
}

export default async function EsportsLivePage() {
  const t = await getExtracted()

  return <SportsFeedPageContent sportSlug="live" sportTitle={t('Live')} pageMode="liveAndSoon" vertical="esports" />
}
