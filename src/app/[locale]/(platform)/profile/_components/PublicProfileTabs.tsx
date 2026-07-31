'use client'

import type { Route } from 'next'

import { useExtracted } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { startTransition, useOptimistic } from 'react'

import PublicActivityList from '@/app/[locale]/(platform)/profile/_components/PublicActivityList'
import PublicPositionsList from '@/app/[locale]/(platform)/profile/_components/PublicPositionsList'
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type TabType = 'positions' | 'activity'

const TAB_QUERY_PARAM = 'tab'

const baseTabs = [{ id: 'positions' as const }, { id: 'activity' as const }]

interface PublicProfileTabsProps {
  userAddress: string
}

function usePublicProfileTabs() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTabFromQuery: TabType =
    searchParams.get(TAB_QUERY_PARAM)?.toLowerCase() === 'activity' ? 'activity' : 'positions'
  const [activeTab, setOptimisticActiveTab] = useOptimistic<TabType, TabType>(
    activeTabFromQuery,
    (_currentTab, nextTab) => nextTab,
  )
  function handleTabChange(nextTab: TabType) {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set(TAB_QUERY_PARAM, nextTab)
    const nextUrl = `${pathname}?${nextParams.toString()}`

    startTransition(() => {
      setOptimisticActiveTab(nextTab)
      router.replace(nextUrl as Route, { scroll: false })
    })
  }

  return { activeTab, handleTabChange }
}

export default function PublicProfileTabs({ userAddress }: PublicProfileTabsProps) {
  const t = useExtracted()
  const { activeTab, handleTabChange } = usePublicProfileTabs()

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => handleTabChange(value as TabType)}
      className="overflow-hidden rounded-2xl border"
    >
      <div className="relative">
        <TabsList className="relative flex h-auto w-full items-center justify-start gap-6 rounded-none bg-transparent px-4 pt-4 pb-0 sm:px-6">
          {baseTabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={cn(
                'relative rounded-none bg-transparent px-0 pt-0 pb-3 text-sm font-semibold shadow-none transition-colors data-active:bg-transparent data-active:shadow-none',
                activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.id === 'positions' ? t('Positions') : t('Activity')}
            </TabsTrigger>
          ))}
          <TabsIndicator renderBeforeHydration />
        </TabsList>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border/80" />
      </div>

      <div className="space-y-4 px-0 pt-4 pb-0 sm:px-0">
        <TabsContent value="positions" className="mt-0">
          <PublicPositionsList userAddress={userAddress} />
        </TabsContent>
        <TabsContent value="activity" className="mt-0">
          <PublicActivityList userAddress={userAddress} />
        </TabsContent>
      </div>
    </Tabs>
  )
}
