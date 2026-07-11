import type { AdminSportsFormState } from '@/lib/admin-sports-create'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildAdminSportsDerivedContent } from '@/lib/admin-sports-create'
import { buildSportsSourceDefaultSearchQuery } from '@/lib/sports-source/search-query'
import {
  fetchAdminApi,
  readResponseBody,
  readResponseErrorMessage,
} from './admin-create-event-form-utils'

export interface SportsMatchCandidate {
  provider: string
  eventId: string
  eventName?: string | null
  gameId: string | null
  leagueId: string | null
  leagueName: string | null
  leagueSlug: string | null
  sportSlug: string | null
  startTime: string | null
  homeTeam: { name: string, abbreviation?: string | null } | null
  awayTeam: { name: string, abbreviation?: string | null } | null
  score: string | null
  live: boolean | null
  ended: boolean | null
  livestreamUrl: string | null
  confidence: number
  matchReason: string[]
}

function formatSportsSearchDate(value: string | null | undefined) {
  const normalized = value?.trim()
  if (!normalized) {
    return null
  }

  const localDateMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})/)
  if (localDateMatch?.[1]) {
    return localDateMatch[1]
  }

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

function resolveSportsSearchCategory(mainCategorySlug: string) {
  return mainCategorySlug.trim().toLowerCase() === 'esports' ? 'esports' : 'sports'
}

function isSameSportsMatchCandidate(first: SportsMatchCandidate, second: SportsMatchCandidate) {
  return first.provider === second.provider
    && first.eventId === second.eventId
    && first.gameId === second.gameId
}

export function useSportsMatchSearch({
  baseEventSlug,
  endDateIso,
  mainCategorySlug,
  sportsForm,
  title,
}: {
  baseEventSlug: string
  endDateIso: string
  mainCategorySlug: string
  sportsForm: AdminSportsFormState
  title: string
}) {
  const t = useExtracted()
  const [sportsMatchQueryOverride, setSportsMatchQueryOverride] = useState<string | null>(null)
  const [sportsMatchCandidates, setSportsMatchCandidates] = useState<SportsMatchCandidate[]>([])
  const [selectedSportsMatch, setSelectedSportsMatch] = useState<SportsMatchCandidate | null>(null)
  const [isSearchingSportsMatches, setIsSearchingSportsMatches] = useState(false)
  const [sportsMatchError, setSportsMatchError] = useState('')
  const sportsMatchSearchControllerRef = useRef<AbortController | null>(null)
  const sportsSearchCategory = resolveSportsSearchCategory(mainCategorySlug)
  const defaultSportsMatchQuery = useMemo(() => buildSportsSourceDefaultSearchQuery({
    title,
    teams: sportsForm.teams,
    category: sportsSearchCategory,
    tags: [sportsSearchCategory],
  }), [title, sportsForm.teams, sportsSearchCategory])
  const automaticSportsMatchQuery = sportsSearchCategory === 'esports' ? defaultSportsMatchQuery : ''
  const sportsMatchQuery = sportsMatchQueryOverride ?? automaticSportsMatchQuery

  const setSportsMatchQuery = useCallback((value: string) => {
    const trimmedValue = value.trim()
    if (!trimmedValue) {
      setSportsMatchQueryOverride('')
      return
    }

    setSportsMatchQueryOverride(trimmedValue !== automaticSportsMatchQuery ? value : null)
  }, [automaticSportsMatchQuery])

  const searchSportsMatches = useCallback(async () => {
    const query = sportsMatchQuery.trim() || defaultSportsMatchQuery || title.trim()
    if (!query) {
      setSportsMatchError(t('Enter a match search first.'))
      return
    }

    sportsMatchSearchControllerRef.current?.abort()
    const controller = new AbortController()
    sportsMatchSearchControllerRef.current = controller

    try {
      setIsSearchingSportsMatches(true)
      setSportsMatchError('')
      const derivedEventDate = buildAdminSportsDerivedContent({
        baseSlug: baseEventSlug,
        sports: sportsForm,
      }).payload?.eventDate
      const eventDate = derivedEventDate ?? formatSportsSearchDate(endDateIso)

      const response = await fetchAdminApi('/sports/events/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        signal: controller.signal,
        body: JSON.stringify({
          title: query,
          teams: sportsForm.teams.map(team => ({
            name: team.name,
            abbreviation: team.abbreviation,
          })),
          slug: baseEventSlug,
          category: sportsSearchCategory,
          tags: [sportsSearchCategory],
          sport: sportsForm.sportSlug.trim() || undefined,
          league: sportsForm.leagueSlug.trim() || undefined,
          date: eventDate ?? undefined,
          limit: 8,
        }),
      })
      if (sportsMatchSearchControllerRef.current !== controller) {
        return
      }
      if (!response.ok) {
        const { payload, text } = await readResponseBody(response)
        setSportsMatchError(readResponseErrorMessage(payload, text) || t('Could not search sports matches.'))
        return
      }

      const payload = await response.json().catch(() => null) as { candidates?: SportsMatchCandidate[] } | null
      if (sportsMatchSearchControllerRef.current !== controller) {
        return
      }
      const nextCandidates = Array.isArray(payload?.candidates) ? payload.candidates : []
      setSportsMatchCandidates(nextCandidates)
      setSelectedSportsMatch(previous => previous && nextCandidates.some(candidate => isSameSportsMatchCandidate(candidate, previous))
        ? previous
        : null)
    }
    catch (error) {
      if (controller.signal.aborted) {
        return
      }
      console.error('Failed to search sports matches', error)
      setSportsMatchError(t('Could not search sports matches.'))
    }
    finally {
      if (sportsMatchSearchControllerRef.current === controller) {
        sportsMatchSearchControllerRef.current = null
        setIsSearchingSportsMatches(false)
      }
    }
  }, [baseEventSlug, defaultSportsMatchQuery, endDateIso, sportsForm, sportsMatchQuery, sportsSearchCategory, t, title])

  useEffect(function abortSportsMatchSearchOnUnmount() {
    return function cleanupSportsMatchSearchController() {
      sportsMatchSearchControllerRef.current?.abort()
      sportsMatchSearchControllerRef.current = null
    }
  }, [])

  return {
    defaultSportsMatchQuery,
    sportsMatchQuery,
    setSportsMatchQuery,
    sportsMatchCandidates,
    selectedSportsMatch,
    setSelectedSportsMatch,
    isSearchingSportsMatches,
    sportsMatchError,
    searchSportsMatches,
  }
}
