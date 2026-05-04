'use client'

import type { SafeTransactionRequestPayload } from '@/lib/safe/transactions'
import type { ProxyWalletStatus } from '@/types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { hashTypedData, isAddress } from 'viem'
import { useSignMessage } from 'wagmi'
import { getSafeNonceAction, submitSafeTransactionAction } from '@/app/[locale]/(platform)/_actions/approve-tokens'
import { WalletDepositModal, WalletWithdrawModal } from '@/app/[locale]/(platform)/_components/WalletModal'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { useBalance } from '@/hooks/useBalance'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useLiFiWalletUsdBalance } from '@/hooks/useLiFiWalletUsdBalance'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { MAX_AMOUNT_INPUT } from '@/lib/amount-input'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { COLLATERAL_TOKEN_ADDRESS } from '@/lib/contracts'
import { formatAmountInputValue } from '@/lib/formatters'
import { DEFAULT_CHAIN_ID } from '@/lib/network'
import { buildSendErc20Transaction, getSafeTxTypedData, packSafeSignature } from '@/lib/safe/transactions'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'

type DepositView = 'fund' | 'receive' | 'wallets' | 'amount' | 'confirm' | 'success'

interface PendingWithdrawal {
  id: string
  amount: string
  to: string
  createdAt: number
}

interface WalletFlowProps {
  depositOpen: boolean
  onDepositOpenChange: (open: boolean) => void
  withdrawOpen: boolean
  onWithdrawOpenChange: (open: boolean) => void
  user: {
    id: string
    address: string
    proxy_wallet_address?: string | null
    proxy_wallet_status?: ProxyWalletStatus | null
  } | null
  meldUrl: string | null
}

function useDepositViewState(onDepositOpenChange: (open: boolean) => void) {
  const [depositView, setDepositView] = useState<DepositView>('fund')

  const handleDepositModalChange = useCallback((next: boolean) => {
    onDepositOpenChange(next)
    if (!next) {
      setDepositView('fund')
    }
  }, [onDepositOpenChange])

  return { depositView, setDepositView, handleDepositModalChange }
}

function useWithdrawFormState(onWithdrawOpenChange: (open: boolean) => void) {
  const [walletSendTo, setWalletSendTo] = useState('')
  const [walletSendAmount, setWalletSendAmount] = useState('')
  const [isWalletSending, setIsWalletSending] = useState(false)

  const handleWithdrawModalChange = useCallback((next: boolean) => {
    onWithdrawOpenChange(next)
    if (!next) {
      setIsWalletSending(false)
      setWalletSendTo('')
      setWalletSendAmount('')
    }
  }, [onWithdrawOpenChange])

  return {
    walletSendTo,
    setWalletSendTo,
    walletSendAmount,
    setWalletSendAmount,
    isWalletSending,
    setIsWalletSending,
    handleWithdrawModalChange,
  }
}

const PENDING_WITHDRAWAL_EXPIRY_MS = 2 * 60 * 1000

function usePendingWithdrawals() {
  const [pendingWithdrawals, setPendingWithdrawals] = useState<PendingWithdrawal[]>([])

  const visiblePendingWithdrawals = useMemo(
    () => pendingWithdrawals.filter(withdrawal => Date.now() - withdrawal.createdAt < PENDING_WITHDRAWAL_EXPIRY_MS),
    [pendingWithdrawals],
  )

  useEffect(function pruneExpiredPendingWithdrawals() {
    if (pendingWithdrawals.length === 0) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setPendingWithdrawals(current =>
        current.filter(withdrawal => Date.now() - withdrawal.createdAt < PENDING_WITHDRAWAL_EXPIRY_MS),
      )
    }, 15_000)

    return function clearPendingWithdrawalInterval() {
      window.clearInterval(intervalId)
    }
  }, [pendingWithdrawals.length])

  return { pendingWithdrawals: visiblePendingWithdrawals, setPendingWithdrawals }
}

function useHasDeployedProxyWallet(user: WalletFlowProps['user']) {
  return useMemo(() => (
    Boolean(user?.proxy_wallet_address && user?.proxy_wallet_status === 'deployed')
  ), [user?.proxy_wallet_address, user?.proxy_wallet_status])
}

function useWalletSendHandler({
  user,
  walletSendTo,
  walletSendAmount,
  setIsWalletSending,
  setWalletSendTo,
  setWalletSendAmount,
  setPendingWithdrawals,
  handleWithdrawModalChange,
  openTradeRequirements,
  runWithSignaturePrompt,
  signMessageAsync,
}: {
  user: WalletFlowProps['user']
  walletSendTo: string
  walletSendAmount: string
  setIsWalletSending: (value: boolean) => void
  setWalletSendTo: (value: string) => void
  setWalletSendAmount: (value: string) => void
  setPendingWithdrawals: (updater: (current: PendingWithdrawal[]) => PendingWithdrawal[]) => void
  handleWithdrawModalChange: (next: boolean) => void
  openTradeRequirements: ReturnType<typeof useTradingOnboarding>['openTradeRequirements']
  runWithSignaturePrompt: ReturnType<typeof useSignaturePromptRunner>['runWithSignaturePrompt']
  signMessageAsync: ReturnType<typeof useSignMessage>['signMessageAsync']
}) {
  return useCallback(async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    if (!user?.proxy_wallet_address) {
      toast.error('Deploy your proxy wallet first.')
      return
    }
    if (!isAddress(walletSendTo)) {
      toast.error('Enter a valid recipient address.')
      return
    }
    const amountNumber = Number(walletSendAmount)
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      toast.error('Enter a valid amount.')
      return
    }

    setIsWalletSending(true)
    try {
      const nonceResult = await getSafeNonceAction()
      if (nonceResult.error || !nonceResult.nonce) {
        if (isTradingAuthRequiredError(nonceResult.error)) {
          handleWithdrawModalChange(false)
          openTradeRequirements({ forceTradingAuth: true })
        }
        else {
          toast.error(nonceResult.error ?? DEFAULT_ERROR_MESSAGE)
        }
        return
      }

      const transaction = buildSendErc20Transaction({
        token: COLLATERAL_TOKEN_ADDRESS,
        to: walletSendTo as `0x${string}`,
        amount: walletSendAmount,
        decimals: 6,
      })

      const typedData = getSafeTxTypedData({
        chainId: DEFAULT_CHAIN_ID,
        safeAddress: user.proxy_wallet_address as `0x${string}`,
        transaction,
        nonce: nonceResult.nonce,
      })

      const structHash = hashTypedData({
        domain: typedData.domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message: typedData.message,
      }) as `0x${string}`

      const signature = await runWithSignaturePrompt(() => signMessageAsync({ message: { raw: structHash } }))

      const payload: SafeTransactionRequestPayload = {
        type: 'SAFE',
        from: user.address,
        to: transaction.to,
        proxyWallet: user.proxy_wallet_address,
        data: transaction.data,
        nonce: nonceResult.nonce,
        signature: packSafeSignature(signature as `0x${string}`),
        signatureParams: typedData.signatureParams,
        metadata: 'send_tokens',
      }

      const result = await submitSafeTransactionAction(payload)
      if (result.error) {
        if (isTradingAuthRequiredError(result.error)) {
          handleWithdrawModalChange(false)
          openTradeRequirements({ forceTradingAuth: true })
        }
        else {
          toast.error(result.error)
        }
        return
      }

      toast.success('Withdrawal submitted', {
        description: 'We sent your withdrawal transaction.',
      })
      setPendingWithdrawals((current) => {
        const next = [
          {
            id: result.txHash ?? `${walletSendTo}:${walletSendAmount}:${Date.now()}`,
            amount: walletSendAmount,
            to: walletSendTo,
            createdAt: Date.now(),
          },
          ...current,
        ]

        return next.slice(0, 5)
      })
      setWalletSendTo('')
      setWalletSendAmount('')
      handleWithdrawModalChange(false)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE
      toast.error(message)
    }
    finally {
      setIsWalletSending(false)
    }
  }, [
    handleWithdrawModalChange,
    openTradeRequirements,
    runWithSignaturePrompt,
    setIsWalletSending,
    setPendingWithdrawals,
    setWalletSendAmount,
    setWalletSendTo,
    signMessageAsync,
    user?.address,
    user?.proxy_wallet_address,
    walletSendAmount,
    walletSendTo,
  ])
}

function useBuyHandler({
  meldUrl,
  handleDepositModalChange,
}: {
  meldUrl: string | null
  handleDepositModalChange: (next: boolean) => void
}) {
  return useCallback((url?: string | null) => {
    const targetUrl = url ?? meldUrl
    if (!targetUrl) {
      return
    }

    const width = 480
    const height = 780
    const popup = window.open(
      targetUrl,
      'meld_onramp',
      `width=${width},height=${height},scrollbars=yes,resizable=yes`,
    )

    if (popup) {
      popup.focus()
      handleDepositModalChange(false)
    }
  }, [handleDepositModalChange, meldUrl])
}

function useUseConnectedWalletHandler({
  connectedWalletAddress,
  setWalletSendTo,
}: {
  connectedWalletAddress: string | null
  setWalletSendTo: (value: string) => void
}) {
  return useCallback(() => {
    if (!connectedWalletAddress) {
      return
    }
    setWalletSendTo(connectedWalletAddress)
  }, [connectedWalletAddress, setWalletSendTo])
}

function useSetMaxAmountHandler({
  balanceRaw,
  setWalletSendAmount,
}: {
  balanceRaw: number
  setWalletSendAmount: (value: string) => void
}) {
  return useCallback(() => {
    const amount = Number.isFinite(balanceRaw) ? balanceRaw : 0
    const limitedAmount = Math.min(amount, MAX_AMOUNT_INPUT)
    setWalletSendAmount(formatAmountInputValue(limitedAmount, { roundingMode: 'floor' }))
  }, [balanceRaw, setWalletSendAmount])
}

export function WalletFlow({
  depositOpen,
  onDepositOpenChange,
  withdrawOpen,
  onWithdrawOpenChange,
  user,
  meldUrl,
}: WalletFlowProps) {
  const isMobile = useIsMobile()
  const { signMessageAsync } = useSignMessage()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const { depositView, setDepositView, handleDepositModalChange } = useDepositViewState(onDepositOpenChange)
  const {
    walletSendTo,
    setWalletSendTo,
    walletSendAmount,
    setWalletSendAmount,
    isWalletSending,
    setIsWalletSending,
    handleWithdrawModalChange,
  } = useWithdrawFormState(onWithdrawOpenChange)
  const { pendingWithdrawals: visiblePendingWithdrawals, setPendingWithdrawals } = usePendingWithdrawals()
  const { balance, isLoadingBalance } = useBalance()
  const {
    formattedUsdBalance,
    isLoadingUsdBalance,
  } = useLiFiWalletUsdBalance(user?.address, { enabled: depositOpen })
  const site = useSiteIdentity()
  const connectedWalletAddress = user?.address ?? null
  const { openTradeRequirements } = useTradingOnboarding()

  const hasDeployedProxyWallet = useHasDeployedProxyWallet(user)

  const handleWalletSend = useWalletSendHandler({
    user,
    walletSendTo,
    walletSendAmount,
    setIsWalletSending,
    setWalletSendTo,
    setWalletSendAmount,
    setPendingWithdrawals,
    handleWithdrawModalChange,
    openTradeRequirements,
    runWithSignaturePrompt,
    signMessageAsync,
  })

  const handleBuy = useBuyHandler({ meldUrl, handleDepositModalChange })
  const handleUseConnectedWallet = useUseConnectedWalletHandler({ connectedWalletAddress, setWalletSendTo })
  const handleSetMaxAmount = useSetMaxAmountHandler({ balanceRaw: balance.raw, setWalletSendAmount })

  return (
    <>
      <WalletDepositModal
        open={depositOpen}
        onOpenChange={handleDepositModalChange}
        isMobile={isMobile}
        walletAddress={user?.proxy_wallet_address ?? null}
        walletEoaAddress={user?.address ?? null}
        siteName={site.name}
        meldUrl={meldUrl}
        hasDeployedProxyWallet={hasDeployedProxyWallet}
        view={depositView}
        onViewChange={setDepositView}
        onBuy={handleBuy}
        walletBalance={formattedUsdBalance}
        isBalanceLoading={isLoadingUsdBalance}
      />
      <WalletWithdrawModal
        open={withdrawOpen}
        onOpenChange={handleWithdrawModalChange}
        isMobile={isMobile}
        siteName={site.name}
        sendTo={walletSendTo}
        onChangeSendTo={event => setWalletSendTo(event.target.value)}
        sendAmount={walletSendAmount}
        onChangeSendAmount={setWalletSendAmount}
        isSending={isWalletSending}
        onSubmitSend={handleWalletSend}
        connectedWalletAddress={connectedWalletAddress}
        onUseConnectedWallet={handleUseConnectedWallet}
        availableBalance={balance.raw}
        onMax={handleSetMaxAmount}
        isBalanceLoading={isLoadingBalance}
        pendingWithdrawals={visiblePendingWithdrawals}
      />
    </>
  )
}
