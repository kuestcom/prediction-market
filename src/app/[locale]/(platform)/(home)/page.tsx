'use cache'

import type { Event } from '@/types'
import { setRequestLocale } from 'next-intl/server'
import HomeClient from '@/app/[locale]/(platform)/(home)/_components/HomeClient'
import { EventRepository } from '@/lib/db/queries/event'

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params
  setRequestLocale(locale)

  let initialEvents: Event[] = []

  try {
    const { data: events, error } = await EventRepository.listEvents({
      tag: 'trending',
      search: '',
      userId: '',
      bookmarked: false,
    })

    if (error) {
      console.warn('Failed to fetch initial events for static generation:', error)
    }
    else {
      initialEvents = events ?? []
    }
  }
  catch {
    initialEvents = []
  }

  return (
    <main className="container grid gap-4 py-4">
      <HomeClient initialEvents={initialEvents} />
    </main>
  )
}
