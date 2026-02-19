import { ArrowDownIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBalance } from '@/hooks/useBalance'
import { usePendingUsdcDeposit } from '@/hooks/usePendingUsdcDeposit'
import { usePortfolioValue } from '@/hooks/usePortfolioValue'
import { Link } from '@/i18n/navigation'
import { usePortfolioValueVisibility } from '@/stores/usePortfolioValueVisibility'

export default function HeaderPortfolio() {
  const { balance, isLoadingBalance } = useBalance()
  const { hasPendingDeposit } = usePendingUsdcDeposit()
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
        <Link href="/portfolio">
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
        </Link>
      </Button>

      <Button
        variant="ghost"
        size="header"
        className="flex h-11 flex-col items-center justify-center gap-0.5 rounded-[6px] px-2.5 py-1"
        asChild
      >
        <Link href="/portfolio">
          <div className="flex translate-y-px items-center gap-1 text-xs/tight font-medium text-muted-foreground">
            <span>{t('Cash')}</span>
            {hasPendingDeposit && (
              <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary">
                <ArrowDownIcon className="size-3 text-background" />
              </span>
            )}
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
        </Link>
      </Button>
    </div>
  )
}
