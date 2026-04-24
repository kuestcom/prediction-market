import type { EventMarketRow } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMarketRows'

export function resolveChanceMetaForChartDelta(
  chanceMeta: EventMarketRow['chanceMeta'],
  chanceDelta: number | null,
) {
  if (typeof chanceDelta !== 'number' || !Number.isFinite(chanceDelta)) {
    return chanceMeta
  }

  const roundedChanceDelta = Math.round(chanceDelta)
  const absoluteChanceDelta = Math.abs(roundedChanceDelta)
  const shouldShowChanceChange = absoluteChanceDelta >= 1

  return {
    ...chanceMeta,
    shouldShowChanceChange,
    chanceChangeLabel: shouldShowChanceChange ? `${absoluteChanceDelta}%` : '',
    isChanceChangePositive: roundedChanceDelta > 0,
  }
}

interface EventMarketChanceMetaCarrier {
  market: {
    condition_id: string
  }
  chanceMeta: EventMarketRow['chanceMeta']
}

export function applyCachedChartDeltaToEventMarketRow<T extends EventMarketChanceMetaCarrier>(
  row: T,
  chartDeltaByMarket: Record<string, number>,
): T {
  const chanceDelta = chartDeltaByMarket[row.market.condition_id] ?? null
  const resolvedChanceMeta = resolveChanceMetaForChartDelta(row.chanceMeta, chanceDelta)

  return resolvedChanceMeta === row.chanceMeta
    ? row
    : { ...row, chanceMeta: resolvedChanceMeta } as T
}
