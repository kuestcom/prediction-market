'use client'

import type { SearchLoadingStates } from '@/types'
import { LoaderIcon } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface SearchTabsProps {
  activeTab: 'events' | 'profiles'
  onTabChange: (tab: 'events' | 'profiles') => void
  eventCount: number
  profileCount: number
  isLoading: SearchLoadingStates
}

export function SearchTabs({
  activeTab,
  onTabChange,
  eventCount,
  profileCount,
  isLoading,
}: SearchTabsProps) {
  const searchTabs = useMemo(() => ['events', 'profiles'] as const, [])
  const tabRef = useRef<(HTMLLIElement | null)[]>([])
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const [isInitialized, setIsInitialized] = useState(false)

  useLayoutEffect(() => {
    const activeTabIndex = searchTabs.indexOf(activeTab)
    const activeTabElement = tabRef.current[activeTabIndex]

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
  }, [activeTab, searchTabs])

  function handleKeyDown(event: React.KeyboardEvent, tab: 'events' | 'profiles') {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onTabChange(tab)
    }
  }

  return (
    <div className="border-b bg-background">
      <ul className="relative flex h-10">
        {searchTabs.map((tab, index) => {
          const isActive = activeTab === tab
          const count = tab === 'events' ? eventCount : profileCount
          const loading = tab === 'events' ? isLoading.events : isLoading.profiles

          return (
            <li
              key={tab}
              ref={(el) => {
                tabRef.current[index] = el
              }}
              className={cn(
                'flex cursor-pointer items-center px-4 text-sm font-medium transition-colors duration-200',
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
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
                : (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (
                      {count}
                      )
                    </span>
                  )}
            </li>
          )
        })}

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
    </div>
  )
}
