import { useExtracted } from 'next-intl'
import { usePathname } from 'next/navigation'
import { useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBalance } from '@/hooks/useBalance'
import { usePolymarketBalance } from '@/hooks/usePolymarketBalance'
import { usePortfolioValue } from '@/hooks/usePortfolioValue'
import { Link } from '@/i18n/navigation'
import { formatNumber } from '@/lib/formatters'
import { usePolymarketWallet } from '@/stores/usePolymarketWallet'
import { usePortfolioValueVisibility } from '@/stores/usePortfolioValueVisibility'

export default function HeaderPortfolio() {
  const pathname = usePathname()
  const { balance, isLoadingBalance } = useBalance()
  const polymarketWalletStatus = usePolymarketWallet(state => state.status)
  const { isLoading, value: positionsValue } = usePortfolioValue()
  const isLoadingValue = isLoadingBalance || isLoading
  const totalPortfolioValue = (positionsValue ?? 0) + (balance?.raw ?? 0)
  const t = useExtracted()
  const areValuesHidden = usePortfolioValueVisibility(state => state.isHidden)
  const formattedPortfolioValue = Number.isFinite(totalPortfolioValue)
    ? formatNumber(totalPortfolioValue, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00'
  const formattedCashValue = Number.isFinite(balance?.raw)
    ? formatNumber(balance?.raw ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00'
  const isArbitrageMode = useSyncExternalStore(
    (callback) => {
      window.addEventListener('kuest:order-panel-mode-change', callback)
      return () => window.removeEventListener('kuest:order-panel-mode-change', callback)
    },
    () => document.documentElement.dataset.orderPanelMode === 'arbitrage',
    () => false,
  )
  const isEventPage = /(?:^|\/)event\/[^/]+/.test(pathname)
  const showPolymarketCash = polymarketWalletStatus === 'connected' && isEventPage && isArbitrageMode
  const { balance: polymarketBalance, isLoading: isPolymarketBalanceLoading } = usePolymarketBalance({
    enabled: showPolymarketCash,
  })
  const formattedPolymarketCashValue = Number.isFinite(polymarketBalance)
    ? formatNumber(polymarketBalance, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00'

  return (
    <div className={showPolymarketCash ? 'grid grid-cols-3 gap-x-1' : 'grid grid-cols-2 gap-x-1'}>
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

      {showPolymarketCash && (
        <Button
          variant="ghost"
          size="header"
          className="flex h-11 flex-col items-center justify-center gap-0.5 rounded-[6px] px-2.5 py-1"
          asChild
        >
          <a href="https://polymarket.com/portfolio" target="_blank" rel="noreferrer">
            <div className="translate-y-px text-xs/tight font-medium whitespace-nowrap text-muted-foreground">
              Polymarket
            </div>
            <div className="-translate-y-px text-base/tight font-semibold text-[#2E5CFF]">
              {isPolymarketBalanceLoading
                ? <Skeleton className="h-5 w-12" />
                : areValuesHidden
                  ? '****'
                  : (
                      <>
                        $
                        {formattedPolymarketCashValue}
                      </>
                    )}
            </div>
          </a>
        </Button>
      )}
    </div>
  )
}
