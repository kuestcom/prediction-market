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
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { FEE_CLAIM_EXCHANGE_ADDRESSES } from '@/lib/contracts'
import { baseUnitsToNumber } from '@/lib/data-api/fees'
import { usdFormatter } from '@/lib/formatters'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { cn } from '@/lib/utils'
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
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const { signTypedDataAsync } = useSignTypedData()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const user = useUser()
  const { address: connectedAddress, isConnected } = useAppKitAccount()
  const [claimableByExchange, setClaimableByExchange] = useState<Partial<Record<`0x${string}`, bigint>>>({})
  const [claimableReadFailures, setClaimableReadFailures] = useState<Set<`0x${string}`>>(() => new Set())
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
      setClaimableByExchange({})
      setClaimableReadFailures(new Set())
      setIsLoading(false)
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
              args: [normalizedFeeRecipientWallet],
            })

            return { exchange, claimable, didFail: false } as const
          }
          catch (error) {
            console.error('Failed to read claimable fees for exchange.', { exchange, error })
            return { exchange, didFail: true } as const
          }
        }),
      )

      if (requestId !== requestIdRef.current) {
        return
      }

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
    }
    catch (error) {
      if (requestId === requestIdRef.current) {
        console.error('Failed to read claimable fees.', error)
        setClaimableByExchange({})
        setClaimableReadFailures(new Set())
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

  const totalClaimable = useMemo(() => {
    return FEE_CLAIM_EXCHANGE_ADDRESSES.reduce((sum, exchange) => sum + (claimableByExchange[exchange] ?? 0n), 0n)
  }, [claimableByExchange])
  const claimableExchanges = useMemo(() => {
    const exchanges: `0x${string}`[] = []

    FEE_CLAIM_EXCHANGE_ADDRESSES.forEach((exchange) => {
      if ((claimableByExchange[exchange] ?? 0n) > 0n || claimableReadFailures.has(exchange)) {
        exchanges.push(exchange)
      }
    })

    return exchanges
  }, [claimableByExchange, claimableReadFailures])

  const hasMinimumClaimableBalance = totalClaimable >= MINIMUM_CLAIMABLE_FEES
  const hasUnknownClaimableBalance = claimableReadFailures.size > 0
  const hasClaimableBalance = hasMinimumClaimableBalance || hasUnknownClaimableBalance
  const isWrongConnectedWallet = Boolean(
    requiresConnectedEoa
    && connectedWalletAddress
    && !canClaimWithConnectedEoa,
  )
  const claimableValue = usdFormatter.format(baseUnitsToNumber(totalClaimable, 6))
  const insufficientClaimableTooltip = !hasMinimumClaimableBalance && !hasUnknownClaimableBalance
    ? t('You need at least $1 to claim')
    : null
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
                ? insufficientClaimableTooltip
                : null

  const isButtonDisabled = isLoading
    || isClaiming
    || !normalizedFeeRecipientWallet
    || isWrongConnectedWallet
    || !hasClaimableBalance

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

    if (!hasClaimableBalance || !claimableExchanges.length) {
      toast.info(t('You need at least $1 to claim'))
      return
    }

    setIsClaiming(true)
    try {
      const submitted = canClaimWithDepositWallet
        ? await runWithSignaturePrompt(() => submitDepositWalletClaim(claimableExchanges))
        : await runWithSignaturePrompt(() => submitConnectedWalletClaim(claimableExchanges))

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
      <div className="mt-1 flex items-center gap-2">
        <p className="text-2xl font-semibold">{claimableValue}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                type="button"
                size="icon"
                className={cn(`
                  size-8 rounded-md bg-primary text-primary-foreground
                  hover:bg-primary/90
                  disabled:bg-primary disabled:text-primary-foreground disabled:opacity-100
                `)}
                disabled={isButtonDisabled}
                onClick={() => void handleClaim()}
                aria-label={buttonTooltip ?? buttonAriaLabel}
              >
                {isLoading || isClaiming
                  ? <Loader2Icon className="size-3.5 animate-spin" />
                  : <ArrowDownToLineIcon className="size-3.5" />}
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
