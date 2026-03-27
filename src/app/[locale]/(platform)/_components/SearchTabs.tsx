'use client'

import type { SearchLoadingStates } from '@/types'
import { LoaderIcon } from 'lucide-react'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'

interface SearchTabsProps {
  activeTab: 'events' | 'profiles'
  onTabChange: (tab: 'events' | 'profiles') => void
  isLoading: SearchLoadingStates
}

export function SearchTabs({
  activeTab,
  onTabChange,
  isLoading,
}: SearchTabsProps) {
  const searchTabs = useMemo(() => ['events', 'profiles'] as const, [])

  function handleKeyDown(event: React.KeyboardEvent, tab: 'events' | 'profiles') {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onTabChange(tab)
    }
  }

  return (
    <div className="bg-background px-1 pt-1">
      <ul className="relative flex h-10 gap-2">
        {searchTabs.map((tab) => {
          const isActive = activeTab === tab
          const loading = tab === 'events' ? isLoading.events : isLoading.profiles

          return (
            <li
              key={tab}
              className={cn(
                `flex cursor-pointer items-center rounded-md px-3 text-sm font-medium transition-colors duration-200`,
                isActive
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
              onClick={() => onTabChange(tab)}
              onKeyDown={e => handleKeyDown(e, tab)}
              role="tab"
              aria-selected={isActive}
              aria-controls={`${tab}-panel`}
              tabIndex={isActive ? 0 : -1}
            >
              <span className="capitalize">{tab}</span>
              {loading
                ? (
                    <LoaderIcon className="ml-1 size-3 animate-spin" />
                  )
                : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
