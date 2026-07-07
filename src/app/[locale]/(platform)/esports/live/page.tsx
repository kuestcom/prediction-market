import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import SportsFeedPageContent from '@/app/[locale]/(platform)/sports/_components/SportsFeedPageContent'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

export async function generateMetadata({ params }: PageProps<'/[locale]/esports/live'>): Promise<Metadata> {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getExtracted()

  const runtimeTheme = await loadRuntimeThemeState()
  const siteName = runtimeTheme.site.name

  return {
    title: t('Esports Prediction Markets & Live Odds'),
    description: t(`Trade on live esports matches in real time on {siteName}. Trade on CS2, Dota 2, LoL, Valorant, and more with moneyline, spread, and total markets.`, { siteName }),
  }
}

export default async function EsportsLivePage({ params }: PageProps<'/[locale]/esports/live'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <SportsFeedPageContent
      locale={locale as SupportedLocale}
      sportSlug="live"
      sportTitle="Live"
      pageMode="liveAndSoon"
      vertical="esports"
    />
  )
}
