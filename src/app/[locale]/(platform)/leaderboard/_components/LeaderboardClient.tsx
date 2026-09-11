'use client'

import type { Route } from 'next'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type { LeaderboardFilters } from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFilters'

import BiggestWinsSidebar from '@/app/[locale]/(platform)/leaderboard/_components/BiggestWinsSidebar'
import LeaderboardFiltersBar from '@/app/[locale]/(platform)/leaderboard/_components/LeaderboardFiltersBar'
import LeaderboardListRow from '@/app/[locale]/(platform)/leaderboard/_components/LeaderboardListRow'
import LeaderboardPagination from '@/app/[locale]/(platform)/leaderboard/_components/LeaderboardPagination'
import { LeaderboardListSkeleton } from '@/app/[locale]/(platform)/leaderboard/_components/LeaderboardSkeletons'
import PinnedUserRow from '@/app/[locale]/(platform)/leaderboard/_components/PinnedUserRow'
import {
  buildFiltersKey,
  buildLeaderboardScopeKey,
  fetchBiggestWins,
  fetchLeaderboardEntries,
  fetchLeaderboardUserEntry,
  LEADERBOARD_GC_TIME,
  LEADERBOARD_STALE_TIME,
  PAGE_SIZE,
  normalizeWalletAddress,
  resolveLeaderboardApiUrl,
  resolveLeaderboardProxyWallet,
} from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardApi'
import {
  buildLeaderboardPath,
  resolveCategoryApiValue,
  resolvePeriodApiValue,
} from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFilters'
import {
  formatSignedCurrency,
  formatVolumeCurrency,
  getMedalProps,
} from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFormatters'
import {
  LEADERBOARD_LAYOUT_CLASS_NAME,
  LEADERBOARD_ROW_CLASS_NAME,
} from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardStyles'
import { useLeaderboardTranslations } from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardTranslations'
import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
import { useRouter } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

export default function LeaderboardClient({ initialFilters }: { initialFilters: LeaderboardFilters }) {
  const {
    translateCategory,
    translateLeaderboardError,
    translateLeaderboardTitle,
    translatePeriodQualifier,
    translateTryAgain,
  } = useLeaderboardTranslations()
  const router = useRouter()
  const user = useUser()
  const { dataUrl } = usePublicRuntimeConfig()
  const leaderboardApiUrl = useMemo(() => resolveLeaderboardApiUrl(dataUrl), [dataUrl])
  const initialFiltersKey = buildFiltersKey(initialFilters)
  const [filtersState, setFiltersState] = useState<{ key: string; value: LeaderboardFilters }>(() => ({
    key: initialFiltersKey,
    value: initialFilters,
  }))
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const filters = filtersState.key === initialFiltersKey ? filtersState.value : initialFilters
  const leaderboardScopeKey = buildLeaderboardScopeKey(filters, searchQuery)
  const [pageState, setPageState] = useState<{ key: string; value: number }>({
    key: leaderboardScopeKey,
    value: 1,
  })
  const page = pageState.key === leaderboardScopeKey ? pageState.value : 1
  const userAddress = useMemo(
    () => (user?.deposit_wallet_address ?? user?.address ?? '').trim(),
    [user?.address, user?.deposit_wallet_address],
  )
  const currentFilters = useMemo<LeaderboardFilters>(
    () => ({
      category: filters.category,
      period: filters.period,
      order: filters.order,
    }),
    [filters.category, filters.period, filters.order],
  )

  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard', leaderboardApiUrl, leaderboardScopeKey, page],
    queryFn: ({ signal }) => fetchLeaderboardEntries(leaderboardApiUrl, currentFilters, searchQuery, page, signal),
    enabled: Boolean(leaderboardApiUrl),
    staleTime: LEADERBOARD_STALE_TIME,
    gcTime: LEADERBOARD_GC_TIME,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  })

  const hasLeaderboardError = leaderboardQuery.isError
  const baseEntries = leaderboardQuery.data
  const entries = useMemo(
    () => (hasLeaderboardError ? [] : (baseEntries ?? []).slice(0, PAGE_SIZE)),
    [baseEntries, hasLeaderboardError],
  )
  const isLoading = !hasLeaderboardError && (leaderboardQuery.isPending || leaderboardQuery.isPlaceholderData)
  const hasNextPage = !isLoading && !hasLeaderboardError && (baseEntries?.length ?? 0) > PAGE_SIZE
  const hasPaginationItems = !isLoading && (entries.length > 0 || (hasLeaderboardError && page > 1))

  const userEntryQuery = useQuery({
    queryKey: ['leaderboard-user', leaderboardApiUrl, userAddress, filters.category, filters.period, filters.order],
    queryFn: ({ signal }) => fetchLeaderboardUserEntry(leaderboardApiUrl, currentFilters, userAddress, signal),
    enabled: Boolean(leaderboardApiUrl && userAddress),
    staleTime: LEADERBOARD_STALE_TIME,
    gcTime: LEADERBOARD_GC_TIME,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  })

  const userEntry = userEntryQuery.isPlaceholderData ? null : (userEntryQuery.data ?? null)

  const biggestWinsCategory = resolveCategoryApiValue(filters.category)
  const biggestWinsPeriod = resolvePeriodApiValue(filters.period)
  const biggestWinsQuery = useQuery({
    queryKey: ['leaderboard-biggest-wins', leaderboardApiUrl, biggestWinsCategory, biggestWinsPeriod],
    queryFn: ({ signal }) => fetchBiggestWins(leaderboardApiUrl, biggestWinsCategory, biggestWinsPeriod, signal),
    enabled: Boolean(leaderboardApiUrl),
    staleTime: LEADERBOARD_STALE_TIME,
    gcTime: LEADERBOARD_GC_TIME,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  })

  const biggestWins = biggestWinsQuery.data ?? []
  const isBiggestWinsLoading = biggestWinsQuery.isPending || biggestWinsQuery.isPlaceholderData

  useEffect(
    function debounceSearchInput() {
      const timeoutId = window.setTimeout(() => {
        setSearchQuery(searchInput.trim())
      }, 300)

      return function cleanupDebounce() {
        window.clearTimeout(timeoutId)
      }
    },
    [searchInput],
  )

  const categoryLabel = useMemo(() => translateCategory(filters.category), [filters.category, translateCategory])

  function updateFilters(next: LeaderboardFilters) {
    setFiltersState({
      key: initialFiltersKey,
      value: next,
    })
    const nextPath = buildLeaderboardPath(next) as Route
    router.push(nextPath)
  }

  const profitColumnClass = cn(
    'text-right tabular-nums',
    filters.order === 'profit' ? 'text-base font-semibold text-foreground' : 'text-sm text-muted-foreground',
  )
  const volumeColumnClass = cn(
    'text-right tabular-nums',
    filters.order === 'volume' ? 'text-base font-semibold text-foreground' : 'text-sm text-muted-foreground',
  )

  const biggestWinsPeriodLabel = useMemo(() => {
    switch (filters.period) {
      case 'today':
        return translatePeriodQualifier('today')
      case 'weekly':
        return translatePeriodQualifier('weekly')
      case 'monthly':
        return translatePeriodQualifier('monthly')
      case 'all':
        return translatePeriodQualifier('all')
      default:
        return translatePeriodQualifier('monthly')
    }
  }, [filters.period, translatePeriodQualifier])

  const pinnedEntry = useMemo(() => {
    if (!userAddress || hasLeaderboardError) {
      return null
    }

    const normalizedUserAddress = normalizeWalletAddress(userAddress)
    const visibleEntry = leaderboardQuery.isPlaceholderData
      ? undefined
      : entries.find((entry) => {
          return normalizeWalletAddress(resolveLeaderboardProxyWallet(entry)) === normalizedUserAddress
        })
    const sourceEntry = visibleEntry ?? userEntry
    const address = resolveLeaderboardProxyWallet(sourceEntry) || userAddress
    const rawUsername = sourceEntry?.userName || sourceEntry?.xUsername || user?.username || ''
    const username = rawUsername || address
    const rank = visibleEntry?.rank ?? userEntry?.rank
    const rankNumber = Number(rank ?? Number.NaN)
    const { medalSrc, medalAlt } = getMedalProps(rankNumber)

    return {
      rank: rank ?? '\u2014',
      address,
      username,
      profileImage: sourceEntry?.profileImage || user?.image || '',
      pnl: sourceEntry?.pnl,
      vol: sourceEntry?.vol,
      medalSrc,
      medalAlt,
    }
  }, [
    entries,
    hasLeaderboardError,
    leaderboardQuery.isPlaceholderData,
    userAddress,
    userEntry,
    user?.image,
    user?.username,
  ])

  const setPageValue = useCallback(
    (nextPage: number | ((currentPage: number) => number)) => {
      setPageState((currentState) => {
        const currentPage = currentState.key === leaderboardScopeKey ? currentState.value : 1
        const resolvedPage = typeof nextPage === 'function' ? nextPage(currentPage) : nextPage
        return {
          key: leaderboardScopeKey,
          value: Math.max(1, resolvedPage),
        }
      })
    },
    [leaderboardScopeKey],
  )

  /* oxlint-disable react/set-state-in-effect, react-you-might-not-need-an-effect/no-event-handler */
  useEffect(
    function returnToPreviousLeaderboardPageWhenCurrentPageIsEmpty() {
      if (!isLoading && !hasLeaderboardError && page > 1 && entries.length === 0) {
        // The empty response is the server-derived pagination boundary.
        setPageValue(page - 1)
      }
    },
    [entries.length, hasLeaderboardError, isLoading, page, setPageValue],
  )
  /* oxlint-enable react/set-state-in-effect, react-you-might-not-need-an-effect/no-event-handler */

  const pinnedProfitValue = pinnedEntry?.pnl
  const pinnedVolumeValue = pinnedEntry?.vol
  const pinnedProfitLabel = Number.isFinite(pinnedProfitValue)
    ? formatSignedCurrency(Number(pinnedProfitValue))
    : '\u2014'
  const pinnedVolumeLabel = Number.isFinite(pinnedVolumeValue)
    ? formatVolumeCurrency(Number(pinnedVolumeValue))
    : '\u2014'
  const pinnedMobileLabel = filters.order === 'profit' ? pinnedProfitLabel : pinnedVolumeLabel
  const pinnedMobileClass = filters.order === 'profit' ? profitColumnClass : volumeColumnClass

  const listContainerClassName = 'divide-y divide-border/80'
  const listWrapperClassName = 'flex min-w-0 flex-col'

  return (
    <div className="relative w-full">
      <div className={LEADERBOARD_LAYOUT_CLASS_NAME}>
        <section className="flex min-w-0 flex-col gap-6">
          <h1 className="text-2xl font-semibold text-foreground md:text-3xl">{translateLeaderboardTitle()}</h1>

          <div className={listWrapperClassName}>
            <LeaderboardFiltersBar
              filters={filters}
              categoryLabel={categoryLabel}
              searchInput={searchInput}
              onSearchInputChange={setSearchInput}
              onUpdateFilters={updateFilters}
            />
            <div className={listContainerClassName}>
              {isLoading && <LeaderboardListSkeleton count={10} rowClassName={LEADERBOARD_ROW_CLASS_NAME} />}

              {hasLeaderboardError && (
                <div className="flex flex-col items-center gap-3 py-8 text-center" role="alert">
                  <p className="text-sm text-muted-foreground">{translateLeaderboardError()}</p>
                  <button
                    type="button"
                    className="text-sm font-medium text-primary hover:underline"
                    onClick={() => void leaderboardQuery.refetch()}
                  >
                    {translateTryAgain()}
                  </button>
                </div>
              )}

              {!isLoading &&
                entries.map((entry, index) => {
                  const rowKey = [
                    resolveLeaderboardProxyWallet(entry) || entry.userName || entry.xUsername || '',
                    entry.rank ?? index + 1,
                  ].join('-')
                  return (
                    <LeaderboardListRow
                      key={rowKey}
                      entry={entry}
                      index={index}
                      filters={filters}
                      rowClassName={LEADERBOARD_ROW_CLASS_NAME}
                      profitColumnClass={profitColumnClass}
                      volumeColumnClass={volumeColumnClass}
                    />
                  )
                })}
            </div>
            {pinnedEntry && (
              <PinnedUserRow
                pinnedEntry={pinnedEntry}
                pinnedProfitLabel={pinnedProfitLabel}
                pinnedVolumeLabel={pinnedVolumeLabel}
                pinnedMobileLabel={pinnedMobileLabel}
                pinnedMobileClass={pinnedMobileClass}
                profitColumnClass={profitColumnClass}
                volumeColumnClass={volumeColumnClass}
              />
            )}
            <LeaderboardPagination
              hasItems={hasPaginationItems}
              hasNextPage={hasNextPage}
              page={page}
              setPageValue={setPageValue}
            />
          </div>
        </section>

        <BiggestWinsSidebar
          biggestWins={biggestWins}
          isBiggestWinsLoading={isBiggestWinsLoading}
          biggestWinsPeriodLabel={biggestWinsPeriodLabel}
        />
      </div>
    </div>
  )
}
