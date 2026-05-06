'use client'

import { useAppKitAccount } from '@reown/appkit/react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { usePublicClient, useSignTypedData } from 'wagmi'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { Button } from '@/components/ui/button'
import { useAppKit } from '@/hooks/useAppKit'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { CTF_EXCHANGE_ADDRESS, NEG_RISK_CTF_EXCHANGE_ADDRESS } from '@/lib/contracts'
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

export default function SettingsAffiliateFeeClaim() {
  const t = useExtracted()
  const { signTypedDataAsync } = useSignTypedData()
  const publicClient = usePublicClient()
  const { open } = useAppKit()
  const { openTradeRequirements } = useTradingOnboarding()
  const user = useUser()
  const { isConnected } = useAppKitAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)
  const [mainClaimable, setMainClaimable] = useState<bigint>(0n)
  const [negRiskClaimable, setNegRiskClaimable] = useState<bigint>(0n)
  const depositWalletAddress = user?.deposit_wallet_status === 'deployed' && user.deposit_wallet_address
    ? user.deposit_wallet_address as `0x${string}`
    : null
  const claimAddress = depositWalletAddress

  const refreshClaimable = useCallback(async () => {
    if (!publicClient || !claimAddress) {
      setMainClaimable(0n)
      setNegRiskClaimable(0n)
      return
    }

    setIsLoading(true)
    try {
      const [main, negRisk] = await Promise.all([
        publicClient.readContract({
          address: CTF_EXCHANGE_ADDRESS,
          abi: exchangeFeeAbi,
          functionName: 'claimableFees',
          args: [claimAddress],
        }),
        publicClient.readContract({
          address: NEG_RISK_CTF_EXCHANGE_ADDRESS,
          abi: exchangeFeeAbi,
          functionName: 'claimableFees',
          args: [claimAddress],
        }),
      ])
      setMainClaimable(main)
      setNegRiskClaimable(negRisk)
    }
    catch (error) {
      console.error('Failed to read claimable fees.', error)
    }
    finally {
      setIsLoading(false)
    }
  }, [claimAddress, publicClient])

  useEffect(() => {
    void refreshClaimable()
  }, [refreshClaimable])

  const totalClaimable = useMemo(() => mainClaimable + negRiskClaimable, [mainClaimable, negRiskClaimable])

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
      }
      else if (response.code === 'deadline_expired') {
        toast.error(t('Your signature expired. Click Sign again to create a fresh request.'))
      }
      else {
        toast.error(response.error ?? DEFAULT_ERROR_MESSAGE)
      }
      return false
    }

    return true
  }

  async function handleClaim() {
    if (!user) {
      await open()
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

      if (mainClaimable > 0n) {
        exchanges.push(CTF_EXCHANGE_ADDRESS)
      }

      if (negRiskClaimable > 0n) {
        exchanges.push(NEG_RISK_CTF_EXCHANGE_ADDRESS)
      }

      if (!exchanges.length) {
        toast.info(t('No claimable fees found for this wallet.'))
        return
      }

      const submitted = await submitDepositWalletClaim(exchanges)
      if (submitted) {
        toast.success(t('Fee claim submitted successfully.'))
      }
    }
    catch (error) {
      console.error('Failed to claim fees.', error)
      toast.error(t('Failed to claim fees. Please try again.'))
    }
    finally {
      await refreshClaimable()
      setIsClaiming(false)
    }
  }

  return (
    <div className="rounded-lg border p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{t('Onchain fee claim')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('Claim your accrued fees from both exchanges in one action.')}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('Total claimable')}
            :
            {' '}
            <span className="font-medium text-foreground">{formatCurrency(fromBaseUnits(totalClaimable))}</span>
            {' '}
            (
            {t('Main')}
            {' '}
            {formatCurrency(fromBaseUnits(mainClaimable))}
            {' • '}
            {t('NegRisk')}
            {' '}
            {formatCurrency(fromBaseUnits(negRiskClaimable))}
            )
          </p>
        </div>
        <Button
          type="button"
          onClick={() => void handleClaim()}
          disabled={isLoading || isClaiming}
        >
          {!isConnected
            ? t('Connect wallet')
            : !depositWalletAddress
                ? t('Enable Trading')
                : isClaiming
                  ? t('Claiming...')
                  : isLoading
                    ? t('Refreshing...')
                    : t('Claim fees')}
        </Button>
      </div>
    </div>
  )
}
