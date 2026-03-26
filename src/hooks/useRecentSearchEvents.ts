'use client'

import { useEffect, useState } from 'react'

export interface RecentSearchEvent {
  href: string
  iconUrl: string
  id: string
  title: string
}

const RECENT_SEARCH_EVENTS_STORAGE_KEY = 'recent-search-events'
const RECENT_SEARCH_EVENTS_UPDATED_EVENT = 'recent-search-events:updated'
const MAX_RECENT_SEARCH_EVENTS = 8

function isBrowserReady() {
  return typeof window !== 'undefined'
}

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeRecentSearchEvent(value: unknown): RecentSearchEvent | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<RecentSearchEvent>
  const id = trimString(candidate.id)
  const href = trimString(candidate.href)
  const title = trimString(candidate.title)

  if (!id || !href || !title) {
    return null
  }

  return {
    id,
    href,
    title,
    iconUrl: trimString(candidate.iconUrl),
  }
}

function readRecentSearchEvents(): RecentSearchEvent[] {
  if (!isBrowserReady()) {
    return []
  }

  try {
    const raw = window.localStorage.getItem(RECENT_SEARCH_EVENTS_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map(normalizeRecentSearchEvent)
      .filter((item): item is RecentSearchEvent => Boolean(item))
      .slice(0, MAX_RECENT_SEARCH_EVENTS)
  }
  catch (error) {
    console.error('Failed to read recent search events', error)
    return []
  }
}

function writeRecentSearchEvents(items: RecentSearchEvent[]) {
  if (!isBrowserReady()) {
    return
  }

  try {
    window.localStorage.setItem(RECENT_SEARCH_EVENTS_STORAGE_KEY, JSON.stringify(items))
    window.dispatchEvent(new CustomEvent(RECENT_SEARCH_EVENTS_UPDATED_EVENT))
  }
  catch (error) {
    console.error('Failed to write recent search events', error)
  }
}

export function saveRecentSearchEvent(item: RecentSearchEvent) {
  const normalized = normalizeRecentSearchEvent(item)
  if (!normalized) {
    return
  }

  const nextItems = [
    normalized,
    ...readRecentSearchEvents().filter(entry => entry.id !== normalized.id),
  ].slice(0, MAX_RECENT_SEARCH_EVENTS)

  writeRecentSearchEvents(nextItems)
}

export function removeRecentSearchEvent(id: string) {
  const normalizedId = id.trim()
  if (!normalizedId) {
    return
  }

  writeRecentSearchEvents(
    readRecentSearchEvents().filter(item => item.id !== normalizedId),
  )
}

export function useRecentSearchEvents() {
  const [recentEvents, setRecentEvents] = useState<RecentSearchEvent[]>([])

  useEffect(() => {
    if (!isBrowserReady()) {
      return
    }

    function syncRecentSearchEvents() {
      setRecentEvents(readRecentSearchEvents())
    }

    syncRecentSearchEvents()

    window.addEventListener(RECENT_SEARCH_EVENTS_UPDATED_EVENT, syncRecentSearchEvents as EventListener)
    window.addEventListener('storage', syncRecentSearchEvents)

    return () => {
      window.removeEventListener(RECENT_SEARCH_EVENTS_UPDATED_EVENT, syncRecentSearchEvents as EventListener)
      window.removeEventListener('storage', syncRecentSearchEvents)
    }
  }, [])

  return {
    recentEvents,
    removeRecentSearchEvent,
  }
}
