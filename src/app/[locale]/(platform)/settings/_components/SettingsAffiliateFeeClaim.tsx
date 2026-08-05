'use client'

import { useAppKitAccount } from '@reown/appkit/react'
import { ArrowDownToLineIcon, BadgePercentIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePublicClient, useSignTypedData } from 'wagmi'

import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { useAppKit } from '@/hooks/useAppKit'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { FEE_CLAIM_EXCHANGE_ADDRESSES } from '@/lib/contracts'
import { formatCurrency } from '@/lib/formatters'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { signAndSubmitDepositWalletCalls } from '@/lib/wallet/client'
import { buildClaimFeesCalls } from '@/lib/wallet/transactions'
import { useUser } from '@/stores/useUser'

const exchangeFeeAbi = [
  {
    name: 'claimableFees',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const

function fromBaseUnits(value: bigint): number {
  return Number(value) / 1_000_000
}

interface SettingsAffiliateFeeClaimProps {
  lifetimeEarned: number
}

export default function SettingsAffiliateFeeClaim({ lifetimeEarned }: SettingsAffiliateFeeClaimProps) {
  const t = useExtracted()
  const { signTypedDataAsync } = useSignTypedData()
  const publicClient = usePublicClient()
  const { open: openAppKit } = useAppKit()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const { openTradeRequirements } = useTradingOnboarding()
  const user = useUser()
  const { isConnected } = useAppKitAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)
  const [claimableByExchange, setClaimableByExchange] = useState<Partial<Record<`0x${string}`, bigint>>>({})
  const [claimableReadFailures, setClaimableReadFailures] = useState<Set<`0x${string}`>>(() => new Set())
  const depositWalletAddress =
    user?.deposit_wallet_status === 'deployed' && user.deposit_wallet_address
      ? (user.deposit_wallet_address as `0x${string}`)
      : null
  const claimAddress = depositWalletAddress

  const refreshClaimable = useCallback(async () => {
    if (!publicClient || !claimAddress) {
      setClaimableByExchange({})
      setClaimableReadFailures(new Set())
      return
    }

    setIsLoading(true)
    try {
      const results = await Promise.all(
        FEE_CLAIM_EXCHANGE_ADDRESSES.map(async (exchange) => {
          try {
            const claimable = await publicClient.readContract({
              address: exchange,
              abi: exchangeFeeAbi,
              functionName: 'claimableFees',
              args: [claimAddress],
            })

            return { exchange, claimable, didFail: false } as const
          } catch (error) {
            console.error('Failed to read claimable fees for exchange.', { exchange, error })
            return { exchange, didFail: true } as const
          }
        }),
      )

      const nextClaimable: Partial<Record<`0x${string}`, bigint>> = {}
      const nextReadFailures = new Set<`0x${string}`>()

      results.forEach((result) => {
        if (result.didFail) {
          nextReadFailures.add(result.exchange)
          return
        }

        nextClaimable[result.exchange] = result.claimable
      })

      setClaimableByExchange(nextClaimable)
      setClaimableReadFailures(nextReadFailures)
    } catch (error) {
      console.error('Failed to read claimable fees.', error)
      setClaimableReadFailures(new Set())
    } finally {
      setIsLoading(false)
    }
  }, [claimAddress, publicClient])

  useEffect(() => {
    void refreshClaimable()
  }, [refreshClaimable])

  const totalClaimable = useMemo(() => {
    return FEE_CLAIM_EXCHANGE_ADDRESSES.reduce((sum, exchange) => sum + (claimableByExchange[exchange] ?? 0n), 0n)
  }, [claimableByExchange])

  async function submitDepositWalletClaim(exchanges: `0x${string}`[]) {
    if (!user?.address || !depositWalletAddress) {
      openTradeRequirements()
      return false
    }

    const response = await signAndSubmitDepositWalletCalls({
      user,
      calls: buildClaimFeesCalls({ exchanges }),
      metadata: 'claim_fees',
      signTypedDataAsync,
    })

    if (response.error) {
      if (isTradingAuthRequiredError(response.error)) {
        openTradeRequirements({ forceTradingAuth: true })
      } else if (response.code === 'deadline_expired') {
        toast.error(t('Your signature expired. Click Sign again to create a fresh request.'))
      } else {
        toast.error(response.error ?? DEFAULT_ERROR_MESSAGE)
      }
      return false
    }

    return true
  }

  async function handleClaim() {
    if (!user) {
      await openAppKit()
      return
    }
    if (!isConnected) {
      await openAppKit()
      return
    }
    if (!depositWalletAddress) {
      openTradeRequirements()
      return
    }
    if (!publicClient) {
      toast.error(DEFAULT_ERROR_MESSAGE)
      return
    }

    setIsClaiming(true)
    try {
      const exchanges: `0x${string}`[] = []

      FEE_CLAIM_EXCHANGE_ADDRESSES.forEach((exchange) => {
        if ((claimableByExchange[exchange] ?? 0n) > 0n || claimableReadFailures.has(exchange)) {
          exchanges.push(exchange)
        }
      })

      if (!exchanges.length) {
        toast.info(t('No claimable fees found for this wallet.'))
        return
      }

      const submitted = await runWithSignaturePrompt(() => submitDepositWalletClaim(exchanges))
      if (submitted) {
        toast.success(t('Fee claim submitted successfully.'))
      }
    } catch (error) {
      console.error('Failed to claim fees.', error)
      toast.error(t('Failed to claim fees. Please try again.'))
    } finally {
      await refreshClaimable()
      setIsClaiming(false)
    }
  }

  return (
    <div className="relative flex min-h-56 flex-col overflow-hidden rounded-xl border bg-background p-5">
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="grid size-10 place-items-center rounded-lg border border-yes/20 bg-yes/8 text-yes">
          <BadgePercentIcon className="size-5" aria-hidden />
        </div>
        <span className="font-mono text-xs text-muted-foreground uppercase">{t('Affiliate rewards')}</span>
      </div>

      <div className="relative z-10 mt-6 flex flex-col items-stretch gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('Available to claim')}</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight text-foreground">
            {formatCurrency(fromBaseUnits(totalClaimable))}
          </p>
        </div>
        <Button
          className="w-full sm:w-auto"
          type="button"
          onClick={() => void handleClaim()}
          disabled={isLoading || isClaiming}
        >
          {isClaiming || isLoading ? (
            <Spinner className="size-4" />
          ) : isConnected && depositWalletAddress ? (
            <ArrowDownToLineIcon className="size-4" />
          ) : null}
          {!isConnected
            ? t('Connect wallet')
            : !depositWalletAddress
              ? t('Enable Trading')
              : isClaiming
                ? t('Claiming...')
                : isLoading
                  ? t('Refreshing...')
                  : t('Claim')}
        </Button>
      </div>

      <div className="relative z-10 mt-auto flex items-center justify-between gap-4 border-t pt-4">
        <p className="text-xs text-muted-foreground">{t('Lifetime earned')}</p>
        <p className="text-lg font-semibold tracking-tight">{formatCurrency(lifetimeEarned)}</p>
      </div>
    </div>
  )
}
