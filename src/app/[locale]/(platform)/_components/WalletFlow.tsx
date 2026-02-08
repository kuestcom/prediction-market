'use client'

import type { SafeTransactionRequestPayload } from '@/lib/safe/transactions'
import type { ProxyWalletStatus } from '@/types'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { hashTypedData, isAddress } from 'viem'
import { useSignMessage } from 'wagmi'
import { getSafeNonceAction, submitSafeTransactionAction } from '@/app/[locale]/(platform)/_actions/approve-tokens'
import { WalletDepositModal, WalletWithdrawModal } from '@/app/[locale]/(platform)/_components/WalletModal'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { useBalance } from '@/hooks/useBalance'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useLiFiWalletUsdBalance } from '@/hooks/useLiFiWalletUsdBalance'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { MAX_AMOUNT_INPUT } from '@/lib/amount-input'
import { defaultNetwork } from '@/lib/appkit'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { COLLATERAL_TOKEN_ADDRESS } from '@/lib/contracts'
import { formatAmountInputValue } from '@/lib/formatters'
import { buildSendErc20Transaction, getSafeTxTypedData, packSafeSignature } from '@/lib/safe/transactions'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'

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
  const [depositView, setDepositView] = useState<'fund' | 'receive' | 'wallets' | 'amount' | 'confirm' | 'success'>('fund')
  const [walletSendTo, setWalletSendTo] = useState('')
  const [walletSendAmount, setWalletSendAmount] = useState('')
  const [isWalletSending, setIsWalletSending] = useState(false)
  const { balance, isLoadingBalance } = useBalance()
  const {
    formattedUsdBalance,
    isLoadingUsdBalance,
  } = useLiFiWalletUsdBalance(user?.address, { enabled: depositOpen })
  const site = useSiteIdentity()
  const connectedWalletAddress = user?.address ?? null
  const { openTradeRequirements } = useTradingOnboarding()

  const hasDeployedProxyWallet = useMemo(() => (
    Boolean(user?.proxy_wallet_address && user?.proxy_wallet_status === 'deployed')
  ), [user?.proxy_wallet_address, user?.proxy_wallet_status])

  const handleDepositModalChange = useCallback((next: boolean) => {
    onDepositOpenChange(next)
    if (!next) {
      setDepositView('fund')
    }
  }, [onDepositOpenChange])

  const handleWithdrawModalChange = useCallback((next: boolean) => {
    onWithdrawOpenChange(next)
    if (!next) {
      setIsWalletSending(false)
      setWalletSendTo('')
      setWalletSendAmount('')
    }
  }, [onWithdrawOpenChange])

  const handleWalletSend = useCallback(async (event?: React.FormEvent<HTMLFormElement>) => {
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
          openTradeRequirements()
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
        chainId: defaultNetwork.id,
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

      const signature = await signMessageAsync({ message: { raw: structHash } })

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
          openTradeRequirements()
        }
        else {
          toast.error(result.error)
        }
        return
      }

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
    signMessageAsync,
    user?.address,
    user?.proxy_wallet_address,
    walletSendAmount,
    walletSendTo,
  ])

  const handleBuy = useCallback((url?: string | null) => {
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

  const handleUseConnectedWallet = useCallback(() => {
    if (!connectedWalletAddress) {
      return
    }
    setWalletSendTo(connectedWalletAddress)
  }, [connectedWalletAddress])

  const handleSetMaxAmount = useCallback(() => {
    const amount = Number.isFinite(balance.raw) ? balance.raw : 0
    const limitedAmount = Math.min(amount, MAX_AMOUNT_INPUT)
    setWalletSendAmount(formatAmountInputValue(limitedAmount, { roundingMode: 'floor' }))
  }, [balance.raw])

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
      />
    </>
  )
}
