'use client'

import type { ReactNode } from 'react'
import type { PortfolioSnapshot } from '@/lib/portfolio'
import { CheckIcon, EyeIcon, FocusIcon } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useBalance } from '@/hooks/useBalance'
import { useClipboard } from '@/hooks/useClipboard'
import { usePortfolioValue } from '@/hooks/usePortfolioValue'
import { getAvatarPlaceholderStyle, shouldUseAvatarPlaceholder } from '@/lib/avatar'
import { formatCompactCount, formatCompactCurrency, formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export interface ProfileForCards {
  username: string
  avatarUrl: string
  joinedAt?: string
  viewsCount?: number
  portfolioAddress?: string | null
}

interface ProfileOverviewCardProps {
  profile: ProfileForCards
  snapshot: PortfolioSnapshot
  actions?: ReactNode
  variant?: 'public' | 'portfolio'
  useDefaultUserWallet?: boolean
  enableLiveValue?: boolean
}

export default function ProfileOverviewCard({
  profile,
  snapshot,
  actions,
  variant = 'public',
  useDefaultUserWallet = true,
  enableLiveValue = true,
}: ProfileOverviewCardProps) {
  const { copied, copy } = useClipboard()
  const liveWalletAddress = enableLiveValue ? profile.portfolioAddress : null
  const { value: livePositionsValue, isLoading } = usePortfolioValue(
    liveWalletAddress,
    { useDefaultUser: useDefaultUserWallet },
  )
  const hasLiveValue = Boolean(liveWalletAddress) && !isLoading
  const positionsValue = hasLiveValue ? livePositionsValue ?? snapshot.positionsValue : snapshot.positionsValue
  const { balance, isLoadingBalance } = useBalance({ enabled: variant === 'portfolio' })
  const shouldWaitForBalance = variant === 'portfolio'
  const isInitialLoading = shouldWaitForBalance ? isLoadingBalance || isLoading : isLoading
  const [hasLoaded, setHasLoaded] = useState(!isInitialLoading)

  useEffect(() => {
    if (!isInitialLoading) {
      setHasLoaded(true)
    }
  }, [isInitialLoading])

  const isReady = hasLoaded
  const totalPortfolioValue = (positionsValue ?? 0) + (balance?.raw ?? 0)
  const formattedTotalValue = variant === 'portfolio'
    ? formatCurrency(totalPortfolioValue, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : formatCompactCurrency(totalPortfolioValue)
  const formattedCashValue = variant === 'portfolio'
    ? formatCurrency(balance?.raw ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2, includeSymbol: false })
    : formatCompactCurrency(balance?.raw ?? 0).replace('$', '')
  const avatarUrl = profile.avatarUrl?.trim() ?? ''
  const showPlaceholder = shouldUseAvatarPlaceholder(avatarUrl)
  const avatarSeed = profile.portfolioAddress || profile.username || 'user'
  const avatarFallbackStyle = showPlaceholder
    ? getAvatarPlaceholderStyle(avatarSeed)
    : undefined
  const joinedText = useMemo(() => {
    if (!profile.joinedAt) {
      return null
    }
    const date = new Date(profile.joinedAt)
    if (Number.isNaN(date.getTime())) {
      return null
    }
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }, [profile.joinedAt])

  const positionsValueLabel = Math.abs(positionsValue) >= 100_000
    ? formatCompactCurrency(positionsValue)
    : formatCurrency(positionsValue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  const biggestWinLabel = Math.abs(snapshot.biggestWin) >= 100_000
    ? formatCompactCurrency(snapshot.biggestWin)
    : formatCurrency(snapshot.biggestWin, { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  const stats = [
    { label: 'Positions Value', value: positionsValueLabel },
    { label: 'Biggest Win', value: biggestWinLabel },
    { label: 'Predictions', value: formatCompactCount(snapshot.predictions) },
  ]

  return (
    <Card className="relative h-full overflow-hidden rounded-lg bg-background">
      <CardContent className="relative flex h-full flex-col gap-2 p-3 sm:p-4">
        {isReady
          ? (
              <>
                {variant === 'portfolio'
                  ? (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="text-sm font-semibold tracking-wide text-muted-foreground">Portfolio</span>
                          <p className="text-3xl/tight font-bold text-foreground sm:text-4xl">
                            {formattedTotalValue}
                          </p>
                          <div
                            className={cn(
                              'flex items-center gap-2 text-sm font-semibold',
                              snapshot.profitLoss > 0
                                ? 'text-yes'
                                : snapshot.profitLoss < 0
                                  ? 'text-no'
                                  : 'text-muted-foreground',
                            )}
                          >
                            <span>
                              {snapshot.profitLoss >= 0 ? '+' : '-'}
                              {formatCompactCurrency(Math.abs(snapshot.profitLoss))}
                            </span>
                            <span>
                              (
                              {positionsValue > 0
                                ? `${((snapshot.profitLoss / positionsValue) * 100).toFixed(2)}%`
                                : '0.00%'}
                              )
                            </span>
                            <span className="text-muted-foreground">Today</span>
                          </div>
                        </div>

                        <div
                          className="flex shrink-0 items-center gap-2 rounded-full bg-card/70 px-3 py-2 shadow-sm"
                        >
                          <div className="relative size-6">
                            <Image src="/images/trade/money.svg" alt="Cash" fill sizes="24px" className="object-contain" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-extrabold text-foreground">
                              $
                              {formattedCashValue}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  : (
                      <div className="flex items-start justify-between gap-3 sm:gap-4">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div
                            className={`
                              relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full
                              border bg-muted/40
                            `}
                            style={avatarFallbackStyle}
                          >
                            {!showPlaceholder && avatarUrl
                              ? (
                                  <Image
                                    src={avatarUrl}
                                    alt={`${profile.username} avatar`}
                                    fill
                                    sizes="48px"
                                    className="object-cover"
                                  />
                                )
                              : null}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="truncate text-lg/tight font-semibold sm:text-xl" title={profile.username}>
                              {profile.username}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                              {joinedText && (
                                <span className="inline-flex items-center gap-1">
                                  Joined
                                  {' '}
                                  {joinedText}
                                </span>
                              )}
                              {typeof profile.viewsCount === 'number' && (
                                <>
                                  <span aria-hidden className="text-muted-foreground/50">•</span>
                                  <span className="inline-flex items-center gap-1">
                                    <EyeIcon className="size-4" />
                                    {formatCompactCount(profile.viewsCount)}
                                    {' '}
                                    views
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {profile.portfolioAddress && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`
                              size-9 rounded-full border bg-background/60 text-muted-foreground shadow-sm
                              transition-colors
                              hover:bg-background
                            `}
                            onClick={() => profile.portfolioAddress && copy(profile.portfolioAddress)}
                            aria-label="Copy portfolio address"
                          >
                            {copied ? <CheckIcon className="size-4 text-yes" /> : <FocusIcon className="size-4" />}
                          </Button>
                        )}
                      </div>
                    )}

                <div className="mt-auto pt-1">
                  {actions ?? (
                    <div className="grid grid-cols-3 gap-2.5">
                      {stats.map((stat, index) => (
                        <div
                          key={stat.label}
                          className={cn(
                            'flex h-full flex-col rounded-lg bg-background/40 p-2 shadow-sm',
                            index > 0 && 'border-l',
                          )}
                        >
                          <p className="text-sm font-medium text-muted-foreground">
                            {stat.label}
                          </p>
                          <p className="mt-auto text-xl font-semibold tracking-tight text-foreground">
                            {stat.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )
          : (
              <div className="space-y-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-28" />
              </div>
            )}
      </CardContent>
    </Card>
  )
}
