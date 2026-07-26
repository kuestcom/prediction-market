import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query'
import type { SharesByCondition } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useUserShareBalances'
import type { PortfolioUserOpenOrder } from '@/app/[locale]/(platform)/portfolio/_types/PortfolioOpenOrdersTypes'
import type { PublicPosition } from '@/app/[locale]/(platform)/profile/_components/PublicPositionItem'
import type { UserOpenOrder } from '@/types'
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
