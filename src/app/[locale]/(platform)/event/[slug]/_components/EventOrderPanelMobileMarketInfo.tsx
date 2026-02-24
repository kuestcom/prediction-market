import type { Event, Market } from '@/types'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import { Skeleton } from '@/components/ui/skeleton'
import { usePortfolioValueVisibility } from '@/stores/usePortfolioValueVisibility'

interface EventOrderPanelMobileMarketInfoProps {
  event: Event
  market: Market | null
  isSingleMarket: boolean
  balanceText: string
  isBalanceLoading?: boolean
}

export default function EventOrderPanelMobileMarketInfo({
  event,
  market,
  isSingleMarket,
  balanceText,
  isBalanceLoading = false,
}: EventOrderPanelMobileMarketInfoProps) {
  const t = useExtracted()
  const areValuesHidden = usePortfolioValueVisibility(state => state.isHidden)

  if (!market) {
    return <></>
  }

  return (
    <div className="mb-4 flex items-center gap-3.5">
      <Image
        src={market.icon_url}
        alt={market.title}
        width={36}
        height={36}
        className="shrink-0 rounded-md"
      />
      <div className="flex-1">
        <div className="line-clamp-2 text-base/tight font-semibold">
          {event.title}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {!isSingleMarket && <span>{market.short_title || market.title}</span>}
          <span className="flex items-center gap-1">
            <span>{t('Bal.')}</span>
            {isBalanceLoading
              ? <Skeleton className="inline-block h-3 w-10 align-middle" />
              : (
                  <>
                    {areValuesHidden ? '****' : `$${balanceText}`}
                  </>
                )}
          </span>
        </div>
      </div>
    </div>
  )
}
