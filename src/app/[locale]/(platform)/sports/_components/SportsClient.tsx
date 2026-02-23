'use client'

import type { Event } from '@/types'
import { useEffect, useRef } from 'react'
import { OpenCardProvider } from '@/app/[locale]/(platform)/(home)/_components/EventOpenCardProvider'
import { useFilters } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import SportsEventsGrid from '@/app/[locale]/(platform)/sports/_components/SportsEventsGrid'

type SportsPageMode = 'all' | 'live' | 'futures'
type SportsSection = 'games' | 'props'

interface SportsClientProps {
  initialEvents: Event[]
  initialTag?: string
  initialMode?: SportsPageMode
  sportsSportSlug?: string | null
  sportsSection?: SportsSection | null
}

export default function SportsClient({
  initialEvents,
  initialTag,
  initialMode = 'all',
  sportsSportSlug = null,
  sportsSection = null,
}: SportsClientProps) {
  const { filters, updateFilters } = useFilters()
  const lastAppliedInitialTagRef = useRef<string | null>(null)

  useEffect(() => {
    const targetTag = initialTag ?? 'sports'
    if (lastAppliedInitialTagRef.current === targetTag) {
      return
    }

    lastAppliedInitialTagRef.current = targetTag
    updateFilters({ tag: targetTag, mainTag: 'sports' })
  }, [initialTag, updateFilters])

  return (
    <OpenCardProvider>
      <SportsEventsGrid
        filters={filters}
        initialEvents={initialEvents}
        initialMode={initialMode}
        sportsSportSlug={sportsSportSlug}
        sportsSection={sportsSection}
      />
    </OpenCardProvider>
  )
}
