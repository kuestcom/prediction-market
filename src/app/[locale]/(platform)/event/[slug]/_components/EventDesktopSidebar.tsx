'use client'

import type { Event, Market, Outcome } from '@/types'
import dynamic from 'next/dynamic'
import EventOrderPanelTermsDisclaimer from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelTermsDisclaimer'
import EventRelatedSlot from '@/app/[locale]/(platform)/event/[slug]/_components/EventRelatedSlot'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cn } from '@/lib/utils'

const EventOrderPanelDesktop = dynamic(
  () => import('@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelForm'),
  { ssr: false, loading: () => <Skeleton className="h-80 w-full rounded-xl" /> },
)

interface EventDesktopSidebarProps {
  event: Event
  initialMarket: Market | null
  initialOutcome: Outcome | null
}

export default function EventDesktopSidebar({
  event,
  initialMarket,
  initialOutcome,
}: EventDesktopSidebarProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return null
  }

  return (
    <aside
      className={cn(`
        hidden gap-4
        lg:sticky lg:top-38 lg:grid lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto
      `)}
    >
      <div className="grid gap-6">
        <EventOrderPanelDesktop
          event={event}
          isMobile={false}
          initialMarket={initialMarket}
          initialOutcome={initialOutcome}
        />
        <EventOrderPanelTermsDisclaimer />
        <span className="border border-dashed"></span>
        <EventRelatedSlot event={event} placement="desktop" />
      </div>
    </aside>
  )
}
