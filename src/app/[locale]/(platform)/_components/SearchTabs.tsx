'use client'

import type { SearchLoadingStates } from '@/types'

import { Spinner } from '@/components/ui/spinner'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

interface SearchTabsProps {
  activeTab: 'events' | 'profiles'
  isLoading: SearchLoadingStates
}

const SEARCH_TABS = ['events', 'profiles'] as const

export function SearchTabs({ activeTab, isLoading }: SearchTabsProps) {
  return (
    <div className="bg-background px-1 pt-1">
      <TabsList className="relative flex h-10 w-full justify-start gap-2 rounded-none bg-transparent p-0">
        {SEARCH_TABS.map((tab) => {
          const isActive = activeTab === tab
          const loading = tab === 'events' ? isLoading.events : isLoading.profiles

          return (
            <TabsTrigger
              key={tab}
              value={tab}
              className={cn(
                `flex cursor-pointer items-center rounded-md px-3 text-sm font-medium transition-colors duration-200`,
                isActive
                  ? 'bg-muted text-foreground shadow-none'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <span className="capitalize">{tab}</span>
              {loading ? <Spinner className="ml-1 size-3" /> : null}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </div>
  )
}
