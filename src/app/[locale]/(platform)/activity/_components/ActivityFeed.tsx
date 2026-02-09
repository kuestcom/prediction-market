'use client'

import type { Route } from 'next'
import type { DataApiActivity } from '@/lib/data-api/user'
import type { ActivityOrder } from '@/types'
import { Loader2Icon, SquareArrowOutUpRightIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import ProfileLink from '@/components/ProfileLink'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { Link, useRouter } from '@/i18n/navigation'
import { filterActivitiesByMinAmount } from '@/lib/activity/filter'
import { MICRO_UNIT, POLYGON_SCAN_BASE } from '@/lib/constants'
import { mapDataApiActivityToActivityOrder } from '@/lib/data-api/user'
import { formatCurrency, formatSharePriceLabel, formatTimeAgo, toMicro } from '@/lib/formatters'
import { cn } from '@/lib/utils'

type LiveActivityPayload = DataApiActivity & {
  category?: string
  mainCategory?: string
  main_category?: string
  tag?: string
  tags?: string[]
  eventTags?: string[]
  event_tags?: string[]
  categoryName?: string
  eventCategory?: string
  eventTag?: string
}

interface LiveActivityMessage {
  topic?: string
  type?: string
  payload?: LiveActivityPayload | LiveActivityPayload[]
}

interface LiveActivityItem {
  id: string
  categories: CategoryValue[]
  order: ActivityOrder
}

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'politics', label: 'Politics' },
  { value: 'sports', label: 'Sports' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'finance', label: 'Finance' },
  { value: 'geopolitics', label: 'Geopolitics' },
  { value: 'earnings', label: 'Earnings' },
  { value: 'culture', label: 'Culture' },
  { value: 'world', label: 'World' },
  { value: 'economy', label: 'Economy' },
  { value: 'climate-science', label: 'Climate & Science' },
] as const

type CategoryValue = typeof CATEGORY_OPTIONS[number]['value']
const CATEGORY_VALUES = new Set<CategoryValue>(CATEGORY_OPTIONS.map(option => option.value))

function isCategoryValue(value: string): value is CategoryValue {
  return CATEGORY_VALUES.has(value as CategoryValue)
}

const MIN_AMOUNT_OPTIONS = [
  { value: 'none', label: 'None', display: 'Min amount' },
  { value: '10', label: '$10', display: 'Min $10' },
  { value: '100', label: '$100', display: 'Min $100' },
  { value: '1000', label: '$1,000', display: 'Min $1,000' },
  { value: '10000', label: '$10,000', display: 'Min $10,000' },
  { value: '100000', label: '$100,000', display: 'Min $100,000' },
] as const

const MAX_ITEMS = 100
const MAX_SEEN_ITEMS = MAX_ITEMS * 6
const ROW_HEIGHT_ESTIMATE = 64
const MIN_VISIBLE_ITEMS = 12
const MAX_VISIBLE_ITEMS = 28

function normalizeCategoryValue(value?: string | null) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const normalized = trimmed
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')

  if (normalized === 'climate and science' || normalized === 'climate science') {
    return 'climate-science'
  }

  if (normalized === 'geo politics' || normalized === 'geopolitics') {
    return 'geopolitics'
  }

  const slug = normalized.replace(/\s+/g, '-')
  if (isCategoryValue(slug)) {
    return slug
  }

  return null
}

function resolveCategoryMatches(tags?: string[] | null) {
  if (!tags || tags.length === 0) {
    return []
  }

  const normalized = new Set<string>()
  for (const tag of tags) {
    const normalizedTag = normalizeCategoryValue(tag)
    if (normalizedTag) {
      normalized.add(normalizedTag)
    }
  }

  if (normalized.size === 0) {
    return []
  }

  return CATEGORY_OPTIONS
    .filter(option => option.value !== 'all' && normalized.has(option.value))
    .map(option => option.value)
}

function resolveCategories(payload: LiveActivityPayload) {
  const categories = new Set<CategoryValue>()
  const tagMatches = resolveCategoryMatches(payload.tags ?? payload.eventTags ?? payload.event_tags)
  for (const match of tagMatches) {
    categories.add(match)
  }

  const rawCategory = payload.category
    ?? payload.mainCategory
    ?? payload.main_category
    ?? payload.tag
    ?? payload.categoryName
    ?? payload.eventCategory
    ?? payload.eventTag

  const normalizedCategory = normalizeCategoryValue(rawCategory)
  if (normalizedCategory) {
    categories.add(normalizedCategory as CategoryValue)
  }

  return Array.from(categories)
}

function resolveMarketIcon(iconUrl?: string | null) {
  if (!iconUrl) {
    return null
  }

  return iconUrl.startsWith('http') ? iconUrl : `https://gateway.irys.xyz/${iconUrl}`
}

function resolveOutcomeColorClass(outcomeText?: string | null) {
  const normalized = (outcomeText ?? '').toLowerCase()
  if (normalized.includes('yes') || normalized.includes('up') || normalized.includes('true')) {
    return 'text-yes'
  }
  return 'text-no'
}

function hasText(value?: string | null) {
  return Boolean(value && value.trim())
}

export default function ActivityFeed() {
  const t = useExtracted()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const wsUrl = process.env.WS_LIVE_DATA_URL
  const wsUrlRef = useRef<string | null>(wsUrl ?? null)
  const router = useRouter()
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [minAmountFilter, setMinAmountFilter] = useState<string>('none')
  const [items, setItems] = useState<LiveActivityItem[]>([])
  const [baseVisibleCount, setBaseVisibleCount] = useState<number>(20)
  const [visibleCount, setVisibleCount] = useState<number>(20)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const seenIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!wsUrl) {
      return
    }
    wsUrlRef.current = wsUrl

    let isActive = true
    let ws: WebSocket | null = null
    let reconnectTimeout: number | null = null

    function buildSubscriptionPayload(action: 'subscribe' | 'unsubscribe') {
      return JSON.stringify({
        action,
        subscriptions: [
          {
            topic: 'activity',
            type: 'orders_matched',
          },
        ],
      })
    }

    function handleOpen() {
      if (!ws) {
        return
      }
      ws.send(buildSubscriptionPayload('subscribe'))
    }

    function handleMessage(eventMessage: MessageEvent<string>) {
      if (!isActive) {
        return
      }

      let payload: LiveActivityMessage | null = null
      try {
        payload = JSON.parse(eventMessage.data)
      }
      catch {
        return
      }

      if (payload?.topic !== 'activity' || payload.type !== 'orders_matched' || !payload.payload) {
        return
      }

      const rawItems = Array.isArray(payload.payload) ? payload.payload : [payload.payload]
      const nextItems: LiveActivityItem[] = []

      for (const rawPayload of rawItems) {
        const hasTitle = hasText(rawPayload.title)
        const hasMarketSlug = hasText(rawPayload.slug)
        const hasUser = hasText(rawPayload.pseudonym) || hasText(rawPayload.name) || hasText(rawPayload.proxyWallet)
        const hasSide = hasText(rawPayload.side)
        const hasOutcomeText = hasText(rawPayload.outcome)
        const hasOutcomeIndex = typeof rawPayload.outcomeIndex === 'number'
        const hasOutcome = hasOutcomeText || hasOutcomeIndex
        const hasPrice = Number.isFinite(rawPayload.price) && Number(rawPayload.price) > 0
        const hasTimestamp = Number.isFinite(rawPayload.timestamp)
        const hasSize = Number.isFinite(rawPayload.size) && Number(rawPayload.size) > 0
        const hasUsd = Number.isFinite(rawPayload.usdcSize) && Number(rawPayload.usdcSize) > 0
        const hasValue = hasPrice && (hasSize || hasUsd)

        if (!hasTitle || !hasMarketSlug || !hasUser || !hasSide || !hasOutcome || !hasPrice || !hasTimestamp || !hasValue) {
          continue
        }

        const order = mapDataApiActivityToActivityOrder(rawPayload)
        if (hasOutcomeText) {
          order.outcome.text = rawPayload.outcome!.trim()
        }
        else if (hasOutcomeIndex) {
          order.outcome.text = rawPayload.outcomeIndex === 0 ? 'Yes' : 'No'
        }
        if (hasOutcomeIndex) {
          order.outcome.index = rawPayload.outcomeIndex as number
        }
        const categories = resolveCategories(rawPayload)
        nextItems.push({
          id: order.id,
          categories,
          order,
        })
      }

      const uniqueNextItems = nextItems.filter((item) => {
        if (seenIdsRef.current.has(item.id)) {
          return false
        }
        seenIdsRef.current.add(item.id)
        return true
      })

      if (uniqueNextItems.length === 0) {
        return
      }

      setItems((prev) => {
        const next = [...uniqueNextItems, ...prev]
        const trimmed = next.slice(0, MAX_ITEMS)
        if (seenIdsRef.current.size > MAX_SEEN_ITEMS) {
          seenIdsRef.current = new Set(trimmed.map(item => item.id))
        }
        return trimmed
      })
    }

    function handleError() {
      // no-op
    }

    function handleClose() {
      if (!isActive) {
        return
      }
      scheduleReconnect()
    }

    function connect() {
      if (!isActive || ws || document.hidden) {
        return
      }
      if (!wsUrlRef.current) {
        return
      }
      ws = new WebSocket(wsUrlRef.current)
      ws.addEventListener('open', handleOpen)
      ws.addEventListener('message', handleMessage)
      ws.addEventListener('error', handleError)
      ws.addEventListener('close', handleClose)
    }

    function clearReconnect() {
      if (reconnectTimeout != null) {
        window.clearTimeout(reconnectTimeout)
        reconnectTimeout = null
      }
    }

    function scheduleReconnect() {
      clearReconnect()
      reconnectTimeout = window.setTimeout(() => {
        if (!isActive) {
          return
        }
        if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          ws = null
          connect()
        }
      }, 1500)
    }

    function handleVisibilityChange() {
      if (!document.hidden) {
        if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          ws = null
          connect()
        }
      }
    }

    connect()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isActive = false
      clearReconnect()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(buildSubscriptionPayload('unsubscribe'))
        }
        ws.removeEventListener('open', handleOpen)
        ws.removeEventListener('message', handleMessage)
        ws.removeEventListener('error', handleError)
        ws.removeEventListener('close', handleClose)
        ws.close()
      }
    }
  }, [wsUrl])

  useEffect(() => {
    function updateBaseCount() {
      const viewportHeight = window.innerHeight || 800
      const estimate = Math.ceil(viewportHeight / ROW_HEIGHT_ESTIMATE) + 6
      const clamped = Math.min(MAX_VISIBLE_ITEMS, Math.max(MIN_VISIBLE_ITEMS, estimate))
      setBaseVisibleCount(clamped)
    }

    updateBaseCount()
    window.addEventListener('resize', updateBaseCount)
    return () => window.removeEventListener('resize', updateBaseCount)
  }, [])

  const minAmountMicro = useMemo(() => {
    const parsed = Number(minAmountFilter)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return undefined
    }
    return Number(toMicro(parsed))
  }, [minAmountFilter])

  const filteredOrders = useMemo(() => {
    let filtered = items
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(item => item.categories.includes(categoryFilter as CategoryValue))
    }
    return filterActivitiesByMinAmount(filtered.map(item => item.order), minAmountMicro)
  }, [categoryFilter, items, minAmountMicro])

  const minAmountDisplay = useMemo(() => {
    return MIN_AMOUNT_OPTIONS.find(option => option.value === minAmountFilter)?.display ?? 'Min amount'
  }, [minAmountFilter])

  const categoryDisplay = useMemo(() => {
    return CATEGORY_OPTIONS.find(option => option.value === categoryFilter)?.label ?? 'All'
  }, [categoryFilter])

  useEffect(() => {
    setVisibleCount(baseVisibleCount)
  }, [baseVisibleCount, categoryFilter, minAmountFilter])

  useEffect(() => {
    setVisibleCount((current) => {
      if (filteredOrders.length === 0) {
        return baseVisibleCount
      }
      const clamped = Math.min(current, filteredOrders.length)
      return Math.max(baseVisibleCount, clamped)
    })
  }, [baseVisibleCount, filteredOrders.length])

  const pageSize = Math.max(6, Math.round(baseVisibleCount * 0.6))
  const hasHiddenItems = visibleCount < filteredOrders.length
  const visibleOrders = filteredOrders.slice(0, visibleCount)

  useEffect(() => {
    const node = loadMoreRef.current
    if (!node || !hasHiddenItems) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry?.isIntersecting) {
          return
        }
        setVisibleCount(current => Math.min(current + pageSize, filteredOrders.length))
      },
      { rootMargin: '200px 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [filteredOrders.length, hasHiddenItems, pageSize])

  const isLoading = items.length === 0

  const rowClassName = cn(
    `
      group relative z-0 flex w-full cursor-pointer flex-col gap-3 p-3 transition-all duration-200 ease-in-out
      before:pointer-events-none before:absolute before:-inset-x-3 before:inset-y-0 before:-z-10 before:rounded-lg
      before:bg-black/5 before:opacity-0 before:transition-opacity before:duration-200 before:content-['']
      hover:before:opacity-100
      sm:flex-row sm:items-center sm:gap-4
      dark:before:bg-white/5
    `,
  )

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
          {t('Activity')}
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-10 text-base font-medium text-foreground">
              <SelectValue asChild>
                <span className="line-clamp-1">{categoryDisplay}</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              {CATEGORY_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={minAmountFilter} onValueChange={setMinAmountFilter}>
            <SelectTrigger className="h-10 text-base font-medium text-foreground">
              <SelectValue asChild>
                <span className="line-clamp-1">{minAmountDisplay}</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              {MIN_AMOUNT_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="divide-y divide-border/80">
        {(isLoading || filteredOrders.length === 0) && (
          Array.from({ length: 10 }).map((_, index) => (
            <div key={`activity-skeleton-${index}`} className={rowClassName}>
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Skeleton className="size-12 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/5 rounded-full" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-2 rounded-full" />
                    <Skeleton className="h-3 w-1/2 rounded-full" />
                  </div>
                </div>
              </div>
              <Skeleton className="h-3 w-14 rounded-full" />
            </div>
          ))
        )}

        {!isLoading && visibleOrders.length > 0 && (
          visibleOrders.map((activity) => {
            const eventSlug = activity.market.event?.slug || activity.market.slug
            const marketSlug = activity.market.event?.slug ? activity.market.slug : null
            const eventHref = (marketSlug ? `/event/${eventSlug}/${marketSlug}` : `/event/${eventSlug}`) as Route
            const marketIcon = resolveMarketIcon(activity.market.icon_url)
            const rawOutcomeText = activity.outcome.text || ''
            const outcomeText = normalizeOutcomeLabel(rawOutcomeText) || rawOutcomeText
            const outcomeColorClass = resolveOutcomeColorClass(rawOutcomeText)
            const priceLabel = formatSharePriceLabel(Number(activity.price), { fallback: '—' })
            const totalValue = Number.isFinite(activity.total_value)
              ? Number(activity.total_value) / MICRO_UNIT
              : 0
            const totalValueLabel = totalValue > 0
              ? formatCurrency(totalValue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
              : null
            const timeAgoLabel = formatTimeAgo(activity.created_at)
            const txUrl = activity.tx_hash ? `${POLYGON_SCAN_BASE}/tx/${activity.tx_hash}` : null
            const username = activity.user.username || activity.user.address || ''

            return (
              <div
                key={activity.id}
                className={rowClassName}
                role="link"
                tabIndex={0}
                onClick={() => router.push(eventHref)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    router.push(eventHref)
                  }
                }}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <Link
                    href={eventHref}
                    onClick={event => event.stopPropagation()}
                    className="relative size-12 shrink-0 overflow-hidden rounded-md"
                  >
                    {marketIcon
                      ? (
                          <Image
                            src={marketIcon}
                            alt={activity.market.title}
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        )
                      : (
                          <div className="size-full" aria-hidden />
                        )}
                  </Link>

                  <div className="min-w-0 flex-1 space-y-1">
                    <Link
                      href={eventHref}
                      onClick={event => event.stopPropagation()}
                      className={`
                        block max-w-[64ch] truncate text-sm text-muted-foreground underline-offset-2
                        hover:underline
                      `}
                      title={activity.market.title}
                    >
                      {activity.market.title}
                    </Link>

                    <div
                      onClick={event => event.stopPropagation()}
                      onKeyDown={event => event.stopPropagation()}
                    >
                      <ProfileLink
                        user={{
                          image: activity.user.image,
                          username,
                          address: activity.user.address,
                        }}
                        avatarSize={24}
                        profileSlug={activity.user.address || username}
                        profileHref={activity.user.address || username ? `/profile/${activity.user.address || username}` : undefined}
                        layout="inline"
                        containerClassName="gap-2 text-sm leading-tight [&_[data-avatar]]:h-6 [&_[data-avatar]]:w-6"
                        usernameClassName="font-semibold text-foreground underline-offset-2 hover:underline"
                        usernameMaxWidthClassName="max-w-32 sm:max-w-40"
                        inlineContent={(
                          <>
                            <span className="text-muted-foreground">
                              {activity.side === 'sell' ? 'sold' : 'bought'}
                            </span>
                            <span className={cn('font-semibold', outcomeColorClass)}>
                              {outcomeText}
                            </span>
                            <span className="text-muted-foreground">at</span>
                            <span className="text-muted-foreground">{priceLabel}</span>
                            {totalValueLabel && (
                              <span className="text-muted-foreground">
                                (
                                {totalValueLabel}
                                )
                              </span>
                            )}
                          </>
                        )}
                      />
                    </div>
                  </div>
                </div>

                <div className={`
                  flex w-full shrink-0 items-center justify-end gap-1.5 text-xs text-muted-foreground
                  sm:w-auto
                `}
                >
                  {txUrl
                    ? (
                        <>
                          <span>{timeAgoLabel}</span>
                          <a
                            href={txUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={event => event.stopPropagation()}
                            className="text-muted-foreground transition-colors hover:text-foreground"
                            aria-label="View transaction on Polygonscan"
                          >
                            <SquareArrowOutUpRightIcon className="size-3" />
                          </a>
                        </>
                      )
                    : (
                        <span>{timeAgoLabel}</span>
                      )}
                </div>
              </div>
            )
          })
        )}

        {!isLoading && hasHiddenItems && (
          <div className="flex items-center justify-center gap-2 py-3 text-base text-muted-foreground">
            <Loader2Icon className="size-6 animate-spin" />
            {t('Loading more...')}
          </div>
        )}

        <div ref={loadMoreRef} className="h-1 w-full opacity-0" aria-hidden />
      </div>
    </div>
  )
}
