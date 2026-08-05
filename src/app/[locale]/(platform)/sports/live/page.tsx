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
    title: t('Sports Live Prediction Markets & Live Odds'),
    description: t(
      `Trade on live sports in real time on {siteName}. Trade on NBA, NHL, UFC, MLB, soccer, and 20+ sports with moneyline, spread, and total markets. Real-time odds and scores.`,
      { siteName },
    ),
  }
}

export default async function SportsLivePage() {
  setRequestLocale(await getRootLocale())

  return <SportsFeedPageContent sportSlug="live" sportTitle="Live" pageMode="liveAndSoon" vertical="sports" />
}
