'use client'

import type { TradeFlowLabelItem } from '@/app/[locale]/(platform)/event/[slug]/_utils/eventChartInternalHelpers'
import { tradeFlowTextStrokeStyle } from '@/app/[locale]/(platform)/event/[slug]/_utils/eventChartInternalHelpers'
import { cn } from '@/lib/utils'

interface EventChartTradeFlowProps {
  items: TradeFlowLabelItem[]
}

export default function EventChartTradeFlow({ items }: EventChartTradeFlowProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className={cn(`
      pointer-events-none absolute bottom-6 left-4 flex flex-col gap-1 text-sm font-semibold tabular-nums
    `)}
    >
      {items.map(item => (
        <span
          key={item.id}
          className={cn(`${item.outcome === 'yes' ? 'text-yes' : 'text-no'} animate-trade-flow-rise`)}
          style={tradeFlowTextStrokeStyle}
        >
          +
          {item.label}
        </span>
      ))}
    </div>
  )
}
