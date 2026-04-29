'use client'

import type { Event } from '@/types'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

const EventMarketContext = dynamic(
  () => import('@/app/[locale]/(platform)/event/[slug]/_components/EventMarketContext'),
  { ssr: false, loading: () => <Skeleton className="h-18" /> },
)

interface EventMarketContextSlotProps {
  enabled: boolean
  event: Event
}

export default function EventMarketContextSlot({ enabled, event }: EventMarketContextSlotProps) {
  if (!enabled) {
    return null
  }

  return <EventMarketContext event={event} />
}
