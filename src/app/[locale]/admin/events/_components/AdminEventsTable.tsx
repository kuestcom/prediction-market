'use client'

import type { AdminEventRow } from '@/app/[locale]/admin/events/_hooks/useAdminEvents'
import type { SportsSourceProvider } from '@/lib/sports-source/providers'
import { useQueryClient } from '@tanstack/react-query'
import { FilterIcon, Loader2Icon, SearchIcon, SettingsIcon, XIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { DataTable } from '@/app/[locale]/admin/_components/DataTable'
import { updateEventAdditionalContextAction } from '@/app/[locale]/admin/events/_actions/update-event-additional-context'
import { updateEventLivestreamUrlAction } from '@/app/[locale]/admin/events/_actions/update-event-livestream-url'
import { updateEventSportsFinalStateAction } from '@/app/[locale]/admin/events/_actions/update-event-sports-final-state'
import { updateEventSyncSettingsAction } from '@/app/[locale]/admin/events/_actions/update-event-sync-settings'
import { updateEventVisibilityAction } from '@/app/[locale]/admin/events/_actions/update-event-visibility'
import { useAdminEventsColumns } from '@/app/[locale]/admin/events/_components/columns'
import { useAdminEventsTable } from '@/app/[locale]/admin/events/_hooks/useAdminEvents'
import AppLink from '@/components/AppLink'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { InputError } from '@/components/ui/input-error'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  filterSportsSourceProvidersByCategory,
  formatSportsSourceProviderLabel,
  normalizeSingleSportsSourceProvider,
  SPORTS_SOURCE_PROVIDERS,
} from '@/lib/sports-source/providers'
import { buildSportsSourceMatchupSearchQuery } from '@/lib/sports-source/search-query'
import { cn } from '@/lib/utils'

interface AdminEventsTableProps {
  initialAutoDeployNewEventsEnabled: boolean
  mainCategoryOptions: { slug: string, name: string }[]
  configuredSportsSourceProviders: SportsSourceProvider[]
}

interface SportsSourceCandidate {
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
  livestreamEmbedUrl?: string | null
  livestreamProvider?: string | null
  livestreamOfficial?: boolean | null
  confidence: number
  matchReason: string[]
  raw?: Record<string, unknown>
}

async function fetchAdminApi(pathname: string, init?: RequestInit) {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  const primaryResponse = await fetch(`/admin/api${normalizedPath}`, init)
  if (primaryResponse.status !== 404 || typeof window === 'undefined') {
    return primaryResponse
  }

  const [maybeLocale] = window.location.pathname.split('/').filter(Boolean)
  if (!maybeLocale) {
    return primaryResponse
  }

  return fetch(`/${maybeLocale}/admin/api${normalizedPath}`, init)
}

function parseSportsScoreParts(score: string | null | undefined) {
  const trimmed = score?.trim()
  if (!trimmed) {
    return { home: '', away: '' }
  }

  const match = trimmed.match(/(\d+)\D+(\d+)/)
  if (!match) {
    return { home: '', away: '' }
  }

  return {
    home: match[1] ?? '',
    away: match[2] ?? '',
  }
}

function formatSportsSourceDate(value: Date | null) {
  if (!value || Number.isNaN(value.getTime())) {
    return null
  }

  const year = String(value.getUTCFullYear()).padStart(4, '0')
  const month = String(value.getUTCMonth() + 1).padStart(2, '0')
  const day = String(value.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function resolveSportsSourceSearchDate(event: AdminEventRow | null) {
  if (!event) {
    return null
  }

  if (event.sports_vertical === 'esports' && event.sports_start_time) {
    return formatSportsSourceDate(new Date(event.sports_start_time))
  }

  if (event.sports_event_date) {
    return event.sports_event_date
  }

  if (event.sports_start_time) {
    return formatSportsSourceDate(new Date(event.sports_start_time))
  }

  const slugDate = event.slug.match(/(\d{4}-\d{2}-\d{2})$/)?.[1]
  if (slugDate) {
    return slugDate
  }

  return event.end_date ? formatSportsSourceDate(new Date(event.end_date)) : null
}

function parseSportsSourceConfidence(value: string | null | undefined) {
  const normalized = value?.trim()
  if (!normalized) {
    return null
  }

  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : null
}

function formatSportsSourceCandidateName(candidate: SportsSourceCandidate) {
  return [candidate.homeTeam?.name, candidate.awayTeam?.name].filter(Boolean).join(' vs ')
    || candidate.eventName
    || candidate.eventId
}

function formatSportsSourceCandidateMeta(candidate: SportsSourceCandidate) {
  return [
    candidate.leagueName,
    candidate.startTime ? formatDayMonthLabel(new Date(candidate.startTime)) : null,
    candidate.provider,
  ].filter(Boolean).join(' · ')
}

function buildSportsSourceCandidatePayload(candidate: SportsSourceCandidate) {
  return {
    selection: 'manual',
    provider: candidate.provider,
    eventId: candidate.eventId,
    eventName: candidate.eventName ?? null,
    gameId: candidate.gameId,
    leagueId: candidate.leagueId,
    leagueName: candidate.leagueName,
    startTime: candidate.startTime,
    confidence: candidate.confidence,
    matchReason: candidate.matchReason,
    livestreamUrl: candidate.livestreamUrl,
    livestreamEmbedUrl: candidate.livestreamEmbedUrl ?? null,
    livestreamProvider: candidate.livestreamProvider ?? null,
    livestreamOfficial: candidate.livestreamOfficial ?? null,
    raw: candidate.raw ?? null,
  }
}

function parseMatchTeamsFromTitle(title: string | null | undefined) {
  const matchup = buildSportsSourceMatchupSearchQuery(null, title)
  if (!matchup) {
    return { home: 'Team 1', away: 'Team 2' }
  }

  const parts = matchup.split(/\s+vs\s+/i).map(part => part.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return {
      home: parts[0]!,
      away: parts[1]!,
    }
  }

  return { home: 'Team 1', away: 'Team 2' }
}

function resolveSportsFinalTeams(event: AdminEventRow | null) {
  if (!event) {
    return null
  }

  const teams = event.sports_teams ?? []
  const home = teams[0]?.name?.trim() || teams[0]?.abbreviation?.trim()
  const away = teams[1]?.name?.trim() || teams[1]?.abbreviation?.trim()
  if (home && away) {
    return { home, away }
  }

  return parseMatchTeamsFromTitle(event.title)
}

function resolveGameDateFromAdminEvent(event: AdminEventRow | null): Date | null {
  if (!event) {
    return null
  }

  if (event.end_date) {
    const parsedEndDate = new Date(event.end_date)
    if (!Number.isNaN(parsedEndDate.getTime())) {
      return parsedEndDate
    }
  }

  const slugMatch = event.slug.match(/(\d{4})-(\d{2})-(\d{2})$/)
  if (!slugMatch) {
    return null
  }

  const year = Number.parseInt(slugMatch[1] ?? '', 10)
  const monthIndex = Number.parseInt(slugMatch[2] ?? '', 10) - 1
  const day = Number.parseInt(slugMatch[3] ?? '', 10)
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) {
    return null
  }

  return new Date(year, monthIndex, day)
}

function formatDayMonthLabel(date: Date | null) {
  if (!date || Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(date)
}

function formatUtcDayMonthLabel(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(parsed)
}

function buildSportsSourceModalSearchQuery(event: AdminEventRow) {
  const title = event.title.trim()
  if (event.sports_vertical !== 'esports') {
    return title
  }

  const dateLabel = formatUtcDayMonthLabel(resolveSportsSourceSearchDate(event))
  if (!dateLabel || title.toLowerCase().includes(dateLabel.toLowerCase())) {
    return title
  }

  return `${title} (${dateLabel})`
}

function useAdminEventsTableState(initialAutoDeployNewEventsEnabled: boolean) {
  const t = useExtracted()
  const queryClient = useQueryClient()

  const {
    events,
    totalCount,
    isLoading,
    error,
    retry,
    pageIndex,
    pageSize,
    search,
    sortBy,
    sortOrder,
    mainCategorySlug,
    creator,
    creatorOptions,
    seriesSlug,
    seriesOptions,
    activeOnly,
    handleSearchChange,
    handleSortChange,
    handleMainCategoryChange,
    handleCreatorChange,
    handleSeriesSlugChange,
    handleActiveOnlyChange,
    handlePageChange,
    handlePageSizeChange,
  } = useAdminEventsTable()

  const [pendingHiddenId, setPendingHiddenId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [savedAutoDeployEnabled, setSavedAutoDeployEnabled] = useState(initialAutoDeployNewEventsEnabled)
  const [draftAutoDeployEnabled, setDraftAutoDeployEnabled] = useState(initialAutoDeployNewEventsEnabled)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [livestreamEvent, setLivestreamEvent] = useState<AdminEventRow | null>(null)
  const [livestreamUrlValue, setLivestreamUrlValue] = useState('')
  const [livestreamError, setLivestreamError] = useState<string | null>(null)
  const [isSavingLivestream, setIsSavingLivestream] = useState(false)
  const [additionalContextEvent, setAdditionalContextEvent] = useState<AdminEventRow | null>(null)
  const [additionalContextValue, setAdditionalContextValue] = useState('')
  const [additionalContextError, setAdditionalContextError] = useState<string | null>(null)
  const [isSavingAdditionalContext, setIsSavingAdditionalContext] = useState(false)
  const [sportsFinalEvent, setSportsFinalEvent] = useState<AdminEventRow | null>(null)
  const [sportsEndedValue, setSportsEndedValue] = useState(false)
  const [sportsScoreHomeValue, setSportsScoreHomeValue] = useState('')
  const [sportsScoreAwayValue, setSportsScoreAwayValue] = useState('')
  const [sportsSourceSearchQuery, setSportsSourceSearchQuery] = useState('')
  const [sportsSourceCandidates, setSportsSourceCandidates] = useState<SportsSourceCandidate[]>([])
  const [hasSearchedSportsSource, setHasSearchedSportsSource] = useState(false)
  const [sportsSourceDetailsOpen, setSportsSourceDetailsOpen] = useState(false)
  const [sportsSourceProviderValue, setSportsSourceProviderValue] = useState('')
  const [sportsSourceEventIdValue, setSportsSourceEventIdValue] = useState('')
  const [sportsSourceGameIdValue, setSportsSourceGameIdValue] = useState('')
  const [sportsSourceLeagueIdValue, setSportsSourceLeagueIdValue] = useState('')
  const [sportsSourceLeagueLabelValue, setSportsSourceLeagueLabelValue] = useState('')
  const [sportsSourceConfidenceValue, setSportsSourceConfidenceValue] = useState('')
  const [sportsSourcePayloadValue, setSportsSourcePayloadValue] = useState<Record<string, unknown> | null | undefined>(undefined)
  const [sportsSourceLivestreamUrlValue, setSportsSourceLivestreamUrlValue] = useState('')
  const [sportsSourceSearchError, setSportsSourceSearchError] = useState<string | null>(null)
  const [isSearchingSportsSource, setIsSearchingSportsSource] = useState(false)
  const sportsSourceSearchControllerRef = useRef<AbortController | null>(null)
  const [sportsFinalError, setSportsFinalError] = useState<string | null>(null)
  const [isSavingSportsFinal, setIsSavingSportsFinal] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draftMainCategorySlug, setDraftMainCategorySlug] = useState(mainCategorySlug)
  const [draftCreator, setDraftCreator] = useState(creator)
  const [draftSeriesSlug, setDraftSeriesSlug] = useState(seriesSlug)

  const handleToggleHidden = useCallback(async (event: AdminEventRow, checked: boolean) => {
    setPendingHiddenId(event.id)

    try {
      const result = await updateEventVisibilityAction(event.id, checked)
      if (result.success) {
        toast.success(checked
          ? t('{name} is now hidden from public event lists.', { name: event.title })
          : t('{name} is now visible in public event lists.', { name: event.title }))
        void queryClient.invalidateQueries({ queryKey: ['admin-events'] })
      }
      else {
        toast.error(result.error || t('Failed to update event visibility'))
      }
    }
    catch (error) {
      console.error('Failed to update event visibility', error)
      toast.error(t('Failed to update event visibility'))
    }
    finally {
      setPendingHiddenId(null)
    }
  }, [queryClient, t])

  const handleOpenSettings = useCallback(() => {
    setDraftAutoDeployEnabled(savedAutoDeployEnabled)
    setSettingsOpen(true)
  }, [savedAutoDeployEnabled])

  const handleCloseSettings = useCallback(() => {
    if (isSavingSettings) {
      return
    }
    setDraftAutoDeployEnabled(savedAutoDeployEnabled)
    setSettingsOpen(false)
  }, [isSavingSettings, savedAutoDeployEnabled])

  const handleSaveSettings = useCallback(async () => {
    setIsSavingSettings(true)
    try {
      const result = await updateEventSyncSettingsAction(draftAutoDeployEnabled)
      if (result.success) {
        setSavedAutoDeployEnabled(draftAutoDeployEnabled)
        toast.success(draftAutoDeployEnabled
          ? t('New events will be auto-deployed.')
          : t('New events now require manual activation.'))
        setSettingsOpen(false)
      }
      else {
        toast.error(result.error || t('Failed to update event sync settings'))
      }
    }
    catch (error) {
      console.error('Failed to update event sync settings', error)
      toast.error(t('Failed to update event sync settings'))
    }
    finally {
      setIsSavingSettings(false)
    }
  }, [draftAutoDeployEnabled, t])

  const handleOpenFilters = useCallback(() => {
    setDraftMainCategorySlug(mainCategorySlug)
    setDraftCreator(creator)
    setDraftSeriesSlug(seriesSlug)
    setFiltersOpen(true)
  }, [mainCategorySlug, creator, seriesSlug])

  const handleApplyFilters = useCallback(() => {
    handleMainCategoryChange(draftMainCategorySlug)
    handleCreatorChange(draftCreator)
    handleSeriesSlugChange(draftSeriesSlug)
    setFiltersOpen(false)
  }, [
    draftMainCategorySlug,
    draftCreator,
    draftSeriesSlug,
    handleMainCategoryChange,
    handleCreatorChange,
    handleSeriesSlugChange,
  ])

  const handleClearFilters = useCallback(() => {
    handleMainCategoryChange('all')
    handleCreatorChange('all')
    handleSeriesSlugChange('all')
    handleActiveOnlyChange(false)
  }, [handleMainCategoryChange, handleCreatorChange, handleSeriesSlugChange, handleActiveOnlyChange])

  const handleOpenLivestreamModal = useCallback((event: AdminEventRow) => {
    setLivestreamEvent(event)
    setLivestreamUrlValue(event.livestream_url ?? '')
    setLivestreamError(null)
  }, [])

  const handleOpenAdditionalContextModal = useCallback((event: AdminEventRow) => {
    setAdditionalContextEvent(event)
    setAdditionalContextValue(event.additional_context ?? '')
    setAdditionalContextError(null)
  }, [])

  const handleCloseAdditionalContextModal = useCallback(() => {
    if (isSavingAdditionalContext) {
      return
    }

    setAdditionalContextEvent(null)
    setAdditionalContextValue('')
    setAdditionalContextError(null)
  }, [isSavingAdditionalContext])

  const handleCloseLivestreamModal = useCallback(() => {
    if (isSavingLivestream) {
      return
    }

    setLivestreamEvent(null)
    setLivestreamUrlValue('')
    setLivestreamError(null)
  }, [isSavingLivestream])

  const handleSaveLivestreamUrl = useCallback(async () => {
    if (!livestreamEvent) {
      return
    }

    setIsSavingLivestream(true)
    setLivestreamError(null)

    const result = await updateEventLivestreamUrlAction(livestreamEvent.id, livestreamUrlValue)
    if (result.success) {
      toast.success(livestreamUrlValue.trim()
        ? t('Livestream URL updated for {name}.', { name: livestreamEvent.title })
        : t('Livestream URL removed for {name}.', { name: livestreamEvent.title }))
      void queryClient.invalidateQueries({ queryKey: ['admin-events'] })
      setLivestreamEvent(null)
      setLivestreamUrlValue('')
      setLivestreamError(null)
      setIsSavingLivestream(false)
      return
    }

    setLivestreamError(result.error ?? t('Failed to update livestream URL'))
    setIsSavingLivestream(false)
  }, [livestreamEvent, livestreamUrlValue, queryClient, t])

  const handleSaveAdditionalContext = useCallback(async () => {
    if (!additionalContextEvent) {
      return
    }

    setIsSavingAdditionalContext(true)
    setAdditionalContextError(null)

    try {
      const result = await updateEventAdditionalContextAction(additionalContextEvent.id, additionalContextValue)
      if (result.success) {
        toast.success(additionalContextValue.trim()
          ? t({
              id: 'adminEventsAdditionalContextUpdatedToast',
              message: 'Additional context updated for {name}.',
              values: { name: additionalContextEvent.title },
            })
          : t({
              id: 'adminEventsAdditionalContextRemovedToast',
              message: 'Additional context removed for {name}.',
              values: { name: additionalContextEvent.title },
            }))
        void queryClient.invalidateQueries({ queryKey: ['admin-events'] })
        setAdditionalContextEvent(null)
        setAdditionalContextValue('')
        setAdditionalContextError(null)
        return
      }

      setAdditionalContextError(result.error ?? t({
        id: 'adminEventsAdditionalContextFailed',
        message: 'Failed to update additional context',
      }))
    }
    catch (error) {
      setAdditionalContextError(error instanceof Error && error.message
        ? error.message
        : t({
            id: 'adminEventsAdditionalContextFailed',
            message: 'Failed to update additional context',
          }))
    }
    finally {
      setIsSavingAdditionalContext(false)
    }
  }, [additionalContextEvent, additionalContextValue, queryClient, t])

  const handleOpenSportsFinalModal = useCallback((event: AdminEventRow) => {
    const parsedScore = parseSportsScoreParts(event.sports_score)
    const provider = normalizeSingleSportsSourceProvider(event.sports_source_provider)
    setSportsFinalEvent(event)
    setSportsEndedValue(event.sports_ended === true)
    setSportsScoreHomeValue(parsedScore.home)
    setSportsScoreAwayValue(parsedScore.away)
    setSportsSourceSearchQuery(buildSportsSourceModalSearchQuery(event))
    setSportsSourceCandidates([])
    setHasSearchedSportsSource(false)
    setSportsSourceDetailsOpen(true)
    setSportsSourceProviderValue(provider ?? '')
    setSportsSourceEventIdValue(provider ? event.sports_source_event_id ?? '' : '')
    setSportsSourceGameIdValue(provider ? event.sports_source_game_id ?? '' : '')
    setSportsSourceLeagueIdValue(provider ? event.sports_source_league_id ?? '' : '')
    setSportsSourceLeagueLabelValue(provider ? event.sports_source_league_label ?? '' : '')
    setSportsSourceConfidenceValue(provider ? event.sports_source_match_confidence ?? '' : '')
    setSportsSourcePayloadValue(undefined)
    setSportsSourceLivestreamUrlValue('')
    setSportsSourceSearchError(null)
    setSportsFinalError(null)
  }, [])

  const applySportsSourceCandidate = useCallback((candidate: SportsSourceCandidate) => {
    setSportsSourceProviderValue(candidate.provider)
    setSportsSourceEventIdValue(candidate.eventId)
    setSportsSourceGameIdValue(candidate.gameId ?? '')
    setSportsSourceLeagueIdValue(candidate.leagueId ?? '')
    setSportsSourceLeagueLabelValue(candidate.leagueName ?? '')
    setSportsSourceConfidenceValue(typeof candidate.confidence === 'number' ? candidate.confidence.toFixed(4) : '')
    setSportsSourcePayloadValue(buildSportsSourceCandidatePayload(candidate))
    setSportsSourceLivestreamUrlValue(candidate.livestreamUrl ?? '')
    if (candidate.score) {
      const parsedScore = parseSportsScoreParts(candidate.score)
      if (parsedScore.home && parsedScore.away) {
        setSportsScoreHomeValue(parsedScore.home)
        setSportsScoreAwayValue(parsedScore.away)
      }
    }
    if (candidate.ended === true) {
      setSportsEndedValue(true)
    }
  }, [])

  const clearSportsSourceCandidate = useCallback(() => {
    setSportsSourceProviderValue('')
    setSportsSourceEventIdValue('')
    setSportsSourceGameIdValue('')
    setSportsSourceLeagueIdValue('')
    setSportsSourceLeagueLabelValue('')
    setSportsSourceConfidenceValue('')
    setSportsSourcePayloadValue(null)
    setSportsSourceLivestreamUrlValue('')
    setSportsSourceDetailsOpen(true)
  }, [])

  const searchSportsSourceCandidates = useCallback(async () => {
    if (!sportsFinalEvent) {
      return
    }

    const query = sportsSourceSearchQuery.trim() || sportsFinalEvent.title.trim()
    if (!query) {
      setSportsSourceSearchError(t('Enter a match search first.'))
      return
    }

    sportsSourceSearchControllerRef.current?.abort()
    const controller = new AbortController()
    sportsSourceSearchControllerRef.current = controller

    try {
      setIsSearchingSportsSource(true)
      setSportsSourceSearchError(null)
      setHasSearchedSportsSource(false)
      const eventDate = resolveSportsSourceSearchDate(sportsFinalEvent)
      const response = await fetchAdminApi('/sports/events/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        signal: controller.signal,
        body: JSON.stringify({
          title: query,
          teams: sportsFinalEvent.sports_teams?.slice(0, 2).map(team => ({
            name: team.name,
            abbreviation: team.abbreviation,
          })),
          slug: sportsFinalEvent.slug,
          category: sportsFinalEvent.sports_vertical ?? 'sports',
          tags: sportsFinalEvent.sports_vertical ? [sportsFinalEvent.sports_vertical] : [],
          sport: sportsFinalEvent.sports_sport_slug ?? undefined,
          league: sportsFinalEvent.sports_league_slug ?? undefined,
          series: sportsFinalEvent.sports_series_slug ?? undefined,
          date: eventDate ?? undefined,
          provider: sportsSourceProviderValue || undefined,
          limit: 8,
        }),
      })
      if (sportsSourceSearchControllerRef.current !== controller) {
        return
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null
        setSportsSourceSearchError(payload?.error || t('Could not search sports matches.'))
        return
      }

      const payload = await response.json().catch(() => null) as { candidates?: SportsSourceCandidate[] } | null
      if (sportsSourceSearchControllerRef.current !== controller) {
        return
      }
      setSportsSourceCandidates(Array.isArray(payload?.candidates) ? payload.candidates : [])
      setHasSearchedSportsSource(true)
    }
    catch (error) {
      if (controller.signal.aborted) {
        return
      }
      console.error('Failed to search sports source candidates', error)
      setSportsSourceSearchError(t('Could not search sports matches.'))
    }
    finally {
      if (sportsSourceSearchControllerRef.current === controller) {
        sportsSourceSearchControllerRef.current = null
        setIsSearchingSportsSource(false)
      }
    }
  }, [sportsFinalEvent, sportsSourceProviderValue, sportsSourceSearchQuery, t])

  const handleCloseSportsFinalModal = useCallback(() => {
    if (isSavingSportsFinal) {
      return
    }
    sportsSourceSearchControllerRef.current?.abort()
    sportsSourceSearchControllerRef.current = null
    setSportsFinalEvent(null)
    setSportsEndedValue(false)
    setSportsScoreHomeValue('')
    setSportsScoreAwayValue('')
    setSportsSourceSearchQuery('')
    setSportsSourceCandidates([])
    setHasSearchedSportsSource(false)
    setSportsSourceDetailsOpen(false)
    setSportsSourceProviderValue('')
    setSportsSourceEventIdValue('')
    setSportsSourceGameIdValue('')
    setSportsSourceLeagueIdValue('')
    setSportsSourceLeagueLabelValue('')
    setSportsSourceConfidenceValue('')
    setSportsSourcePayloadValue(undefined)
    setSportsSourceLivestreamUrlValue('')
    setSportsSourceSearchError(null)
    setSportsFinalError(null)
  }, [isSavingSportsFinal])

  const handleSaveSportsFinalState = useCallback(async () => {
    if (!sportsFinalEvent) {
      return
    }

    setIsSavingSportsFinal(true)
    setSportsFinalError(null)

    const normalizedHomeScore = sportsScoreHomeValue.trim()
    const normalizedAwayScore = sportsScoreAwayValue.trim()
    const hasHomeScore = normalizedHomeScore.length > 0
    const hasAwayScore = normalizedAwayScore.length > 0

    if (hasHomeScore !== hasAwayScore) {
      setSportsFinalError(t('Fill both team scores or leave both empty.'))
      setIsSavingSportsFinal(false)
      return
    }

    if ((hasHomeScore && !/^\d+$/.test(normalizedHomeScore)) || (hasAwayScore && !/^\d+$/.test(normalizedAwayScore))) {
      setSportsFinalError(t('Scores must contain numbers only.'))
      setIsSavingSportsFinal(false)
      return
    }

    const sportsScore = hasHomeScore && hasAwayScore
      ? `${Number.parseInt(normalizedHomeScore, 10)} - ${Number.parseInt(normalizedAwayScore, 10)}`
      : ''
    const sourceMatchConfidence = parseSportsSourceConfidence(sportsSourceConfidenceValue)
    const normalizedSportsSourceLivestreamUrl = sportsSourceLivestreamUrlValue.trim()
    const hasUnrecognizedExistingSportsSourceProvider = Boolean(
      sportsFinalEvent.sports_source_provider?.trim()
      && !normalizeSingleSportsSourceProvider(sportsFinalEvent.sports_source_provider),
    )
    const shouldSkipAutoClearedSportsSource = hasUnrecognizedExistingSportsSourceProvider
      && !sportsSourceProviderValue.trim()
      && !sportsSourceEventIdValue.trim()
      && !sportsSourceGameIdValue.trim()
      && !sportsSourceLeagueIdValue.trim()
      && !sportsSourceLeagueLabelValue.trim()
      && !sportsSourceConfidenceValue.trim()
      && sportsSourcePayloadValue === undefined

    const result = await updateEventSportsFinalStateAction(sportsFinalEvent.id, {
      sportsEnded: sportsEndedValue,
      sportsScore,
      ...(!shouldSkipAutoClearedSportsSource
        ? {
            sportsSource: {
              provider: sportsSourceProviderValue,
              eventId: sportsSourceEventIdValue,
              gameId: sportsSourceGameIdValue,
              leagueId: sportsSourceLeagueIdValue,
              leagueLabel: sportsSourceLeagueLabelValue,
              matchConfidence: sourceMatchConfidence,
              ...(sportsSourcePayloadValue !== undefined ? { payload: sportsSourcePayloadValue } : {}),
            },
          }
        : {}),
      ...(normalizedSportsSourceLivestreamUrl ? { livestreamUrl: normalizedSportsSourceLivestreamUrl } : {}),
    })
    if (result.success) {
      toast.success(sportsEndedValue
        ? t('{name} marked as final.', { name: sportsFinalEvent.title })
        : t('{name} updated.', { name: sportsFinalEvent.title }))
      void queryClient.invalidateQueries({ queryKey: ['admin-events'] })
      setSportsFinalEvent(null)
      setSportsEndedValue(false)
      setSportsScoreHomeValue('')
      setSportsScoreAwayValue('')
      setSportsSourceSearchQuery('')
      setSportsSourceCandidates([])
      setHasSearchedSportsSource(false)
      setSportsSourceDetailsOpen(false)
      setSportsSourceProviderValue('')
      setSportsSourceEventIdValue('')
      setSportsSourceGameIdValue('')
      setSportsSourceLeagueIdValue('')
      setSportsSourceLeagueLabelValue('')
      setSportsSourceConfidenceValue('')
      setSportsSourcePayloadValue(undefined)
      setSportsSourceLivestreamUrlValue('')
      setSportsSourceSearchError(null)
      setSportsFinalError(null)
      setIsSavingSportsFinal(false)
      return
    }

    setSportsFinalError(result.error ?? t('Failed to update sports final state'))
    setIsSavingSportsFinal(false)
  }, [
    sportsFinalEvent,
    sportsEndedValue,
    sportsScoreHomeValue,
    sportsScoreAwayValue,
    sportsSourceConfidenceValue,
    sportsSourceEventIdValue,
    sportsSourceGameIdValue,
    sportsSourceLeagueIdValue,
    sportsSourceLeagueLabelValue,
    sportsSourceLivestreamUrlValue,
    sportsSourcePayloadValue,
    sportsSourceProviderValue,
    queryClient,
    t,
  ])

  const columns = useAdminEventsColumns({
    onToggleHidden: handleToggleHidden,
    onOpenAdditionalContextModal: handleOpenAdditionalContextModal,
    onOpenLivestreamModal: handleOpenLivestreamModal,
    onOpenSportsFinalModal: handleOpenSportsFinalModal,
    isUpdatingHidden: eventId => pendingHiddenId === eventId,
  })

  return {
    events,
    totalCount,
    isLoading,
    error,
    retry,
    pageIndex,
    pageSize,
    search,
    sortBy,
    sortOrder,
    mainCategorySlug,
    creator,
    creatorOptions,
    seriesSlug,
    seriesOptions,
    activeOnly,
    handleSearchChange,
    handleSortChange,
    handleActiveOnlyChange,
    handlePageChange,
    handlePageSizeChange,
    settingsOpen,
    setSettingsOpen,
    draftAutoDeployEnabled,
    setDraftAutoDeployEnabled,
    isSavingSettings,
    handleOpenSettings,
    handleCloseSettings,
    handleSaveSettings,
    filtersOpen,
    setFiltersOpen,
    draftMainCategorySlug,
    setDraftMainCategorySlug,
    draftCreator,
    setDraftCreator,
    draftSeriesSlug,
    setDraftSeriesSlug,
    handleOpenFilters,
    handleApplyFilters,
    handleClearFilters,
    additionalContextEvent,
    additionalContextValue,
    setAdditionalContextValue,
    additionalContextError,
    isSavingAdditionalContext,
    handleCloseAdditionalContextModal,
    handleSaveAdditionalContext,
    livestreamEvent,
    livestreamUrlValue,
    setLivestreamUrlValue,
    livestreamError,
    isSavingLivestream,
    handleCloseLivestreamModal,
    handleSaveLivestreamUrl,
    sportsFinalEvent,
    sportsEndedValue,
    setSportsEndedValue,
    sportsScoreHomeValue,
    setSportsScoreHomeValue,
    sportsScoreAwayValue,
    setSportsScoreAwayValue,
    sportsSourceSearchQuery,
    setSportsSourceSearchQuery,
    sportsSourceCandidates,
    hasSearchedSportsSource,
    sportsSourceDetailsOpen,
    setSportsSourceDetailsOpen,
    sportsSourceProviderValue,
    setSportsSourceProviderValue,
    sportsSourceEventIdValue,
    setSportsSourceEventIdValue,
    sportsSourceGameIdValue,
    setSportsSourceGameIdValue,
    sportsSourceLeagueIdValue,
    setSportsSourceLeagueIdValue,
    sportsSourceLeagueLabelValue,
    setSportsSourceLeagueLabelValue,
    sportsSourceConfidenceValue,
    setSportsSourceConfidenceValue,
    sportsSourceLivestreamUrlValue,
    sportsSourceSearchError,
    isSearchingSportsSource,
    applySportsSourceCandidate,
    clearSportsSourceCandidate,
    searchSportsSourceCandidates,
    sportsFinalError,
    isSavingSportsFinal,
    handleCloseSportsFinalModal,
    handleSaveSportsFinalState,
    columns,
  }
}

export default function AdminEventsTable({
  initialAutoDeployNewEventsEnabled,
  mainCategoryOptions,
  configuredSportsSourceProviders,
}: AdminEventsTableProps) {
  const t = useExtracted()
  const isMobile = useIsMobile()
  const {
    events,
    totalCount,
    isLoading,
    error,
    retry,
    pageIndex,
    pageSize,
    search,
    sortBy,
    sortOrder,
    mainCategorySlug,
    creator,
    creatorOptions,
    seriesSlug,
    seriesOptions,
    activeOnly,
    handleSearchChange,
    handleSortChange,
    handleActiveOnlyChange,
    handlePageChange,
    handlePageSizeChange,
    settingsOpen,
    setSettingsOpen,
    draftAutoDeployEnabled,
    setDraftAutoDeployEnabled,
    isSavingSettings,
    handleOpenSettings,
    handleCloseSettings,
    handleSaveSettings,
    filtersOpen,
    setFiltersOpen,
    draftMainCategorySlug,
    setDraftMainCategorySlug,
    draftCreator,
    setDraftCreator,
    draftSeriesSlug,
    setDraftSeriesSlug,
    handleOpenFilters,
    handleApplyFilters,
    handleClearFilters,
    additionalContextEvent,
    additionalContextValue,
    setAdditionalContextValue,
    additionalContextError,
    isSavingAdditionalContext,
    handleCloseAdditionalContextModal,
    handleSaveAdditionalContext,
    livestreamEvent,
    livestreamUrlValue,
    setLivestreamUrlValue,
    livestreamError,
    isSavingLivestream,
    handleCloseLivestreamModal,
    handleSaveLivestreamUrl,
    sportsFinalEvent,
    sportsEndedValue,
    setSportsEndedValue,
    sportsScoreHomeValue,
    setSportsScoreHomeValue,
    sportsScoreAwayValue,
    setSportsScoreAwayValue,
    sportsSourceSearchQuery,
    setSportsSourceSearchQuery,
    sportsSourceCandidates,
    hasSearchedSportsSource,
    sportsSourceDetailsOpen,
    setSportsSourceDetailsOpen,
    sportsSourceProviderValue,
    setSportsSourceProviderValue,
    sportsSourceEventIdValue,
    setSportsSourceEventIdValue,
    sportsSourceGameIdValue,
    setSportsSourceGameIdValue,
    sportsSourceLeagueIdValue,
    setSportsSourceLeagueIdValue,
    sportsSourceLeagueLabelValue,
    setSportsSourceLeagueLabelValue,
    sportsSourceConfidenceValue,
    setSportsSourceConfidenceValue,
    sportsSourceLivestreamUrlValue,
    sportsSourceSearchError,
    isSearchingSportsSource,
    applySportsSourceCandidate,
    clearSportsSourceCandidate,
    searchSportsSourceCandidates,
    sportsFinalError,
    isSavingSportsFinal,
    handleCloseSportsFinalModal,
    handleSaveSportsFinalState,
    columns,
  } = useAdminEventsTableState(initialAutoDeployNewEventsEnabled)

  const settingsButton = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" size="icon" onClick={handleOpenSettings} aria-label={t('Settings')}>
          <SettingsIcon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t('Settings')}</TooltipContent>
    </Tooltip>
  )

  const createEventButton = (
    <Button asChild type="button" className="h-9">
      <AppLink href="/admin/events/calendar">{t('Create Event')}</AppLink>
    </Button>
  )

  const hasAppliedFilters = mainCategorySlug !== 'all'
    || creator !== 'all'
    || seriesSlug !== 'all'

  const filtersButton = (
    <div className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="outline" size="icon" onClick={handleOpenFilters} aria-label={t('Filters')}>
            <FilterIcon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('Filters')}</TooltipContent>
      </Tooltip>
      {hasAppliedFilters && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            handleClearFilters()
          }}
          className={cn(`
            absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full border border-background
            bg-foreground text-background
          `)}
          aria-label={t('Clear filters')}
        >
          <XIcon className="size-2.5" />
        </button>
      )}
    </div>
  )

  const onlyActiveControl = (
    <div className="flex items-center gap-2">
      <Switch
        id="admin-events-active-only"
        checked={activeOnly}
        onCheckedChange={handleActiveOnlyChange}
      />
      <Label htmlFor="admin-events-active-only" className="text-sm font-normal text-muted-foreground">
        {t('Only active')}
      </Label>
    </div>
  )

  const sportsFinalGameDateLabel = formatDayMonthLabel(resolveGameDateFromAdminEvent(sportsFinalEvent))
  const sportsFinalTeams = resolveSportsFinalTeams(sportsFinalEvent)
  const hasSportsSourceIdentity = Boolean(sportsSourceProviderValue.trim() && (
    sportsSourceEventIdValue.trim() || sportsSourceGameIdValue.trim()
  ))
  const sportsSourceProviderOptions = filterSportsSourceProvidersByCategory({
    providers: configuredSportsSourceProviders,
    category: sportsFinalEvent?.sports_vertical ?? null,
    tags: sportsFinalEvent?.sports_vertical ? [sportsFinalEvent.sports_vertical] : null,
  })
  const sportsSourceProviderSelectValue = SPORTS_SOURCE_PROVIDERS.includes(sportsSourceProviderValue as typeof SPORTS_SOURCE_PROVIDERS[number])
    && sportsSourceProviderOptions.includes(sportsSourceProviderValue as typeof sportsSourceProviderOptions[number])
    ? sportsSourceProviderValue
    : 'none'
  const sportsSourceSummary = hasSportsSourceIdentity
    ? [
        sportsSourceProviderValue.trim(),
        sportsSourceEventIdValue.trim() || sportsSourceGameIdValue.trim(),
      ].filter(Boolean).join(' · ')
    : t('Search sports API')

  const filtersFormFields = (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2">
        <Label>{t('Main category')}</Label>
        <Select value={draftMainCategorySlug} onValueChange={setDraftMainCategorySlug}>
          <SelectTrigger className="h-10 w-full">
            <SelectValue placeholder={t('Main category')} />
          </SelectTrigger>
          <SelectContent align="start" className="py-1">
            <SelectItem value="all" className="mx-1 my-0.5 cursor-pointer rounded-md">{t('All categories')}</SelectItem>
            {mainCategoryOptions.map(category => (
              <SelectItem
                key={category.slug}
                value={category.slug}
                className="mx-1 my-0.5 cursor-pointer rounded-md"
              >
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {creatorOptions.length > 1 && (
        <div className="grid gap-2">
          <Label>{t('Creator')}</Label>
          <Select value={draftCreator} onValueChange={setDraftCreator}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder={t('Creator')} />
            </SelectTrigger>
            <SelectContent align="start" className="py-1">
              <SelectItem value="all" className="mx-1 my-0.5 cursor-pointer rounded-md">{t('All creators')}</SelectItem>
              {creatorOptions.map(creatorWallet => (
                <SelectItem
                  key={creatorWallet}
                  value={creatorWallet}
                  className="mx-1 my-0.5 cursor-pointer rounded-md font-mono text-xs"
                >
                  {creatorWallet}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {seriesOptions.length > 0 && (
        <div className="grid gap-2">
          <Label>{t('Series')}</Label>
          <Select value={draftSeriesSlug} onValueChange={setDraftSeriesSlug}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder={t('Series')} />
            </SelectTrigger>
            <SelectContent align="start" className="py-1">
              <SelectItem value="all" className="mx-1 my-0.5 cursor-pointer rounded-md">{t('All series')}</SelectItem>
              {seriesOptions.map(seriesOption => (
                <SelectItem
                  key={seriesOption}
                  value={seriesOption}
                  className="mx-1 my-0.5 cursor-pointer rounded-md"
                >
                  {seriesOption}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )

  const settingsFormFields = (
    <div className="grid gap-4 py-2">
      <div className="grid gap-1">
        <div className="flex items-center gap-2">
          <Switch
            id="auto-deploy-events"
            checked={draftAutoDeployEnabled}
            onCheckedChange={setDraftAutoDeployEnabled}
            disabled={isSavingSettings}
          />
          <Label htmlFor="auto-deploy-events" className="text-sm font-medium">
            {t('Auto-deploy new events')}
          </Label>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">
            {t('When disabled, new synced events stay hidden until manually enabled in this list.')}
          </p>
        </div>
      </div>
    </div>
  )

  const livestreamFormFields = (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2">
        <Label htmlFor="event-livestream-url">
          {t('Livestream URL')}
        </Label>
        <Input
          id="event-livestream-url"
          type="url"
          placeholder="https://example.com/live"
          value={livestreamUrlValue}
          onChange={event => setLivestreamUrlValue(event.target.value)}
          disabled={isSavingLivestream}
        />
        {livestreamEvent && (
          <p className="text-xs text-muted-foreground">
            {livestreamEvent.title}
          </p>
        )}
      </div>
      {livestreamError && <InputError message={livestreamError} />}
    </div>
  )

  const additionalContextFormFields = (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2">
        <Label htmlFor="event-additional-context">
          {t({ id: 'adminEventsAdditionalContextLabel', message: 'Additional Context' })}
        </Label>
        <Textarea
          id="event-additional-context"
          placeholder={t({
            id: 'adminEventsAdditionalContextPlaceholder',
            message: 'Write the additional context shown in Rules for this event.',
          })}
          value={additionalContextValue}
          onChange={event => setAdditionalContextValue(event.target.value)}
          disabled={isSavingAdditionalContext}
          className="min-h-28"
        />
        {additionalContextEvent && (
          <p className="text-sm text-muted-foreground">
            {additionalContextEvent.title}
          </p>
        )}
      </div>
      {additionalContextError && <InputError message={additionalContextError} />}
    </div>
  )

  const sportsFinalFormFields = (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2">
        <Label>{t('Score')}</Label>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <Input
            id="event-sports-score-home"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            placeholder="0"
            value={sportsScoreHomeValue}
            onChange={event => setSportsScoreHomeValue(event.target.value)}
            disabled={isSavingSportsFinal}
          />
          <span className="text-sm font-semibold text-muted-foreground">-</span>
          <Input
            id="event-sports-score-away"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            placeholder="0"
            value={sportsScoreAwayValue}
            onChange={event => setSportsScoreAwayValue(event.target.value)}
            disabled={isSavingSportsFinal}
          />
        </div>
        {sportsFinalTeams && (
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span className="truncate">{sportsFinalTeams.home}</span>
            <span className="truncate text-right">{sportsFinalTeams.away}</span>
          </div>
        )}
      </div>

      <details
        className="rounded-md border border-border bg-muted/10 p-3"
        open={sportsSourceDetailsOpen}
        onToggle={event => setSportsSourceDetailsOpen(event.currentTarget.open)}
      >
        <summary className="cursor-pointer text-sm font-medium">
          {sportsSourceSummary}
        </summary>

        <div className="mt-3 grid gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={sportsSourceSearchQuery}
              onChange={event => setSportsSourceSearchQuery(event.target.value)}
              placeholder={sportsFinalEvent?.title ?? t('Search match')}
              disabled={isSavingSportsFinal}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void searchSportsSourceCandidates()
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => void searchSportsSourceCandidates()}
              disabled={isSavingSportsFinal || isSearchingSportsSource}
            >
              {isSearchingSportsSource
                ? <Loader2Icon className="size-4 animate-spin" />
                : <SearchIcon className="size-4" />}
              <span>{t('Search')}</span>
            </Button>
            {hasSportsSourceIdentity
              ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearSportsSourceCandidate}
                    disabled={isSavingSportsFinal}
                  >
                    {t('Clear')}
                  </Button>
                )
              : null}
          </div>

          {sportsSourceSearchError && <InputError message={sportsSourceSearchError} />}

          {sportsSourceCandidates.length > 0
            ? (
                <div className="grid gap-2">
                  {sportsSourceCandidates.map(candidate => (
                    <button
                      key={`${candidate.provider}:${candidate.eventId}:${candidate.gameId ?? ''}`}
                      type="button"
                      className={cn(`
                        flex min-w-0 items-center justify-between gap-3 rounded-md border bg-background px-3 py-2
                        text-left text-sm transition
                        hover:border-primary/60
                      `)}
                      onClick={() => applySportsSourceCandidate(candidate)}
                      disabled={isSavingSportsFinal}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {formatSportsSourceCandidateName(candidate)}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {formatSportsSourceCandidateMeta(candidate)}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {Math.round((candidate.confidence ?? 0) * 100)}
                        %
                      </span>
                    </button>
                  ))}
                </div>
              )
            : hasSearchedSportsSource && !sportsSourceSearchError
              ? (
                  <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                    {t('No results found')}
                  </p>
                )
              : null}

          {sportsSourceLivestreamUrlValue
            ? (
                <p className="truncate text-xs text-muted-foreground">
                  {t('Livestream URL')}
                  {': '}
                  {sportsSourceLivestreamUrlValue}
                </p>
              )
            : null}

          <div className="grid grid-cols-1 gap-3 border-t border-border/50 pt-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="event-sports-source-provider">{t('Provider')}</Label>
              <Select
                value={sportsSourceProviderSelectValue}
                onValueChange={value => setSportsSourceProviderValue(value === 'none' ? '' : value)}
                disabled={isSavingSportsFinal}
              >
                <SelectTrigger id="event-sports-source-provider" className="w-full">
                  <SelectValue placeholder={t('Provider')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="mx-1 my-0.5 cursor-pointer rounded-md">
                    {t('None')}
                  </SelectItem>
                  {sportsSourceProviderOptions.map(provider => (
                    <SelectItem
                      key={provider}
                      value={provider}
                      className="mx-1 my-0.5 cursor-pointer rounded-md"
                    >
                      {formatSportsSourceProviderLabel(provider)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-sports-source-event-id">{t('Event ID')}</Label>
              <Input
                id="event-sports-source-event-id"
                value={sportsSourceEventIdValue}
                onChange={event => setSportsSourceEventIdValue(event.target.value)}
                disabled={isSavingSportsFinal}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-sports-source-game-id">{t('Game ID')}</Label>
              <Input
                id="event-sports-source-game-id"
                value={sportsSourceGameIdValue}
                onChange={event => setSportsSourceGameIdValue(event.target.value)}
                disabled={isSavingSportsFinal}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-sports-source-league-id">{t('League ID')}</Label>
              <Input
                id="event-sports-source-league-id"
                value={sportsSourceLeagueIdValue}
                onChange={event => setSportsSourceLeagueIdValue(event.target.value)}
                disabled={isSavingSportsFinal}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-sports-source-league-label">{t('League')}</Label>
              <Input
                id="event-sports-source-league-label"
                value={sportsSourceLeagueLabelValue}
                onChange={event => setSportsSourceLeagueLabelValue(event.target.value)}
                disabled={isSavingSportsFinal}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-sports-source-confidence">{t('Confidence')}</Label>
              <Input
                id="event-sports-source-confidence"
                value={sportsSourceConfidenceValue}
                onChange={event => setSportsSourceConfidenceValue(event.target.value)}
                disabled={isSavingSportsFinal}
                inputMode="decimal"
                placeholder="0.0000"
              />
            </div>
          </div>
        </div>
      </details>

      <div className="flex items-center gap-2">
        <Switch
          id="event-sports-ended"
          checked={sportsEndedValue}
          onCheckedChange={setSportsEndedValue}
          disabled={isSavingSportsFinal}
        />
        <Label htmlFor="event-sports-ended">{t('Ended')}</Label>
      </div>

      {sportsFinalError && <InputError message={sportsFinalError} />}
    </div>
  )

  return (
    <>
      <DataTable
        columns={columns}
        data={events}
        totalCount={totalCount}
        searchPlaceholder={t('Search')}
        enableSelection={false}
        enablePagination
        enableColumnVisibility={false}
        isLoading={isLoading}
        error={error}
        onRetry={retry}
        emptyMessage={t('No events found')}
        emptyDescription={t('Events created from sync will show up here.')}
        search={search}
        onSearchChange={handleSearchChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        toolbarLeftContent={(
          <div className="flex items-center gap-3">
            {filtersButton}
            {onlyActiveControl}
          </div>
        )}
        toolbarRightContent={(
          <div className="flex items-center gap-2">
            {createEventButton}
            {settingsButton}
          </div>
        )}
        searchInputClassName="h-9 sm:w-37.5 lg:w-62.5"
        searchLeadingIcon={<SearchIcon className="size-4" />}
      />

      {isMobile
        ? (
            <Drawer
              open={filtersOpen}
              onOpenChange={(open) => {
                if (open) {
                  setFiltersOpen(true)
                  return
                }
                setFiltersOpen(false)
              }}
            >
              <DrawerContent className="max-h-[90vh] w-full bg-background px-4 pt-4 pb-6">
                <div className="grid gap-4">
                  <DrawerHeader className="space-y-2 p-0 text-left">
                    <DrawerTitle>{t('Filters')}</DrawerTitle>
                  </DrawerHeader>
                  {filtersFormFields}
                  <DrawerFooter className="mt-2 p-0">
                    <Button type="button" variant="outline" onClick={() => setFiltersOpen(false)}>
                      {t('Cancel')}
                    </Button>
                    <Button type="button" onClick={handleApplyFilters}>
                      {t('Apply')}
                    </Button>
                  </DrawerFooter>
                </div>
              </DrawerContent>
            </Drawer>
          )
        : (
            <Dialog
              open={filtersOpen}
              onOpenChange={(open) => {
                if (open) {
                  setFiltersOpen(true)
                  return
                }
                setFiltersOpen(false)
              }}
            >
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{t('Filters')}</DialogTitle>
                </DialogHeader>
                {filtersFormFields}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setFiltersOpen(false)}>
                    {t('Cancel')}
                  </Button>
                  <Button type="button" onClick={handleApplyFilters}>
                    {t('Apply')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

      {isMobile
        ? (
            <Drawer
              open={settingsOpen}
              onOpenChange={(open) => {
                if (open) {
                  setSettingsOpen(true)
                  return
                }
                handleCloseSettings()
              }}
            >
              <DrawerContent className="max-h-[90vh] w-full bg-background px-4 pt-4 pb-6">
                <div className="grid gap-4">
                  <DrawerHeader className="space-y-2 p-0 text-left">
                    <DrawerTitle>{t('Events settings')}</DrawerTitle>
                  </DrawerHeader>
                  {settingsFormFields}
                  <DrawerFooter className="mt-2 p-0">
                    <Button
                      type="button"
                      onClick={() => {
                        void handleSaveSettings()
                      }}
                      disabled={isSavingSettings}
                    >
                      {isSavingSettings ? t('Saving...') : t('Save')}
                    </Button>
                  </DrawerFooter>
                </div>
              </DrawerContent>
            </Drawer>
          )
        : (
            <Dialog
              open={settingsOpen}
              onOpenChange={(open) => {
                if (open) {
                  setSettingsOpen(true)
                  return
                }
                handleCloseSettings()
              }}
            >
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{t('Events settings')}</DialogTitle>
                </DialogHeader>
                {settingsFormFields}
                <DialogFooter>
                  <Button
                    type="button"
                    onClick={() => {
                      void handleSaveSettings()
                    }}
                    disabled={isSavingSettings}
                  >
                    {isSavingSettings ? t('Saving...') : t('Save')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

      {isMobile
        ? (
            <Drawer
              open={Boolean(additionalContextEvent)}
              onOpenChange={(open) => {
                if (open) {
                  return
                }
                handleCloseAdditionalContextModal()
              }}
            >
              <DrawerContent className="max-h-[90vh] w-full bg-background px-4 pt-4 pb-6">
                <div className="grid gap-4">
                  <DrawerHeader className="space-y-2 p-0 text-left">
                    <DrawerTitle>
                      {t({ id: 'adminEventsAddAdditionalContext', message: 'Add Additional Context' })}
                    </DrawerTitle>
                    <DrawerDescription>
                      {t({
                        id: 'adminEventsAdditionalContextDescription',
                        message: 'Configure the additional context shown in Rules for this event. Leave empty to remove it.',
                      })}
                    </DrawerDescription>
                  </DrawerHeader>
                  {additionalContextFormFields}
                  <DrawerFooter className="mt-2 p-0">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCloseAdditionalContextModal}
                      disabled={isSavingAdditionalContext}
                    >
                      {t('Cancel')}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        void handleSaveAdditionalContext()
                      }}
                      disabled={isSavingAdditionalContext}
                    >
                      {isSavingAdditionalContext ? t('Saving...') : t('Save')}
                    </Button>
                  </DrawerFooter>
                </div>
              </DrawerContent>
            </Drawer>
          )
        : (
            <Dialog
              open={Boolean(additionalContextEvent)}
              onOpenChange={(open) => {
                if (open) {
                  return
                }
                handleCloseAdditionalContextModal()
              }}
            >
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {t({ id: 'adminEventsAddAdditionalContext', message: 'Add Additional Context' })}
                  </DialogTitle>
                  <DialogDescription>
                    {t({
                      id: 'adminEventsAdditionalContextDescription',
                      message: 'Configure the additional context shown in Rules for this event. Leave empty to remove it.',
                    })}
                  </DialogDescription>
                </DialogHeader>
                {additionalContextFormFields}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseAdditionalContextModal}
                    disabled={isSavingAdditionalContext}
                  >
                    {t('Cancel')}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      void handleSaveAdditionalContext()
                    }}
                    disabled={isSavingAdditionalContext}
                  >
                    {isSavingAdditionalContext ? t('Saving...') : t('Save')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

      {isMobile
        ? (
            <Drawer
              open={Boolean(livestreamEvent)}
              onOpenChange={(open) => {
                if (open) {
                  return
                }
                handleCloseLivestreamModal()
              }}
            >
              <DrawerContent className="max-h-[90vh] w-full bg-background px-4 pt-4 pb-6">
                <div className="grid gap-4">
                  <DrawerHeader className="space-y-2 p-0 text-left">
                    <DrawerTitle>
                      {livestreamEvent?.livestream_url ? t('Edit livestream URL') : t('Add livestream URL')}
                    </DrawerTitle>
                    <DrawerDescription>
                      {t('Configure the livestream URL for this event. Leave empty to remove it.')}
                    </DrawerDescription>
                  </DrawerHeader>
                  {livestreamFormFields}
                  <DrawerFooter className="mt-2 p-0">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCloseLivestreamModal}
                      disabled={isSavingLivestream}
                    >
                      {t('Cancel')}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        void handleSaveLivestreamUrl()
                      }}
                      disabled={isSavingLivestream}
                    >
                      {isSavingLivestream ? t('Saving...') : t('Save')}
                    </Button>
                  </DrawerFooter>
                </div>
              </DrawerContent>
            </Drawer>
          )
        : (
            <Dialog
              open={Boolean(livestreamEvent)}
              onOpenChange={(open) => {
                if (open) {
                  return
                }
                handleCloseLivestreamModal()
              }}
            >
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {livestreamEvent?.livestream_url ? t('Edit livestream URL') : t('Add livestream URL')}
                  </DialogTitle>
                  <DialogDescription>
                    {t('Configure the livestream URL for this event. Leave empty to remove it.')}
                  </DialogDescription>
                </DialogHeader>
                {livestreamFormFields}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseLivestreamModal}
                    disabled={isSavingLivestream}
                  >
                    {t('Cancel')}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      void handleSaveLivestreamUrl()
                    }}
                    disabled={isSavingLivestream}
                  >
                    {isSavingLivestream ? t('Saving...') : t('Save')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

      {isMobile
        ? (
            <Drawer
              open={Boolean(sportsFinalEvent)}
              onOpenChange={(open) => {
                if (open) {
                  return
                }
                handleCloseSportsFinalModal()
              }}
            >
              <DrawerContent className="max-h-[90vh] w-full overflow-y-auto bg-background px-4 pt-4 pb-6">
                <div className="grid gap-4">
                  <DrawerHeader className="space-y-2 p-0 text-left">
                    <DrawerTitle>{t('Sports final status')}</DrawerTitle>
                    {sportsFinalEvent && (
                      <p className="text-sm text-muted-foreground">
                        {sportsFinalEvent.title}
                        {sportsFinalGameDateLabel ? ` (${sportsFinalGameDateLabel})` : ''}
                      </p>
                    )}
                  </DrawerHeader>
                  {sportsFinalFormFields}
                  <DrawerFooter className="mt-2 p-0">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCloseSportsFinalModal}
                      disabled={isSavingSportsFinal}
                    >
                      {t('Cancel')}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        void handleSaveSportsFinalState()
                      }}
                      disabled={isSavingSportsFinal}
                    >
                      {isSavingSportsFinal ? t('Saving...') : t('Save')}
                    </Button>
                  </DrawerFooter>
                </div>
              </DrawerContent>
            </Drawer>
          )
        : (
            <Dialog
              open={Boolean(sportsFinalEvent)}
              onOpenChange={(open) => {
                if (open) {
                  return
                }
                handleCloseSportsFinalModal()
              }}
            >
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{t('Sports final status')}</DialogTitle>
                  {sportsFinalEvent && (
                    <p className="text-sm text-muted-foreground">
                      {sportsFinalEvent.title}
                      {sportsFinalGameDateLabel ? ` (${sportsFinalGameDateLabel})` : ''}
                    </p>
                  )}
                </DialogHeader>
                {sportsFinalFormFields}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseSportsFinalModal}
                    disabled={isSavingSportsFinal}
                  >
                    {t('Cancel')}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      void handleSaveSportsFinalState()
                    }}
                    disabled={isSavingSportsFinal}
                  >
                    {isSavingSportsFinal ? t('Saving...') : t('Save')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
    </>
  )
}
