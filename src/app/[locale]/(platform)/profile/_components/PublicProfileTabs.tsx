'use client'

import { useExtracted } from 'next-intl'
import { useMemo, useState } from 'react'
import PublicActivityList from '@/app/[locale]/(platform)/profile/_components/PublicActivityList'
import PublicPositionsList from '@/app/[locale]/(platform)/profile/_components/PublicPositionsList'
import { useTabIndicatorPosition } from '@/hooks/useTabIndicatorPosition'
import { cn } from '@/lib/utils'

type TabType = 'positions' | 'activity'

const baseTabs = [
  { id: 'positions' as const },
  { id: 'activity' as const },
]

interface PublicProfileTabsProps {
  userAddress: string
}

function usePublicProfileTabs() {
  const [activeTab, setActiveTab] = useState<TabType>('positions')
  const tabs = useMemo(() => baseTabs, [])
  const { tabRef, indicatorStyle, isInitialized } = useTabIndicatorPosition({ tabs, activeTab })

  return { tabs, activeTab, setActiveTab, tabRef, indicatorStyle, isInitialized }
}

export default function PublicProfileTabs({ userAddress }: PublicProfileTabsProps) {
  const t = useExtracted()
  const { tabs, activeTab, setActiveTab, tabRef, indicatorStyle, isInitialized } = usePublicProfileTabs()

  return (
    <div className="overflow-hidden rounded-2xl border">
      <div className="relative">
        <div className="flex items-center gap-6 px-4 pt-4 sm:px-6">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              ref={(el) => {
                tabRef.current[index] = el
              }}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative pb-3 text-sm font-semibold transition-colors',
                activeTab === tab.id
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.id === 'positions' ? t('Positions') : t('Activity')}
            </button>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border/80" />
        <div
          className={cn(
            'pointer-events-none absolute bottom-0 h-0.5 bg-primary',
            { 'transition-all duration-300 ease-out': isInitialized },
          )}
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`,
          }}
        />
      </div>

      <div className="space-y-4 px-0 pt-4 pb-0 sm:px-0">
        {activeTab === 'positions' && <PublicPositionsList userAddress={userAddress} />}
        {activeTab === 'activity' && <PublicActivityList userAddress={userAddress} />}
      </div>
    </div>
  )
}
