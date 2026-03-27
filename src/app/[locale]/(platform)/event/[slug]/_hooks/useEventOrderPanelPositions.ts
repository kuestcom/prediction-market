import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { OUTCOME_INDEX } from '@/lib/constants'
import { fetchUserPositionsForMarket } from '@/lib/data-api/user'

export function useEventOrderPanelPositions({
  makerAddress,
  conditionId,
}: {
  makerAddress: string | null
  conditionId: string | undefined
}) {
  const positionsQuery = useQuery({
    queryKey: ['order-panel-user-positions', makerAddress, conditionId],
    enabled: Boolean(makerAddress && conditionId),
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
    refetchInterval: makerAddress ? 15_000 : false,
    refetchIntervalInBackground: true,
    queryFn: ({ signal }) =>
      fetchUserPositionsForMarket({
        pageParam: 0,
        userAddress: makerAddress!,
        conditionId,
        status: 'active',
        signal,
      }),
  })

  const aggregatedPositionShares = useMemo(() => {
    if (!positionsQuery.data?.length) {
      return null
    }

    return positionsQuery.data.reduce<Record<string, Record<typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO, number>>>((acc, position) => {
      const resolvedConditionId = position.market?.condition_id
      const quantity = typeof position.total_shares === 'number' ? position.total_shares : 0
      if (!resolvedConditionId || quantity <= 0) {
        return acc
      }

      const normalizedOutcome = position.outcome_text?.toLowerCase()
      const explicitOutcomeIndex = typeof position.outcome_index === 'number' ? position.outcome_index : undefined
      const resolvedOutcomeIndex = explicitOutcomeIndex ?? (
        normalizedOutcome === 'no'
          ? OUTCOME_INDEX.NO
          : OUTCOME_INDEX.YES
      )

      if (!acc[resolvedConditionId]) {
        acc[resolvedConditionId] = {
          [OUTCOME_INDEX.YES]: 0,
          [OUTCOME_INDEX.NO]: 0,
        }
      }

      const bucket = resolvedOutcomeIndex === OUTCOME_INDEX.NO ? OUTCOME_INDEX.NO : OUTCOME_INDEX.YES
      acc[resolvedConditionId][bucket] += quantity
      return acc
    }, {})
  }, [positionsQuery.data])

  return {
    positionsQuery,
    aggregatedPositionShares,
  }
}
