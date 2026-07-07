import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import type { SportsVertical } from '@/lib/sports-vertical'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import SportsContent from '@/app/[locale]/(platform)/sports/_components/SportsContent'
import SportsGamesCenter from '@/app/[locale]/(platform)/sports/_components/SportsGamesCenter'
import { buildSportsGamesCards } from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import { findSportsHrefBySlug } from '@/app/[locale]/(platform)/sports/_utils/sports-menu-routing'
import { EventRepository } from '@/lib/db/queries/event'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'
import { shouldBypassPublicShellPlaceholder, STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

type SportsSection = 'games' | 'props'

export interface SportsVerticalSectionPageParams {
  locale: string
  sport: string
  vertical: SportsVertical
  section: SportsSection
  week?: string
}

interface SportsSportContext {
  canonicalSportSlug: string
  sportTitle: string
}

async function resolveSportsSportContext(
  vertical: SportsVertical,
  sport: string,
): Promise<SportsSportContext | null> {
  const [{ data: canonicalSportSlug }, { data: layoutData }] = await Promise.all([
    SportsMenuRepository.resolveCanonicalSlugByAlias(sport),
    SportsMenuRepository.getLayoutData(vertical),
  ])

  if (
    !canonicalSportSlug
    || !findSportsHrefBySlug({
      menuEntries: layoutData?.menuEntries,
      canonicalSportSlug,
    })
  ) {
    return null
  }

  return {
    canonicalSportSlug,
    sportTitle: layoutData?.h1TitleBySlug[canonicalSportSlug] ?? canonicalSportSlug.toUpperCase(),
  }
}

function parseWeekParam(value: string) {
  if (!/^[1-9]\d*$/.test(value)) {
    return null
  }

  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function assertValidSportsSectionParams({ sport, week }: Pick<SportsVerticalSectionPageParams, 'sport' | 'week'>) {
  if (sport === STATIC_PARAMS_PLACEHOLDER || week === STATIC_PARAMS_PLACEHOLDER) {
    if (shouldBypassPublicShellPlaceholder(sport, week)) {
      return false
    }
    notFound()
  }

  return true
}

export async function generateSportsVerticalSectionMetadata({
  locale,
  sport,
  vertical,
  section,
  week,
}: SportsVerticalSectionPageParams): Promise<Metadata> {
  setRequestLocale(locale)

  if (!assertValidSportsSectionParams({ sport, week })) {
    return {}
  }

  const parsedWeek = week ? parseWeekParam(week) : null
  if (week && parsedWeek == null) {
    notFound()
  }

  const [runtimeTheme, sportContext] = await Promise.all([
    loadRuntimeThemeState(),
    resolveSportsSportContext(vertical, sport),
  ])
  if (!sportContext) {
    notFound()
  }

  const siteName = runtimeTheme.site.name
  const t = await getExtracted()
  const title = section === 'props'
    ? t('{sportTitle} Props Prediction Markets & Live Odds', { sportTitle: sportContext.sportTitle })
    : parsedWeek == null
      ? t('{sportTitle} Prediction Markets & Live Odds', { sportTitle: sportContext.sportTitle })
      : t('{sportTitle} Prediction Markets & Live Odds - Week {week}', {
          sportTitle: sportContext.sportTitle,
          week: String(parsedWeek),
        })
  const descriptionParams = {
    sportTitle: sportContext.sportTitle,
    siteName,
  }
  const description = section === 'props'
    ? vertical === 'esports'
      ? t('Trade on live {sportTitle} esports player props in real time on {siteName}. Bet on kills, assists, maps, rounds, and more specialty markets while you watch.', descriptionParams)
      : t('Trade on live {sportTitle} player props in real time on {siteName}. Bet on points, rebounds, strikeouts, touchdowns, and more specialty markets while you watch.', descriptionParams)
    : vertical === 'esports'
      ? t('Trade on live {sportTitle} esports matches in real time on {siteName}. Bet on moneyline, spread, and total markets. Watch streams while you trade.', descriptionParams)
      : t('Trade on live {sportTitle} matches in real time on {siteName}. Bet on moneyline, spread, and total markets. Real-time odds and scores.', descriptionParams)

  return {
    title,
    description,
  }
}

export async function renderSportsVerticalSectionPage({
  locale,
  sport,
  vertical,
  section,
  week,
}: SportsVerticalSectionPageParams) {
  setRequestLocale(locale)

  if (!assertValidSportsSectionParams({ sport, week })) {
    return null
  }

  const parsedWeek = week ? parseWeekParam(week) : null
  if (week && parsedWeek == null) {
    notFound()
  }

  const sportContext = await resolveSportsSportContext(vertical, sport)
  if (!sportContext) {
    notFound()
  }

  const { canonicalSportSlug, sportTitle } = sportContext
  if (section === 'props') {
    return (
      <div className="grid gap-4">
        <SportsContent
          locale={locale}
          initialTag={vertical}
          mainTag={vertical}
          initialMode="all"
          sportsSportSlug={canonicalSportSlug}
          sportsSection="props"
        />
      </div>
    )
  }

  const { data: activeEvents } = await EventRepository.listEvents({
    tag: vertical,
    sportsVertical: vertical,
    search: '',
    userId: '',
    bookmarked: false,
    locale: locale as SupportedLocale,
    sportsSportSlug: canonicalSportSlug,
    sportsSection: 'games',
    excludeSportsAuxiliary: true,
    status: 'active',
  })

  const cards = buildSportsGamesCards(activeEvents ?? [])
  const pageKey = parsedWeek == null
    ? `${vertical}-games-page-${canonicalSportSlug}`
    : `${vertical}-games-week-page-${canonicalSportSlug}-${parsedWeek}`

  return (
    <div key={pageKey} className="contents">
      <SportsGamesCenter
        cards={cards}
        sportSlug={canonicalSportSlug}
        sportTitle={sportTitle}
        initialWeek={parsedWeek}
        vertical={vertical}
      />
    </div>
  )
}
