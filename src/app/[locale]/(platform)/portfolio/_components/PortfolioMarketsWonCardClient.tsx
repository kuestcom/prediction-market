'use client'

import type { Route } from 'next'
import { DialogTitle } from '@radix-ui/react-dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { useQueryClient } from '@tanstack/react-query'
import { BanknoteArrowDownIcon, TrophyIcon } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { hashTypedData } from 'viem'
import { useSignMessage } from 'wagmi'
import { getSafeNonceAction, submitSafeTransactionAction } from '@/app/[locale]/(platform)/_actions/approve-tokens'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import SiteLogoIcon from '@/components/SiteLogoIcon'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { SAFE_BALANCE_QUERY_KEY } from '@/hooks/useBalance'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
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
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
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
  const { ensureTradingReady, openTradeRequirements } = useTradingOnboarding()
  const { signMessageAsync } = useSignMessage()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const queryClient = useQueryClient()
  const user = useUser()
  const router = useRouter()
  const site = useSiteIdentity()

  const siteName = site.name
  const previewMarkets = useMemo(() => markets.slice(0, 3), [markets])
  const previewExtraCount = Math.max(0, markets.length - 3)

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
  const hasClaimableMarkets = claimableSignature.length > 0

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
        if (isTradingAuthRequiredError(nonceResult.error)) {
          setIsDialogOpen(false)
          openTradeRequirements({ forceTradingAuth: true })
        }
        else {
          toast.error(nonceResult.error ?? DEFAULT_ERROR_MESSAGE)
        }
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

      const signature = await runWithSignaturePrompt(() => signMessageAsync({
        message: { raw: structHash },
      }))

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
        if (isTradingAuthRequiredError(response.error)) {
          setIsDialogOpen(false)
          openTradeRequirements({ forceTradingAuth: true })
        }
        else {
          toast.error(response.error)
        }
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
      <Card className="relative z-0 w-full rounded-lg border bg-transparent">
        <CardContent
          className={`
            flex flex-wrap items-center justify-between gap-4 py-3 pr-3 pl-5
            md:flex-nowrap md:gap-6 md:py-4 md:pr-4 md:pl-6
          `}
        >
          <div className="flex min-w-0 items-center gap-5">
            <div className="relative isolate ml-2 h-12 w-17 shrink-0">
              {previewMarkets.map((market, index) => {
                const stackClass = (() => {
                  if (previewMarkets.length <= 1) {
                    return 'left-[0.5rem] top-[0.125rem] z-20'
                  }

                  const stackClassByIndex = [
                    'left-[-0.875rem] top-0 -rotate-[13deg] z-10',
                    'left-[0.5rem] top-[0.125rem] z-20',
                    'right-[-0.875rem] top-[0.125rem] rotate-[19deg] z-30',
                  ] as const
                  return stackClassByIndex[Math.min(index, 2)]
                })()
                const showOverflowCount = index === 2 && previewExtraCount > 0

                return (
                  <div
                    key={market.conditionId}
                    className={`
                      absolute size-11 overflow-hidden rounded-lg border-2 border-foreground bg-muted shadow-sm
                      motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in-0 motion-safe:zoom-in-95
                      motion-reduce:animate-none
                      ${stackClass}
                    `}
                    style={{ animationDelay: `${index * 55}ms` }}
                  >
                    {market?.imageUrl
                      ? (
                          <Image
                            src={market.imageUrl}
                            alt={market.title}
                            fill
                            sizes="44px"
                            className="object-cover"
                          />
                        )
                      : (
                          <div className="grid size-full place-items-center text-2xs text-muted-foreground">
                            ?
                          </div>
                        )}
                    {showOverflowCount && (
                      <div className="absolute inset-0 grid place-items-center bg-black/40 text-sm font-bold text-white">
                        +
                        {previewExtraCount}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="min-w-0 pl-2 text-left">
              <p className="inline-flex items-center gap-2 text-base font-semibold text-muted-foreground">
                <span>You won</span>
                <span className="text-2xl font-semibold text-foreground tabular-nums">
                  {formatCurrency(summary.totalProceeds)}
                </span>
              </p>
            </div>
          </div>

          <DialogTrigger asChild>
            <Button className="h-10 shrink-0 rounded-md px-7" disabled={!hasClaimableMarkets}>
              <BanknoteArrowDownIcon className="size-4" />
              Claim
            </Button>
          </DialogTrigger>
        </CardContent>
      </Card>

      <DialogContent className="max-w-88 space-y-4 p-5 text-center sm:p-6">
        <VisuallyHidden>
          <DialogTitle>You Won</DialogTitle>
        </VisuallyHidden>

        <div className="flex justify-center">
          <div className="
            flex size-14 items-center justify-center rounded-xl bg-yes/15
            motion-safe:animate-pulse
            motion-reduce:animate-none
          "
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-yes/20 ring-1 ring-yes/30">
              <TrophyIcon className="size-4 text-yes" strokeWidth={2.75} />
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="
            pointer-events-none inline-flex items-center gap-2 text-2xl font-semibold text-foreground select-none
          "
          >
            <SiteLogoIcon
              logoSvg={site.logoSvg}
              logoImageUrl={site.logoImageUrl}
              alt={`${site.name} logo`}
              className="size-8 text-current [&_svg]:size-8 [&_svg_*]:fill-current [&_svg_*]:stroke-current"
              imageClassName="size-8 object-contain"
              size={32}
            />
            <span>{siteName}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="inline-flex items-center gap-2 text-foreground dark:text-white">
            <span className="text-xl font-semibold">You won</span>
            <span className="text-3xl leading-none font-semibold tabular-nums">
              {formatCurrency(summary.totalProceeds)}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            Great job predicting the future!
          </p>
        </div>

        <div className="scrollbar-hide max-h-[min(40vh,12rem)] space-y-2 overflow-y-auto pr-1 text-left">
          {markets.map((market) => {
            const href = market.eventSlug ? (`/event/${market.eventSlug}` as Route) : null
            const itemClassName = [
              'flex w-full items-center gap-3 rounded-md p-3 transition-colors',
              href
                ? 'hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none dark:hover:bg-muted/20'
                : 'cursor-default',
            ].join(' ')
            const content = (
              <>
                <div className="relative size-12 overflow-hidden rounded-md">
                  {market.imageUrl
                    ? (
                        <Image
                          src={market.imageUrl}
                          alt={market.title}
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

        <Button className="h-10 w-full" onClick={handleClaimAll} disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : markets.length > 1 ? 'Claim all proceeds' : 'Claim proceeds'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
