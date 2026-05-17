'use client'

import type { DepositWalletStatus } from '@/types'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { isAddress } from 'viem'
import { useSignTypedData } from 'wagmi'
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
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { signAndSubmitDepositWalletCalls } from '@/lib/wallet/client'
import { buildSendErc20Call } from '@/lib/wallet/transactions'

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
    deposit_wallet_address?: string | null
    deposit_wallet_status?: DepositWalletStatus | null
  } | null
  meldUrl: string | null
}

interface WalletSendMessages {
  depositWalletRequired: string
  invalidRecipient: string
  invalidAmount: string
  withdrawalSubmitted: string
  withdrawalSubmittedDescription: string
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

function useHasDeployedDepositWallet(user: WalletFlowProps['user']) {
  return useMemo(() => (
    Boolean(user?.deposit_wallet_address && user?.deposit_wallet_status === 'deployed')
  ), [user?.deposit_wallet_address, user?.deposit_wallet_status])
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
  signTypedDataAsync,
  messages,
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
  signTypedDataAsync: ReturnType<typeof useSignTypedData>['signTypedDataAsync']
  messages: WalletSendMessages
}) {
  return useCallback(async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    if (!user?.deposit_wallet_address) {
      toast.error(messages.depositWalletRequired)
      return
    }
    if (!isAddress(walletSendTo)) {
      toast.error(messages.invalidRecipient)
      return
    }
    const amountNumber = Number(walletSendAmount)
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      toast.error(messages.invalidAmount)
      return
    }

    setIsWalletSending(true)
    try {
      const call = buildSendErc20Call({
        token: COLLATERAL_TOKEN_ADDRESS,
        to: walletSendTo as `0x${string}`,
        amount: walletSendAmount,
        decimals: 6,
      })

      const result = await runWithSignaturePrompt(() => signAndSubmitDepositWalletCalls({
        user,
        calls: [call],
        metadata: 'send_tokens',
        signTypedDataAsync,
      }))
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

      toast.success(messages.withdrawalSubmitted, {
        description: messages.withdrawalSubmittedDescription,
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
    messages,
    openTradeRequirements,
    runWithSignaturePrompt,
    setIsWalletSending,
    setPendingWithdrawals,
    setWalletSendAmount,
    setWalletSendTo,
    signTypedDataAsync,
    user,
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
  const t = useExtracted()
  const { signTypedDataAsync } = useSignTypedData()
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
  const hasDeployedDepositWallet = useHasDeployedDepositWallet(user)
  const depositWalletAddress = user?.deposit_wallet_address ?? null
  const { balance, isLoadingBalance } = useBalance({ depositWalletAddress })
  const {
    formattedUsdBalance: formattedConnectedWalletUsdBalance,
    isLoadingUsdBalance: isLoadingConnectedWalletUsdBalance,
  } = useLiFiWalletUsdBalance(user?.address, { enabled: depositOpen })
  const site = useSiteIdentity()
  const connectedWalletAddress = user?.address ?? null
  const { openTradeRequirements } = useTradingOnboarding()

  const walletSendMessages = useMemo<WalletSendMessages>(() => ({
    depositWalletRequired: t('Set up your Deposit Wallet first.'),
    invalidRecipient: t('Enter a valid recipient address.'),
    invalidAmount: t('Enter a valid amount.'),
    withdrawalSubmitted: t('Withdrawal submitted'),
    withdrawalSubmittedDescription: t('We sent your withdrawal transaction.'),
  }), [t])

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
    signTypedDataAsync,
    messages: walletSendMessages,
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
        walletAddress={depositWalletAddress}
        walletEoaAddress={user?.address ?? null}
        siteName={site.name}
        meldUrl={meldUrl}
        hasDeployedDepositWallet={hasDeployedDepositWallet}
        view={depositView}
        onViewChange={setDepositView}
        onBuy={handleBuy}
        depositWalletBalance={balance.text}
        isDepositWalletBalanceLoading={isLoadingBalance}
        walletBalance={formattedConnectedWalletUsdBalance}
        isBalanceLoading={isLoadingConnectedWalletUsdBalance}
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
