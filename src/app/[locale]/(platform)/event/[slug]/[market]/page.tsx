import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import EventContent from '@/app/[locale]/(platform)/event/[slug]/_components/EventContent'
import { loadMarketContextSettings } from '@/lib/ai/market-context-config'
import { EventRepository } from '@/lib/db/queries/event'
import { UserRepository } from '@/lib/db/queries/user'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export async function generateMetadata({ params }: PageProps<'/[locale]/event/[slug]/[market]'>): Promise<Metadata> {
  const { locale, slug } = await params
  setRequestLocale(locale)
  if (slug === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }
  const { data } = await EventRepository.getEventTitleBySlug(slug)

  return {
    title: data?.title,
  }
}

export default async function EventMarketPage({ params }: PageProps<'/[locale]/event/[slug]/[market]'>) {
  const userPromise = UserRepository.getCurrentUser()
  const marketContextSettingsPromise = loadMarketContextSettings()
  const { locale, slug, market } = await params
  setRequestLocale(locale)
  if (slug === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }
  const [user, marketContextSettings] = await Promise.all([
    userPromise,
    marketContextSettingsPromise,
  ])
  const marketContextEnabled = marketContextSettings.enabled && Boolean(marketContextSettings.apiKey)

  const [eventResult, changeLogResult] = await Promise.all([
    EventRepository.getEventBySlug(slug, user?.id ?? ''),
    EventRepository.getEventConditionChangeLogBySlug(slug),
  ])

  const { data: event, error } = eventResult
  if (error || !event) {
    notFound()
  }

  if (changeLogResult.error) {
    console.warn('Failed to load event change log:', changeLogResult.error)
  }

  const selectedMarket = event.markets.find(item => item.slug === market)
  if (!selectedMarket) {
    notFound()
  }

  return (
    <EventContent
      event={event}
      changeLogEntries={changeLogResult.data ?? []}
      user={user}
      marketContextEnabled={marketContextEnabled}
      marketSlug={market}
      key={`is-bookmarked-${event.is_bookmarked}`}
    />
  )
}
