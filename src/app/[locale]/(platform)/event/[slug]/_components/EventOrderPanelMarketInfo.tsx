import type { Market } from '@/types'
import Image from 'next/image'

interface EventOrderPanelMarketInfoProps {
  market: Market | null
}

export default function EventOrderPanelMarketInfo({ market }: EventOrderPanelMarketInfoProps) {
  if (!market) {
    return <></>
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-3.5">
        <Image
          src={market.icon_url}
          alt={market.title}
          width={48}
          height={48}
          className="shrink-0 rounded-md"
        />
        <span className="line-clamp-2 text-base/tight font-bold">
          {market.short_title || market.title}
        </span>
      </div>
    </div>
  )
}
