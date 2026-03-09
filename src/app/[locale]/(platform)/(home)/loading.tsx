import type { SupportedLocale } from '@/i18n/locales'
import { getLocale } from 'next-intl/server'
import EventsGridSkeleton from '@/app/[locale]/(platform)/(home)/_components/EventsGridSkeleton'
import EventsStaticGrid from '@/app/[locale]/(platform)/(home)/_components/EventsStaticGrid'
import { EventRepository } from '@/lib/db/queries/event'

export default async function Loading() {
  const locale = await getLocale()

  try {
    const { data: events, error } = await EventRepository.listEvents({
      tag: 'trending',
      search: '',
      userId: '',
      bookmarked: false,
      locale: locale as SupportedLocale,
    })

    if (!error && events && events.length > 0) {
      return (
        <main className="container grid gap-4 py-4">
          <EventsStaticGrid
            events={events}
            priceOverridesByMarket={{}}
          />
        </main>
      )
    }
  }
  catch {
    // Fall through to the visual skeleton if the fallback query fails.
  }

  return (
    <main className="container grid gap-4 py-4">
      <EventsGridSkeleton />
    </main>
  )
}
