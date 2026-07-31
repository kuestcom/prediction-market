import { useExtracted, useLocale } from 'next-intl'
import { useMemo } from 'react'

import ConnectionStatusIndicator from '@/app/[locale]/(platform)/event/[slug]/_components/ConnectionStatusIndicator'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type EventTabKey = 'comments' | 'holders' | 'activity'

interface EventTabSelectorProps {
  activeTab: EventTabKey
  commentsCount: number | null
  liveCommentsStatus: 'connecting' | 'live' | 'offline'
  marketChannelStatus: 'connecting' | 'live' | 'offline'
}

function useEventTabLabels(commentsCount: number | null) {
  const t = useExtracted()
  const locale = useLocale()
  const formattedCommentsCount = useMemo(
    () => (commentsCount == null ? null : Number(commentsCount).toLocaleString(locale)),
    [commentsCount, locale],
  )
  const eventTabs = useMemo<Array<{ key: EventTabKey; label: string }>>(
    () => [
      {
        key: 'comments',
        label:
          formattedCommentsCount == null ? t('Comments') : t('Comments ({count})', { count: formattedCommentsCount }),
      },
      { key: 'holders', label: t('Top Holders') },
      { key: 'activity', label: t('Activity') },
    ],
    [formattedCommentsCount, t],
  )

  return { eventTabs }
}

export default function EventTabSelector({
  activeTab,
  commentsCount,
  liveCommentsStatus,
  marketChannelStatus,
}: EventTabSelectorProps) {
  const { eventTabs } = useEventTabLabels(commentsCount)

  return (
    <div className="mt-3 flex items-center gap-2 border-b border-border">
      <div className="flex w-0 flex-1 overflow-x-auto">
        <TabsList className="flex h-8 min-w-max gap-8 rounded-none bg-transparent p-0 text-sm font-medium">
          {eventTabs.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className={cn(
                'h-full rounded-none border-b-2 bg-transparent px-0 pb-2 whitespace-nowrap shadow-none transition-colors duration-200 data-active:bg-transparent data-active:shadow-none',
                activeTab === tab.key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {activeTab === 'comments' && <ConnectionStatusIndicator className="-mt-2 shrink-0" status={liveCommentsStatus} />}
      {activeTab === 'activity' && (
        <ConnectionStatusIndicator className="-mt-2 shrink-0" status={marketChannelStatus} />
      )}
    </div>
  )
}
