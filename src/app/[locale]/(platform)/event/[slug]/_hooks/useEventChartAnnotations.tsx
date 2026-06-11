'use client'

import type { ReactNode } from 'react'
import type { ActivityOrder } from '@/types'
import type { PredictionChartAnnotationMarker } from '@/types/PredictionChartTypes'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  fetchUserTradeActivityForConditionIds,
  resolveOutcomeIconUrl,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/eventChartInternalHelpers'
import EventIconImage from '@/components/EventIconImage'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { OUTCOME_INDEX } from '@/lib/constants'
import { formatDollarValueLabel, formatSharePriceLabel, formatSharesLabel, fromMicro } from '@/lib/formatters'

import { cn } from '@/lib/utils'

function buildAnnotationTooltip(params: {
  outcomeIconUrl: string
  outcomeLabel: string
  actionLabel: string
  sharesLabel: string
  outcomeColorClass: string
  priceLabel: string
  totalValueLabel: string
}): ReactNode {
  const { outcomeIconUrl, outcomeLabel, actionLabel, sharesLabel, outcomeColorClass, priceLabel, totalValueLabel } = params
  return (
    <div className="flex items-center gap-2 text-xs whitespace-nowrap">
      {outcomeIconUrl
        ? (
            <EventIconImage
              src={outcomeIconUrl}
              alt={outcomeLabel}
              sizes="20px"
              containerClassName="size-5 rounded-full"
            />
          )
        : null}
      <span className="font-semibold text-foreground">{actionLabel}</span>
      <span className={cn('font-semibold', outcomeColorClass)}>
        {sharesLabel}
        {' '}
        {outcomeLabel}
      </span>
      <span className="text-foreground">
        at
        {' '}
        {priceLabel}
      </span>
      <span className="text-muted-foreground">
        (
        {totalValueLabel}
        )
      </span>
    </div>
  )
}

function buildMarkerFromActivity(
  activity: ActivityOrder,
  index: number,
  markerConditionIds: string[],
  showBothOutcomes: boolean,
  normalizeOutcomeLabel: (label: string) => string,
): PredictionChartAnnotationMarker | null {
  const conditionId = activity.market.condition_id
  if (!conditionId || !markerConditionIds.includes(conditionId)) {
    return null
  }

  const createdAtTimestamp = new Date(activity.created_at).getTime()
  if (!Number.isFinite(createdAtTimestamp)) {
    return null
  }

  const rawPrice = Number(activity.price)
  if (!Number.isFinite(rawPrice)) {
    return null
  }

  const outcomeIndex = Number(activity.outcome.index)
  const isYesOutcome = outcomeIndex === OUTCOME_INDEX.YES
  const isNoOutcome = outcomeIndex === OUTCOME_INDEX.NO
  if (!isYesOutcome && !isNoOutcome) {
    return null
  }

  const normalizedLineValue = showBothOutcomes
    ? rawPrice * 100
    : (isNoOutcome ? (1 - rawPrice) * 100 : rawPrice * 100)

  if (!Number.isFinite(normalizedLineValue)) {
    return null
  }

  const sharesValue = Number.parseFloat(fromMicro(activity.amount, 4))
  const sharesLabel = Number.isFinite(sharesValue)
    ? formatSharesLabel(sharesValue)
    : '—'
  const outcomeLabel = normalizeOutcomeLabel(activity.outcome.text)
  const actionLabel = activity.side === 'sell' ? 'Sold' : 'Bought'
  const priceLabel = formatSharePriceLabel(rawPrice, { fallback: '—' })
  const totalValue = Number.parseFloat(fromMicro(activity.total_value, 2))
  const totalValueLabel = formatDollarValueLabel(Number.isFinite(totalValue) ? totalValue : 0, { fallback: '0¢' })
  const outcomeIconUrl = resolveOutcomeIconUrl(activity.market.icon_url)
  const outcomeColorClass = isYesOutcome ? 'text-yes' : 'text-no'
  const markerColor = isYesOutcome ? 'var(--color-yes)' : 'var(--color-no)'

  return {
    id: `trade-${activity.id}-${createdAtTimestamp}-${index}`,
    date: new Date(createdAtTimestamp),
    value: normalizedLineValue,
    color: markerColor,
    radius: 3.6,
    tooltipContent: buildAnnotationTooltip({
      outcomeIconUrl,
      outcomeLabel,
      actionLabel,
      sharesLabel,
      outcomeColorClass,
      priceLabel,
      totalValueLabel,
    }),
  }
}

export function useEventChartAnnotations(params: {
  eventId: string
  userAddress: string | null
  markerConditionIds: string[]
  showBothOutcomes: boolean
  annotationsEnabled: boolean
}) {
  const { eventId, userAddress, markerConditionIds, showBothOutcomes, annotationsEnabled } = params
  const normalizeOutcomeLabel = useOutcomeLabel()

  const markerConditionSignature = useMemo(
    () => markerConditionIds.slice().sort().join(','),
    [markerConditionIds],
  )

  const { data: userTradeActivities = [] } = useQuery({
    queryKey: ['event-chart-user-trade-markers', eventId, userAddress, markerConditionSignature],
    queryFn: ({ signal }) => fetchUserTradeActivityForConditionIds({
      userAddress: userAddress!,
      conditionIds: markerConditionIds,
      signal,
    }),
    enabled: Boolean(annotationsEnabled && userAddress && markerConditionIds.length > 0),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  })

  const chartAnnotationMarkers = useMemo<PredictionChartAnnotationMarker[]>(() => {
    if (!userTradeActivities.length) {
      return []
    }

    return userTradeActivities.flatMap((activity, index) => {
      const marker = buildMarkerFromActivity(
        activity,
        index,
        markerConditionIds,
        showBothOutcomes,
        normalizeOutcomeLabel,
      )
      return marker ? [marker] : []
    })
  }, [markerConditionIds, normalizeOutcomeLabel, showBothOutcomes, userTradeActivities])

  return chartAnnotationMarkers
}
