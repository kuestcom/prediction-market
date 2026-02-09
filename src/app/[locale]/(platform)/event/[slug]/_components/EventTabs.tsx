import type { Event, User } from '@/types'
import { useMemo, useState } from 'react'
import EventActivity from '@/app/[locale]/(platform)/event/[slug]/_components/EventActivity'
import EventComments from '@/app/[locale]/(platform)/event/[slug]/_components/EventComments'
import EventTabSelector from '@/app/[locale]/(platform)/event/[slug]/_components/EventTabSelector'
import EventTopHolders from '@/app/[locale]/(platform)/event/[slug]/_components/EventTopHolders'
import { useCommentMetrics } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useCommentMetrics'
import { useLiveCommentsChannel } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useLiveCommentsChannel'

interface EventTabsProps {
  event: Event
  user: User | null
}

export default function EventTabs({ event, user }: EventTabsProps) {
  const [activeTab, setActiveTab] = useState('comments')
  const { data: commentMetrics } = useCommentMetrics(event.slug)
  const { status: liveCommentsStatus } = useLiveCommentsChannel({
    eventSlug: event.slug,
    user,
    enabled: activeTab === 'comments',
  })
  const commentsCount = useMemo(() => {
    if (commentMetrics?.comments_count != null) {
      return commentMetrics.comments_count
    }
    return null
  }, [commentMetrics?.comments_count])

  return (
    <div className="mt-6">
      <EventTabSelector
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        commentsCount={commentsCount}
        liveCommentsStatus={liveCommentsStatus}
      />
      {activeTab === 'comments' && <EventComments event={event} user={user} />}
      {activeTab === 'holders' && <EventTopHolders event={event} />}
      {activeTab === 'activity' && <EventActivity event={event} />}
    </div>
  )
}
