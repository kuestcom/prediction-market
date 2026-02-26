import { useMemo } from 'react'
import { buildUserOpenOrdersQueryKey, useUserOpenOrdersQuery } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useUserOpenOrdersQuery'
import { OUTCOME_INDEX } from '@/lib/constants'
import { normalizeShares } from '@/lib/order-panel-utils'

export function useEventOrderPanelOpenOrders({
  userId,
  eventSlug,
  conditionId,
}: {
  userId?: string | null
  eventSlug: string
  conditionId?: string
}) {
  const openOrdersQueryKey = useMemo(
    () => buildUserOpenOrdersQueryKey(userId, eventSlug, conditionId),
    [conditionId, eventSlug, userId],
  )
  const openOrdersQuery = useUserOpenOrdersQuery({
    userId,
    eventSlug,
    conditionId,
    enabled: Boolean(userId && conditionId),
  })

  const openOrders = useMemo(
    () => openOrdersQuery.data?.pages?.flatMap(page => page.data) ?? [],
    [openOrdersQuery.data],
  )

  const openSellSharesByCondition = useMemo(() => {
    if (!openOrders.length) {
      return {}
    }

    return openOrders.reduce<Record<string, Record<typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO, number>>>((acc, order) => {
      if (order.side !== 'sell' || !order.market?.condition_id) {
        return acc
      }

      const resolvedConditionId = order.market.condition_id
      const outcomeIndex = order.outcome?.index === OUTCOME_INDEX.NO ? OUTCOME_INDEX.NO : OUTCOME_INDEX.YES
      const totalShares = Math.max(
        normalizeShares(order.maker_amount),
        normalizeShares(order.taker_amount),
      )
      const filledShares = Math.max(normalizeShares(order.size_matched), 0)
      const remainingShares = Math.max(totalShares - Math.min(filledShares, totalShares), 0)

      if (remainingShares <= 0) {
        return acc
      }

      if (!acc[resolvedConditionId]) {
        acc[resolvedConditionId] = {
          [OUTCOME_INDEX.YES]: 0,
          [OUTCOME_INDEX.NO]: 0,
        }
      }

      acc[resolvedConditionId][outcomeIndex] += remainingShares
      return acc
    }, {})
  }, [openOrders])

  return {
    openOrdersQueryKey,
    openOrdersQuery,
    openOrders,
    openSellSharesByCondition,
  }
}
