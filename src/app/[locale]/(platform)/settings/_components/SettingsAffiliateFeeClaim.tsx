'use client'

import { useAppKitAccount } from '@reown/appkit/react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { hashTypedData } from 'viem'
import { usePublicClient, useSignMessage, useWalletClient } from 'wagmi'
import { getSafeNonceAction, submitSafeTransactionAction } from '@/app/[locale]/(platform)/_actions/approve-tokens'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { Button } from '@/components/ui/button'
import { useAppKit } from '@/hooks/useAppKit'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { CTF_EXCHANGE_ADDRESS, NEG_RISK_CTF_EXCHANGE_ADDRESS } from '@/lib/contracts'
import { formatCurrency } from '@/lib/formatters'
import { DEFAULT_CHAIN_ID } from '@/lib/network'
import {
  aggregateSafeTransactions,
  buildClaimFeesTransactions,
  getSafeTxTypedData,
  packSafeSignature,
} from '@/lib/safe/transactions'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
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
  const { data: walletClient } = useWalletClient()
  const { signMessageAsync } = useSignMessage()
  const publicClient = usePublicClient()
  const { open } = useAppKit()
  const { openTradeRequirements } = useTradingOnboarding()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const user = useUser()
  const { address, isConnected } = useAppKitAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)
  const [mainClaimable, setMainClaimable] = useState<bigint>(0n)
  const [negRiskClaimable, setNegRiskClaimable] = useState<bigint>(0n)
  const proxyWalletAddress = user?.proxy_wallet_status === 'deployed' && user.proxy_wallet_address
    ? user.proxy_wallet_address as `0x${string}`
    : null
  const claimAddress = proxyWalletAddress ?? (address ? address as `0x${string}` : null)

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

  async function submitSafeClaim(exchanges: `0x${string}`[]) {
    if (!user?.address || !proxyWalletAddress) {
      openTradeRequirements()
      return false
    }

    const nonceResult = await getSafeNonceAction()
    if (nonceResult.error || !nonceResult.nonce) {
      if (isTradingAuthRequiredError(nonceResult.error)) {
        openTradeRequirements({ forceTradingAuth: true })
      }
      else {
        toast.error(nonceResult.error ?? DEFAULT_ERROR_MESSAGE)
      }
      return false
    }

    const aggregated = aggregateSafeTransactions(buildClaimFeesTransactions({ exchanges }))
    const typedData = getSafeTxTypedData({
      chainId: DEFAULT_CHAIN_ID,
      safeAddress: proxyWalletAddress,
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

    const response = await submitSafeTransactionAction({
      type: 'SAFE',
      from: user.address,
      to: aggregated.to,
      proxyWallet: proxyWalletAddress,
      data: aggregated.data,
      nonce: nonceResult.nonce,
      signature: packSafeSignature(signature as `0x${string}`),
      signatureParams,
      metadata: 'claim_fees',
    })

    if (response?.error) {
      if (isTradingAuthRequiredError(response.error)) {
        openTradeRequirements({ forceTradingAuth: true })
      }
      else {
        toast.error(response.error)
      }
      return false
    }

    return true
  }

  async function handleClaim() {
    if (!claimAddress || !publicClient) {
      await open()
      return
    }
    if (!address) {
      await open()
      return
    }

    setIsClaiming(true)
    const hashes: `0x${string}`[] = []
    let waitedForReceipts = false
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

      if (proxyWalletAddress) {
        const submitted = await submitSafeClaim(exchanges)
        if (submitted) {
          toast.success(t('Fee claim submitted successfully.'))
        }
        return
      }

      if (!address || !walletClient) {
        await open()
        return
      }

      if (mainClaimable > 0n) {
        const hash = await walletClient.writeContract({
          account: address as `0x${string}`,
          address: CTF_EXCHANGE_ADDRESS,
          abi: exchangeFeeAbi,
          functionName: 'claim',
          args: [],
        })
        hashes.push(hash)
      }

      if (negRiskClaimable > 0n) {
        const hash = await walletClient.writeContract({
          account: address as `0x${string}`,
          address: NEG_RISK_CTF_EXCHANGE_ADDRESS,
          abi: exchangeFeeAbi,
          functionName: 'claim',
          args: [],
        })
        hashes.push(hash)
      }

      await Promise.all(hashes.map(hash => publicClient.waitForTransactionReceipt({ hash })))
      waitedForReceipts = true
      toast.success(t('Fee claim submitted successfully.'))
    }
    catch (error) {
      console.error('Failed to claim fees.', error)
      toast.error(t('Failed to claim fees. Please try again.'))
    }
    finally {
      if (!waitedForReceipts && hashes.length) {
        await Promise.allSettled(hashes.map(hash => publicClient.waitForTransactionReceipt({ hash })))
      }
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
