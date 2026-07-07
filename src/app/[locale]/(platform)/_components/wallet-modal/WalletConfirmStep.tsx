'use client'

import type { LiFiWalletTokenItem } from '@/hooks/useLiFiWalletTokens'
import {
  ChevronRightIcon,
  FuelIcon,
  InfoIcon,
  Loader2Icon,
  WalletIcon,
} from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import { formatWalletModalAddress } from '@/app/[locale]/(platform)/_components/wallet-modal/utils'
import SiteLogoIcon from '@/components/SiteLogoIcon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDirectUsdcDepositExecution } from '@/hooks/useDirectUsdcDepositExecution'
import { useLiFiExecution } from '@/hooks/useLiFiExecution'
import { useLiFiQuote } from '@/hooks/useLiFiQuote'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { formatDisplayAmount } from '@/lib/amount-input'
import { cn } from '@/lib/utils'

function WalletConfirmStep({
  walletEoaAddress,
  walletAddress,
  siteLabel,
  onComplete,
  amountValue,
  selectedToken,
  quote,
  refreshIndex,
  executionMode = 'lifi',
}: {
  walletEoaAddress?: string | null
  walletAddress?: string | null
  siteLabel: string
  onComplete: () => void
  amountValue: string
  selectedToken?: LiFiWalletTokenItem | null
  quote?: { toAmountDisplay: string | null, gasUsdDisplay: string | null } | null
  refreshIndex: number
  executionMode?: 'lifi' | 'direct-usdc'
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const walletEoaLabel = formatWalletModalAddress(walletEoaAddress)
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false)
  const site = useSiteIdentity()
  const formattedAmount = formatDisplayAmount(amountValue)
  const displayAmount = formattedAmount && formattedAmount.trim() !== '' ? formattedAmount : '0.00'
  const { quote: fetchedQuote, isLoadingQuote } = useLiFiQuote({
    fromToken: selectedToken,
    amountValue,
    fromAddress: walletEoaAddress,
    toAddress: walletAddress,
    refreshIndex,
    enabled: executionMode === 'lifi',
  })
  const effectiveQuote = quote ?? (executionMode === 'lifi' ? fetchedQuote : null)
  const hasAmount = amountValue.trim() !== ''
  const isQuoteLoading = isLoadingQuote && hasAmount
  const status: 'quote' | 'gas' | 'ready' = effectiveQuote ? 'ready' : (isLoadingQuote ? 'gas' : 'quote')
  const {
    execute: executeLiFi,
    isExecuting: isExecutingLiFi,
  } = useLiFiExecution({
    fromToken: selectedToken,
    amountValue,
    fromAddress: walletEoaAddress,
    toAddress: walletAddress,
  })
  const {
    execute: executeDirectUsdcDeposit,
    isExecuting: isExecutingDirectUsdcDeposit,
  } = useDirectUsdcDepositExecution({
    amountValue,
    fromAddress: walletEoaAddress,
    toAddress: walletAddress,
  })
  const execute = executionMode === 'direct-usdc' ? executeDirectUsdcDeposit : executeLiFi
  const isExecuting = executionMode === 'direct-usdc' ? isExecutingDirectUsdcDeposit : isExecutingLiFi
  const isCtaDisabled = isExecuting || isSubmitting || !effectiveQuote || isLoadingQuote
  const sendSymbol = selectedToken?.symbol ?? 'Token'
  const sendIcon = selectedToken?.icon ?? '/images/deposit/transfer/polygon_dark.png'
  const chainIcon = selectedToken?.chainIcon ?? '/images/deposit/transfer/polygon_dark.png'
  const receiveAmountDisplay = effectiveQuote?.toAmountDisplay ?? '—'
  const gasUsdDisplay = effectiveQuote?.gasUsdDisplay ?? null

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-center">
        <p className="text-5xl font-semibold text-foreground">
          {displayAmount}
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-lg border">
          <div className="px-4 py-1.5 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Source</span>
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <WalletIcon className="size-4" />
                Wallet
                {walletEoaLabel ? ` (${walletEoaLabel})` : ''}
              </span>
            </div>
          </div>
          <div className="mx-auto h-px w-[90%] bg-border/60" />
          <div className="px-4 py-1.5 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Destination</span>
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <SiteLogoIcon
                  logoSvg={site.logoSvg}
                  logoImageUrl={site.logoImageUrl}
                  alt={`${siteLabel} logo`}
                  className="size-4 text-current [&_svg]:size-[1em] [&_svg_*]:fill-current [&_svg_*]:stroke-current"
                  imageClassName="size-[1em] object-contain"
                  size={16}
                />
                {siteLabel}
                {' '}
                Wallet
              </span>
            </div>
          </div>
          <div className="mx-auto h-px w-[90%] bg-border/60" />
          <div className="px-4 py-1.5 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Estimated time</span>
              <span className="font-semibold text-foreground">&lt; 1 min</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border">
          <div className="px-4 py-1.5 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>You send</span>
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <span className="relative">
                  <Image
                    src={sendIcon}
                    alt={sendSymbol}
                    width={18}
                    height={18}
                    className="rounded-full"
                    unoptimized
                  />
                  <span className="absolute -right-1 -bottom-1 rounded-full bg-background p-0.5">
                    <Image
                      src={chainIcon}
                      alt={selectedToken?.network ?? 'Chain'}
                      width={10}
                      height={10}
                      className="rounded-full"
                      unoptimized={chainIcon.startsWith('http')}
                    />
                  </span>
                </span>
                {displayAmount}
                {' '}
                {sendSymbol}
              </span>
            </div>
          </div>
          <div className="mx-auto h-px w-[90%] bg-border/60" />
          <div className="px-4 py-1.5 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>You receive</span>
              {isQuoteLoading
                ? <Skeleton className="h-4 w-28 rounded-full" />
                : (
                    <span className="flex items-center gap-2 font-semibold text-foreground">
                      <span className="relative">
                        <Image
                          src="/images/deposit/transfer/usdc_dark.png"
                          alt="USDC"
                          width={18}
                          height={18}
                          className="rounded-full"
                        />
                        <span className="absolute -right-1 -bottom-1 rounded-full bg-background p-0.5">
                          <Image
                            src="/images/deposit/transfer/polygon_dark.png"
                            alt="Polygon"
                            width={10}
                            height={10}
                            className="rounded-full"
                          />
                        </span>
                      </span>
                      {receiveAmountDisplay}
                      {' '}
                      USDC
                    </span>
                  )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2 text-xs text-muted-foreground">
        <button
          type="button"
          className="flex w-full items-center justify-between text-xs text-muted-foreground"
          onClick={() => setIsBreakdownOpen(current => !current)}
          disabled={isQuoteLoading}
        >
          <span>Transaction breakdown</span>
          <span className="flex items-center gap-1">
            {isQuoteLoading
              ? <Skeleton className="h-3 w-20 rounded-full" />
              : (
                  <>
                    {!isBreakdownOpen && <span>{gasUsdDisplay ? `$${gasUsdDisplay}` : '—'}</span>}
                    <ChevronRightIcon className={cn('size-3 transition', { 'rotate-90': isBreakdownOpen })} />
                  </>
                )}
          </span>
        </button>
        {isBreakdownOpen && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                Network cost
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InfoIcon className="size-3" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1 text-xs text-foreground">
                      <div className="flex items-center justify-between gap-4">
                        <span>Total cost</span>
                        <span className="text-right">{gasUsdDisplay ? `$${gasUsdDisplay}` : '—'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span>Source chain gas</span>
                        <span className="text-right">{gasUsdDisplay ? `$${gasUsdDisplay}` : '—'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span>Destination chain gas</span>
                        <span className="text-right">—</span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </span>
              <span className="flex items-center gap-2">
                <FuelIcon className="size-3" />
                {gasUsdDisplay ? `$${gasUsdDisplay}` : '—'}
              </span>
            </div>
          </div>
        )}
      </div>

      <Badge variant="outline" className="w-full p-3 text-muted-foreground">
        By clicking on Confirm Order, you agree to our
        {' '}
        <a
          href="/tos"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          terms
        </a>
        .
      </Badge>
      <Button
        type="button"
        className="h-12 w-full"
        disabled={isCtaDisabled}
        onClick={async () => {
          if (status !== 'ready') {
            return
          }
          try {
            setIsSubmitting(true)
            await execute()
            onComplete()
          }
          finally {
            setIsSubmitting(false)
          }
        }}
      >
        {(isLoadingQuote || isSubmitting || isExecuting) && <Loader2Icon className="size-4 animate-spin" />}
        {isSubmitting && 'Confirm transaction in your wallet'}
        {!isSubmitting && status === 'quote' && 'Preparing your quote...'}
        {!isSubmitting && status === 'gas' && 'Estimating gas...'}
        {!isSubmitting && status === 'ready' && 'Confirm order'}
      </Button>
    </div>
  )
}

export default WalletConfirmStep
