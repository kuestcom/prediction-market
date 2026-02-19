import type { MergeableMarket } from '@/app/[locale]/(platform)/[username]/_components/MergePositionsDialog'
import type { PublicPosition } from '@/app/[locale]/(platform)/[username]/_components/PublicPositionItem'
import type { ConditionShares, PositionsTotals, SortDirection, SortOption } from '@/app/[locale]/(platform)/[username]/_types/PublicPositionsTypes'
import { fetchUserOpenOrders } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useUserOpenOrdersQuery'
import { MICRO_UNIT, OUTCOME_INDEX } from '@/lib/constants'
import { formatCurrency } from '@/lib/formatters'

export interface DataApiPosition {
  proxyWallet?: string
  asset?: string
  conditionId?: string
  size?: number
  avgPrice?: number
  initialValue?: number
  currentValue?: number
  curPrice?: number
  cashPnl?: number
  totalBought?: number
  realizedPnl?: number
  percentPnl?: number
  percentRealizedPnl?: number
  redeemable?: boolean
  mergeable?: boolean
  title?: string
  slug?: string
  icon?: string
  eventSlug?: string
  outcome?: string
  outcomeIndex?: number | string | null
  outcome_index?: number | string | null
  oppositeOutcome?: string
  oppositeAsset?: string
  timestamp?: number
}

export function formatCurrencyValue(value?: number) {
  return Number.isFinite(value) ? formatCurrency(value ?? 0) : '—'
}

export function getOutcomeLabel(position: PublicPosition) {
  if (position.outcome && position.outcome.trim()) {
    return position.outcome
  }
  return position.outcomeIndex === OUTCOME_INDEX.NO ? 'No' : 'Yes'
}

export function getTradeValue(position: PublicPosition) {
  return (position.size ?? 0) * (position.avgPrice ?? 0)
}

export function getValue(position: PublicPosition) {
  const currentValue = Number(position.currentValue)
  if (Number.isFinite(currentValue)) {
    return currentValue
  }

  const size = Number(position.size)
  if (!Number.isFinite(size) || size <= 0) {
    return 0
  }

  const avgPrice = Number(position.avgPrice)
  if (Number.isFinite(avgPrice)) {
    return size * avgPrice
  }

  const curPrice = Number(position.curPrice)
  if (Number.isFinite(curPrice)) {
    return size * curPrice
  }

  return 0
}

export function getLatestPrice(position: PublicPosition) {
  const curPrice = Number(position.curPrice)
  if (Number.isFinite(curPrice)) {
    return curPrice
  }

  const avgPrice = Number(position.avgPrice)
  if (Number.isFinite(avgPrice)) {
    return avgPrice
  }

  const size = Number(position.size)
  const currentValue = Number(position.currentValue)
  if (Number.isFinite(size) && size > 0 && Number.isFinite(currentValue)) {
    return currentValue / size
  }

  return 0
}

export function getPnlValue(position: PublicPosition) {
  return getValue(position) - getTradeValue(position)
}

export function getPnlPercent(position: PublicPosition) {
  const trade = getTradeValue(position)
  return trade > 0 ? (getPnlValue(position) / trade) * 100 : 0
}

export function parseNumber(value?: number | string | null) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : Number.NaN
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : Number.NaN
  }
  return Number.NaN
}

export const DEFAULT_SORT_DIRECTION: Record<SortOption, SortDirection> = {
  currentValue: 'desc',
  trade: 'desc',
  pnlPercent: 'desc',
  pnlValue: 'desc',
  shares: 'desc',
  alpha: 'asc',
  endingSoon: 'asc',
  payout: 'desc',
  latestPrice: 'desc',
  avgCost: 'desc',
}

export function getDefaultSortDirection(sortBy: SortOption): SortDirection {
  return DEFAULT_SORT_DIRECTION[sortBy]
}

export function resolvePositionsSortParams(sortBy: SortOption, sortDirection?: SortDirection) {
  const resolvedDirection = (sortDirection ?? DEFAULT_SORT_DIRECTION[sortBy]) === 'asc' ? 'ASC' : 'DESC'
  switch (sortBy) {
    case 'alpha':
      return { sortBy: 'TITLE', sortDirection: resolvedDirection }
    case 'endingSoon':
      return { sortBy: 'RESOLVING', sortDirection: resolvedDirection }
    case 'shares':
      return { sortBy: 'TOKENS', sortDirection: resolvedDirection }
    case 'trade':
      return { sortBy: 'INITIAL', sortDirection: resolvedDirection }
    case 'pnlPercent':
      return { sortBy: 'PERCENTPNL', sortDirection: resolvedDirection }
    case 'pnlValue':
      return { sortBy: 'CASHPNL', sortDirection: resolvedDirection }
    case 'latestPrice':
      return { sortBy: 'PRICE', sortDirection: resolvedDirection }
    case 'avgCost':
      return { sortBy: 'AVGPRICE', sortDirection: resolvedDirection }
    case 'payout':
      return { sortBy: 'TOKENS', sortDirection: resolvedDirection }
    case 'currentValue':
    default:
      return { sortBy: 'CURRENT', sortDirection: resolvedDirection }
  }
}

export function isClientOnlySort(sortBy: SortOption) {
  return sortBy === 'currentValue' || sortBy === 'latestPrice'
}

export function resolvePositionsSearchParams(searchQuery: string) {
  const trimmed = searchQuery.trim()
  if (!trimmed) {
    return {}
  }

  const parts = trimmed.split(',').map(part => part.trim()).filter(Boolean)
  const isConditionList = parts.length > 0
    && parts.every(part => /^0x[a-fA-F0-9]{64}$/.test(part))

  if (isConditionList) {
    return { market: parts.join(',') }
  }

  return { title: trimmed.slice(0, 100) }
}

export function matchesPositionsSearchQuery(position: PublicPosition, searchQuery: string) {
  const trimmed = searchQuery.trim().toLowerCase()
  if (!trimmed) {
    return true
  }

  const marketTitle = position.title?.toLowerCase() ?? ''
  const outcomeText = position.outcome?.toLowerCase() ?? ''
  const eventSlug = position.eventSlug?.toLowerCase() ?? ''
  const slug = position.slug?.toLowerCase() ?? ''
  const conditionId = position.conditionId?.toLowerCase() ?? ''

  return (
    marketTitle.includes(trimmed)
    || outcomeText.includes(trimmed)
    || eventSlug.includes(trimmed)
    || slug.includes(trimmed)
    || conditionId.includes(trimmed)
  )
}

export function mapDataApiPosition(position: DataApiPosition, status: 'active' | 'closed'): PublicPosition {
  const slug = position.slug || position.conditionId || 'unknown-market'
  const eventSlug = position.eventSlug || slug
  const timestampMs = typeof position.timestamp === 'number'
    ? position.timestamp * 1000
    : Date.now()
  const sizeValue = parseNumber(position.size)
  const avgPriceValue = parseNumber(position.avgPrice)
  const currentValueRaw = parseNumber(position.currentValue)
  const realizedValueRaw = parseNumber(position.realizedPnl)
  const curPriceRaw = parseNumber(position.curPrice)
  const outcomeIndexValue = parseNumber(position.outcomeIndex ?? position.outcome_index)
  const outcomeIndex = Number.isFinite(outcomeIndexValue) ? outcomeIndexValue : undefined

  let derivedCurrentValue = Number.isFinite(currentValueRaw) ? currentValueRaw : Number.NaN
  if (!Number.isFinite(derivedCurrentValue)) {
    if (Number.isFinite(sizeValue) && sizeValue > 0) {
      if (Number.isFinite(curPriceRaw)) {
        derivedCurrentValue = sizeValue * curPriceRaw
      }
      else if (Number.isFinite(avgPriceValue)) {
        derivedCurrentValue = sizeValue * avgPriceValue
      }
    }
  }

  const currentValue = Number.isFinite(derivedCurrentValue) ? derivedCurrentValue : 0
  const realizedValue = Number.isFinite(realizedValueRaw) ? realizedValueRaw : currentValue
  const normalizedValue = status === 'closed' ? realizedValue : currentValue
  const derivedCurPrice = Number.isFinite(curPriceRaw)
    ? curPriceRaw
    : (Number.isFinite(sizeValue) && sizeValue > 0 && Number.isFinite(currentValue))
        ? currentValue / sizeValue
        : (Number.isFinite(avgPriceValue) ? avgPriceValue : Number.NaN)

  return {
    id: `${position.conditionId || slug}-${outcomeIndex ?? 0}-${status}`,
    title: position.title || 'Untitled market',
    slug,
    eventSlug,
    icon: position.icon,
    conditionId: position.conditionId,
    asset: position.asset,
    oppositeAsset: position.oppositeAsset,
    avgPrice: Number.isFinite(avgPriceValue) ? avgPriceValue : 0,
    currentValue: normalizedValue,
    curPrice: Number.isFinite(derivedCurPrice) ? derivedCurPrice : undefined,
    timestamp: timestampMs,
    status,
    outcome: position.outcome,
    outcomeIndex,
    oppositeOutcome: position.oppositeOutcome,
    mergeable: position.mergeable,
    size: Number.isFinite(sizeValue) ? sizeValue : undefined,
  }
}

function normalizeAsset(value?: string | null) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed.length > 0 ? trimmed : null
}

export function buildMergeableMarkets(positions: PublicPosition[]): MergeableMarket[] {
  const activeMergeable = positions.filter(
    position => position.status === 'active' && position.conditionId && normalizeAsset(position.asset),
  )

  const grouped = new Map<string, PublicPosition[]>()

  activeMergeable.forEach((position) => {
    const key = position.conditionId as string
    const existing = grouped.get(key) ?? []
    grouped.set(key, [...existing, position])
  })

  const markets: MergeableMarket[] = []

  grouped.forEach((groupPositions, conditionId) => {
    const assets = new Map<string, PublicPosition>()

    groupPositions.forEach((position) => {
      const assetKey = normalizeAsset(position.asset)
      if (!assetKey) {
        return
      }

      const existing = assets.get(assetKey)
      if (!existing || (position.size ?? 0) > (existing.size ?? 0)) {
        assets.set(assetKey, position)
      }
    })

    if (assets.size !== 2) {
      return
    }

    let outcomeAssets: [string, string] | null = null
    for (const position of assets.values()) {
      const assetKey = normalizeAsset(position.asset)
      const oppositeKey = normalizeAsset(position.oppositeAsset)
      if (assetKey && oppositeKey && assets.has(oppositeKey)) {
        outcomeAssets = [assetKey, oppositeKey]
        break
      }
    }

    if (!outcomeAssets) {
      const assetKeys = Array.from(assets.keys()).sort()
      if (assetKeys.length === 2) {
        outcomeAssets = [assetKeys[0], assetKeys[1]]
      }
    }

    if (!outcomeAssets) {
      return
    }

    const firstPosition = assets.get(outcomeAssets[0])
    const secondPosition = assets.get(outcomeAssets[1])
    if (!firstPosition || !secondPosition) {
      return
    }

    const mergeableAmount = Math.min(firstPosition.size ?? 0, secondPosition.size ?? 0)
    const mergeableCents = Math.floor(mergeableAmount * 100 + 1e-8) / 100

    if (!Number.isFinite(mergeableCents) || mergeableCents <= 0) {
      return
    }

    const sample = firstPosition.icon ? firstPosition : secondPosition

    markets.push({
      conditionId,
      eventSlug: sample.eventSlug || sample.slug,
      title: sample.title,
      icon: sample.icon,
      mergeAmount: mergeableCents,
      outcomeAssets,
    })
  })

  return markets
}

export function normalizeOrderShares(value: number) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0
  }
  return numeric > 100_000 ? numeric / MICRO_UNIT : numeric
}

async function fetchMarketOutcomeAssetMap(eventSlug: string, conditionId: string): Promise<Record<number, string>> {
  const response = await fetch(
    `/api/events/${encodeURIComponent(eventSlug)}/market-metadata?conditionId=${encodeURIComponent(conditionId)}`,
  )

  if (!response.ok) {
    throw new Error('Failed to fetch market metadata')
  }

  const payload = await response.json().catch(() => null)
  const outcomes = payload?.data?.outcomes ?? []
  const outcomeMap: Record<number, string> = {}

  outcomes.forEach((outcome: { token_id?: string, outcome_index?: number | string | null }) => {
    const outcomeIndex = parseNumber(outcome?.outcome_index ?? null)
    const tokenId = normalizeAsset(outcome?.token_id)
    if (!Number.isFinite(outcomeIndex) || !tokenId) {
      return
    }
    outcomeMap[outcomeIndex] = tokenId
  })

  return outcomeMap
}

export async function fetchLockedSharesByCondition(markets: MergeableMarket[]): Promise<Record<string, ConditionShares>> {
  const uniqueKeys = Array.from(new Map(
    markets
      .filter(market => market.conditionId && market.eventSlug)
      .map(market => [`${market.eventSlug}:${market.conditionId}`, { eventSlug: market.eventSlug!, conditionId: market.conditionId }]),
  ).values())

  const expectedAssetsByCondition = new Map<string, [string, string]>()
  markets.forEach((market) => {
    if (market.conditionId && Array.isArray(market.outcomeAssets) && market.outcomeAssets.length === 2) {
      expectedAssetsByCondition.set(market.conditionId, market.outcomeAssets)
    }
  })

  const lockedByCondition: Record<string, ConditionShares> = {}

  await Promise.all(uniqueKeys.map(async ({ eventSlug, conditionId }) => {
    try {
      const outcomeAssetMap = await fetchMarketOutcomeAssetMap(eventSlug, conditionId)
      const expectedAssets = expectedAssetsByCondition.get(conditionId)
      if (!expectedAssets) {
        throw new Error(`Missing outcome assets for condition ${conditionId}`)
      }

      const availableAssets = new Set(Object.values(outcomeAssetMap))
      const hasAllAssets = expectedAssets.every(asset => availableAssets.has(asset))
      if (!hasAllAssets) {
        throw new Error(`Incomplete outcome asset mapping for condition ${conditionId}`)
      }

      const seenCursors = new Set<string>()
      let nextCursor = 'MA=='
      while (nextCursor && nextCursor !== 'LTE=' && !seenCursors.has(nextCursor)) {
        seenCursors.add(nextCursor)
        const openOrdersPage = await fetchUserOpenOrders({
          pageParam: nextCursor,
          eventSlug,
          conditionId,
        })

        openOrdersPage.data.forEach((order) => {
          if (order.side !== 'sell') {
            return
          }

          const totalShares = Math.max(
            normalizeOrderShares(order.maker_amount),
            normalizeOrderShares(order.taker_amount),
          )
          const filledShares = normalizeOrderShares(order.size_matched)
          const remainingShares = Math.max(totalShares - Math.min(filledShares, totalShares), 0)
          if (remainingShares <= 0) {
            return
          }

          const outcomeIndexValue = parseNumber(order.outcome?.index as number | string | null | undefined)
          if (!Number.isFinite(outcomeIndexValue)) {
            return
          }

          const assetKey = outcomeAssetMap[outcomeIndexValue]
          if (!assetKey) {
            return
          }

          const bucket = lockedByCondition[conditionId] ?? {}
          bucket[assetKey] = (bucket[assetKey] ?? 0) + remainingShares
          lockedByCondition[conditionId] = bucket
        })

        nextCursor = openOrdersPage.next_cursor
      }
    }
    catch (error) {
      console.error('Failed to fetch open orders for mergeable lock calculation.', error)
    }
  }))

  return lockedByCondition
}

export function sortPositions(
  positions: PublicPosition[],
  sortBy: SortOption,
  sortDirection: SortDirection = DEFAULT_SORT_DIRECTION[sortBy],
) {
  const list = [...positions]
  const multiplier = sortDirection === 'asc' ? 1 : -1

  list.sort((a, b) => {
    let result = 0
    switch (sortBy) {
      case 'currentValue':
        result = getValue(a) - getValue(b)
        break
      case 'trade':
        result = getTradeValue(a) - getTradeValue(b)
        break
      case 'pnlPercent':
        result = getPnlPercent(a) - getPnlPercent(b)
        break
      case 'pnlValue':
        result = getPnlValue(a) - getPnlValue(b)
        break
      case 'shares':
        result = (a.size ?? 0) - (b.size ?? 0)
        break
      case 'alpha':
        result = a.title.localeCompare(b.title)
        break
      case 'endingSoon':
        result = (a.timestamp ?? 0) - (b.timestamp ?? 0)
        break
      case 'payout':
        result = (a.size ?? 0) - (b.size ?? 0)
        break
      case 'latestPrice':
        result = getLatestPrice(a) - getLatestPrice(b)
        break
      case 'avgCost':
        result = (a.avgPrice ?? 0) - (b.avgPrice ?? 0)
        break
      default:
        result = 0
        break
    }

    return result * multiplier
  })

  return list
}

export function calculatePositionsTotals(positions: PublicPosition[]): PositionsTotals {
  const trade = positions.reduce((sum, position) => {
    const tradeValue = (position.size ?? 0) * (position.avgPrice ?? 0)
    return sum + tradeValue
  }, 0)
  const value = positions.reduce((sum, position) => sum + (position.currentValue ?? 0), 0)
  const toWin = positions.reduce((sum, position) => sum + (position.size ?? 0), 0)
  const diff = value - trade
  const pct = trade > 0 ? (diff / trade) * 100 : 0
  return { trade, value, diff, pct, toWin }
}
