'use client'

import type { EventFaqItem } from '@/lib/event-faq'
import type { Event } from '@/types'
import EventTabs from '@/app/[locale]/(platform)/event/[slug]/_components/EventTabs'
import { useUser } from '@/stores/useUser'

interface EventTabsSectionProps {
  event: Event
  faqItems: EventFaqItem[]
}

export default function EventTabsSection({ event, faqItems }: EventTabsSectionProps) {
  const user = useUser()

  return <EventTabs event={event} user={user} faqItems={faqItems} />
}
