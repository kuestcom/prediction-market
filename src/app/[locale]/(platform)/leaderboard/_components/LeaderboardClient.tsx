'use client'

import type { Route } from 'next'
import type { LeaderboardFilters } from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFilters'
import type { BiggestWinEntry, LeaderboardEntry } from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardTypes'
import { useEffect, useMemo, useReducer, useState } from 'react'
import BiggestWinsSidebar from '@/app/[locale]/(platform)/leaderboard/_components/BiggestWinsSidebar'
import LeaderboardFiltersBar from '@/app/[locale]/(platform)/leaderboard/_components/LeaderboardFiltersBar'
import LeaderboardListRow from '@/app/[locale]/(platform)/leaderboard/_components/LeaderboardListRow'
import LeaderboardPagination from '@/app/[locale]/(platform)/leaderboard/_components/LeaderboardPagination'
import { LeaderboardListSkeleton } from '@/app/[locale]/(platform)/leaderboard/_components/LeaderboardSkeletons'
import PinnedUserRow from '@/app/[locale]/(platform)/leaderboard/_components/PinnedUserRow'
import {
  BIGGEST_WINS_CACHE,
  BIGGEST_WINS_IN_FLIGHT,
  buildFiltersKey,
  buildLeaderboardScopeKey,
  fetchBiggestWins,
  hydrateEntriesWithPortfolioPnl,
  LEADERBOARD_API_URL,
  LIST_ROW_COLUMNS,
  normalizeLeaderboardResponse,
  normalizeWalletAddress,
  PAGE_SIZE,
  sortEntriesForDisplay,
} from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardApi'
import {
  buildLeaderboardPath,
  CATEGORY_OPTIONS,
  resolveCategoryApiValue,
  resolveOrderApiValue,
  resolvePeriodApiValue,
} from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFilters'
import {
  formatSignedCurrency,
  formatVolumeCurrency,
  getMedalProps,
} from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFormatters'
import { useRouter } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

export default function LeaderboardClient({ initialFilters }: { initialFilters: LeaderboardFilters }) {
  const router = useRouter()
  const user = useUser()
  const initialFiltersKey = buildFiltersKey(initialFilters)
  const [filtersState, setFiltersState] = useState<{ key: string, value: LeaderboardFilters }>(() => ({
    key: initialFiltersKey,
    value: initialFilters,
  }))
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loadedLeaderboardKey, setLoadedLeaderboardKey] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const filters = filtersState.key === initialFiltersKey ? filtersState.value : initialFilters
  const leaderboardScopeKey = buildLeaderboardScopeKey(filters, searchQuery)
  const [pageState, setPageState] = useState<{ key: string, value: number }>({
    key: leaderboardScopeKey,
    value: 1,
  })
  const page = pageState.key === leaderboardScopeKey ? pageState.value : 1
  const leaderboardRequestKey = `${leaderboardScopeKey}:${page}`
  const isLoading = loadedLeaderboardKey !== leaderboardRequestKey
  const [userEntry, setUserEntry] = useState<LeaderboardEntry | null>(null)
  const initialBiggestWinsKey = `${resolveCategoryApiValue(initialFilters.category)}:${resolvePeriodApiValue(initialFilters.period)}`
  const initialBiggestWins = BIGGEST_WINS_CACHE.get(initialBiggestWinsKey) ?? []
  const [biggestWins, setBiggestWins] = useReducer(
    (_current: BiggestWinEntry[], next: BiggestWinEntry[]) => next,
    initialBiggestWins,
  )
  const [isBiggestWinsLoading, setIsBiggestWinsLoading] = useReducer(
    (_current: boolean, next: boolean) => next,
    !BIGGEST_WINS_CACHE.has(initialBiggestWinsKey),
  )
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

  useEffect(function debounceSearchInput() {
    const timeoutId = window.setTimeout(() => {
      setSearchQuery(searchInput.trim())
    }, 300)

    return function cleanupDebounce() {
      window.clearTimeout(timeoutId)
    }
  }, [searchInput])

  useEffect(function fetchLeaderboardEntries() {
    const controller = new AbortController()

    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
      category: resolveCategoryApiValue(filters.category),
      timePeriod: resolvePeriodApiValue(filters.period),
      orderBy: resolveOrderApiValue(filters.order),
    })
    if (searchQuery) {
      params.set('userName', searchQuery)
    }

    fetch(`${LEADERBOARD_API_URL}/leaderboard?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const errorBody = await response.json().catch(() => null)
          throw new Error(errorBody?.error || 'Failed to load leaderboard.')
        }
        return response.json()
      })
      .then(async (result) => {
        const normalized = normalizeLeaderboardResponse(result)
        const hydrated = await hydrateEntriesWithPortfolioPnl(normalized, currentFilters, controller.signal)
        if (controller.signal.aborted) {
          return
        }
        setEntries(sortEntriesForDisplay(hydrated, currentFilters, page))
      })
      .catch((_error) => {
        if (controller.signal.aborted) {
          return
        }
        setEntries([])
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadedLeaderboardKey(leaderboardRequestKey)
        }
      })

    return function cleanupFetchLeaderboard() {
      controller.abort()
    }
  }, [filters.category, filters.period, filters.order, searchQuery, page, leaderboardRequestKey, currentFilters])

  useEffect(function fetchUserEntry() {
    if (!userAddress) {
      return
    }

    const controller = new AbortController()

    const params = new URLSearchParams({
      limit: '1',
      offset: '0',
      category: resolveCategoryApiValue(filters.category),
      timePeriod: resolvePeriodApiValue(filters.period),
      orderBy: resolveOrderApiValue(filters.order),
      user: userAddress,
    })

    fetch(`${LEADERBOARD_API_URL}/leaderboard?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const errorBody = await response.json().catch(() => null)
          throw new Error(errorBody?.error || 'Failed to load leaderboard user entry.')
        }
        return response.json()
      })
      .then(async (result) => {
        const [entry] = normalizeLeaderboardResponse(result)
        if (!entry) {
          setUserEntry(null)
          return
        }

        const [hydrated] = await hydrateEntriesWithPortfolioPnl([entry], currentFilters, controller.signal)
        if (controller.signal.aborted) {
          return
        }
        setUserEntry(hydrated ?? entry)
      })
      .catch((_error) => {
        if (controller.signal.aborted) {
          return
        }
        setUserEntry(null)
      })

    return function cleanupFetchUserEntry() {
      controller.abort()
    }
  }, [filters.category, filters.period, filters.order, userAddress, currentFilters])

  useEffect(function fetchBiggestWinsData() {
    const category = resolveCategoryApiValue(filters.category)
    const period = resolvePeriodApiValue(filters.period)
    const cacheKey = `${category}:${period}`
    const cached = BIGGEST_WINS_CACHE.get(cacheKey)
    if (cached) {
      setBiggestWins(cached)
      setIsBiggestWinsLoading(false)
      return
    }

    let isActive = true
    setIsBiggestWinsLoading(true)

    const existing = BIGGEST_WINS_IN_FLIGHT.get(cacheKey)
    const request = existing ?? fetchBiggestWins(category, period)

    if (!existing) {
      BIGGEST_WINS_IN_FLIGHT.set(cacheKey, request)
    }

    request
      .then((result) => {
        BIGGEST_WINS_CACHE.set(cacheKey, result)
        if (isActive) {
          setBiggestWins(result)
        }
      })
      .catch(() => {
        if (isActive) {
          setBiggestWins([])
        }
      })
      .finally(() => {
        BIGGEST_WINS_IN_FLIGHT.delete(cacheKey)
        if (isActive) {
          setIsBiggestWinsLoading(false)
        }
      })

    return function cleanupFetchBiggestWins() {
      isActive = false
    }
  }, [filters.category, filters.period])

  const categoryLabel = useMemo(
    () => CATEGORY_OPTIONS.find(option => option.value === filters.category)?.label ?? 'All Categories',
    [filters.category],
  )

  function updateFilters(next: LeaderboardFilters) {
    setFiltersState({
      key: initialFiltersKey,
      value: next,
    })
    const nextPath = buildLeaderboardPath(next) as Route
    router.push(nextPath)
  }

  function setPageValue(nextPage: number | ((currentPage: number) => number)) {
    setPageState((currentState) => {
      const currentPage = currentState.key === leaderboardScopeKey ? currentState.value : 1
      const resolvedPage = typeof nextPage === 'function' ? nextPage(currentPage) : nextPage
      return {
        key: leaderboardScopeKey,
        value: Math.max(1, resolvedPage),
      }
    })
  }

  const rowClassName = cn(
    `
      group relative z-0 grid w-full ${LIST_ROW_COLUMNS}
      min-h-[82px] items-center gap-4 py-5 pr-2 pl-3 text-sm
      before:pointer-events-none before:absolute before:-inset-x-3 before:inset-y-0 before:-z-10 before:rounded-lg
      before:bg-black/5 before:opacity-0 before:transition-opacity before:duration-200 before:content-['']
      hover:before:opacity-100
      dark:before:bg-white/5
    `,
  )

  const profitColumnClass = cn(
    'text-right tabular-nums',
    filters.order === 'profit'
      ? 'text-base font-semibold text-foreground'
      : 'text-sm text-muted-foreground',
  )
  const volumeColumnClass = cn(
    'text-right tabular-nums',
    filters.order === 'volume'
      ? 'text-base font-semibold text-foreground'
      : 'text-sm text-muted-foreground',
  )

  const biggestWinsPeriodLabel = useMemo(() => {
    switch (filters.period) {
      case 'today':
        return 'today'
      case 'weekly':
        return 'this week'
      case 'monthly':
        return 'this month'
      case 'all':
        return 'all time'
      default:
        return 'this month'
    }
  }, [filters.period])

  const pinnedEntry = useMemo(() => {
    if (!userAddress) {
      return null
    }

    const normalizedUserAddress = normalizeWalletAddress(userAddress)
    const visibleEntry = entries.find(entry => normalizeWalletAddress(entry.proxyWallet) === normalizedUserAddress)
    const sourceEntry = visibleEntry ?? userEntry
    const address = sourceEntry?.proxyWallet || userAddress
    const rawUsername = sourceEntry?.userName || sourceEntry?.xUsername || user?.username || ''
    const username = rawUsername || address
    const rankNumber = Number(sourceEntry?.rank ?? Number.NaN)
    const { medalSrc, medalAlt } = getMedalProps(rankNumber)

    return {
      rank: sourceEntry?.rank ?? '\u2014',
      address,
      username,
      profileImage: sourceEntry?.profileImage || user?.image || '',
      pnl: sourceEntry?.pnl,
      vol: sourceEntry?.vol,
      medalSrc,
      medalAlt,
    }
  }, [entries, userAddress, userEntry, user?.image, user?.username])

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
      <div className={`
        grid w-full gap-8
        lg:grid-cols-[minmax(0,1fr)_380px]
        xl:grid-cols-[minmax(0,54.5rem)_23.75rem] xl:justify-between xl:gap-6
      `}
      >
        <section className="flex min-w-0 flex-col gap-6">
          <h1 className="text-2xl font-semibold text-foreground md:text-3xl">Leaderboard</h1>

          <div className={listWrapperClassName}>
            <LeaderboardFiltersBar
              filters={filters}
              categoryLabel={categoryLabel}
              searchInput={searchInput}
              onSearchInputChange={setSearchInput}
              onUpdateFilters={updateFilters}
            />
            <div className={listContainerClassName}>
              {isLoading && <LeaderboardListSkeleton count={10} rowClassName={rowClassName} />}

              {!isLoading && entries.map((entry, index) => (
                <LeaderboardListRow
                  key={`${entry.proxyWallet || entry.userName || entry.xUsername || ''}-${entry.rank ?? index + 1}`}
                  entry={entry}
                  index={index}
                  filters={filters}
                  rowClassName={rowClassName}
                  profitColumnClass={profitColumnClass}
                  volumeColumnClass={volumeColumnClass}
                />
              ))}
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
            <LeaderboardPagination page={page} setPageValue={setPageValue} />
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
