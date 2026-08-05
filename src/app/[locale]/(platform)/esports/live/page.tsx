import type { Metadata } from 'next'

import { getExtracted, setRequestLocale } from 'next-intl/server'

import SportsFeedPageContent from '@/app/[locale]/(platform)/sports/_components/SportsFeedPageContent'
import { getRootLocale } from '@/i18n/root-locale'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

export async function generateMetadata(): Promise<Metadata> {
  setRequestLocale(await getRootLocale())

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
  setRequestLocale(await getRootLocale())

  return <SportsFeedPageContent sportSlug="live" sportTitle="Live" pageMode="liveAndSoon" vertical="esports" />
}
