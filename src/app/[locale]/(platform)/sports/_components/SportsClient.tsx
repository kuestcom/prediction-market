'use client'

import type { SportsVertical } from '@/lib/sports-vertical'
import type { Event } from '@/types'
import { useEffect, useRef } from 'react'
import { useFilters } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import SportsEventsGrid from '@/app/[locale]/(platform)/sports/_components/SportsEventsGrid'

type SportsPageMode = 'all' | 'live' | 'futures'
type SportsSection = 'games' | 'props'

interface SportsClientProps {
  initialEvents: Event[]
  initialTag?: string
  mainTag?: string
  initialMode?: SportsPageMode
  sportsVertical?: SportsVertical | null
  sportsSportSlug?: string | null
  sportsSection?: SportsSection | null
}

interface SyncInitialTagToFiltersOptions {
  effectiveMainTag: string
  initialTag: string | undefined
  lastAppliedInitialTagRef: {
    current: string | null
  }
  updateFilters: ReturnType<typeof useFilters>['updateFilters']
}

function syncInitialTagToFilters({
  effectiveMainTag,
  initialTag,
  lastAppliedInitialTagRef,
  updateFilters,
}: SyncInitialTagToFiltersOptions) {
  const targetTag = initialTag ?? 'sports'
  if (lastAppliedInitialTagRef.current === targetTag) {
    return
  }

  lastAppliedInitialTagRef.current = targetTag
  updateFilters({ tag: targetTag, mainTag: effectiveMainTag })
}

function useInitialTagFilterSync({
  initialTag,
  effectiveMainTag,
  updateFilters,
}: {
  initialTag: string | undefined
  effectiveMainTag: string
  updateFilters: ReturnType<typeof useFilters>['updateFilters']
}) {
  const lastAppliedInitialTagRef = useRef<string | null>(null)

  useEffect(function runInitialTagFilterSync() {
    syncInitialTagToFilters({ effectiveMainTag, initialTag, lastAppliedInitialTagRef, updateFilters })
  }, [effectiveMainTag, initialTag, updateFilters])
}

export default function SportsClient({
  initialEvents,
  initialTag,
  mainTag,
  initialMode = 'all',
  sportsVertical = null,
  sportsSportSlug = null,
  sportsSection = null,
}: SportsClientProps) {
  const { filters, updateFilters } = useFilters()
  const effectiveMainTag = mainTag?.trim() || initialTag?.trim() || 'sports'

  useInitialTagFilterSync({ initialTag, effectiveMainTag, updateFilters })

  return (
    <SportsEventsGrid
      eventTag={initialTag ?? 'sports'}
      mainTag={effectiveMainTag}
      filters={filters}
      initialEvents={initialEvents}
      initialMode={initialMode}
      sportsVertical={sportsVertical}
      sportsSportSlug={sportsSportSlug}
      sportsSection={sportsSection}
    />
  )
}
