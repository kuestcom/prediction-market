import type { Event } from '@/types'
import { buildMarketTargets } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import { isMarketResolved } from '@/app/[locale]/(platform)/event/[slug]/_utils/eventMarketUtils'

export function buildRowChartDeltaTargets(markets: Event['markets']) {
  return buildMarketTargets(
    markets.filter(market => !isMarketResolved(market)),
  )
}
