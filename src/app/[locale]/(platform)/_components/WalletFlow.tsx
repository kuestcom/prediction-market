'use client'

import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isAddress } from 'viem'
import { useSignTypedData } from 'wagmi'

import type { DepositWalletStatus } from '@/types'

import { WalletDepositModal, WalletWithdrawModal } from '@/app/[locale]/(platform)/_components/WalletModal'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { toast } from '@/components/ui/toast'
import { useAppKit } from '@/hooks/useAppKit'
import { useBalance } from '@/hooks/useBalance'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useLiFiWalletUsdBalance } from '@/hooks/useLiFiWalletUsdBalance'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { useRouter } from '@/i18n/navigation'
import { MAX_AMOUNT_INPUT } from '@/lib/amount-input'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { COLLATERAL_TOKEN_ADDRESS } from '@/lib/contracts'
import { formatAmountInputValue } from '@/lib/formatters'
import { IS_TEST_MODE } from '@/lib/network'
import { isMeldCheckoutReturnMessage, MELD_CHECKOUT_RETURN_CHANNEL } from '@/lib/payments/meld-return-channel'
import { startMeldCheckout } from '@/lib/payments/start-meld-checkout'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { signAndSubmitDepositWalletCalls } from '@/lib/wallet/client'
import { buildSendErc20Call } from '@/lib/wallet/transactions'

type DepositView = 'fund' | 'receive' | 'wallets' | 'amount' | 'confirm' | 'success'

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
  canBuyMeld: boolean
}

interface WalletSendMessages {
  depositWalletRequired: string
  invalidRecipient: string
  invalidAmount: string
  reconnectWallet: string
  withdrawalSubmitted: string
  withdrawalSubmittedDescription: string
}

function useDepositViewState(onDepositOpenChange: (open: boolean) => void) {
  const [depositView, setDepositView] = useState<DepositView>('fund')

  const handleDepositModalChange = useCallback(
    (next: boolean) => {
      onDepositOpenChange(next)
      if (!next) {
        setDepositView('fund')
      }
    },
    [onDepositOpenChange],
  )

  return { depositView, setDepositView, handleDepositModalChange }
}

function useWithdrawFormState(onWithdrawOpenChange: (open: boolean) => void) {
  const [walletSendTo, setWalletSendTo] = useState('')
  const [walletSendAmount, setWalletSendAmount] = useState('')
  const [isWalletSending, setIsWalletSending] = useState(false)

  const handleWithdrawModalChange = useCallback(
    (next: boolean) => {
      onWithdrawOpenChange(next)
      if (!next) {
        setIsWalletSending(false)
        setWalletSendTo('')
        setWalletSendAmount('')
      }
    },
    [onWithdrawOpenChange],
  )

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

function useHasDeployedDepositWallet(user: WalletFlowProps['user']) {
  return useMemo(
    () => Boolean(user?.deposit_wallet_address && user?.deposit_wallet_status === 'deployed'),
    [user?.deposit_wallet_address, user?.deposit_wallet_status],
  )
}

function useWalletSendHandler({
  user,
  walletSendTo,
  walletSendAmount,
  setIsWalletSending,
  setWalletSendTo,
  setWalletSendAmount,
  handleWithdrawModalChange,
  openTradeRequirements,
  openWalletModal,
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
  handleWithdrawModalChange: (next: boolean) => void
  openTradeRequirements: ReturnType<typeof useTradingOnboarding>['openTradeRequirements']
  openWalletModal: ReturnType<typeof useAppKit>['open']
  runWithSignaturePrompt: ReturnType<typeof useSignaturePromptRunner>['runWithSignaturePrompt']
  signTypedDataAsync: ReturnType<typeof useSignTypedData>['signTypedDataAsync']
  messages: WalletSendMessages
}) {
  return useCallback(
    async (event?: React.FormEvent<HTMLFormElement>) => {
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

        const result = await runWithSignaturePrompt(() =>
          signAndSubmitDepositWalletCalls({
            user,
            calls: [call],
            metadata: 'send_tokens',
            signTypedDataAsync,
          }),
        )
        if (result.error) {
          if (isTradingAuthRequiredError(result.error)) {
            handleWithdrawModalChange(false)
            openTradeRequirements({ forceTradingAuth: true })
          } else if (result.code === 'wallet_connector_not_connected') {
            toast.error(messages.reconnectWallet)
            void openWalletModal({ view: 'Connect' })
          } else {
            toast.error(result.error)
          }
          return
        }

        toast.success(messages.withdrawalSubmitted, {
          description: messages.withdrawalSubmittedDescription,
        })
        setWalletSendTo('')
        setWalletSendAmount('')
        handleWithdrawModalChange(false)
      } catch (error) {
        const message = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE
        toast.error(message)
      } finally {
        setIsWalletSending(false)
      }
    },
    [
      handleWithdrawModalChange,
      messages,
      openTradeRequirements,
      openWalletModal,
      runWithSignaturePrompt,
      setIsWalletSending,
      setWalletSendAmount,
      setWalletSendTo,
      signTypedDataAsync,
      user,
      walletSendAmount,
      walletSendTo,
    ],
  )
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
  canBuyMeld,
}: WalletFlowProps) {
  const isMobile = useIsMobile()
  const t = useExtracted()
  const router = useRouter()
  const { signTypedDataAsync } = useSignTypedData()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const { open: openAppKit } = useAppKit()
  const { depositView, setDepositView, handleDepositModalChange } = useDepositViewState(onDepositOpenChange)
  const meldCheckoutPopupsRef = useRef(new Map<string, Window>())
  const {
    walletSendTo,
    setWalletSendTo,
    walletSendAmount,
    setWalletSendAmount,
    isWalletSending,
    setIsWalletSending,
    handleWithdrawModalChange,
  } = useWithdrawFormState(onWithdrawOpenChange)
  const hasDeployedDepositWallet = useHasDeployedDepositWallet(user)
  const depositWalletAddress = user?.deposit_wallet_address ?? null
  const { balance, isLoadingBalance, refetchBalance } = useBalance({ depositWalletAddress })
  const {
    formattedUsdBalance: formattedConnectedWalletUsdBalance,
    isLoadingUsdBalance: isLoadingConnectedWalletUsdBalance,
  } = useLiFiWalletUsdBalance(user?.address, { enabled: depositOpen && !IS_TEST_MODE })
  const site = useSiteIdentity()
  const connectedWalletAddress = user?.address ?? null
  const { openTradeRequirements } = useTradingOnboarding()

  const walletSendMessages = useMemo<WalletSendMessages>(
    () => ({
      depositWalletRequired: t('Set up your Deposit Wallet first.'),
      invalidRecipient: t('Enter a valid recipient address.'),
      invalidAmount: t('Enter a valid amount.'),
      reconnectWallet: t('Your wallet connection expired. Reconnect your wallet and try again.'),
      withdrawalSubmitted: t('Withdrawal submitted'),
      withdrawalSubmittedDescription: t('We sent your withdrawal transaction.'),
    }),
    [t],
  )

  const handleWalletSend = useWalletSendHandler({
    user,
    walletSendTo,
    walletSendAmount,
    setIsWalletSending,
    setWalletSendTo,
    setWalletSendAmount,
    handleWithdrawModalChange,
    openTradeRequirements,
    openWalletModal: openAppKit,
    runWithSignaturePrompt,
    signTypedDataAsync,
    messages: walletSendMessages,
  })

  const handleBuy = useCallback(() => {
    if (!canBuyMeld) {
      return
    }

    const popup = window.open('', '_blank', 'width=450,height=790,scrollbars=yes,resizable=yes')
    if (popup) {
      popup.opener = null
      popup.focus()
    }
    handleDepositModalChange(false)
    void startMeldCheckout(popup, {
      onCheckoutCreated: (checkoutId) => {
        if (popup && !popup.closed) {
          meldCheckoutPopupsRef.current.set(checkoutId, popup)
        }
      },
    }).catch(() => {
      toast.error(t('An unexpected error occurred. Please try again.'))
    })
  }, [canBuyMeld, handleDepositModalChange, t])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      return
    }

    const channel = new BroadcastChannel(MELD_CHECKOUT_RETURN_CHANNEL)
    function handleReturn(event: MessageEvent<unknown>) {
      if (!isMeldCheckoutReturnMessage(event.data) || event.data.type !== 'return') {
        return
      }

      const popup = meldCheckoutPopupsRef.current.get(event.data.checkoutId)
      if (!popup) {
        return
      }

      meldCheckoutPopupsRef.current.delete(event.data.checkoutId)
      channel.postMessage({ type: 'ack', checkoutId: event.data.checkoutId })
      if (!popup.closed) {
        try {
          popup.close()
        } catch {
          // The return window has its own close attempt and a fallback screen.
        }
      }
      router.replace({ pathname: '/', query: { meldCheckoutId: event.data.checkoutId } })
    }

    channel.addEventListener('message', handleReturn)
    return () => {
      channel.removeEventListener('message', handleReturn)
      channel.close()
    }
  }, [router])

  const handleUseConnectedWallet = useUseConnectedWalletHandler({ connectedWalletAddress, setWalletSendTo })
  const handleSetMaxAmount = useSetMaxAmountHandler({ balanceRaw: balance.raw, setWalletSendAmount })

  useEffect(() => {
    let isActive = true
    const runningCheckouts = new Set<string>()
    const timers = new Map<ReturnType<typeof setTimeout>, () => void>()

    function wait(milliseconds: number): Promise<void> {
      return new Promise<void>((resolve) => {
        let timer: ReturnType<typeof setTimeout>
        function finish() {
          timers.delete(timer)
          resolve()
        }
        timer = setTimeout(finish, milliseconds)
        timers.set(timer, finish)
      })
    }

    function clearPendingCheckout(checkoutId: string) {
      try {
        if (window.localStorage.getItem('kuest:pending-meld-checkout') === checkoutId) {
          window.localStorage.removeItem('kuest:pending-meld-checkout')
        }
      } catch {
        // Storage is optional; the return page continues polling the checkout.
      }
    }

    async function pollCheckout(checkoutId: string) {
      if (!/^[0-9a-f-]{36}$/iu.test(checkoutId) || runningCheckouts.has(checkoutId)) {
        return
      }
      runningCheckouts.add(checkoutId)
      for (let attempt = 0; isActive; attempt += 1) {
        try {
          const response = await fetch(`/api/payments/meld/checkouts/${encodeURIComponent(checkoutId)}/status`, {
            cache: 'no-store',
          })
          if (response.status === 401) {
            break
          }
          if (response.status === 404) {
            clearPendingCheckout(checkoutId)
            break
          }
          if (response.ok) {
            const result: unknown = await response.json()
            const status =
              typeof result === 'object' && result !== null && 'status' in result && typeof result.status === 'string'
                ? result.status
                : null
            if (status === 'SETTLED') {
              clearPendingCheckout(checkoutId)
              await refetchBalance()
              break
            }
            if (status && ['FAILED', 'DECLINED', 'CANCELLED', 'REFUNDED', 'AUTHORIZATION_EXPIRED'].includes(status)) {
              clearPendingCheckout(checkoutId)
              break
            }
          }
        } catch {
          // Retry transient network and provider errors while the page remains open.
        }

        const delay = attempt < 12 ? 10_000 : 30_000
        await wait(delay)
      }
      runningCheckouts.delete(checkoutId)
    }

    function readPendingCheckout() {
      try {
        const checkoutId = window.localStorage.getItem('kuest:pending-meld-checkout')
        if (checkoutId) {
          void pollCheckout(checkoutId)
        }
      } catch {
        // Status tracking in the return page remains available without browser storage.
      }
    }
    function onCreated(event: Event) {
      const checkoutId = (event as CustomEvent<unknown>).detail
      if (typeof checkoutId === 'string') {
        void pollCheckout(checkoutId)
      }
    }

    readPendingCheckout()
    window.addEventListener('storage', readPendingCheckout)
    window.addEventListener('kuest:meld-checkout-created', onCreated)
    return () => {
      isActive = false
      window.removeEventListener('storage', readPendingCheckout)
      window.removeEventListener('kuest:meld-checkout-created', onCreated)
      for (const [timer, finish] of timers) {
        clearTimeout(timer)
        finish()
      }
      timers.clear()
    }
  }, [refetchBalance])

  return (
    <>
      <WalletDepositModal
        open={depositOpen}
        onOpenChange={handleDepositModalChange}
        isMobile={isMobile}
        walletAddress={depositWalletAddress}
        walletEoaAddress={user?.address ?? null}
        siteName={site.name}
        canBuyMeld={canBuyMeld}
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
        onChangeSendTo={(event) => setWalletSendTo(event.target.value)}
        sendAmount={walletSendAmount}
        onChangeSendAmount={setWalletSendAmount}
        isSending={isWalletSending}
        onSubmitSend={handleWalletSend}
        connectedWalletAddress={connectedWalletAddress}
        onUseConnectedWallet={handleUseConnectedWallet}
        availableBalance={balance.raw}
        onMax={handleSetMaxAmount}
        isBalanceLoading={isLoadingBalance}
      />
    </>
  )
}
