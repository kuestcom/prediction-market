import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query'
import type { SharesByCondition } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useUserShareBalances'
import type { PortfolioUserOpenOrder } from '@/app/[locale]/(platform)/portfolio/_types/PortfolioOpenOrdersTypes'
import type { PublicPosition } from '@/app/[locale]/(platform)/profile/_components/PublicPositionItem'
import type { UserOpenOrder, UserPosition } from '@/types'
import { MICRO_UNIT, OUTCOME_INDEX } from '@/lib/constants'

type OutcomeIndex = typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO

interface PositionDelta {
  conditionId: string
  outcomeIndex: OutcomeIndex
  sharesDelta: number
  avgPrice?: number | null
  currentPrice?: number | null
  title?: string | null
  slug?: string | null
  eventSlug?: string | null
  iconUrl?: string | null
  outcomeText?: string | null
  isActive?: boolean
  isResolved?: boolean
}

interface ShareDelta {
  conditionId: string
  outcomeIndex: OutcomeIndex
  sharesDelta: number
}

interface PublicConditionReduction {
  conditionId: string
  sharesDelta: number
  currentPrice?: number | null
}

interface OptimisticOpenOrderInput {
  id: string
  side: 'buy' | 'sell'
  type: UserOpenOrder['type']
  price: number
  shares: number
  totalValue: number
  expiration?: number | null
  outcomeIndex: OutcomeIndex
  outcomeText: string
  conditionId: string
  marketTitle: string
  marketSlug: string
  eventSlug?: string | null
  eventTitle?: string | null
  iconUrl?: string | null
  createdAt?: string
}

type OpenOrdersInfiniteData<TOrder extends { id: string }> = InfiniteData<{
  data: TOrder[]
  next_cursor: string
}>

function roundNumber(value: number, decimals = 6) {
  if (!Number.isFinite(value)) {
    return 0
  }

  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function clampPrice(value: number | null | undefined, fallback = 0.5) {
  if (value == null || !Number.isFinite(value)) {
    return fallback
  }

  if (value <= 0) {
    return 0
  }

  if (value > 1) {
    return 1
  }

  return value
}

function toMicroNumber(value: number) {
  return Math.round(roundNumber(value) * MICRO_UNIT)
}

function resolveOutcomeIndex(outcomeIndex?: number, outcomeText?: string | null) {
  if (outcomeIndex === OUTCOME_INDEX.NO || outcomeIndex === OUTCOME_INDEX.YES) {
    return outcomeIndex
  }

  return outcomeText?.toLowerCase() === 'no'
    ? OUTCOME_INDEX.NO
    : OUTCOME_INDEX.YES
}

function resolveUserPositionShares(position: UserPosition) {
  if (typeof position.total_shares === 'number' && Number.isFinite(position.total_shares)) {
    return position.total_shares
  }

  if (typeof position.size === 'number' && Number.isFinite(position.size)) {
    return position.size
  }

  return 0
}

function resolveUserPositionAvgPrice(position: UserPosition) {
  if (typeof position.avgPrice === 'number' && Number.isFinite(position.avgPrice)) {
    return clampPrice(position.avgPrice, 0)
  }

  if (typeof position.average_position === 'number' && Number.isFinite(position.average_position)) {
    return clampPrice(position.average_position / MICRO_UNIT, 0)
  }

  return 0
}

function resolveUserPositionCost(position: UserPosition) {
  if (typeof position.total_position_cost === 'number' && Number.isFinite(position.total_position_cost)) {
    return Math.max(0, position.total_position_cost / MICRO_UNIT)
  }

  const shares = resolveUserPositionShares(position)
  const avgPrice = resolveUserPositionAvgPrice(position)
  return Math.max(0, shares * avgPrice)
}

function resolveUserPositionCurrentPrice(position: UserPosition) {
  if (typeof position.curPrice === 'number' && Number.isFinite(position.curPrice)) {
    return clampPrice(position.curPrice, 0)
  }

  const shares = resolveUserPositionShares(position)
  if (shares > 0 && typeof position.currentValue === 'number' && Number.isFinite(position.currentValue)) {
    return clampPrice(position.currentValue / shares, 0)
  }

  return resolveUserPositionAvgPrice(position)
}

function buildOptimisticUserPosition(delta: PositionDelta, nowIso: string): UserPosition {
  const shares = Math.max(0, roundNumber(delta.sharesDelta))
  const avgPrice = clampPrice(delta.avgPrice ?? delta.currentPrice, 0.5)
  const currentPrice = clampPrice(delta.currentPrice ?? delta.avgPrice, avgPrice)
  const currentValue = roundNumber(shares * currentPrice)
  const totalCost = roundNumber(shares * avgPrice)

  return {
    market: {
      condition_id: delta.conditionId,
      title: delta.title ?? 'Untitled market',
      slug: delta.slug ?? delta.conditionId,
      icon_url: delta.iconUrl ?? '',
      is_active: delta.isActive ?? true,
      is_resolved: delta.isResolved ?? false,
      event: {
        slug: delta.eventSlug ?? delta.slug ?? delta.conditionId,
      },
    },
    outcome_index: delta.outcomeIndex,
    outcome_text: delta.outcomeText ?? (delta.outcomeIndex === OUTCOME_INDEX.NO ? 'No' : 'Yes'),
    avgPrice,
    curPrice: currentPrice,
    currentValue,
    totalBought: totalCost,
    initialValue: totalCost,
    average_position: toMicroNumber(avgPrice),
    total_position_value: toMicroNumber(currentValue),
    total_position_cost: toMicroNumber(totalCost),
    total_shares: shares,
    size: shares,
    profit_loss_value: 0,
    profit_loss_percent: 0,
    realizedPnl: 0,
    cashPnl: 0,
    percentPnl: 0,
    percentRealizedPnl: 0,
    redeemable: false,
    order_count: 1,
    last_activity_at: nowIso,
  }
}

function applyPositionDelta(position: UserPosition, delta: PositionDelta, nowIso: string) {
  const previousShares = resolveUserPositionShares(position)
  const previousAvgPrice = resolveUserPositionAvgPrice(position)
  const previousCost = resolveUserPositionCost(position)
  const previousCurrentPrice = resolveUserPositionCurrentPrice(position)
  const normalizedDeltaShares = roundNumber(delta.sharesDelta)
  const nextShares = Math.max(0, roundNumber(previousShares + normalizedDeltaShares))

  if (nextShares <= 0) {
    return null
  }

  const referencePrice = normalizedDeltaShares >= 0
    ? clampPrice(delta.avgPrice ?? delta.currentPrice, previousAvgPrice || previousCurrentPrice || 0.5)
    : (previousShares > 0 ? previousCost / previousShares : previousAvgPrice)
  const deltaCost = normalizedDeltaShares >= 0
    ? normalizedDeltaShares * referencePrice
    : -Math.min(previousShares, Math.abs(normalizedDeltaShares)) * referencePrice
  const nextCost = Math.max(0, roundNumber(previousCost + deltaCost))
  const nextAvgPrice = nextShares > 0
    ? clampPrice(nextCost / nextShares, referencePrice || previousAvgPrice || 0.5)
    : 0
  const nextCurrentPrice = clampPrice(delta.currentPrice, previousCurrentPrice || nextAvgPrice || referencePrice)
  const nextCurrentValue = roundNumber(nextShares * nextCurrentPrice)
  const pnlValue = roundNumber(nextCurrentValue - nextCost)
  const pnlPercent = nextCost > 0 ? roundNumber((pnlValue / nextCost) * 100, 4) : 0

  return {
    ...position,
    market: {
      ...position.market,
      condition_id: delta.conditionId,
      title: delta.title ?? position.market.title,
      slug: delta.slug ?? position.market.slug,
      icon_url: delta.iconUrl ?? position.market.icon_url,
      is_active: delta.isActive ?? position.market.is_active,
      is_resolved: delta.isResolved ?? position.market.is_resolved,
      event: {
        slug: delta.eventSlug ?? position.market.event?.slug ?? position.market.slug,
      },
    },
    outcome_index: delta.outcomeIndex,
    outcome_text: delta.outcomeText ?? position.outcome_text ?? (delta.outcomeIndex === OUTCOME_INDEX.NO ? 'No' : 'Yes'),
    avgPrice: nextAvgPrice,
    curPrice: nextCurrentPrice,
    currentValue: nextCurrentValue,
    totalBought: nextCost,
    initialValue: nextCost,
    average_position: toMicroNumber(nextAvgPrice),
    total_position_value: toMicroNumber(nextCurrentValue),
    total_position_cost: toMicroNumber(nextCost),
    total_shares: nextShares,
    size: nextShares,
    profit_loss_value: toMicroNumber(pnlValue),
    profit_loss_percent: pnlPercent,
    last_activity_at: nowIso,
    redeemable: false,
    order_count: Math.max(1, position.order_count + (normalizedDeltaShares > 0 ? 1 : 0)),
  }
}

export function applyPositionDeltasToUserPositions(
  positions: UserPosition[] | undefined,
  deltas: PositionDelta[],
) {
  if (!Array.isArray(positions) || deltas.length === 0) {
    return positions
  }

  let nextPositions = [...positions]
  let hasChanges = false
  const nowIso = new Date().toISOString()

  deltas.forEach((delta) => {
    if (!delta.conditionId || !Number.isFinite(delta.sharesDelta) || delta.sharesDelta === 0) {
      return
    }

    const matchIndex = nextPositions.findIndex(position =>
      position.market?.condition_id === delta.conditionId
      && resolveOutcomeIndex(position.outcome_index, position.outcome_text) === delta.outcomeIndex,
    )

    if (matchIndex === -1) {
      if (delta.sharesDelta <= 0) {
        return
      }

      nextPositions = [buildOptimisticUserPosition(delta, nowIso), ...nextPositions]
      hasChanges = true
      return
    }

    const nextPosition = applyPositionDelta(nextPositions[matchIndex], delta, nowIso)
    hasChanges = true

    if (!nextPosition) {
      nextPositions = nextPositions.filter((_, index) => index !== matchIndex)
      return
    }

    nextPositions[matchIndex] = nextPosition
  })

  return hasChanges ? nextPositions : positions
}

function resolvePublicPositionPrice(position: PublicPosition) {
  if (typeof position.curPrice === 'number' && Number.isFinite(position.curPrice)) {
    return clampPrice(position.curPrice, 0)
  }

  if (typeof position.avgPrice === 'number' && Number.isFinite(position.avgPrice)) {
    return clampPrice(position.avgPrice, 0)
  }

  return 0
}

function updatePublicPosition(position: PublicPosition, sharesDelta: number, nextPrice: number | null | undefined) {
  const previousShares = typeof position.size === 'number' && Number.isFinite(position.size) ? position.size : 0
  const nextShares = Math.max(0, roundNumber(previousShares + sharesDelta))

  if (nextShares <= 0) {
    return null
  }

  const currentPrice = clampPrice(nextPrice, resolvePublicPositionPrice(position))

  return {
    ...position,
    size: nextShares,
    currentValue: roundNumber(nextShares * currentPrice),
    curPrice: currentPrice,
    timestamp: Date.now(),
  }
}

export function applyPositionDeltasToPublicPositions(
  positions: PublicPosition[] | undefined,
  deltas: Pick<PositionDelta, 'conditionId' | 'outcomeIndex' | 'sharesDelta' | 'currentPrice'>[],
) {
  if (!Array.isArray(positions) || deltas.length === 0) {
    return positions
  }

  let nextPositions = [...positions]
  let hasChanges = false

  deltas.forEach((delta) => {
    const matchIndex = nextPositions.findIndex(position =>
      position.conditionId === delta.conditionId
      && resolveOutcomeIndex(position.outcomeIndex, position.outcome) === delta.outcomeIndex,
    )

    if (matchIndex === -1) {
      return
    }

    hasChanges = true
    const nextPosition = updatePublicPosition(nextPositions[matchIndex], delta.sharesDelta, delta.currentPrice)
    if (!nextPosition) {
      nextPositions = nextPositions.filter((_, index) => index !== matchIndex)
      return
    }

    nextPositions[matchIndex] = nextPosition
  })

  return hasChanges ? nextPositions : positions
}

export function removeClaimedPublicPositions(
  positions: PublicPosition[] | undefined,
  claimedConditionIds: string[],
) {
  if (!Array.isArray(positions) || claimedConditionIds.length === 0) {
    return positions
  }

  const claimedSet = new Set(claimedConditionIds)
  const nextPositions = positions.filter(position => !position.conditionId || !claimedSet.has(position.conditionId))
  return nextPositions.length === positions.length ? positions : nextPositions
}

export function applyConditionReductionsToPublicPositions(
  positions: PublicPosition[] | undefined,
  reductions: PublicConditionReduction[],
) {
  if (!Array.isArray(positions) || reductions.length === 0) {
    return positions
  }

  let nextPositions = [...positions]
  let hasChanges = false

  reductions.forEach((reduction) => {
    if (!reduction.conditionId || !Number.isFinite(reduction.sharesDelta) || reduction.sharesDelta === 0) {
      return
    }

    nextPositions = nextPositions.flatMap((position) => {
      if (position.conditionId !== reduction.conditionId) {
        return [position]
      }

      hasChanges = true
      const nextPosition = updatePublicPosition(position, reduction.sharesDelta, reduction.currentPrice)
      return nextPosition ? [nextPosition] : []
    })
  })

  return hasChanges ? nextPositions : positions
}

export function applyShareDeltas(
  sharesByCondition: SharesByCondition | undefined,
  deltas: ShareDelta[],
) {
  if (!sharesByCondition || deltas.length === 0) {
    return sharesByCondition
  }

  const nextShares: SharesByCondition = { ...sharesByCondition }
  let hasChanges = false

  deltas.forEach((delta) => {
    if (!delta.conditionId || !Number.isFinite(delta.sharesDelta) || delta.sharesDelta === 0) {
      return
    }

    const currentConditionShares = nextShares[delta.conditionId] ?? {
      [OUTCOME_INDEX.YES]: 0,
      [OUTCOME_INDEX.NO]: 0,
    }
    const nextConditionShares = {
      ...currentConditionShares,
      [delta.outcomeIndex]: Math.max(
        0,
        roundNumber((currentConditionShares[delta.outcomeIndex] ?? 0) + delta.sharesDelta),
      ),
    }

    hasChanges = true

    if (nextConditionShares[OUTCOME_INDEX.YES] <= 0 && nextConditionShares[OUTCOME_INDEX.NO] <= 0) {
      delete nextShares[delta.conditionId]
      return
    }

    nextShares[delta.conditionId] = nextConditionShares
  })

  return hasChanges ? nextShares : sharesByCondition
}

export function buildOptimisticOpenOrder({
  id,
  side,
  type,
  price,
  shares,
  totalValue,
  expiration = null,
  outcomeIndex,
  outcomeText,
  conditionId,
  marketTitle,
  marketSlug,
  eventSlug,
  eventTitle,
  iconUrl,
  createdAt,
}: OptimisticOpenOrderInput): PortfolioUserOpenOrder {
  const normalizedShares = Math.max(0, roundNumber(shares))
  const normalizedTotalValue = Math.max(0, roundNumber(totalValue))
  const makerAmount = side === 'buy' ? toMicroNumber(normalizedTotalValue) : toMicroNumber(normalizedShares)
  const takerAmount = side === 'buy' ? toMicroNumber(normalizedShares) : toMicroNumber(normalizedTotalValue)

  return {
    id,
    side,
    type,
    status: 'open',
    price,
    maker_amount: makerAmount,
    taker_amount: takerAmount,
    size_matched: 0,
    created_at: createdAt ?? new Date().toISOString(),
    expiration,
    outcome: {
      index: outcomeIndex,
      text: outcomeText,
    },
    market: {
      condition_id: conditionId,
      title: marketTitle,
      slug: marketSlug,
      is_active: true,
      is_resolved: false,
      icon_url: iconUrl ?? undefined,
      event_slug: eventSlug ?? undefined,
      event_title: eventTitle ?? undefined,
    },
  }
}

export function prependOpenOrderToInfiniteData<TOrder extends { id: string }>(
  current: OpenOrdersInfiniteData<TOrder> | undefined,
  order: TOrder,
) {
  if (!current) {
    return current
  }

  const firstPage = current.pages[0]
  if (!firstPage) {
    return current
  }

  const alreadyExists = current.pages.some(page => page.data.some(existing => existing.id === order.id))
  if (alreadyExists) {
    return current
  }

  return {
    ...current,
    pages: [
      {
        ...firstPage,
        data: [order, ...firstPage.data],
      },
      ...current.pages.slice(1),
    ],
  }
}

export function removeOpenOrdersFromInfiniteData<TOrder extends { id: string }>(
  current: OpenOrdersInfiniteData<TOrder> | undefined,
  orderIds: string[],
) {
  if (!current || orderIds.length === 0) {
    return current
  }

  const orderIdSet = new Set(orderIds)
  let hasChanges = false
  const nextPages = current.pages.map((page) => {
    const nextData = page.data.filter((order) => {
      const shouldKeep = !orderIdSet.has(order.id)
      if (!shouldKeep) {
        hasChanges = true
      }
      return shouldKeep
    })

    return nextData.length === page.data.length
      ? page
      : {
          ...page,
          data: nextData,
        }
  })

  return hasChanges
    ? {
        ...current,
        pages: nextPages,
      }
    : current
}

export function updateQueryDataWhere<TData>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  shouldUpdate: (currentQueryKey: QueryKey) => boolean,
  updater: (data: TData | undefined) => TData | undefined,
) {
  queryClient.getQueriesData<TData>({ queryKey }).forEach(([currentQueryKey]) => {
    if (!shouldUpdate(currentQueryKey)) {
      return
    }

    queryClient.setQueryData<TData>(currentQueryKey, current => updater(current))
  })
}
