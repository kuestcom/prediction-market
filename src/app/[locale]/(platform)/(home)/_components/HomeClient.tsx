'use client'

import type { Event } from '@/types'
import { useEffect, useRef } from 'react'
import { OpenCardProvider } from '@/app/[locale]/(platform)/(home)/_components/EventOpenCardProvider'
import EventsGrid from '@/app/[locale]/(platform)/(home)/_components/EventsGrid'
import FilterToolbar from '@/app/[locale]/(platform)/(home)/_components/FilterToolbar'
import { useFilters } from '@/app/[locale]/(platform)/_providers/FilterProvider'

interface HomeClientProps {
  initialEvents: Event[]
  initialTag?: string
}

export default function HomeClient({ initialEvents, initialTag }: HomeClientProps) {
  const { filters, updateFilters } = useFilters()
  const lastAppliedInitialTagRef = useRef<string | null>(null)

  useEffect(() => {
    const targetTag = initialTag ?? 'trending'
    if (lastAppliedInitialTagRef.current === targetTag) {
      return
    }

    lastAppliedInitialTagRef.current = targetTag
    updateFilters({ tag: targetTag, mainTag: targetTag })
  }, [initialTag, updateFilters])

  return (
    <>
      <FilterToolbar
        filters={filters}
        onFiltersChange={updateFilters}
      />

      <OpenCardProvider>
        <EventsGrid
          filters={filters}
          initialEvents={initialEvents}
        />
      </OpenCardProvider>
    </>
  )
}
