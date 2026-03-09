'use client'

import type { FilterState } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import type { Event } from '@/types'
import dynamic from 'next/dynamic'
import { startTransition, useEffect, useState } from 'react'
import EventsGridSkeleton from '@/app/[locale]/(platform)/(home)/_components/EventsGridSkeleton'
import EventsStaticGrid from '@/app/[locale]/(platform)/(home)/_components/EventsStaticGrid'
import EventsEmptyState from '@/app/[locale]/(platform)/event/[slug]/_components/EventsEmptyState'
import { useCurrentTimestamp } from '@/hooks/useCurrentTimestamp'

interface EventsGridProps {
  filters: FilterState
  initialEvents: Event[]
  maxColumns?: number
  onClearFilters?: () => void
  routeMainTag: string
  routeTag: string
}

function loadHydratedEventsGrid() {
  return import('@/app/[locale]/(platform)/(home)/_components/HydratedEventsGrid')
}

const HydratedEventsGrid = dynamic(
  loadHydratedEventsGrid,
  { ssr: false },
)

export default function EventsGrid({
  filters,
  initialEvents,
  maxColumns,
  onClearFilters,
  routeMainTag,
  routeTag,
}: EventsGridProps) {
  const [hasHydrated, setHasHydrated] = useState(false)
  const [hasStartedInteractiveHydration, setHasStartedInteractiveHydration] = useState(false)
  const currentTimestamp = useCurrentTimestamp({ intervalMs: 60_000 })
  const isRouteInitialState = filters.tag === routeTag
    && filters.mainTag === routeMainTag
    && filters.search === ''
    && !filters.bookmarked
    && filters.frequency === 'all'
    && filters.status === 'active'
    && !filters.hideSports
    && !filters.hideCrypto
    && !filters.hideEarnings
  const shouldUseInitialData = isRouteInitialState && initialEvents.length > 0

  useEffect(() => {
    setHasHydrated(true)
  }, [])

  useEffect(() => {
    if (!hasHydrated) {
      return
    }

    const browserWindow = window as Window & typeof globalThis & {
      cancelIdleCallback?: (handle: number) => void
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
    }
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let idleCallbackId: number | null = null
    let isCancelled = false

    function startInteractiveHydration() {
      void loadHydratedEventsGrid().then(() => {
        if (isCancelled) {
          return
        }

        startTransition(() => {
          setHasStartedInteractiveHydration(true)
        })
      })
    }

    if (typeof browserWindow.requestIdleCallback === 'function') {
      idleCallbackId = browserWindow.requestIdleCallback(startInteractiveHydration, { timeout: 1200 })
    }
    else {
      timeoutId = setTimeout(startInteractiveHydration, 250)
    }

    return () => {
      isCancelled = true
      if (idleCallbackId !== null && typeof browserWindow.cancelIdleCallback === 'function') {
        browserWindow.cancelIdleCallback(idleCallbackId)
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
    }
  }, [hasHydrated])

  if (!hasStartedInteractiveHydration) {
    if (shouldUseInitialData) {
      return (
        <div className="w-full">
          <EventsStaticGrid
            events={initialEvents}
            priceOverridesByMarket={{}}
            maxColumns={maxColumns}
            currentTimestamp={currentTimestamp}
          />
        </div>
      )
    }

    if (hasHydrated) {
      return <EventsGridSkeleton maxColumns={maxColumns} />
    }

    return <EventsEmptyState tag={filters.tag} searchQuery={filters.search} onClearFilters={onClearFilters} />
  }

  return (
    <HydratedEventsGrid
      filters={filters}
      initialEvents={initialEvents}
      maxColumns={maxColumns}
      onClearFilters={onClearFilters}
      routeMainTag={routeMainTag}
      routeTag={routeTag}
    />
  )
}
