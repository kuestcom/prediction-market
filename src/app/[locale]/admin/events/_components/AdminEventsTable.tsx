'use client'

import { useQueryClient } from '@tanstack/react-query'
import { ChevronDownIcon, FilterIcon, SearchIcon, SettingsIcon, XIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useRef, useState, useSyncExternalStore } from 'react'

import type { AdminEventRow } from '@/app/[locale]/admin/events/_hooks/useAdminEvents'
import type {
  AdminEventsTableState,
  AdminEventsTableStatePatch,
} from '@/app/[locale]/admin/events/_lib/admin-events-table-state'
import type { AdminEventAttentionFilter } from '@/lib/admin-event-attention'
import type { SportsSourceProvider } from '@/lib/sports-source/providers'

import { DataTable } from '@/app/[locale]/admin/_components/DataTable'
import { updateEventAdditionalContextAction } from '@/app/[locale]/admin/events/_actions/update-event-additional-context'
import { updateEventLivestreamUrlAction } from '@/app/[locale]/admin/events/_actions/update-event-livestream-url'
import { updateEventSportsFinalStateAction } from '@/app/[locale]/admin/events/_actions/update-event-sports-final-state'
import { updateEventSyncSettingsAction } from '@/app/[locale]/admin/events/_actions/update-event-sync-settings'
import { updateEventVisibilityAction } from '@/app/[locale]/admin/events/_actions/update-event-visibility'
import AdminResolutionReportsDialog from '@/app/[locale]/admin/events/_components/AdminResolutionReportsDialog'
import { useAdminEventsColumns } from '@/app/[locale]/admin/events/_components/columns'
import { useAdminEventsTable } from '@/app/[locale]/admin/events/_hooks/useAdminEvents'
import {
  getServerHideCryptoPreference,
  readHideCryptoPreference,
  storeHideCryptoPreference,
  subscribeToHideCryptoPreference,
} from '@/app/[locale]/admin/events/_lib/admin-events-hide-crypto-preference'
import { DEFAULT_ADMIN_EVENTS_TABLE_STATE } from '@/app/[locale]/admin/events/_lib/admin-events-table-state'
import EventIconImage from '@/components/EventIconImage'
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
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Link } from '@/i18n/navigation'
import { resolveAutomaticSportsSourceCardCandidate } from '@/lib/sports-source/auto-selection'
import { normalizeSingleSportsSourceProvider } from '@/lib/sports-source/providers'
import { buildSportsSourceMatchupSearchQuery } from '@/lib/sports-source/search-query'
import { cn } from '@/lib/utils'

export interface AdminEventsTableProps {
  initialAutoDeployNewEventsEnabled: boolean
  tableState: AdminEventsTableState
  onTableStateChange: (patch: AdminEventsTableStatePatch) => void
  mainCategoryOptions: { slug: string; name: string }[]
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
  homeTeam: { name: string; abbreviation?: string | null } | null
  awayTeam: { name: string; abbreviation?: string | null } | null
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

function resolveSportsSourceProvider(event: AdminEventRow): SportsSourceProvider {
  return event.sports_vertical === 'esports' ? 'pandascore' : 'thesportsdb'
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
  return (
    [candidate.homeTeam?.name, candidate.awayTeam?.name].filter(Boolean).join(' vs ') ||
    candidate.eventName ||
    candidate.eventId
  )
}

function formatSportsSourceCandidateMeta(candidate: SportsSourceCandidate) {
  return [
    candidate.leagueName,
    candidate.startTime ? formatDayMonthLabel(new Date(candidate.startTime)) : null,
    candidate.provider,
  ]
    .filter(Boolean)
    .join(' · ')
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
    return {
      home: { name: 'Team 1', logoUrl: null },
      away: { name: 'Team 2', logoUrl: null },
    }
  }

  const parts = matchup
    .split(/\s+vs\s+/i)
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length >= 2) {
    return {
      home: { name: parts[0]!, logoUrl: null },
      away: { name: parts[1]!, logoUrl: null },
    }
  }

  return {
    home: { name: 'Team 1', logoUrl: null },
    away: { name: 'Team 2', logoUrl: null },
  }
}

function resolveSportsFinalTeams(event: AdminEventRow | null) {
  if (!event) {
    return null
  }

  const teams = event.sports_teams ?? []
  const home = teams[0]?.name?.trim() || teams[0]?.abbreviation?.trim()
  const away = teams[1]?.name?.trim() || teams[1]?.abbreviation?.trim()
  if (home && away) {
    const logoUrls = event.sports_team_logo_urls ?? []
    return {
      home: { name: home, logoUrl: teams[0]?.logo_url?.trim() || logoUrls[0]?.trim() || null },
      away: { name: away, logoUrl: teams[1]?.logo_url?.trim() || logoUrls[1]?.trim() || null },
    }
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

function useAdminEventsTableState(
  initialAutoDeployNewEventsEnabled: boolean,
  tableState: AdminEventsTableState,
  onTableStateChange: (patch: AdminEventsTableStatePatch) => void,
) {
  const t = useExtracted()
  const queryClient = useQueryClient()
  const subscribeToHideCryptoAndResetPage = useCallback(
    (onStoreChange: () => void) =>
      subscribeToHideCryptoPreference(onStoreChange, () => {
        onTableStateChange({ pageIndex: 0 })
      }),
    [onTableStateChange],
  )
  const hideCrypto = useSyncExternalStore(
    subscribeToHideCryptoAndResetPage,
    readHideCryptoPreference,
    getServerHideCryptoPreference,
  )

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
    attention,
    handleSearchChange,
    handleSortChange,
    handleFiltersChange,
    handleActiveOnlyChange,
    handlePageChange,
    handlePageSizeChange,
  } = useAdminEventsTable(tableState, onTableStateChange, hideCrypto)

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
  const [resolutionReportsEvent, setResolutionReportsEvent] = useState<AdminEventRow | null>(null)
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
  const [sportsSourcePayloadValue, setSportsSourcePayloadValue] = useState<Record<string, unknown> | null | undefined>(
    undefined,
  )
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
  const [draftAttention, setDraftAttention] = useState<AdminEventAttentionFilter | 'all'>(attention)

  const handleHideCryptoChange = useCallback((nextHideCrypto: boolean) => {
    storeHideCryptoPreference(nextHideCrypto)
  }, [])

  const handleToggleHidden = useCallback(
    async (event: AdminEventRow, checked: boolean) => {
      setPendingHiddenId(event.id)

      try {
        const result = await updateEventVisibilityAction(event.id, checked)
        if (result.success) {
          toast.success(
            checked
              ? t('{name} is now hidden from public event lists.', { name: event.title })
              : t('{name} is now visible in public event lists.', { name: event.title }),
          )
          void queryClient.invalidateQueries({ queryKey: ['admin-events'] })
        } else {
          toast.error(result.error || t('Failed to update event visibility'))
        }
      } catch (error) {
        console.error('Failed to update event visibility', error)
        toast.error(t('Failed to update event visibility'))
      } finally {
        setPendingHiddenId(null)
      }
    },
    [queryClient, t],
  )

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
        toast.success(
          draftAutoDeployEnabled
            ? t('New events will be auto-deployed.')
            : t('New events now require manual activation.'),
        )
        setSettingsOpen(false)
      } else {
        toast.error(result.error || t('Failed to update event sync settings'))
      }
    } catch (error) {
      console.error('Failed to update event sync settings', error)
      toast.error(t('Failed to update event sync settings'))
    } finally {
      setIsSavingSettings(false)
    }
  }, [draftAutoDeployEnabled, t])

  const handleOpenFilters = useCallback(() => {
    setDraftMainCategorySlug(mainCategorySlug)
    setDraftCreator(creator)
    setDraftSeriesSlug(seriesSlug)
    setDraftAttention(attention)
    setFiltersOpen(true)
  }, [attention, mainCategorySlug, creator, seriesSlug])

  const handleApplyFilters = useCallback(() => {
    handleFiltersChange({
      mainCategorySlug: draftMainCategorySlug,
      creator: draftCreator,
      seriesSlug: draftSeriesSlug,
      activeOnly,
      attention: draftAttention,
    })
    setFiltersOpen(false)
  }, [activeOnly, draftMainCategorySlug, draftCreator, draftSeriesSlug, draftAttention, handleFiltersChange])

  const handleClearFilters = useCallback(() => {
    handleFiltersChange({
      mainCategorySlug: 'all',
      creator: 'all',
      seriesSlug: 'all',
      activeOnly: DEFAULT_ADMIN_EVENTS_TABLE_STATE.activeOnly,
      attention: 'all',
    })
  }, [handleFiltersChange])

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

  const handleOpenResolutionReportsModal = useCallback((event: AdminEventRow) => {
    setResolutionReportsEvent(event)
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
      toast.success(
        livestreamUrlValue.trim()
          ? t('Livestream URL updated for {name}.', { name: livestreamEvent.title })
          : t('Livestream URL removed for {name}.', { name: livestreamEvent.title }),
      )
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
        toast.success(
          additionalContextValue.trim()
            ? t('Additional context updated for {name}.', { name: additionalContextEvent.title })
            : t('Additional context removed for {name}.', { name: additionalContextEvent.title }),
        )
        void queryClient.invalidateQueries({ queryKey: ['admin-events'] })
        setAdditionalContextEvent(null)
        setAdditionalContextValue('')
        setAdditionalContextError(null)
        return
      }

      setAdditionalContextError(result.error ?? t('Failed to update additional context'))
    } catch (error) {
      setAdditionalContextError(
        error instanceof Error && error.message ? error.message : t('Failed to update additional context'),
      )
    } finally {
      setIsSavingAdditionalContext(false)
    }
  }, [additionalContextEvent, additionalContextValue, queryClient, t])

  const handleOpenSportsFinalModal = useCallback((event: AdminEventRow) => {
    const parsedScore = parseSportsScoreParts(event.sports_score)
    const provider = resolveSportsSourceProvider(event)
    const hasSourceIdentity = Boolean(event.sports_source_event_id?.trim() || event.sports_source_game_id?.trim())
    setSportsFinalEvent(event)
    setSportsEndedValue(event.sports_ended === true)
    setSportsScoreHomeValue(parsedScore.home)
    setSportsScoreAwayValue(parsedScore.away)
    setSportsSourceSearchQuery(buildSportsSourceModalSearchQuery(event))
    setSportsSourceCandidates([])
    setHasSearchedSportsSource(false)
    setSportsSourceDetailsOpen(false)
    setSportsSourceProviderValue(hasSourceIdentity ? provider : '')
    setSportsSourceEventIdValue(hasSourceIdentity ? (event.sports_source_event_id ?? '') : '')
    setSportsSourceGameIdValue(hasSourceIdentity ? (event.sports_source_game_id ?? '') : '')
    setSportsSourceLeagueIdValue(hasSourceIdentity ? (event.sports_source_league_id ?? '') : '')
    setSportsSourceLeagueLabelValue(hasSourceIdentity ? (event.sports_source_league_label ?? '') : '')
    setSportsSourceConfidenceValue(hasSourceIdentity ? (event.sports_source_match_confidence ?? '') : '')
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
          teams: sportsFinalEvent.sports_teams?.slice(0, 2).map((team) => ({
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
          provider: sportsSourceProviderValue || resolveSportsSourceProvider(sportsFinalEvent),
          limit: 8,
        }),
      })
      if (sportsSourceSearchControllerRef.current !== controller) {
        return
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        setSportsSourceSearchError(payload?.error || t('Could not search sports matches.'))
        return
      }

      const payload = (await response.json().catch(() => null)) as { candidates?: SportsSourceCandidate[] } | null
      if (sportsSourceSearchControllerRef.current !== controller) {
        return
      }
      const nextCandidates = Array.isArray(payload?.candidates) ? payload.candidates : []
      setSportsSourceCandidates(nextCandidates)
      const automaticCardCandidate = resolveAutomaticSportsSourceCardCandidate(nextCandidates)
      if (automaticCardCandidate) {
        applySportsSourceCandidate(automaticCardCandidate)
      }
      setHasSearchedSportsSource(true)
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }
      console.error('Failed to search sports source candidates', error)
      setSportsSourceSearchError(t('Could not search sports matches.'))
    } finally {
      if (sportsSourceSearchControllerRef.current === controller) {
        sportsSourceSearchControllerRef.current = null
        setIsSearchingSportsSource(false)
      }
    }
  }, [applySportsSourceCandidate, sportsFinalEvent, sportsSourceProviderValue, sportsSourceSearchQuery, t])

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

    const sportsScore =
      hasHomeScore && hasAwayScore
        ? `${Number.parseInt(normalizedHomeScore, 10)} - ${Number.parseInt(normalizedAwayScore, 10)}`
        : ''
    const sourceMatchConfidence = parseSportsSourceConfidence(sportsSourceConfidenceValue)
    const normalizedSportsSourceLivestreamUrl = sportsSourceLivestreamUrlValue.trim()
    const hasUnrecognizedExistingSportsSourceProvider = Boolean(
      sportsFinalEvent.sports_source_provider?.trim() &&
      !normalizeSingleSportsSourceProvider(sportsFinalEvent.sports_source_provider),
    )
    const shouldSkipAutoClearedSportsSource =
      hasUnrecognizedExistingSportsSourceProvider &&
      !sportsSourceProviderValue.trim() &&
      !sportsSourceEventIdValue.trim() &&
      !sportsSourceGameIdValue.trim() &&
      !sportsSourceLeagueIdValue.trim() &&
      !sportsSourceLeagueLabelValue.trim() &&
      !sportsSourceConfidenceValue.trim() &&
      sportsSourcePayloadValue === undefined

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
      toast.success(
        sportsEndedValue
          ? t('{name} marked as final.', { name: sportsFinalEvent.title })
          : t('{name} updated.', { name: sportsFinalEvent.title }),
      )
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
    onOpenResolutionReportsModal: handleOpenResolutionReportsModal,
    onOpenSportsFinalModal: handleOpenSportsFinalModal,
    isUpdatingHidden: (eventId) => pendingHiddenId === eventId,
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
    hideCrypto,
    activeOnly,
    attention,
    handleSearchChange,
    handleSortChange,
    handleHideCryptoChange,
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
    draftAttention,
    setDraftAttention,
    handleOpenFilters,
    handleApplyFilters,
    handleClearFilters,
    resolutionReportsEvent,
    setResolutionReportsEvent,
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
  tableState,
  onTableStateChange,
  mainCategoryOptions,
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
    hideCrypto,
    activeOnly,
    attention,
    handleSearchChange,
    handleSortChange,
    handleHideCryptoChange,
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
    draftAttention,
    setDraftAttention,
    handleOpenFilters,
    handleApplyFilters,
    handleClearFilters,
    resolutionReportsEvent,
    setResolutionReportsEvent,
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
  } = useAdminEventsTableState(initialAutoDeployNewEventsEnabled, tableState, onTableStateChange)

  const settingsButton = (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button type="button" variant="outline" size="icon" onClick={handleOpenSettings} aria-label={t('Settings')}>
            <SettingsIcon className="size-4" />
          </Button>
        }
      />
      <TooltipContent>{t('Settings')}</TooltipContent>
    </Tooltip>
  )

  const createEventButton = (
    <Button
      className="h-9"
      nativeButton={false}
      render={<Link href="/admin/events/calendar">{t('Create Event')}</Link>}
    />
  )

  const hasAppliedFilters =
    mainCategorySlug !== 'all' ||
    creator !== 'all' ||
    seriesSlug !== 'all' ||
    activeOnly !== DEFAULT_ADMIN_EVENTS_TABLE_STATE.activeOnly ||
    attention !== 'all'

  const filtersButton = (
    <div className="relative">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button type="button" variant="outline" size="icon" onClick={handleOpenFilters} aria-label={t('Filters')}>
              <FilterIcon className="size-4" />
            </Button>
          }
        />
        <TooltipContent>{t('Filters')}</TooltipContent>
      </Tooltip>
      {hasAppliedFilters && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            handleClearFilters()
          }}
          className={cn(
            `absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full border border-background bg-foreground text-background`,
          )}
          aria-label={t('Clear filters')}
        >
          <XIcon className="size-2.5" />
        </button>
      )}
    </div>
  )

  const onlyActiveControl = (
    <div className="flex items-center gap-2">
      <Switch id="admin-events-active-only" checked={activeOnly} onCheckedChange={handleActiveOnlyChange} />
      <Label htmlFor="admin-events-active-only" className="text-sm font-normal text-muted-foreground">
        {t('Only active')}
      </Label>
    </div>
  )

  const hideCryptoControl = (
    <div className="flex items-center gap-2">
      <Switch
        id="admin-events-hide-crypto"
        checked={hideCrypto}
        onCheckedChange={(checked) => {
          handleHideCryptoChange(checked)
        }}
      />
      <Label htmlFor="admin-events-hide-crypto" className="text-sm font-normal text-muted-foreground">
        {t('Hide crypto')}
      </Label>
    </div>
  )

  const sportsFinalGameDateLabel = formatDayMonthLabel(resolveGameDateFromAdminEvent(sportsFinalEvent))
  const sportsFinalTeams = resolveSportsFinalTeams(sportsFinalEvent)
  const hasSportsSourceIdentity = Boolean(
    sportsSourceProviderValue.trim() && (sportsSourceEventIdValue.trim() || sportsSourceGameIdValue.trim()),
  )
  const sportsSourceSummary = hasSportsSourceIdentity
    ? [sportsSourceProviderValue.trim(), sportsSourceEventIdValue.trim() || sportsSourceGameIdValue.trim()]
        .filter(Boolean)
        .join(' · ')
    : t('Automatic score')
  const sportsFinalEventSummary = sportsFinalEvent ? (
    <div className="flex max-w-full min-w-0 items-center gap-3 overflow-hidden text-left">
      <div className="relative size-10 shrink-0 overflow-hidden rounded-md border bg-muted/40">
        {sportsFinalEvent.icon_url ? (
          <EventIconImage
            src={sportsFinalEvent.icon_url}
            alt={sportsFinalEvent.title}
            sizes="40px"
            containerClassName="size-full"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-xs font-semibold text-muted-foreground">
            {sportsFinalEvent.title.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="max-w-full text-sm leading-snug font-medium break-words whitespace-normal text-foreground">
          {sportsFinalEvent.title}
        </p>
        {sportsFinalGameDateLabel ? <p className="text-xs text-muted-foreground">{sportsFinalGameDateLabel}</p> : null}
      </div>
    </div>
  ) : null

  const filtersFormFields = (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2">
        <Label>{t('Attention')}</Label>
        <Select
          items={{
            all: t('All events'),
            'missing-sports-id': t('Events without a sports ID'),
            'past-due-unresolved': t('Events awaiting resolution'),
            'resolution-reports': t('Events with resolution reports'),
          }}
          value={draftAttention}
          onValueChange={(value) => value !== null && setDraftAttention(value as AdminEventAttentionFilter | 'all')}
        >
          <SelectTrigger className="h-10 w-full">
            <SelectValue placeholder={t('Attention')} />
          </SelectTrigger>
          <SelectContent align="start" className="py-1">
            <SelectItem value="all" className="mx-1 my-0.5 cursor-pointer rounded-md">
              {t('All events')}
            </SelectItem>
            <SelectItem value="missing-sports-id" className="mx-1 my-0.5 cursor-pointer rounded-md">
              {t('Events without a sports ID')}
            </SelectItem>
            <SelectItem value="past-due-unresolved" className="mx-1 my-0.5 cursor-pointer rounded-md">
              {t('Events awaiting resolution')}
            </SelectItem>
            <SelectItem value="resolution-reports" className="mx-1 my-0.5 cursor-pointer rounded-md">
              {t('Events with resolution reports')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label>{t('Main category')}</Label>
        <Select
          items={[
            { label: t('All categories'), value: 'all' },
            ...mainCategoryOptions.map((category) => ({ label: category.name, value: category.slug })),
          ]}
          value={draftMainCategorySlug}
          onValueChange={(value) => value !== null && setDraftMainCategorySlug(value)}
        >
          <SelectTrigger className="h-10 w-full">
            <SelectValue placeholder={t('Main category')} />
          </SelectTrigger>
          <SelectContent align="start" className="py-1">
            <SelectItem value="all" className="mx-1 my-0.5 cursor-pointer rounded-md">
              {t('All categories')}
            </SelectItem>
            {mainCategoryOptions.map((category) => (
              <SelectItem key={category.slug} value={category.slug} className="mx-1 my-0.5 cursor-pointer rounded-md">
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {creatorOptions.length > 1 && (
        <div className="grid gap-2">
          <Label>{t('Creator')}</Label>
          <Select
            items={[
              { label: t('All creators'), value: 'all' },
              ...creatorOptions.map((creatorWallet) => ({ label: creatorWallet, value: creatorWallet })),
            ]}
            value={draftCreator}
            onValueChange={(value) => value !== null && setDraftCreator(value)}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder={t('Creator')} />
            </SelectTrigger>
            <SelectContent align="start" className="py-1">
              <SelectItem value="all" className="mx-1 my-0.5 cursor-pointer rounded-md">
                {t('All creators')}
              </SelectItem>
              {creatorOptions.map((creatorWallet) => (
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
          <Select
            items={[
              { label: t('All series'), value: 'all' },
              ...seriesOptions.map((seriesOption) => ({ label: seriesOption, value: seriesOption })),
            ]}
            value={draftSeriesSlug}
            onValueChange={(value) => value !== null && setDraftSeriesSlug(value)}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder={t('Series')} />
            </SelectTrigger>
            <SelectContent align="start" className="py-1">
              <SelectItem value="all" className="mx-1 my-0.5 cursor-pointer rounded-md">
                {t('All series')}
              </SelectItem>
              {seriesOptions.map((seriesOption) => (
                <SelectItem key={seriesOption} value={seriesOption} className="mx-1 my-0.5 cursor-pointer rounded-md">
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
        <Label htmlFor="event-livestream-url">{t('Livestream URL')}</Label>
        <Input
          id="event-livestream-url"
          type="url"
          placeholder="https://example.com/live"
          value={livestreamUrlValue}
          onChange={(event) => setLivestreamUrlValue(event.target.value)}
          disabled={isSavingLivestream}
        />
        {livestreamEvent && <p className="text-xs text-muted-foreground">{livestreamEvent.title}</p>}
      </div>
      {livestreamError && <InputError message={livestreamError} />}
    </div>
  )

  const additionalContextFormFields = (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2">
        <Label htmlFor="event-additional-context">{t('Additional Context')}</Label>
        <Textarea
          id="event-additional-context"
          placeholder={t('Write the additional context shown in Rules for this event.')}
          value={additionalContextValue}
          onChange={(event) => setAdditionalContextValue(event.target.value)}
          disabled={isSavingAdditionalContext}
          className="min-h-28"
        />
        {additionalContextEvent && <p className="text-sm text-muted-foreground">{additionalContextEvent.title}</p>}
      </div>
      {additionalContextError && <InputError message={additionalContextError} />}
    </div>
  )

  const sportsFinalFormFields = (
    <div className="grid gap-4 py-2">
      {sportsFinalTeams ? (
        <div className="rounded-xl border bg-muted/10 px-3 py-4 sm:px-4">
          <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_auto_3.5rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_4rem_auto_4rem_minmax(0,1fr)] sm:gap-3">
            <div className="flex min-w-0 flex-col items-center gap-2 text-center">
              <div className="flex size-12 items-center justify-center sm:size-14">
                {sportsFinalTeams.home.logoUrl ? (
                  <EventIconImage
                    src={sportsFinalTeams.home.logoUrl}
                    alt={sportsFinalTeams.home.name}
                    sizes="56px"
                    containerClassName="size-full rounded-md"
                    imageClassName="object-contain"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-sm font-semibold text-muted-foreground">
                    {sportsFinalTeams.home.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="line-clamp-2 w-full text-xs leading-tight font-medium break-words sm:text-sm">
                {sportsFinalTeams.home.name}
              </span>
            </div>

            <Input
              id="event-sports-score-home"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              placeholder="0"
              aria-label={`${sportsFinalTeams.home.name} ${t('Score')}`}
              value={sportsScoreHomeValue}
              onChange={(event) => setSportsScoreHomeValue(event.target.value)}
              disabled={isSavingSportsFinal}
              className="h-12 [appearance:textfield] px-1 text-center text-lg font-semibold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />

            <span className="text-base font-semibold text-muted-foreground" aria-hidden="true">
              ×
            </span>

            <Input
              id="event-sports-score-away"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              placeholder="0"
              aria-label={`${sportsFinalTeams.away.name} ${t('Score')}`}
              value={sportsScoreAwayValue}
              onChange={(event) => setSportsScoreAwayValue(event.target.value)}
              disabled={isSavingSportsFinal}
              className="h-12 [appearance:textfield] px-1 text-center text-lg font-semibold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />

            <div className="flex min-w-0 flex-col items-center gap-2 text-center">
              <div className="flex size-12 items-center justify-center sm:size-14">
                {sportsFinalTeams.away.logoUrl ? (
                  <EventIconImage
                    src={sportsFinalTeams.away.logoUrl}
                    alt={sportsFinalTeams.away.name}
                    sizes="56px"
                    containerClassName="size-full rounded-md"
                    imageClassName="object-contain"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-sm font-semibold text-muted-foreground">
                    {sportsFinalTeams.away.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="line-clamp-2 w-full text-xs leading-tight font-medium break-words sm:text-sm">
                {sportsFinalTeams.away.name}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <details
        className="overflow-hidden rounded-lg border border-border bg-muted/10"
        open={sportsSourceDetailsOpen}
        onToggle={(event) => setSportsSourceDetailsOpen(event.currentTarget.open)}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span className="truncate">{sportsSourceSummary}</span>
          <ChevronDownIcon
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
              sportsSourceDetailsOpen && 'rotate-180',
            )}
          />
        </summary>

        <div className="grid gap-3 border-t border-border/50 p-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={sportsSourceSearchQuery}
              onChange={(event) => setSportsSourceSearchQuery(event.target.value)}
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
              {isSearchingSportsSource ? <Spinner className="size-4" /> : <SearchIcon className="size-4" />}
              <span>{t('Search')}</span>
            </Button>
            {hasSportsSourceIdentity ? (
              <Button
                type="button"
                variant="outline"
                onClick={clearSportsSourceCandidate}
                disabled={isSavingSportsFinal}
              >
                {t('Clear')}
              </Button>
            ) : null}
          </div>

          {sportsSourceSearchError && <InputError message={sportsSourceSearchError} />}

          {sportsSourceCandidates.length > 0 ? (
            <div className="grid gap-2">
              {sportsSourceCandidates.map((candidate) => (
                <button
                  key={`${candidate.provider}:${candidate.eventId}:${candidate.gameId ?? ''}`}
                  type="button"
                  className={cn(
                    `flex min-w-0 items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-left text-sm transition hover:border-primary/60`,
                  )}
                  onClick={() => applySportsSourceCandidate(candidate)}
                  disabled={isSavingSportsFinal}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{formatSportsSourceCandidateName(candidate)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatSportsSourceCandidateMeta(candidate)}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {Math.round((candidate.confidence ?? 0) * 100)}%
                  </span>
                </button>
              ))}
            </div>
          ) : hasSearchedSportsSource && !sportsSourceSearchError ? (
            <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
              {t('No results found')}
            </p>
          ) : null}

          {sportsSourceLivestreamUrlValue ? (
            <p className="truncate text-xs text-muted-foreground">
              {t('Livestream URL')}
              {': '}
              {sportsSourceLivestreamUrlValue}
            </p>
          ) : null}

          {sportsFinalEvent?.sports_vertical !== 'esports' ? (
            <div className="space-y-1.5 border-t border-border/50 pt-3">
              <Label htmlFor="event-sports-source-event-id">{t('Event ID')}</Label>
              <Input
                id="event-sports-source-event-id"
                value={sportsSourceEventIdValue}
                onChange={(event) => {
                  const eventId = event.target.value
                  clearSportsSourceCandidate()
                  setSportsSourceProviderValue(eventId.trim() ? 'thesportsdb' : '')
                  setSportsSourceEventIdValue(eventId)
                }}
                disabled={isSavingSportsFinal}
                inputMode="numeric"
              />
              <p className="text-xs text-muted-foreground">
                {t.rich(
                  'Can’t find the event? Search for it on <link>TheSportsDB</link>, open the event page, and paste the numeric ID from the URL here.',
                  {
                    link: (chunks) => (
                      <a
                        href="https://www.thesportsdb.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-foreground underline underline-offset-4"
                      >
                        {chunks}
                      </a>
                    ),
                  },
                )}
              </p>
            </div>
          ) : null}
        </div>
      </details>

      {sportsFinalError && <InputError message={sportsFinalError} />}
    </div>
  )

  const sportsFinalFooter = (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Switch
          id="event-sports-ended"
          checked={sportsEndedValue}
          onCheckedChange={setSportsEndedValue}
          disabled={isSavingSportsFinal}
        />
        <Label htmlFor="event-sports-ended" className="whitespace-nowrap">
          {t('Match ended')}
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={handleCloseSportsFinalModal} disabled={isSavingSportsFinal}>
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
      </div>
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
        emptyAction={
          tableState.attention !== 'all' ? (
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              render={<Link href="/admin/events">{t('Clear filters')}</Link>}
            />
          ) : null
        }
        search={search}
        onSearchChange={handleSearchChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        toolbarLeftContent={
          <div className="flex items-center gap-3">
            {filtersButton}
            {onlyActiveControl}
            {hideCryptoControl}
          </div>
        }
        toolbarRightContent={
          <div className="flex items-center gap-2">
            {createEventButton}
            {settingsButton}
          </div>
        }
        searchInputClassName="h-9 sm:w-37.5 lg:w-62.5"
        searchLeadingIcon={<SearchIcon className="size-4" />}
      />

      <AdminResolutionReportsDialog event={resolutionReportsEvent} onClose={() => setResolutionReportsEvent(null)} />

      {isMobile ? (
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
      ) : (
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

      {isMobile ? (
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
      ) : (
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

      {isMobile ? (
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
                <DrawerTitle>{t('Add Additional Context')}</DrawerTitle>
                <DrawerDescription>
                  {t('Configure the additional context shown in Rules for this event. Leave empty to remove it.')}
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
      ) : (
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
              <DialogTitle>{t('Add Additional Context')}</DialogTitle>
              <DialogDescription>
                {t('Configure the additional context shown in Rules for this event. Leave empty to remove it.')}
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

      {isMobile ? (
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
      ) : (
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

      {isMobile ? (
        <Drawer
          open={Boolean(sportsFinalEvent)}
          onOpenChange={(open) => {
            if (open) {
              return
            }
            handleCloseSportsFinalModal()
          }}
        >
          <DrawerContent className="max-h-[90vh] w-full overflow-x-hidden overflow-y-auto bg-background px-4 pt-4 pb-6">
            <div className="grid gap-4">
              <DrawerHeader className="min-w-0 space-y-2 p-0 text-left">
                <DrawerTitle>{t('Match score')}</DrawerTitle>
                {sportsFinalEventSummary}
              </DrawerHeader>
              {sportsFinalFormFields}
              <DrawerFooter className="mt-2 border-t border-border/50 p-0 pt-4">{sportsFinalFooter}</DrawerFooter>
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog
          open={Boolean(sportsFinalEvent)}
          onOpenChange={(open) => {
            if (open) {
              return
            }
            handleCloseSportsFinalModal()
          }}
        >
          <DialogContent className="max-h-[90vh] min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-xl">
            <DialogHeader className="min-w-0">
              <DialogTitle>{t('Match score')}</DialogTitle>
              {sportsFinalEventSummary}
            </DialogHeader>
            {sportsFinalFormFields}
            <DialogFooter className="border-t border-border/50 pt-4">{sportsFinalFooter}</DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
