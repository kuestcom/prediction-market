import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import EventContent from '@/app/[locale]/(platform)/event/[slug]/_components/EventContent'
import { routing } from '@/i18n/routing'
import { loadMarketContextSettings } from '@/lib/ai/market-context-config'
import { EventRepository } from '@/lib/db/queries/event'
import { UserRepository } from '@/lib/db/queries/user'

export async function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }))
}

export async function generateMetadata({ params }: PageProps<'/[locale]/event/[slug]/[market]'>): Promise<Metadata> {
  const { slug } = await params
  const { data } = await EventRepository.getEventTitleBySlug(slug)

  return {
    title: data?.title,
  }
}

export default async function EventMarketPage({ params }: PageProps<'/[locale]/event/[slug]/[market]'>) {
  const [user, { slug, market }, marketContextSettings] = await Promise.all([
    UserRepository.getCurrentUser(),
    params,
    loadMarketContextSettings(),
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
