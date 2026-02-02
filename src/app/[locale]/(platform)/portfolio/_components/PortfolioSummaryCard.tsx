'use client'

import { useAppKitAccount } from '@reown/appkit/react'
import PortfolioWalletActions from '@/app/[locale]/(platform)/portfolio/_components/PortfolioWalletActions'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useBalance } from '@/hooks/useBalance'
import { useClientMounted } from '@/hooks/useClientMounted'
import { usePortfolioValue } from '@/hooks/usePortfolioValue'

export default function PortfolioSummaryCard() {
  const dailyChange = 0.00
  const dailyChangePercent = 0.00
  const isPositive = dailyChange >= 0
  const isMounted = useClientMounted()
  const { status } = useAppKitAccount()
  const { value: positionsValue, isLoading, isFetching } = usePortfolioValue()
  const { balance, isLoadingBalance } = useBalance()
  const isLoadingState = !isMounted || status === 'connecting' || isLoadingBalance || (isLoading && !isFetching)
  const portfolioTotalValue = positionsValue + balance.raw
  const formattedValue = Number.isFinite(portfolioTotalValue)
    ? portfolioTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00'

  if (isLoadingState) {
    return <Skeleton className="h-56 w-full" />
  }

  return (
    <Card className="border bg-transparent">
      <CardContent className="flex flex-col p-6">

        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-sm border p-1">
              <svg
                className="size-4 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <span className="text-sm font-medium text-muted-foreground uppercase">Portfolio</span>
          </div>
          <div className="flex items-center gap-1 rounded-sm border px-2 py-1 text-xs font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 20 14" fill="none">
              <path d="M0 8V5.49951H20V7.74951L5.5 14.0005L0 8Z" fill="#21832D"></path>
              <path d="M12.5 -0.000488281L0 5.49951L5.5 11.6245L20 5.49951L12.5 -0.000488281Z" fill="#3AB549"></path>
              <path d="M3.5 5.49951C4.3 6.29951 3.5 6.66667 3 7L5 9C6.2 8.2 6.66667 8.83333 7 9.5L15.5 6C13.9 4.8 15 4.33284 15.5 3.99951L13.5 2.49951C12.3 2.89951 11.3333 2.33285 11 1.99951L3.5 5.49951Z" fill="#92FF04"></path>
              <ellipse cx="9.5" cy="5.49951" rx="2.5" ry="1.5" fill="#3AB549"></ellipse>
            </svg>
            <span>
              $
              {balance.text}
            </span>
          </div>
        </div>

        <div className="mb-2">
          <div className="text-3xl font-bold text-foreground">
            $
            {formattedValue}
          </div>
        </div>

        <div className="mb-6">
          <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-yes' : 'text-no'}`}>
            <span>
              $
              {dailyChange.toFixed(2)}
            </span>
            <span>
              (
              {dailyChangePercent.toFixed(2)}
              %)
            </span>
            <span className="text-muted-foreground">Today</span>
          </div>
        </div>

        <PortfolioWalletActions className="mt-auto" />
      </CardContent>
    </Card>
  )
}
