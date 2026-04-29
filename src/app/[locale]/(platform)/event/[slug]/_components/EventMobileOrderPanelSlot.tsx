'use client'

import type { Event, Market, Outcome } from '@/types'
import dynamic from 'next/dynamic'
import { useIsMobile } from '@/hooks/useIsMobile'

const EventOrderPanelMobile = dynamic(
  () => import('@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelMobile'),
  { ssr: false, loading: () => null },
)

interface EventMobileOrderPanelSlotProps {
  event: Event
  initialMarket: Market | null
  initialOutcome: Outcome | null
}

export default function EventMobileOrderPanelSlot({
  event,
  initialMarket,
  initialOutcome,
}: EventMobileOrderPanelSlotProps) {
  const isMobile = useIsMobile()

  if (!isMobile) {
    return null
  }

  return <EventOrderPanelMobile event={event} initialMarket={initialMarket} initialOutcome={initialOutcome} />
}
