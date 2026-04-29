'use client'

import type { Event } from '@/types'
import { useExtracted } from 'next-intl'
import dynamic from 'next/dynamic'
import EventRelatedSkeleton from '@/app/[locale]/(platform)/event/[slug]/_components/EventRelatedSkeleton'
import { useHasHydrated } from '@/hooks/useHasHydrated'
import { useIsMobile } from '@/hooks/useIsMobile'

const EventRelated = dynamic(
  () => import('@/app/[locale]/(platform)/event/[slug]/_components/EventRelated'),
  { ssr: false, loading: () => <EventRelatedSkeleton /> },
)

interface EventRelatedSlotProps {
  event: Event
  placement: 'mobile' | 'desktop'
}

export default function EventRelatedSlot({ event, placement }: EventRelatedSlotProps) {
  const t = useExtracted()
  const hasHydrated = useHasHydrated()
  const isMobile = useIsMobile()

  if (!hasHydrated) {
    return placement === 'desktop' ? <EventRelatedSkeleton /> : null
  }

  if (placement === 'mobile') {
    if (!isMobile) {
      return null
    }

    return (
      <div className="grid gap-4 lg:hidden">
        <h3 className="text-base font-medium">{t('Related')}</h3>
        <EventRelated event={event} />
      </div>
    )
  }

  if (isMobile) {
    return null
  }

  return <EventRelated event={event} />
}
