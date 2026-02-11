'use client'

import type { Route } from 'next'
import { DialogTitle } from '@radix-ui/react-dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { useQueryClient } from '@tanstack/react-query'
import { BanknoteArrowDownIcon, CheckIcon } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { hashTypedData } from 'viem'
import { useSignMessage } from 'wagmi'
import { getSafeNonceAction, submitSafeTransactionAction } from '@/app/[locale]/(platform)/_actions/approve-tokens'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { SAFE_BALANCE_QUERY_KEY } from '@/hooks/useBalance'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { Link } from '@/i18n/navigation'
import { defaultNetwork } from '@/lib/appkit'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { formatCurrency, formatPercent } from '@/lib/formatters'
import {
  aggregateSafeTransactions,
  buildRedeemPositionTransaction,
  getSafeTxTypedData,
  packSafeSignature,
} from '@/lib/safe/transactions'
import { triggerConfetti } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

export interface PortfolioClaimMarket {
  conditionId: string
  title: string
  eventSlug?: string
  imageUrl?: string
  outcome?: string
  outcomeIndex?: number
  shares: number
  invested: number
  proceeds: number
  returnPercent: number
  timestamp?: number
  indexSets: number[]
}

export interface PortfolioMarketsWonData {
  summary: {
    marketsWon: number
    totalProceeds: number
    totalInvested: number
    totalReturnPercent: number
    latestMarket?: PortfolioClaimMarket
  }
  markets: PortfolioClaimMarket[]
}

interface PortfolioMarketsWonCardClientProps {
  data: PortfolioMarketsWonData
}

function formatSignedPercent(value: number, digits: number) {
  const safeValue = Number.isFinite(value) ? value : 0
  const sign = safeValue > 0 ? '+' : safeValue < 0 ? '-' : ''
  const formatted = formatPercent(Math.abs(safeValue), { digits })
  return `${sign}${formatted}`
}

export default function PortfolioMarketsWonCardClient({ data }: PortfolioMarketsWonCardClientProps) {
  const { summary, markets } = data
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hiddenClaimSignature, setHiddenClaimSignature] = useState<string | null>(null)
  const { ensureTradingReady } = useTradingOnboarding()
  const { signMessageAsync } = useSignMessage()
  const queryClient = useQueryClient()
  const user = useUser()
  const router = useRouter()
  const site = useSiteIdentity()

  const latestMarket = summary.latestMarket ?? markets[0]
  const siteName = site.name

  const stats = useMemo(
    () => [
      { label: 'Markets won', value: summary.marketsWon.toString() },
      { label: 'Total return', value: formatSignedPercent(summary.totalReturnPercent, 2) },
      { label: 'Proceeds', value: formatCurrency(summary.totalProceeds) },
    ],
    [summary],
  )

  const claimableSignature = useMemo(() => {
    const claimableMarkets = markets
      .filter(market => market.indexSets.length > 0)
      .map((market) => {
        const sortedIndexSets = [...market.indexSets].sort((a, b) => a - b)
        return `${market.conditionId}:${sortedIndexSets.join(',')}`
      })
      .sort()

    return claimableMarkets.join('|')
  }, [markets])

  useEffect(() => {
    if (!isDialogOpen) {
      return
    }

    triggerConfetti('yes')
  }, [isDialogOpen])

  async function handleClaimAll() {
    if (isSubmitting) {
      return
    }

    if (!markets.length) {
      toast.info('No claimable markets available right now.')
      return
    }

    if (!ensureTradingReady()) {
      return
    }

    if (!user?.proxy_wallet_address || !user?.address) {
      toast.error('Deploy your proxy wallet before claiming.')
      return
    }

    const claimTargets = markets.filter(market => market.indexSets.length > 0)
    if (claimTargets.length === 0) {
      toast.info('No claimable markets available right now.')
      return
    }

    setIsSubmitting(true)

    try {
      const nonceResult = await getSafeNonceAction()
      if (nonceResult.error || !nonceResult.nonce) {
        toast.error(nonceResult.error ?? DEFAULT_ERROR_MESSAGE)
        return
      }

      const transactions = claimTargets.map(market =>
        buildRedeemPositionTransaction({
          conditionId: market.conditionId as `0x${string}`,
          indexSets: market.indexSets,
        }),
      )

      const aggregated = aggregateSafeTransactions(transactions)
      const typedData = getSafeTxTypedData({
        chainId: defaultNetwork.id,
        safeAddress: user.proxy_wallet_address as `0x${string}`,
        transaction: aggregated,
        nonce: nonceResult.nonce,
      })

      const { signatureParams, ...safeTypedData } = typedData
      const structHash = hashTypedData({
        domain: safeTypedData.domain,
        types: safeTypedData.types,
        primaryType: safeTypedData.primaryType,
        message: safeTypedData.message,
      }) as `0x${string}`

      const signature = await signMessageAsync({
        message: { raw: structHash },
      })

      const payload = {
        type: 'SAFE' as const,
        from: user.address,
        to: aggregated.to,
        proxyWallet: user.proxy_wallet_address,
        data: aggregated.data,
        nonce: nonceResult.nonce,
        signature: packSafeSignature(signature as `0x${string}`),
        signatureParams,
        metadata: 'redeem_positions',
      }

      const response = await submitSafeTransactionAction(payload)

      if (response?.error) {
        toast.error(response.error)
        return
      }

      toast.success('Claim submitted', {
        description: claimTargets.length > 1
          ? 'We sent a claim for your winning markets.'
          : 'We sent your claim transaction.',
      })

      setHiddenClaimSignature(claimableSignature)
      setIsDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['user-positions'] })
      queryClient.invalidateQueries({ queryKey: ['user-market-positions'] })
      queryClient.invalidateQueries({ queryKey: ['user-conditional-shares'] })
      queryClient.invalidateQueries({ queryKey: [SAFE_BALANCE_QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: ['portfolio-value'] })
      router.refresh()
    }
    catch (error) {
      console.error('Failed to submit claim.', error)
      toast.error('We could not submit your claim. Please try again.')
    }
    finally {
      setIsSubmitting(false)
    }
  }

  const shouldHideClaimCard = hiddenClaimSignature != null
    && hiddenClaimSignature === claimableSignature
    && claimableSignature.length > 0

  if (shouldHideClaimCard || markets.length === 0) {
    return null
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <Card className="border bg-transparent">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4 md:flex-nowrap md:gap-6 md:p-6">
          <div className="flex flex-wrap items-center gap-4 md:flex-nowrap md:gap-6">
            <div className="relative size-12 overflow-hidden rounded-md border">
              {latestMarket?.imageUrl
                ? (
                    <Image
                      src={latestMarket.imageUrl}
                      alt={latestMarket.title}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  )
                : (
                    <div className="grid size-full place-items-center text-2xs text-muted-foreground">
                      No image
                    </div>
                  )}
            </div>

            <div className="flex flex-wrap items-center gap-4 md:gap-8">
              {stats.map((stat, index) => (
                <Fragment key={stat.label}>
                  <div className="flex min-w-27.5 flex-col justify-center text-sm">
                    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {stat.label}
                    </span>
                    <span className="text-lg font-semibold text-foreground">
                      {stat.value}
                    </span>
                  </div>
                  {index < stats.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="mx-2 hidden h-10 w-px rounded-full bg-border/60 md:block"
                    />
                  )}
                </Fragment>
              ))}
            </div>
          </div>

          <DialogTrigger asChild>
            <Button className="h-11 shrink-0 px-6">
              <BanknoteArrowDownIcon className="size-4" />
              Claim
            </Button>
          </DialogTrigger>
        </CardContent>
      </Card>

      <DialogContent className="max-w-104 space-y-6 text-center sm:p-8">
        <VisuallyHidden>
          <DialogTitle>You Won</DialogTitle>
        </VisuallyHidden>

        <div className="flex justify-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-yes/15">
            <div className="flex size-10 items-center justify-center rounded-xl bg-yes/20 ring-1 ring-yes/30">
              <CheckIcon className="size-5 text-yes" strokeWidth={2.75} />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-2xl font-semibold text-foreground dark:text-white">
            You won
            {' '}
            {formatCurrency(summary.totalProceeds)}
          </p>
          <p className="text-sm text-muted-foreground">
            Great job predicting the future on
            {' '}
            {siteName}
            !
          </p>
        </div>

        <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1 text-left">
          {markets.map((market) => {
            const href = market.eventSlug ? (`/event/${market.eventSlug}` as Route) : null
            const itemClassName = [
              'flex w-full items-center gap-4 rounded-md p-4 transition-colors',
              href
                ? 'hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none dark:hover:bg-muted/20'
                : 'cursor-default',
            ].join(' ')
            const content = (
              <>
                <div className="relative size-14 overflow-hidden rounded-md">
                  {market.imageUrl
                    ? (
                        <Image
                          src={market.imageUrl}
                          alt={market.title}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      )
                    : (
                        <div className="grid size-full place-items-center text-2xs text-muted-foreground">
                          No image
                        </div>
                      )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">{market.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Invested
                    {' '}
                    {formatCurrency(market.invested)}
                    {' '}
                    • Won
                    {' '}
                    {formatCurrency(market.proceeds)}
                    {' '}
                    (
                    {formatSignedPercent(market.returnPercent, 0)}
                    )
                  </p>
                </div>
              </>
            )

            return href
              ? (
                  <Link key={market.conditionId} href={href} className={itemClassName}>
                    {content}
                  </Link>
                )
              : (
                  <div key={market.conditionId} className={itemClassName} aria-disabled="true">
                    {content}
                  </div>
                )
          })}
        </div>

        <Button className="h-11 w-full" onClick={handleClaimAll} disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : markets.length > 1 ? 'Claim all proceeds' : 'Claim proceeds'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
