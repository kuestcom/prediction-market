'use client'

import type { EventTabKey } from '@/app/[locale]/(platform)/event/[slug]/_components/EventTabSelector'
import type { EventFaqItem } from '@/lib/event-faq'
import type { Event, User } from '@/types'
import { useMemo, useState } from 'react'
import EventActivity from '@/app/[locale]/(platform)/event/[slug]/_components/EventActivity'
import EventComments from '@/app/[locale]/(platform)/event/[slug]/_components/EventComments'
import EventFaq from '@/app/[locale]/(platform)/event/[slug]/_components/EventFaq'
import { useMarketChannelStatus } from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketChannelProvider'
import EventTabSelector from '@/app/[locale]/(platform)/event/[slug]/_components/EventTabSelector'
import EventTopHolders from '@/app/[locale]/(platform)/event/[slug]/_components/EventTopHolders'
import { useCommentMetrics } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useCommentMetrics'
import { useLiveCommentsChannel } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useLiveCommentsChannel'

interface EventTabsProps {
  event: Event
  user: User | null
  faqItems: EventFaqItem[]
  initialTab?: EventTabKey
}

function useActiveTab(initialTab: EventTabKey) {
  const [activeTab, setActiveTab] = useState<EventTabKey>(initialTab)
  return { activeTab, setActiveTab }
}

function useCommentsCount(commentMetrics: ReturnType<typeof useCommentMetrics>['data']) {
  return useMemo(() => {
    if (commentMetrics?.comments_count != null) {
      return commentMetrics.comments_count
    }
    return null
  }, [commentMetrics?.comments_count])
}

export default function EventTabs({
  event,
  user,
  faqItems,
  initialTab = 'comments',
}: EventTabsProps) {
  const { activeTab, setActiveTab } = useActiveTab(initialTab)
  const { data: commentMetrics } = useCommentMetrics(event.slug)
  const { status: liveCommentsStatus } = useLiveCommentsChannel({
    eventSlug: event.slug,
    user,
    enabled: activeTab === 'comments',
  })
  const marketChannelStatus = useMarketChannelStatus()
  const commentsCount = useCommentsCount(commentMetrics)

  return (
    <div className="mt-6">
      <EventTabSelector
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        commentsCount={commentsCount}
        liveCommentsStatus={liveCommentsStatus}
        marketChannelStatus={marketChannelStatus}
      />
      {activeTab === 'comments' && (
        <>
          <EventComments event={event} user={user} />
          <EventFaq items={faqItems} />
        </>
      )}
      {activeTab === 'holders' && <EventTopHolders event={event} />}
      {activeTab === 'activity' && <EventActivity event={event} />}
    </div>
  )
}
