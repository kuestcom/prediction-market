import type { ActivityOrder, PublicActivity, UserPosition } from '@/types'
import { MICRO_UNIT } from '@/lib/constants'

interface DataApiRequestParams {
  pageParam: number
  userAddress: string
  signal?: AbortSignal
}

export interface DataApiActivity {
  proxyWallet?: string
  timestamp?: number
  conditionId?: string
  type?: string
  size?: number
  usdcSize?: number
  transactionHash?: string
  price?: number
  asset?: string
  side?: string
  outcomeIndex?: number
  title?: string
  slug?: string
  icon?: string
  eventSlug?: string
  outcome?: string
  name?: string
  pseudonym?: string
  profileImage?: string
  profileImageOptimized?: string
  tags?: string[]
}

export interface DataApiPosition {
  proxyWallet?: string
  asset?: string
  conditionId?: string
  size?: number
  avgPrice?: number
  initialValue?: number
  currentValue?: number
  cashPnl?: number
  totalBought?: number
  realizedPnl?: number
  percentPnl?: number
  percentRealizedPnl?: number
  curPrice?: number
  redeemable?: boolean
  mergeable?: boolean
  title?: string
  slug?: string
  icon?: string
  eventSlug?: string
  outcome?: string
  outcomeIndex?: number
  oppositeOutcome?: string
  oppositeAsset?: string
  timestamp?: number
  orderCount?: number
}

export interface DataApiOtherBalance {
  slug?: string
  user?: string
  size?: number
}

const DATA_API_URL = process.env.DATA_URL!

function assertDataApiUrl() {
  if (!DATA_API_URL) {
    throw new Error('DATA_URL environment variable is not configured.')
  }
}

function normalizeValue(value: number | undefined | null): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  const numeric = Number(value)
  if (numeric > MICRO_UNIT) {
    return numeric / MICRO_UNIT
  }

  return numeric
}

function normalizeShares(value?: number | null): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  const numeric = Number(value)
  const abs = Math.abs(numeric)
  if (abs > MICRO_UNIT) {
    return numeric / MICRO_UNIT
  }

  return numeric
}

function normalizeUsd(value?: number | null): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  const numeric = Number(value)
  const abs = Math.abs(numeric)
  if (abs > MICRO_UNIT) {
    return numeric / MICRO_UNIT
  }

  return numeric
}

function sanitizePrice(value?: number | null): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  let numeric = Number(value)
  while (numeric > 10) {
    numeric /= 100
  }
  return numeric
}

function buildActivityId(activity: DataApiActivity, slugFallback: string): string {
  type BaseSource = 'transactionHash' | 'conditionId' | 'asset' | 'slug' | 'fallback'

  let baseSource: BaseSource = 'fallback'
  let base = activity.transactionHash
  if (base) {
    baseSource = 'transactionHash'
  }
  else if (activity.conditionId) {
    base = activity.conditionId
    baseSource = 'conditionId'
  }
  else if (activity.asset) {
    base = activity.asset
    baseSource = 'asset'
  }
  else if (slugFallback) {
    base = slugFallback
    baseSource = 'slug'
  }
  else {
    base = 'activity'
  }

  const parts = [base]
  function append(value?: string | number | null, source?: BaseSource) {
    if (source && source === baseSource) {
      return
    }
    if (value === null || value === undefined) {
      return
    }
    const text = String(value).trim()
    if (!text) {
      return
    }
    parts.push(text)
  }

  append(activity.conditionId, 'conditionId')
  append(activity.asset, 'asset')
  append(activity.outcomeIndex ?? activity.outcome)
  append(activity.side)
  append(activity.price)
  append(activity.size)
  append(activity.timestamp)

  return parts.join(':')
}

export function mapDataApiActivityToPublicActivity(activity: DataApiActivity): PublicActivity {
  const slug = activity.slug || activity.conditionId || 'unknown-market'
  const eventSlug = activity.eventSlug || slug
  const timestampMs = typeof activity.timestamp === 'number'
    ? activity.timestamp * 1000
    : Date.now()
  const usdcValue = normalizeUsd(activity.usdcSize)
  const baseShares = Number.isFinite(activity.size) ? Number(activity.size) : undefined
  const shares = baseShares != null && activity.type?.toLowerCase() === 'split'
    ? baseShares * 2
    : baseShares

  return {
    id: buildActivityId(activity, slug),
    title: activity.title || 'Untitled market',
    slug,
    eventSlug,
    icon: activity.icon,
    type: activity.type?.toLowerCase() || 'trade',
    outcomeText: activity.outcomeIndex != null
      ? (activity.outcomeIndex === 0 ? 'Yes' : 'No')
      : activity.outcome,
    price: Number.isFinite(activity.price) ? Number(activity.price) : undefined,
    shares,
    usdcValue,
    timestamp: timestampMs,
    txHash: activity.transactionHash,
  }
}

export function mapDataApiActivityToActivityOrder(activity: DataApiActivity): ActivityOrder {
  const slug = activity.slug || activity.conditionId || 'unknown-market'
  const eventSlug = activity.eventSlug || slug
  const timestampMs = typeof activity.timestamp === 'number'
    ? activity.timestamp * 1000
    : Date.now()
  const isSplit = activity.type?.toLowerCase() === 'split'
  const normalizedUsd = normalizeUsd(activity.usdcSize)
  let normalizedPrice = sanitizePrice(normalizeValue(activity.price))
  if (normalizedPrice < 0) {
    normalizedPrice = 0
  }

  let baseSize = normalizeShares(activity.size)

  const price = isSplit ? 0.5 : normalizedPrice
  const canDeriveFromUsd = normalizedUsd > 0 && price > 0
  if (canDeriveFromUsd && (baseSize <= 0 || baseSize > 1_000)) {
    baseSize = normalizedUsd / price
  }

  const size = isSplit ? baseSize * 2 : baseSize

  const derivedTotal = size > 0 && price > 0 ? size * price : 0
  let totalUsd = normalizedUsd > 0 ? normalizedUsd : 0
  if (derivedTotal > 0 && (totalUsd === 0 || derivedTotal < totalUsd * 10)) {
    totalUsd = derivedTotal
  }
  else if (totalUsd === 0) {
    totalUsd = derivedTotal
  }
  const outcomeText = isSplit
    ? 'Yes / No'
    : (activity.outcome || 'Outcome')
  const outcomeIndex = isSplit ? undefined : activity.outcomeIndex ?? 0
  const address = activity.proxyWallet || ''
  const displayName = activity.pseudonym || activity.name || address || 'Trader'
  const avatarUrl = activity.profileImageOptimized
    || activity.profileImage
    || ''
  const txHash = activity.transactionHash || undefined

  return {
    id: buildActivityId(activity, slug),
    type: activity.type?.toLowerCase(),
    user: {
      id: address || 'user',
      username: displayName,
      address,
      image: avatarUrl,
    },
    side: activity.side?.toLowerCase() === 'sell' ? 'sell' : 'buy',
    amount: Math.round(size * MICRO_UNIT).toString(),
    price: price.toString(),
    outcome: {
      index: outcomeIndex ?? 0,
      text: outcomeText,
    },
    market: {
      condition_id: activity.conditionId,
      title: activity.title || 'Untitled market',
      slug,
      icon_url: activity.icon || '',
      event: {
        slug: eventSlug,
        show_market_icons: Boolean(activity.icon),
      },
    },
    total_value: Math.round(totalUsd * MICRO_UNIT),
    created_at: new Date(timestampMs).toISOString(),
    status: 'completed',
    tx_hash: txHash,
  }
}

export async function fetchUserActivityData({
  pageParam,
  userAddress,
  signal,
  conditionId,
}: DataApiRequestParams & { conditionId?: string }): Promise<DataApiActivity[]> {
  assertDataApiUrl()

  const params = new URLSearchParams({
    limit: '50',
    offset: pageParam.toString(),
    user: userAddress,
  })

  if (conditionId) {
    params.set('marketId', conditionId)
    params.set('conditionId', conditionId)
  }

  const response = await fetch(`${DATA_API_URL}/activity?${params.toString()}`, { signal })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    const errorMessage = errorBody?.error || 'Server error occurred. Please try again later.'
    throw new Error(errorMessage)
  }

  const result = await response.json()
  if (!Array.isArray(result)) {
    throw new TypeError('Unexpected response from data service.')
  }

  return result as DataApiActivity[]
}

export async function fetchUserOtherBalance({
  eventSlug,
  userAddress,
  signal,
}: {
  eventSlug: string
  userAddress: string
  signal?: AbortSignal
}): Promise<DataApiOtherBalance[]> {
  assertDataApiUrl()

  const slug = eventSlug.trim()
  if (!slug) {
    return []
  }

  const normalizedUserAddress = userAddress.toLowerCase()
  const params = new URLSearchParams({
    slug,
    user: normalizedUserAddress,
  })

  const response = await fetch(`${DATA_API_URL}/other?${params.toString()}`, { signal })
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    const errorMessage = errorBody?.error || 'Server error occurred. Please try again later.'
    throw new Error(errorMessage)
  }

  const result = await response.json()
  if (!Array.isArray(result)) {
    throw new TypeError('Unexpected response from data service.')
  }

  return result.map((entry: DataApiOtherBalance) => ({
    ...entry,
    size: normalizeShares(entry.size),
  }))
}

export function mapDataApiPositionToUserPosition(
  position: DataApiPosition,
  status: 'active' | 'closed',
): UserPosition {
  const slug = position.slug || position.conditionId || 'unknown-market'
  const eventSlug = position.eventSlug || slug
  const timestampMs = typeof position.timestamp === 'number'
    ? position.timestamp * 1000
    : Date.now()

  const size = Number.isFinite(position.size) ? Number(position.size) : undefined
  const avgPrice = Number.isFinite(position.avgPrice) ? Number(position.avgPrice) : 0
  const currentValue = Number.isFinite(position.currentValue) ? Number(position.currentValue) : 0
  const realizedValue = Number.isFinite(position.realizedPnl)
    ? Number(position.realizedPnl)
    : currentValue
  const normalizedValue = status === 'closed' ? realizedValue : currentValue
  const derivedCostFromCash = Number.isFinite(position.cashPnl)
    ? normalizedValue - Number(position.cashPnl)
    : undefined
  const baseCost = Number.isFinite(position.totalBought)
    ? Number(position.totalBought)
    : Number.isFinite(position.initialValue)
      ? Number(position.initialValue)
      : derivedCostFromCash
  const fallbackCost = size != null ? size * avgPrice : normalizedValue
  const normalizedCost = Math.max(
    0,
    Number.isFinite(baseCost) && baseCost != null ? Number(baseCost) : fallbackCost,
  )
  const pnlValueRaw = Number.isFinite(position.cashPnl)
    ? Number(position.cashPnl)
    : normalizedValue - normalizedCost
  const hasPercentPnl = Number.isFinite(position.percentPnl)
  const percentPnlRaw = hasPercentPnl
    ? Number(position.percentPnl)
    : normalizedCost > 0
      ? (pnlValueRaw / normalizedCost) * 100
      : 0
  const normalizedPercent = Number.isFinite(percentPnlRaw)
    ? (hasPercentPnl && Math.abs(percentPnlRaw) <= 1 ? percentPnlRaw * 100 : percentPnlRaw)
    : 0

  const orderCount = typeof position.orderCount === 'number'
    ? Math.max(0, Math.round(position.orderCount))
    : (typeof position.size === 'number' && position.size > 0 ? 1 : 0)
  const outcomeIndex = typeof position.outcomeIndex === 'number' ? position.outcomeIndex : undefined
  const outcomeText = position.outcome
    || (outcomeIndex != null ? (outcomeIndex === 0 ? 'Yes' : 'No') : undefined)
  const oppositeOutcomeText = position.oppositeOutcome

  return {
    market: {
      condition_id: position.conditionId || slug,
      title: position.title || 'Untitled market',
      slug,
      icon_url: position.icon || '',
      is_active: status === 'active',
      is_resolved: status === 'closed',
      event: {
        slug: eventSlug,
      },
    },
    outcome_index: outcomeIndex,
    outcome_text: outcomeText,
    avgPrice: Number.isFinite(position.avgPrice) ? Number(position.avgPrice) : undefined,
    curPrice: Number.isFinite(position.curPrice) ? Number(position.curPrice) : undefined,
    currentValue: Number.isFinite(position.currentValue) ? Number(position.currentValue) : undefined,
    totalBought: Number.isFinite(position.totalBought) ? Number(position.totalBought) : undefined,
    initialValue: Number.isFinite(position.initialValue) ? Number(position.initialValue) : undefined,
    average_position: Math.round(avgPrice * MICRO_UNIT),
    total_position_value: Math.round(normalizedValue * MICRO_UNIT),
    total_position_cost: Math.round(normalizedCost * MICRO_UNIT),
    total_shares: size,
    profit_loss_value: Math.round(pnlValueRaw * MICRO_UNIT),
    profit_loss_percent: normalizedPercent,
    realizedPnl: Number.isFinite(position.realizedPnl) ? Number(position.realizedPnl) : undefined,
    cashPnl: Number.isFinite(position.cashPnl) ? Number(position.cashPnl) : undefined,
    percentPnl: Number.isFinite(position.percentPnl) ? Number(position.percentPnl) : undefined,
    percentRealizedPnl: Number.isFinite(position.percentRealizedPnl) ? Number(position.percentRealizedPnl) : undefined,
    opposite_outcome_text: oppositeOutcomeText,
    order_count: orderCount,
    last_activity_at: new Date(timestampMs).toISOString(),
  }
}

export async function fetchUserPositionsForMarket({
  pageParam,
  userAddress,
  status,
  conditionId,
  signal,
}: DataApiRequestParams & {
  status: 'active' | 'closed'
  conditionId?: string
}): Promise<UserPosition[]> {
  assertDataApiUrl()
  const endpoint = status === 'closed' ? '/closed-positions' : '/positions'
  const normalizedUserAddress = userAddress.toLowerCase()
  const params = new URLSearchParams({
    user: normalizedUserAddress,
    limit: '50',
    offset: pageParam.toString(),
    sortDirection: 'DESC',
    sizeThreshold: '0.01',
  })

  if (status === 'closed') {
    params.set('sortBy', 'TIMESTAMP')
  }
  if (conditionId) {
    params.set('market', conditionId)
  }

  const response = await fetch(`${DATA_API_URL}${endpoint}?${params.toString()}`, { signal })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    const errorMessage = errorBody?.error || 'Server error occurred. Please try again later.'
    throw new Error(errorMessage)
  }

  const result = await response.json()
  if (!Array.isArray(result)) {
    throw new TypeError('Unexpected response from data service.')
  }

  return (result as DataApiPosition[]).map(item => mapDataApiPositionToUserPosition(item, status))
}
