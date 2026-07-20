'use client'

import type { Route } from 'next'
import { useExtracted } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { startTransition, useMemo, useOptimistic } from 'react'
import PublicActivityList from '@/app/[locale]/(platform)/profile/_components/PublicActivityList'
import PublicPositionsList from '@/app/[locale]/(platform)/profile/_components/PublicPositionsList'
import { useTabIndicatorPosition } from '@/hooks/useTabIndicatorPosition'
import { cn } from '@/lib/utils'

type TabType = 'positions' | 'activity'

const TAB_QUERY_PARAM = 'tab'

const baseTabs = [
  { id: 'positions' as const },
  { id: 'activity' as const },
]

interface PublicProfileTabsProps {
  userAddress: string
}

function usePublicProfileTabs() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTabFromQuery: TabType = searchParams.get(TAB_QUERY_PARAM)?.toLowerCase() === 'activity'
    ? 'activity'
    : 'positions'
  const [activeTab, setOptimisticActiveTab] = useOptimistic<TabType, TabType>(
    activeTabFromQuery,
    (_currentTab, nextTab) => nextTab,
  )
  const tabs = useMemo(() => baseTabs, [])
  const { tabRef, indicatorStyle, isInitialized } = useTabIndicatorPosition({ tabs, activeTab })

  function handleTabChange(nextTab: TabType) {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set(TAB_QUERY_PARAM, nextTab)
    const nextUrl = `${pathname}?${nextParams.toString()}`

    startTransition(() => {
      setOptimisticActiveTab(nextTab)
      router.replace(nextUrl as Route, { scroll: false })
    })
  }

  return { tabs, activeTab, tabRef, indicatorStyle, isInitialized, handleTabChange }
}

export default function PublicProfileTabs({ userAddress }: PublicProfileTabsProps) {
  const t = useExtracted()
  const { tabs, activeTab, tabRef, indicatorStyle, isInitialized, handleTabChange } = usePublicProfileTabs()

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
              onClick={() => handleTabChange(tab.id)}
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
