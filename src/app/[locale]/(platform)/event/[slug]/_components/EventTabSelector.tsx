import { useExtracted, useLocale } from 'next-intl'
import { useMemo } from 'react'
import ConnectionStatusIndicator from '@/app/[locale]/(platform)/event/[slug]/_components/ConnectionStatusIndicator'
import { cn } from '@/lib/utils'

interface EventTabSelectorProps {
  activeTab: string
  setActiveTab: (activeTab: string) => void
  commentsCount: number | null
  liveCommentsStatus: 'connecting' | 'live' | 'offline'
  marketChannelStatus: 'connecting' | 'live' | 'offline'
}

export default function EventTabSelector({
  activeTab,
  setActiveTab,
  commentsCount,
  liveCommentsStatus,
  marketChannelStatus,
}: EventTabSelectorProps) {
  const t = useExtracted()
  const locale = useLocale()
  const formattedCommentsCount = useMemo(
    () => (commentsCount == null ? null : Number(commentsCount).toLocaleString(locale)),
    [commentsCount, locale],
  )
  const eventTabs = useMemo(() => ([
    {
      key: 'comments',
      label: formattedCommentsCount == null
        ? t('Comments')
        : t('Comments ({count})', { count: formattedCommentsCount }),
    },
    { key: 'holders', label: t('Top Holders') },
    { key: 'activity', label: t('Activity') },
  ]), [formattedCommentsCount, t])

  return (
    <div className="mt-3 flex items-center justify-between border-b border-border">
      <ul className="flex h-8 gap-8 text-sm font-medium">
        {eventTabs.map((tab, index) => (
          <li
            key={tab.key}
            className={index === 0 ? '' : undefined}
          >
            <button
              type="button"
              className={cn(
                'h-full border-b-2 pb-2 transition-colors duration-200',
                activeTab === tab.key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>
      {activeTab === 'comments' && <ConnectionStatusIndicator status={liveCommentsStatus} />}
      {activeTab === 'activity' && <ConnectionStatusIndicator status={marketChannelStatus} />}
    </div>
  )
}
