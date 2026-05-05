import type { Market } from '@/types'
import EventIconImage from '@/components/EventIconImage'

interface EventOrderPanelMarketInfoProps {
  market: Market | null
}

export default function EventOrderPanelMarketInfo({ market }: EventOrderPanelMarketInfoProps) {
  if (!market) {
    return null
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-3.5">
        <EventIconImage
          src={market.icon_url}
          alt={market.title}
          sizes="48px"
          containerClassName="size-12 shrink-0 rounded-md"
        />
        <span className="line-clamp-2 text-base/tight font-bold">
          {market.short_title || market.title}
        </span>
      </div>
    </div>
  )
}
