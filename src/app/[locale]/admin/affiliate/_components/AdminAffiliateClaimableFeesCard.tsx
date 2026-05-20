'use client'

import { useAppKitAccount } from '@reown/appkit/react'
import { ArrowDownToLineIcon, Loader2Icon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { encodeFunctionData } from 'viem'
import { usePublicClient, useSignTypedData, useWalletClient } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppKit } from '@/hooks/useAppKit'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { CTF_EXCHANGE_ADDRESS, NEG_RISK_CTF_EXCHANGE_ADDRESS } from '@/lib/contracts'
import { baseUnitsToNumber } from '@/lib/data-api/fees'
import { usdFormatter } from '@/lib/formatters'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { isUserRejectedRequestError, normalizeAddress } from '@/lib/wallet'
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

const MINIMUM_CLAIMABLE_FEES = 1_000_000n

function toLowerCaseAddress(value: `0x${string}` | null) {
  return value?.toLowerCase() ?? null
}

function maskWalletAddress(address: `0x${string}`) {
  return `${address.slice(0, 6)}****${address.slice(-4)}`
}

interface AdminAffiliateClaimableFeesCardProps {
  feeRecipientWallet: string
}

export default function AdminAffiliateClaimableFeesCard({
  feeRecipientWallet,
}: AdminAffiliateClaimableFeesCardProps) {
  const t = useExtracted()
  const { open } = useAppKit()
  const { signTypedDataAsync } = useSignTypedData()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const user = useUser()
  const { address: connectedAddress, isConnected } = useAppKitAccount()
  const [mainClaimable, setMainClaimable] = useState(0n)
  const [negRiskClaimable, setNegRiskClaimable] = useState(0n)
  const [isLoading, setIsLoading] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)
  const requestIdRef = useRef(0)
  const normalizedFeeRecipientWallet = normalizeAddress(feeRecipientWallet)
  const connectedWalletAddress = normalizeAddress(connectedAddress)
  const depositWalletAddress = user?.deposit_wallet_status === 'deployed'
    ? normalizeAddress(user.deposit_wallet_address)
    : null
  const normalizedFeeRecipientWalletLower = toLowerCaseAddress(normalizedFeeRecipientWallet)
  const canClaimWithDepositWallet = Boolean(
    normalizedFeeRecipientWalletLower
    && depositWalletAddress
    && normalizedFeeRecipientWalletLower === toLowerCaseAddress(depositWalletAddress),
  )
  const canClaimWithConnectedEoa = Boolean(
    normalizedFeeRecipientWalletLower
    && connectedWalletAddress
    && normalizedFeeRecipientWalletLower === toLowerCaseAddress(connectedWalletAddress),
  )
  const requiresConnectedEoa = Boolean(normalizedFeeRecipientWallet && !canClaimWithDepositWallet)

  const refreshClaimable = useCallback(async () => {
    const requestId = ++requestIdRef.current

    if (!publicClient || !normalizedFeeRecipientWallet) {
      setMainClaimable(0n)
      setNegRiskClaimable(0n)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const [main, negRisk] = await Promise.all([
        publicClient.readContract({
          address: CTF_EXCHANGE_ADDRESS,
          abi: exchangeFeeAbi,
          functionName: 'claimableFees',
          args: [normalizedFeeRecipientWallet],
        }),
        publicClient.readContract({
          address: NEG_RISK_CTF_EXCHANGE_ADDRESS,
          abi: exchangeFeeAbi,
          functionName: 'claimableFees',
          args: [normalizedFeeRecipientWallet],
        }),
      ])

      if (requestId !== requestIdRef.current) {
        return
      }

      setMainClaimable(main)
      setNegRiskClaimable(negRisk)
    }
    catch (error) {
      if (requestId === requestIdRef.current) {
        console.error('Failed to read claimable fees.', error)
        setMainClaimable(0n)
        setNegRiskClaimable(0n)
      }
    }
    finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [normalizedFeeRecipientWallet, publicClient])

  useEffect(() => {
    void refreshClaimable()
  }, [refreshClaimable])

  const totalClaimable = useMemo(() => mainClaimable + negRiskClaimable, [mainClaimable, negRiskClaimable])
  const claimableExchanges = useMemo(() => {
    const exchanges: `0x${string}`[] = []

    if (mainClaimable > 0n) {
      exchanges.push(CTF_EXCHANGE_ADDRESS)
    }

    if (negRiskClaimable > 0n) {
      exchanges.push(NEG_RISK_CTF_EXCHANGE_ADDRESS)
    }

    return exchanges
  }, [mainClaimable, negRiskClaimable])

  const hasMinimumClaimableBalance = totalClaimable >= MINIMUM_CLAIMABLE_FEES
  const isWrongConnectedWallet = Boolean(
    requiresConnectedEoa
    && connectedWalletAddress
    && !canClaimWithConnectedEoa,
  )
  const claimableValue = usdFormatter.format(baseUnitsToNumber(totalClaimable, 6))
  const connectWalletTooltip = normalizedFeeRecipientWallet
    ? t('You need to connect wallet {wallet} to withdraw.', {
        wallet: maskWalletAddress(normalizedFeeRecipientWallet),
      })
    : null

  const buttonTooltip = isClaiming
    ? t('Claiming...')
    : isLoading
      ? t('Refreshing...')
      : !normalizedFeeRecipientWallet
          ? null
          : isWrongConnectedWallet
            ? connectWalletTooltip
            : !hasMinimumClaimableBalance
                ? t('Claim fees')
                : null

  const isButtonDisabled = isLoading
    || isClaiming
    || !normalizedFeeRecipientWallet
    || isWrongConnectedWallet
    || !hasMinimumClaimableBalance

  const buttonAriaLabel = isClaiming
    ? t('Claiming...')
    : isLoading
      ? t('Refreshing...')
      : !isConnected
          ? t('Connect wallet')
          : t('Withdraw')

  async function submitDepositWalletClaim(exchanges: `0x${string}`[]) {
    if (!user?.address || !user.deposit_wallet_address) {
      toast.error(DEFAULT_ERROR_MESSAGE)
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
        toast.error(t('Enable Trading'))
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

  async function submitConnectedWalletClaim(exchanges: `0x${string}`[]) {
    if (!walletClient || !publicClient || !normalizedFeeRecipientWallet) {
      toast.error(DEFAULT_ERROR_MESSAGE)
      return false
    }

    for (const exchange of exchanges) {
      const hash = await walletClient.sendTransaction({
        account: normalizedFeeRecipientWallet,
        chain: walletClient.chain,
        to: exchange,
        data: encodeFunctionData({
          abi: exchangeFeeAbi,
          functionName: 'claim',
          args: [],
        }),
        value: 0n,
      })

      await publicClient.waitForTransactionReceipt({ hash })
    }

    return true
  }

  async function handleClaim() {
    if (!isConnected) {
      await open()
      return
    }

    if (!publicClient) {
      toast.error(DEFAULT_ERROR_MESSAGE)
      return
    }

    if (!hasMinimumClaimableBalance || !claimableExchanges.length) {
      toast.info(t('Claim fees'))
      return
    }

    setIsClaiming(true)
    try {
      const submitted = canClaimWithDepositWallet
        ? await submitDepositWalletClaim(claimableExchanges)
        : await submitConnectedWalletClaim(claimableExchanges)

      if (submitted) {
        toast.success(t('Fee claim submitted successfully.'))
      }
    }
    catch (error) {
      console.error('Failed to claim fees.', error)

      if (isUserRejectedRequestError(error)) {
        toast.error(t('You rejected the signature request.'))
      }
      else {
        toast.error(t('Failed to claim fees. Please try again.'))
      }
    }
    finally {
      await refreshClaimable()
      setIsClaiming(false)
    }
  }

  return (
    <div className="rounded-lg bg-muted/40 p-4">
      <p className="text-xs text-muted-foreground uppercase">{t('Your Claimable fees')}</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="text-2xl font-semibold">{claimableValue}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                type="button"
                size="icon"
                className="
                  rounded-md bg-primary text-primary-foreground
                  hover:bg-primary/90
                  disabled:bg-primary disabled:text-primary-foreground disabled:opacity-100
                "
                disabled={isButtonDisabled}
                onClick={() => void handleClaim()}
                aria-label={buttonTooltip ?? buttonAriaLabel}
              >
                {isLoading || isClaiming
                  ? <Loader2Icon className="size-4 animate-spin" />
                  : <ArrowDownToLineIcon className="size-4" />}
              </Button>
            </span>
          </TooltipTrigger>
          {buttonTooltip && (
            <TooltipContent side="top" className="max-w-64 text-left">
              {buttonTooltip}
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </div>
  )
}
