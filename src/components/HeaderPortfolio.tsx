import { useExtracted } from 'next-intl'
import AppLink from '@/components/AppLink'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBalance } from '@/hooks/useBalance'
import { usePortfolioValue } from '@/hooks/usePortfolioValue'
import { usePortfolioValueVisibility } from '@/stores/usePortfolioValueVisibility'

export default function HeaderPortfolio() {
  const { balance, isLoadingBalance } = useBalance()
  const { isLoading, value: positionsValue } = usePortfolioValue()
  const isLoadingValue = isLoadingBalance || isLoading
  const totalPortfolioValue = (positionsValue ?? 0) + (balance?.raw ?? 0)
  const t = useExtracted()
  const areValuesHidden = usePortfolioValueVisibility(state => state.isHidden)
  const formattedPortfolioValue = Number.isFinite(totalPortfolioValue)
    ? totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00'
  const formattedCashValue = Number.isFinite(balance?.raw)
    ? (balance?.raw ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00'

  return (
    <div className="grid grid-cols-2 gap-x-1">
      <Button
        variant="ghost"
        size="header"
        className="flex h-11 flex-col items-center justify-center gap-0.5 rounded-[6px] px-2.5 py-1"
        asChild
      >
        <AppLink intentPrefetch href="/portfolio">
          <div className="translate-y-px text-xs/tight font-medium text-muted-foreground">{t('Portfolio')}</div>
          <div className="-translate-y-px text-base/tight font-semibold text-yes">
            {isLoadingValue
              ? <Skeleton className="h-5 w-12" />
              : areValuesHidden
                ? '****'
                : (
                    <>
                      $
                      {formattedPortfolioValue}
                    </>
                  )}
          </div>
        </AppLink>
      </Button>

      <Button
        variant="ghost"
        size="header"
        className="flex h-11 flex-col items-center justify-center gap-0.5 rounded-[6px] px-2.5 py-1"
        asChild
      >
        <AppLink intentPrefetch href="/portfolio">
          <div className="flex translate-y-px items-center gap-1 text-xs/tight font-medium text-muted-foreground">
            <span>{t('Cash')}</span>
          </div>
          <div className="-translate-y-px text-base/tight font-semibold text-yes">
            {isLoadingValue
              ? <Skeleton className="h-5 w-12" />
              : areValuesHidden
                ? '****'
                : (
                    <>
                      $
                      {formattedCashValue}
                    </>
                  )}
          </div>
        </AppLink>
      </Button>
    </div>
  )
}
