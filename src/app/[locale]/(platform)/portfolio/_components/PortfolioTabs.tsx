'use client'

import type { Route } from 'next'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import PublicActivityList from '@/app/[locale]/(platform)/[username]/_components/PublicActivityList'
import PublicPositionsList from '@/app/[locale]/(platform)/[username]/_components/PublicPositionsList'
import PortfolioOpenOrdersList from '@/app/[locale]/(platform)/portfolio/_components/PortfolioOpenOrdersList'
import { cn } from '@/lib/utils'

type TabType = 'positions' | 'openOrders' | 'history'

const TAB_QUERY_PARAM = 'tab'
const tabQueryValueByTab: Record<TabType, string> = {
  positions: 'positions',
  openOrders: 'Open orders',
  history: 'history',
}

function resolveTabFromQueryValue(value: string | null): TabType {
  if (!value) {
    return 'positions'
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s_+-]+/g, '')

  if (normalized === 'openorders' || normalized === 'openorder' || normalized === 'orders') {
    return 'openOrders'
  }

  if (normalized === 'history' || normalized === 'activity') {
    return 'history'
  }

  return 'positions'
}

const baseTabs = [
  { id: 'positions' as const, label: 'Positions' },
  { id: 'openOrders' as const, label: 'Open Orders' },
  { id: 'history' as const, label: 'History' },
]

interface PortfolioTabsProps {
  userAddress: string
}

export default function PortfolioTabs({ userAddress }: PortfolioTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTabFromQuery = useMemo(
    () => resolveTabFromQueryValue(searchParams.get(TAB_QUERY_PARAM)),
    [searchParams],
  )
  const [activeTab, setActiveTab] = useState<TabType>(activeTabFromQuery)
  const tabRef = useRef<(HTMLButtonElement | null)[]>([])
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const [isInitialized, setIsInitialized] = useState(false)
  const tabs = useMemo(() => baseTabs, [])

  useEffect(() => {
    setActiveTab(activeTabFromQuery)
  }, [activeTabFromQuery])

  function handleTabChange(nextTab: TabType) {
    setActiveTab(nextTab)

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set(TAB_QUERY_PARAM, tabQueryValueByTab[nextTab])
    const nextQuery = nextParams.toString()
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname

    router.replace(nextUrl as Route, { scroll: false })
  }

  useLayoutEffect(() => {
    const activeTabIndex = tabs.findIndex(tab => tab.id === activeTab)
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
  }, [activeTab, tabs])

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
              {tab.label}
            </button>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border/80" />
        <div
          className={cn(
            'pointer-events-none absolute bottom-0 h-0.5 bg-primary',
            isInitialized && 'transition-all duration-300 ease-out',
          )}
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`,
          }}
        />
      </div>

      <div className="space-y-4 px-0 pt-4 pb-0 sm:px-0">
        {activeTab === 'positions' && <PublicPositionsList userAddress={userAddress} />}
        {activeTab === 'openOrders' && <PortfolioOpenOrdersList userAddress={userAddress} />}
        {activeTab === 'history' && <PublicActivityList userAddress={userAddress} />}
      </div>
    </div>
  )
}
