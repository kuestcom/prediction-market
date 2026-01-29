import { useExtracted } from 'next-intl'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import LiveCommentsStatusIndicator from '@/app/[locale]/(platform)/event/[slug]/_components/LiveCommentsStatusIndicator'
import MarketChannelStatusIndicator from '@/app/[locale]/(platform)/event/[slug]/_components/MarketChannelStatusIndicator'
import { cn } from '@/lib/utils'

interface EventTabSelectorProps {
  activeTab: string
  setActiveTab: (activeTab: string) => void
  commentsCount: number | null
  liveCommentsStatus: 'connecting' | 'live' | 'offline'
}

export default function EventTabSelector({
  activeTab,
  setActiveTab,
  commentsCount,
  liveCommentsStatus,
}: EventTabSelectorProps) {
  const t = useExtracted()
  const formattedCommentsCount = useMemo(
    () => (commentsCount == null ? null : Number(commentsCount).toLocaleString(undefined)),
    [commentsCount],
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
  const tabRefs = useRef<(HTMLLIElement | null)[]>([])
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const [isInitialized, setIsInitialized] = useState(false)

  useLayoutEffect(() => {
    const activeTabIndex = eventTabs.findIndex(tab => tab.key === activeTab)
    const activeTabElement = tabRefs.current[activeTabIndex]

    if (activeTabElement) {
      const { offsetLeft, offsetWidth } = activeTabElement

      queueMicrotask(() => {
        setIndicatorStyle(prev => ({
          ...prev,
          left: offsetLeft,
          width: offsetWidth,
        }))

        setIsInitialized(prev => prev || true)
      })
    }
  }, [activeTab, eventTabs])

  return (
    <div className="mt-3 flex items-center justify-between border-b border-border">
      <ul className="relative flex h-8 gap-8 text-sm font-semibold">
        {eventTabs.map((tab, index) => (
          <li
            key={tab.key}
            ref={(el) => {
              tabRefs.current[index] = el
            }}
            className={cn(
              'cursor-pointer transition-colors duration-200',
              activeTab === tab.key
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </li>
        ))}

        <div
          className={cn(
            'absolute bottom-0 h-0.5 bg-primary',
            isInitialized && 'transition-all duration-300 ease-out',
          )}
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`,
          }}
        />
      </ul>
      {activeTab === 'comments' && (
        <LiveCommentsStatusIndicator className="-mt-3" status={liveCommentsStatus} />
      )}
      {activeTab === 'activity' && (
        <MarketChannelStatusIndicator className="-mt-3" />
      )}
    </div>
  )
}
