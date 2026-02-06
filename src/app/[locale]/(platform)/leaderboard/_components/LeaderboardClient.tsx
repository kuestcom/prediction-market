'use client'

import type { Route } from 'next'
import type { LeaderboardFilters } from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFilters'
import { ChevronLeftIcon, ChevronRightIcon, MoveRightIcon, SearchIcon } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import {
  buildLeaderboardPath,
  CATEGORY_OPTIONS,
  ORDER_OPTIONS,
  PERIOD_OPTIONS,
  resolveCategoryApiValue,
  resolveOrderApiValue,
  resolvePeriodApiValue,
} from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFilters'
import ProfileLink from '@/components/ProfileLink'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Link, useRouter } from '@/i18n/navigation'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

interface LeaderboardEntry {
  rank?: number | string
  proxyWallet?: string
  userName?: string
  vol?: number
  pnl?: number
  profileImage?: string
  xUsername?: string
  verifiedBadge?: boolean
}

interface BiggestWinEntry {
  rank?: number | string
  winRank?: number | string
  proxyWallet?: string
  userName?: string
  profileImage?: string
  xUsername?: string
  eventTitle?: string
  eventSlug?: string
  marketSlug?: string
  amountIn?: number
  amountOut?: number
  [key: string]: unknown
}

const DATA_API_URL = process.env.DATA_URL!
const LEADERBOARD_API_URL = DATA_API_URL.endsWith('/v1') ? DATA_API_URL : `${DATA_API_URL}/v1`
const PAGE_SIZE = 20
const BIGGEST_WINS_CACHE = new Map<string, BiggestWinEntry[]>()
const BIGGEST_WINS_IN_FLIGHT = new Map<string, Promise<BiggestWinEntry[]>>()

async function fetchBiggestWins(category: string, period: string) {
  const params = new URLSearchParams({
    limit: '20',
    offset: '0',
    category,
    timePeriod: period,
  })

  const response = await fetch(`${LEADERBOARD_API_URL}/biggest-winners?${params.toString()}`)
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.error || 'Failed to load biggest winners.')
  }
  const result_2 = await response.json()
  return normalizeBiggestWinsResponse(result_2)
}

const LIST_ROW_COLUMNS = 'grid-cols-[minmax(0,1fr)_7.5rem] md:grid-cols-[minmax(0,1fr)_7.5rem_7.5rem]'

function normalizeLeaderboardResponse(payload: unknown): LeaderboardEntry[] {
  if (Array.isArray(payload)) {
    return payload as LeaderboardEntry[]
  }

  if (!payload || typeof payload !== 'object') {
    return []
  }

  const data = (payload as { data?: unknown }).data
  if (Array.isArray(data)) {
    return data as LeaderboardEntry[]
  }

  const nested = (payload as { leaderboard?: unknown }).leaderboard
  if (Array.isArray(nested)) {
    return nested as LeaderboardEntry[]
  }

  return []
}

function normalizeBiggestWinsResponse(payload: unknown): BiggestWinEntry[] {
  if (Array.isArray(payload)) {
    return payload as BiggestWinEntry[]
  }

  if (!payload || typeof payload !== 'object') {
    return []
  }

  const data = (payload as { data?: unknown }).data
  if (Array.isArray(data)) {
    return data as BiggestWinEntry[]
  }

  const nested = (payload as { wins?: unknown }).wins
  if (Array.isArray(nested)) {
    return nested as BiggestWinEntry[]
  }

  return []
}

function getNestedValue(entry: Record<string, unknown>, path: string) {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') {
      return undefined
    }
    return (acc as Record<string, unknown>)[key]
  }, entry)
}

function resolveString(entry: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = getNestedValue(entry, path)
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }
  return ''
}

function resolveNumber(entry: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = getNestedValue(entry, path)
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }
  return undefined
}

function formatSignedCurrency(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0
  const formatted = formatCurrency(Math.abs(safeValue), { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return safeValue >= 0 ? `+${formatted}` : `-${formatted}`
}

function formatValueOrDash(value?: number) {
  if (!Number.isFinite(value)) {
    return '—'
  }
  return formatCurrency(value as number, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function LeaderboardClient({ initialFilters }: { initialFilters: LeaderboardFilters }) {
  const router = useRouter()
  const user = useUser()
  const [filters, setFilters] = useState<LeaderboardFilters>(initialFilters)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [userEntry, setUserEntry] = useState<LeaderboardEntry | null>(null)
  const initialBiggestWinsKey = `${resolveCategoryApiValue(initialFilters.category)}:${resolvePeriodApiValue(initialFilters.period)}`
  const initialBiggestWins = BIGGEST_WINS_CACHE.get(initialBiggestWinsKey) ?? []
  const [biggestWins, setBiggestWins] = useState<BiggestWinEntry[]>(initialBiggestWins)
  const [isBiggestWinsLoading, setIsBiggestWinsLoading] = useState(!BIGGEST_WINS_CACHE.has(initialBiggestWinsKey))
  const userAddress = useMemo(
    () => (user?.proxy_wallet_address ?? user?.address ?? '').trim(),
    [user?.address, user?.proxy_wallet_address],
  )

  useEffect(() => {
    setFilters(initialFilters)
  }, [initialFilters])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchQuery(searchInput.trim())
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [filters.category, filters.period, filters.order, searchQuery])

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)

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
      .then((result) => {
        setEntries(normalizeLeaderboardResponse(result))
      })
      .catch((_error) => {
        if (controller.signal.aborted) {
          return
        }
        setEntries([])
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => controller.abort()
  }, [filters.category, filters.period, filters.order, searchQuery, page])

  useEffect(() => {
    if (!userAddress) {
      setUserEntry(null)
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
      .then((result) => {
        const [entry] = normalizeLeaderboardResponse(result)
        setUserEntry(entry ?? null)
      })
      .catch((_error) => {
        if (controller.signal.aborted) {
          return
        }
        setUserEntry(null)
      })

    return () => controller.abort()
  }, [filters.category, filters.period, filters.order, userAddress])

  useEffect(() => {
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

    return () => {
      isActive = false
    }
  }, [filters.category, filters.period])

  const categoryLabel = useMemo(
    () => CATEGORY_OPTIONS.find(option => option.value === filters.category)?.label ?? 'All Categories',
    [filters.category],
  )

  function updateFilters(next: LeaderboardFilters) {
    setFilters(next)
    const nextPath = buildLeaderboardPath(next) as Route
    router.push(nextPath)
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

  function headerButtonClass(isActive: boolean) {
    return cn(
      'flex h-full items-center justify-end text-right text-sm font-medium transition-colors',
      isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
    )
  }

  function headerButtonTextClass(isActive: boolean) {
    return cn(
      'relative inline-flex w-fit items-center',
      isActive
      && 'after:absolute after:inset-x-0 after:-bottom-[calc(0.875rem-1px)] after:h-px after:bg-foreground',
    )
  }

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

  const selectedPeriod = filters.period
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

    const address = userEntry?.proxyWallet || userAddress
    const rawUsername = userEntry?.userName || userEntry?.xUsername || user?.username || ''
    const username = rawUsername || address
    const rankNumber = Number(userEntry?.rank ?? Number.NaN)
    const medalSrc = rankNumber === 1
      ? '/images/medals/gold.svg'
      : rankNumber === 2
        ? '/images/medals/silver.svg'
        : rankNumber === 3
          ? '/images/medals/bronze.svg'
          : null
    const medalAlt = rankNumber === 1
      ? 'Gold medal'
      : rankNumber === 2
        ? 'Silver medal'
        : rankNumber === 3
          ? 'Bronze medal'
          : ''

    return {
      rank: userEntry?.rank ?? '—',
      address,
      username,
      profileImage: userEntry?.profileImage || user?.image || '',
      pnl: userEntry?.pnl,
      vol: userEntry?.vol,
      medalSrc,
      medalAlt,
    }
  }, [userAddress, userEntry, user?.image, user?.username])
  const pinnedProfitValue = pinnedEntry?.pnl
  const pinnedVolumeValue = pinnedEntry?.vol
  const pinnedProfitLabel = Number.isFinite(pinnedProfitValue)
    ? formatSignedCurrency(Number(pinnedProfitValue))
    : '—'
  const pinnedVolumeLabel = Number.isFinite(pinnedVolumeValue)
    ? formatCurrency(Number(pinnedVolumeValue), { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : '—'
  const pinnedMobileLabel = filters.order === 'profit' ? pinnedProfitLabel : pinnedVolumeLabel
  const pinnedMobileClass = filters.order === 'profit' ? profitColumnClass : volumeColumnClass
  const listContainerClassName = 'divide-y divide-border/80'
  const listWrapperClassName = 'flex min-w-0 flex-col'
  const pinnedRowClassName = cn(
    `
      relative z-0 grid w-full ${LIST_ROW_COLUMNS}
      min-h-[70px] items-center gap-4 py-4 pr-2 pl-3 text-sm shadow-sm
      before:pointer-events-none before:absolute before:-inset-x-3 before:inset-y-0 before:-z-10 before:rounded-xl
      before:bg-muted before:content-['']
      dark:before:bg-muted
    `,
  )
  const pageWindowStart = Math.max(1, page - 3)
  const pageNumbers = Array.from({ length: 6 }, (_, index) => pageWindowStart + index)
  function paginationButtonClass(isActive: boolean) {
    return cn(
      'flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-medium transition-colors',
      isActive
        ? 'bg-primary text-primary-foreground'
        : 'text-foreground hover:bg-muted',
    )
  }

  function paginationChevronClass(isDisabled: boolean) {
    return cn(
      'flex size-8 items-center justify-center text-muted-foreground transition-opacity',
      isDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:text-foreground',
    )
  }

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

          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="inline-flex flex-wrap overflow-hidden rounded-lg border border-border">
                {PERIOD_OPTIONS.map((option, index) => {
                  const isActive = option.value === selectedPeriod
                  const isFirst = index === 0
                  const isLast = index === PERIOD_OPTIONS.length - 1

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateFilters({ ...filters, period: option.value })}
                      className={cn(
                        'h-10 px-4 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-muted text-foreground'
                          : 'bg-background text-muted-foreground hover:bg-muted/40',
                        !isLast && 'border-r border-border',
                        isFirst && 'rounded-l-lg',
                        isLast && 'rounded-r-lg',
                      )}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>

              <Select
                value={filters.category}
                onValueChange={value => updateFilters({ ...filters, category: value as LeaderboardFilters['category'] })}
              >
                <SelectTrigger className={`
                  h-10 min-w-40 bg-transparent px-4 text-sm font-medium text-foreground
                  hover:bg-transparent
                  data-[size=default]:h-10
                  dark:bg-transparent
                  dark:hover:bg-transparent
                `}
                >
                  <SelectValue asChild>
                    <span className="line-clamp-1">{categoryLabel}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent position="popper" align="end">
                  {CATEGORY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value} className="py-3 text-sm">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={listWrapperClassName}>
              <div className="border-t border-border/80" />
              <div
                className={cn(
                  `
                    relative grid items-center gap-4 px-3 pt-3 pb-3.5 text-sm text-muted-foreground
                    after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border/80 after:content-['']
                  `,
                  LIST_ROW_COLUMNS,
                )}
              >
                <div className="relative w-full">
                  <SearchIcon className={`
                    pointer-events-none absolute top-1/2 left-0 size-4 -translate-y-1/2 text-muted-foreground
                  `}
                  />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={event => setSearchInput(event.target.value)}
                    placeholder="Search by name"
                    aria-label="Search by name"
                    className={`
                      h-7 w-full bg-transparent pr-2 pl-6 text-sm text-foreground
                      placeholder:text-muted-foreground
                      focus:ring-0 focus:outline-none
                    `}
                  />
                </div>
                <div className="flex items-center justify-end md:hidden">
                  <Select
                    value={filters.order}
                    onValueChange={value => updateFilters({ ...filters, order: value as LeaderboardFilters['order'] })}
                  >
                    <SelectTrigger
                      className={`
                        h-7 border-0 bg-transparent px-0 text-sm font-medium text-muted-foreground shadow-none
                        hover:bg-transparent
                        data-[size=default]:h-7
                        dark:bg-transparent
                        dark:hover:bg-transparent
                      `}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" align="end">
                      {ORDER_OPTIONS.map(option => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className="py-3 text-sm data-highlighted:bg-muted data-highlighted:text-foreground"
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 hidden items-center justify-end gap-3 md:flex">
                  <button
                    type="button"
                    onClick={() => updateFilters({ ...filters, order: 'profit' })}
                    className={cn('flex-1', headerButtonClass(filters.order === 'profit'))}
                  >
                    <span className={headerButtonTextClass(filters.order === 'profit')}>
                      {ORDER_OPTIONS[0].label}
                    </span>
                  </button>
                  <span className="text-muted-foreground">|</span>
                  <button
                    type="button"
                    onClick={() => updateFilters({ ...filters, order: 'volume' })}
                    className={cn('flex-1', headerButtonClass(filters.order === 'volume'))}
                  >
                    <span className={headerButtonTextClass(filters.order === 'volume')}>
                      {ORDER_OPTIONS[1].label}
                    </span>
                  </button>
                </div>
              </div>
              <div className={listContainerClassName}>
                {isLoading && (
                  Array.from({ length: 10 }).map((_, index) => (
                    <div key={`leaderboard-skeleton-${index}`} className={rowClassName}>
                      <div className="flex min-w-0 items-center gap-5">
                        <Skeleton className="h-4 w-3 rounded-full" />
                        <div className="flex min-w-0 items-center gap-2">
                          <Skeleton className="size-10 rounded-full" />
                          <Skeleton className="h-4 w-44 rounded-full" />
                        </div>
                      </div>
                      <Skeleton className="ml-auto h-4 w-24 rounded-full md:hidden" />
                      <Skeleton className="ml-auto hidden h-4 w-24 rounded-full md:block" />
                      <Skeleton className="ml-auto hidden h-4 w-28 rounded-full md:block" />
                    </div>
                  ))
                )}

                {!isLoading && entries.map((entry, index) => {
                  const rank = entry.rank ?? index + 1
                  const address = entry.proxyWallet || ''
                  const rawUsername = entry.userName || entry.xUsername || ''
                  const isWalletAlias = rawUsername.startsWith('0x') && rawUsername.includes('...')
                  const username = (isWalletAlias && address ? address : rawUsername) || address || ''
                  const profileSlug = address || username
                  const profileHref = profileSlug ? `/profile/${profileSlug}` : undefined
                  const profitValue = Number(entry.pnl ?? 0)
                  const volumeValue = Number(entry.vol ?? 0)
                  const profitLabel = formatSignedCurrency(profitValue)
                  const volumeLabel = formatCurrency(volumeValue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                  const mobileValueLabel = filters.order === 'profit' ? profitLabel : volumeLabel
                  const mobileValueClass = filters.order === 'profit' ? profitColumnClass : volumeColumnClass
                  const rankNumber = Number(rank)
                  const medalSrc = rankNumber === 1
                    ? '/images/medals/gold.svg'
                    : rankNumber === 2
                      ? '/images/medals/silver.svg'
                      : rankNumber === 3
                        ? '/images/medals/bronze.svg'
                        : null
                  const medalAlt = rankNumber === 1
                    ? 'Gold medal'
                    : rankNumber === 2
                      ? 'Silver medal'
                      : rankNumber === 3
                        ? 'Bronze medal'
                        : ''

                  return (
                    <div key={`${address || username}-${rank}`} className={rowClassName}>
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="w-5 shrink-0 text-sm font-semibold text-muted-foreground tabular-nums">
                          {rank}
                        </span>
                        <ProfileLink
                          user={{
                            image: entry.profileImage || '',
                            username,
                            address,
                          }}
                          profileSlug={profileSlug}
                          profileHref={profileHref}
                          layout="inline"
                          containerClassName="min-w-0 gap-3 text-base leading-tight [&_[data-avatar]]:h-10 [&_[data-avatar]]:w-10"
                          avatarSize={40}
                          avatarBadge={medalSrc
                            ? (
                                <span className="absolute -bottom-1.5 -left-2">
                                  <Image src={medalSrc} alt={medalAlt} width={24} height={24} className="size-7" />
                                </span>
                              )
                            : null}
                          usernameClassName="text-base font-semibold text-foreground underline-offset-2 hover:underline"
                          usernameMaxWidthClassName="max-w-full md:max-w-[55ch]"
                        />
                      </div>
                      <div className={cn(mobileValueClass, 'md:hidden')}>{mobileValueLabel}</div>
                      <div className={cn(profitColumnClass, 'hidden md:block')}>{profitLabel}</div>
                      <div className={cn(volumeColumnClass, 'hidden md:block')}>{volumeLabel}</div>
                    </div>
                  )
                })}
              </div>
              {pinnedEntry && (
                <div className="sticky bottom-12 z-20 mt-4">
                  <div className={pinnedRowClassName}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-5 shrink-0 text-sm font-semibold text-muted-foreground tabular-nums">
                        {pinnedEntry.rank}
                      </span>
                      <span className="h-8 w-px shrink-0 bg-border/80" aria-hidden="true" />
                      <ProfileLink
                        user={{
                          image: pinnedEntry.profileImage,
                          username: pinnedEntry.username,
                          address: pinnedEntry.address,
                        }}
                        profileSlug={pinnedEntry.address || pinnedEntry.username}
                        profileHref={pinnedEntry.address || pinnedEntry.username ? `/profile/${pinnedEntry.address || pinnedEntry.username}` : undefined}
                        layout="inline"
                        containerClassName="min-w-0 gap-3 text-base leading-tight [&_[data-avatar]]:h-10 [&_[data-avatar]]:w-10"
                        avatarSize={40}
                        avatarBadge={pinnedEntry.medalSrc
                          ? (
                              <span className="absolute -bottom-1.5 -left-2">
                                <Image
                                  src={pinnedEntry.medalSrc}
                                  alt={pinnedEntry.medalAlt}
                                  width={24}
                                  height={24}
                                  className="size-7"
                                />
                              </span>
                            )
                          : null}
                        usernameClassName="text-base font-semibold text-foreground underline-offset-2 hover:underline"
                        usernameMaxWidthClassName="max-w-full md:max-w-[55ch]"
                      />
                    </div>
                    <div className={cn(pinnedMobileClass, 'md:hidden')}>{pinnedMobileLabel}</div>
                    <div className={cn(profitColumnClass, 'hidden md:block')}>{pinnedProfitLabel}</div>
                    <div className={cn(volumeColumnClass, 'hidden md:block')}>{pinnedVolumeLabel}</div>
                  </div>
                </div>
              )}
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  className={paginationChevronClass(page === 1)}
                  disabled={page === 1}
                  aria-label="Previous page"
                >
                  <ChevronLeftIcon className="size-4" />
                </button>
                {pageNumbers.map(pageNumber => (
                  <button
                    key={`leaderboard-page-${pageNumber}`}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={paginationButtonClass(pageNumber === page)}
                    aria-current={pageNumber === page ? 'page' : undefined}
                  >
                    {pageNumber}
                  </button>
                ))}
                <span className="text-sm text-muted-foreground">…</span>
                <button
                  type="button"
                  onClick={() => setPage(prev => prev + 1)}
                  className={paginationChevronClass(false)}
                  aria-label="Next page"
                >
                  <ChevronRightIcon className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside className={`
          w-full overflow-hidden rounded-2xl border bg-background shadow-md
          lg:sticky lg:top-35 lg:h-fit lg:self-start
        `}
        >
          <div className="max-h-152 min-h-88 overflow-y-auto">
            <div className="sticky top-0 z-10 bg-background px-6 pt-6 pb-2">
              <h2 className="text-xl font-semibold text-foreground">
                Biggest wins
                {' '}
                {biggestWinsPeriodLabel}
              </h2>
            </div>
            <div className="w-full px-5">
              {isBiggestWinsLoading && (
                Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={`biggest-wins-skeleton-${index}`}
                    className="flex w-full items-center gap-3 border-b border-border/80 py-4 last:border-b-0"
                  >
                    <Skeleton className="h-3 w-4 rounded-full" />
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <Skeleton className="size-10 rounded-full" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-3 w-32 rounded-full" />
                        <Skeleton className="h-3 w-40 rounded-full" />
                      </div>
                    </div>
                  </div>
                ))
              )}

              {!isBiggestWinsLoading && biggestWins.map((entry, index) => {
                const record = entry as Record<string, unknown>
                const rank = entry.winRank ?? entry.rank ?? index + 1
                const address = resolveString(record, [
                  'user.proxyWallet',
                  'user.proxy_wallet',
                  'user.address',
                  'proxyWallet',
                  'proxy_wallet',
                  'address',
                  'walletAddress',
                  'wallet',
                ])
                const rawUsername = resolveString(record, [
                  'user.userName',
                  'user.username',
                  'user.name',
                  'user.pseudonym',
                  'userName',
                  'username',
                  'name',
                  'pseudonym',
                  'xUsername',
                ])
                const isWalletAlias = rawUsername.startsWith('0x') && rawUsername.includes('...')
                const username = (isWalletAlias && address ? address : rawUsername) || address
                const profileImage = resolveString(record, [
                  'user.profileImage',
                  'user.profile_image',
                  'user.image',
                  'profileImage',
                  'profile_image',
                  'avatar',
                ])
                const eventTitle = resolveString(record, [
                  'event.title',
                  'event.name',
                  'eventTitle',
                  'event_name',
                  'title',
                ])
                const eventSlug = resolveString(record, [
                  'event.slug',
                  'eventSlug',
                  'event_slug',
                  'slug',
                ])
                const marketSlug = resolveString(record, [
                  'market.slug',
                  'marketSlug',
                  'market_slug',
                ])
                const amountIn = resolveNumber(record, [
                  'initialValue',
                  'initial_value',
                  'amountIn',
                  'amount_in',
                  'amountPaid',
                  'amount_paid',
                  'paid',
                  'buy',
                  'cost',
                  'entryValue',
                  'entry_value',
                  'investment',
                  'usdIn',
                  'usd_in',
                ])
                const amountOut = resolveNumber(record, [
                  'finalValue',
                  'final_value',
                  'amountOut',
                  'amount_out',
                  'amountReceived',
                  'amount_received',
                  'received',
                  'payout',
                  'payoutAmount',
                  'payout_amount',
                  'won',
                  'winnings',
                  'return',
                  'exitValue',
                  'exit_value',
                  'usdOut',
                  'usd_out',
                ])

                const profileSlug = address || username
                const profileHref = profileSlug ? `/profile/${profileSlug}` : undefined
                const eventHref = eventSlug
                  ? (marketSlug ? `/event/${eventSlug}/${marketSlug}` : `/event/${eventSlug}`)
                  : null

                const amountInLabel = formatValueOrDash(amountIn)
                const amountOutLabel = formatValueOrDash(amountOut)
                const amountInClass = Number.isFinite(amountIn) ? 'text-foreground' : 'text-muted-foreground'
                const amountOutClass = Number.isFinite(amountOut) ? 'text-yes' : 'text-muted-foreground'

                return (
                  <div
                    key={`${address || username}-${rank}`}
                    className="flex w-full items-center gap-3 border-b border-border/80 py-4 last:border-b-0"
                  >
                    <span className="w-5 shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
                      {rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <ProfileLink
                        user={{
                          image: profileImage,
                          username,
                          address,
                        }}
                        profileSlug={profileSlug}
                        profileHref={profileHref}
                        layout="stacked"
                        tooltipTrigger="avatar-username"
                        containerClassName="items-center gap-3 [&_[data-avatar]]:h-8 [&_[data-avatar]]:w-8"
                        avatarSize={40}
                        usernameClassName="text-sm font-medium text-foreground underline-offset-2 hover:underline"
                        usernameMaxWidthClassName="max-w-[9ch]"
                        usernameAddon={eventTitle
                          ? (
                              <span className="inline-flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
                                <span className="shrink-0">|</span>
                                {eventHref
                                  ? (
                                      <Link
                                        href={eventHref as Route}
                                        className={`
                                          block max-w-[20ch] truncate text-muted-foreground transition-colors
                                          hover:text-foreground hover:underline
                                        `}
                                        title={eventTitle}
                                      >
                                        {eventTitle}
                                      </Link>
                                    )
                                  : (
                                      <span className="block max-w-[23ch] truncate">{eventTitle}</span>
                                    )}
                              </span>
                            )
                          : null}
                      >
                        <div className="flex w-full items-center gap-2 text-xs">
                          <span className={amountInClass}>{amountInLabel}</span>
                          <MoveRightIcon className="size-4 text-muted-foreground" />
                          <span className={cn('font-medium', amountOutClass)}>{amountOutLabel}</span>
                        </div>
                      </ProfileLink>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
