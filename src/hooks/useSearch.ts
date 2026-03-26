import type { SearchLoadingStates, SearchResultItems } from '@/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { sortSearchResultEvents } from '@/lib/event-search-results'
import { isSportsAuxiliaryEventSlug } from '@/lib/sports-event-slugs'

interface UseSearch {
  query: string
  results: SearchResultItems
  isLoading: SearchLoadingStates
  showResults: boolean
  activeTab: 'events' | 'profiles'
  handleQueryChange: (query: string) => void
  clearSearch: () => void
  hideResults: () => void
  showSearchResults: () => void
  setActiveTab: (tab: 'events' | 'profiles') => void
}

export function useSearch(): UseSearch {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultItems>({
    events: [],
    profiles: [],
  })
  const [isLoading, setIsLoading] = useState<SearchLoadingStates>({
    events: false,
    profiles: false,
  })
  const [showResults, setShowResults] = useState(false)
  const [activeTab, setActiveTab] = useState<'events' | 'profiles'>('events')
  const requestIdRef = useRef(0)

  const searchEvents = useCallback(async (searchQuery: string, requestId: number) => {
    if (searchQuery.length < 2) {
      if (requestId === requestIdRef.current) {
        setResults(prev => ({ ...prev, events: [] }))
      }
      return
    }

    if (requestId === requestIdRef.current) {
      setIsLoading(prev => ({ ...prev, events: true }))
    }

    try {
      const params = new URLSearchParams({
        search: searchQuery,
        status: 'all',
      })
      const response = await fetch(`/api/events?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        const filteredEvents = Array.isArray(data)
          ? data.filter(event => !isSportsAuxiliaryEventSlug(event?.slug))
          : []

        if (requestId !== requestIdRef.current) {
          return
        }

        setResults(prev => ({ ...prev, events: sortSearchResultEvents(filteredEvents) }))
      }
      else {
        if (requestId !== requestIdRef.current) {
          return
        }
        setResults(prev => ({ ...prev, events: [] }))
      }
    }
    catch (error) {
      console.error('Events search error:', error)

      if (requestId !== requestIdRef.current) {
        return
      }

      setResults(prev => ({ ...prev, events: [] }))
    }
    finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(prev => ({ ...prev, events: false }))
      }
    }
  }, [])

  const searchProfiles = useCallback(async (searchQuery: string, requestId: number) => {
    if (searchQuery.length < 2) {
      if (requestId === requestIdRef.current) {
        setResults(prev => ({ ...prev, profiles: [] }))
      }
      return
    }

    if (requestId === requestIdRef.current) {
      setIsLoading(prev => ({ ...prev, profiles: true }))
    }

    try {
      const response = await fetch(`/api/users?search=${encodeURIComponent(searchQuery)}`)
      if (response.ok) {
        const data = await response.json()

        if (requestId !== requestIdRef.current) {
          return
        }

        setResults(prev => ({ ...prev, profiles: data }))
      }
      else {
        if (requestId !== requestIdRef.current) {
          return
        }
        setResults(prev => ({ ...prev, profiles: [] }))
      }
    }
    catch (error) {
      console.error('Profiles search error:', error)

      if (requestId !== requestIdRef.current) {
        return
      }

      setResults(prev => ({ ...prev, profiles: [] }))
    }
    finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(prev => ({ ...prev, profiles: false }))
      }
    }
  }, [])

  const search = useCallback(async (searchQuery: string) => {
    const normalizedQuery = searchQuery.trim()
    const requestId = requestIdRef.current + 1

    requestIdRef.current = requestId

    if (normalizedQuery.length < 2) {
      setResults({ events: [], profiles: [] })
      setIsLoading({ events: false, profiles: false })
      setShowResults(false)
      return
    }

    // Execute both searches in parallel
    await Promise.all([
      searchEvents(normalizedQuery, requestId),
      searchProfiles(normalizedQuery, requestId),
    ])

    if (requestId === requestIdRef.current) {
      setShowResults(true)
    }
  }, [searchEvents, searchProfiles])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, search])

  useEffect(() => {
    const hasEvents = results.events.length > 0 || isLoading.events
    const hasProfiles = results.profiles.length > 0 || isLoading.profiles

    if (hasEvents && !hasProfiles) {
      queueMicrotask(() => setActiveTab('events'))
    }
    else if (!hasEvents && hasProfiles) {
      queueMicrotask(() => setActiveTab('profiles'))
    }
    else if (hasEvents && hasProfiles) {
      queueMicrotask(() => setActiveTab('events'))
    }
  }, [results.events.length, results.profiles.length, isLoading.events, isLoading.profiles])

  function handleQueryChange(newQuery: string) {
    requestIdRef.current += 1
    setQuery(newQuery)
  }

  function clearSearch() {
    requestIdRef.current += 1
    setQuery('')
    setResults({ events: [], profiles: [] })
    setIsLoading({ events: false, profiles: false })
    setShowResults(false)
    setActiveTab('events')
  }

  function hideResults() {
    setShowResults(false)
  }

  function showSearchResults() {
    if (query.length < 2) {
      return
    }

    setShowResults(true)
  }

  function handleSetActiveTab(tab: 'events' | 'profiles') {
    setActiveTab(tab)
  }

  return {
    query,
    results,
    isLoading,
    showResults,
    activeTab,
    handleQueryChange,
    clearSearch,
    hideResults,
    showSearchResults,
    setActiveTab: handleSetActiveTab,
  }
}
