'use client'

import { useAppKitAccount } from '@reown/appkit/react'
import { ArrowDownToLineIcon, BadgeCheckIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePublicClient, useSignTypedData } from 'wagmi'

import type { DataApiRewardAccountStats } from '@/lib/data-api/resolution-rewards'

import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { useAppKit } from '@/hooks/useAppKit'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { COLLATERAL_TOKEN_ADDRESS, RESOLUTION_REWARDS_ADDRESS } from '@/lib/contracts'
import { formatCurrency } from '@/lib/formatters'
import { RESOLUTION_REWARDS_ABI } from '@/lib/resolution-rewards'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { signAndSubmitDepositWalletCalls } from '@/lib/wallet/client'
import { buildResolutionRewardsClaimCall } from '@/lib/wallet/transactions'
import { useUser } from '@/stores/useUser'

interface SettingsResolutionRewardsClaimProps {
  stats: DataApiRewardAccountStats | null
}

function fromBaseUnits(value: bigint | string): number {
  try {
    return Number(BigInt(value)) / 1_000_000
  } catch {
    return 0
  }
}

export default function SettingsResolutionRewardsClaim({ stats }: SettingsResolutionRewardsClaimProps) {
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
  const [claimable, setClaimable] = useState<bigint | null>(null)
  const claimableRequestIdRef = useRef(0)
  const claimInFlightRef = useRef(false)
  const depositWalletAddress =
    user?.deposit_wallet_status === 'deployed' && user.deposit_wallet_address
      ? (user.deposit_wallet_address as `0x${string}`)
      : null

  const refreshClaimable = useCallback(async () => {
    const requestId = ++claimableRequestIdRef.current
    if (!publicClient || !depositWalletAddress) {
      setClaimable(null)
      setIsLoading(false)
      return null
    }

    setIsLoading(true)
    try {
      const amount = await publicClient.readContract({
        address: RESOLUTION_REWARDS_ADDRESS,
        abi: RESOLUTION_REWARDS_ABI,
        functionName: 'claimable',
        args: [COLLATERAL_TOKEN_ADDRESS, depositWalletAddress],
      })
      if (requestId === claimableRequestIdRef.current) {
        setClaimable(amount)
      }
      return amount
    } catch (error) {
      console.error('Failed to read claimable resolution rewards.', error)
      return null
    } finally {
      if (requestId === claimableRequestIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [depositWalletAddress, publicClient])

  useEffect(() => {
    void refreshClaimable()
  }, [refreshClaimable])

  useEffect(() => {
    window.addEventListener('resolution-rewards-updated', refreshClaimable)
    return () => window.removeEventListener('resolution-rewards-updated', refreshClaimable)
  }, [refreshClaimable])

  async function submitClaim() {
    if (!user?.address || !depositWalletAddress) {
      openTradeRequirements()
      return false
    }

    const response = await signAndSubmitDepositWalletCalls({
      user,
      calls: [buildResolutionRewardsClaimCall()],
      metadata: 'claim_resolution_rewards',
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
    if (claimInFlightRef.current) {
      return
    }
    if (!user || !isConnected) {
      await openAppKit()
      return
    }
    if (!depositWalletAddress) {
      openTradeRequirements()
      return
    }
    claimInFlightRef.current = true
    setIsClaiming(true)
    try {
      const availableToClaim = await refreshClaimable()
      if (availableToClaim === null) {
        toast.error(t('Unable to load rewards information. Please try again later.'))
        return
      }
      if (availableToClaim === 0n) {
        toast.info(t('No resolution rewards are available to claim.'))
        return
      }

      const submitted = await runWithSignaturePrompt(submitClaim)
      if (submitted) {
        toast.success(t('Resolution reward claim submitted successfully.'))
      }
    } catch (error) {
      console.error('Failed to claim resolution rewards.', error)
      toast.error(t('Failed to claim resolution rewards. Please try again.'))
    } finally {
      await refreshClaimable()
      claimInFlightRef.current = false
      setIsClaiming(false)
    }
  }

  const lifetimeRewards = fromBaseUnits(stats?.totalRewardCredited ?? '0')
  return (
    <div className="relative flex min-h-56 flex-col overflow-hidden rounded-xl border bg-background p-5">
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="grid size-10 place-items-center rounded-lg border border-violet-500/20 bg-violet-500/8 text-violet-500">
          <BadgeCheckIcon className="size-5" aria-hidden />
        </div>
        <span className="font-mono text-xs text-muted-foreground uppercase">{t('Resolution rewards')}</span>
      </div>

      <div className="relative z-10 mt-6 flex flex-col items-stretch gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('Available to claim')}</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight text-foreground">
            {claimable === null ? '—' : formatCurrency(fromBaseUnits(claimable))}
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
        <p className="text-lg font-semibold tracking-tight">{formatCurrency(lifetimeRewards)}</p>
      </div>
    </div>
  )
}
