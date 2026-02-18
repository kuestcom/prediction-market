'use client'

import type { ReactNode } from 'react'
import type { SafeTransactionRequestPayload } from '@/lib/safe/transactions'
import type { User } from '@/types'
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { hashTypedData, UserRejectedRequestError } from 'viem'
import { useSignMessage, useSignTypedData } from 'wagmi'
import { getSafeNonceAction, submitSafeTransactionAction } from '@/app/[locale]/(platform)/_actions/approve-tokens'
import { saveProxyWalletSignature } from '@/app/[locale]/(platform)/_actions/proxy-wallet'
import { generateTradingAuthAction } from '@/app/[locale]/(platform)/_actions/trading-auth'
import TradingOnboardingDialogs from '@/app/[locale]/(platform)/_components/TradingOnboardingDialogs'
import { useAffiliateOrderMetadata } from '@/hooks/useAffiliateOrderMetadata'
import { useAppKit } from '@/hooks/useAppKit'
import { useProxyWalletPolling } from '@/hooks/useProxyWalletPolling'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { defaultNetwork } from '@/lib/appkit'
import { authClient } from '@/lib/auth-client'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import {
  CONDITIONAL_TOKENS_CONTRACT,
  CTF_EXCHANGE_ADDRESS,
  NEG_RISK_CTF_EXCHANGE_ADDRESS,
  UMA_NEG_RISK_ADAPTER_ADDRESS,
} from '@/lib/contracts'
import { fetchReferralLocked } from '@/lib/exchange'
import {
  getSafeProxyDomain,
  SAFE_PROXY_CREATE_PROXY_MESSAGE,
  SAFE_PROXY_PRIMARY_TYPE,
  SAFE_PROXY_TYPES,
} from '@/lib/safe-proxy'
import {
  aggregateSafeTransactions,
  buildApproveTokenTransactions,
  buildSetReferralTransactions,
  getSafeTxTypedData,
  packSafeSignature,
} from '@/lib/safe/transactions'
import {
  buildTradingAuthMessage,
  getTradingAuthDomain,
  TRADING_AUTH_PRIMARY_TYPE,
  TRADING_AUTH_TYPES,
} from '@/lib/trading-auth/client'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { useUser } from '@/stores/useUser'

interface TradingOnboardingContextValue {
  startDepositFlow: () => void
  startWithdrawFlow: () => void
  ensureTradingReady: () => boolean
  openTradeRequirements: (options?: { forceTradingAuth?: boolean }) => void
  hasProxyWallet: boolean
  openWalletModal: () => void
}

const TradingOnboardingContext = createContext<TradingOnboardingContextValue | null>(null)

export function TradingOnboardingProvider({ children }: { children: ReactNode }) {
  const user = useUser()
  const { open } = useAppKit()
  const { signTypedDataAsync } = useSignTypedData()
  const { signMessageAsync } = useSignMessage()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const affiliateMetadata = useAffiliateOrderMetadata()
  const [enableModalOpen, setEnableModalOpen] = useState(false)
  const [fundModalOpen, setFundModalOpen] = useState(false)
  const [tradeModalOpen, setTradeModalOpen] = useState(false)
  const [shouldShowFundAfterProxy, setShouldShowFundAfterProxy] = useState(false)
  const [proxyWalletError, setProxyWalletError] = useState<string | null>(null)
  const [tradingAuthError, setTradingAuthError] = useState<string | null>(null)
  const [tokenApprovalError, setTokenApprovalError] = useState<string | null>(null)
  const [proxyStep, setProxyStep] = useState<'idle' | 'signing' | 'deploying' | 'completed'>('idle')
  const [tradingAuthStep, setTradingAuthStep] = useState<'idle' | 'signing' | 'completed'>('idle')
  const [approvalsStep, setApprovalsStep] = useState<'idle' | 'signing' | 'completed'>('idle')
  const [requiresTradingAuthRefresh, setRequiresTradingAuthRefresh] = useState(false)
  const [depositModalOpen, setDepositModalOpen] = useState(false)
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)

  const proxyWalletStatus = user?.proxy_wallet_status ?? null
  const hasProxyWalletAddress = Boolean(user?.proxy_wallet_address)
  const hasDeployedProxyWallet = useMemo(() => (
    Boolean(user?.proxy_wallet_address && proxyWalletStatus === 'deployed')
  ), [proxyWalletStatus, user?.proxy_wallet_address])
  const isProxyWalletDeploying = useMemo(() => (
    Boolean(
      user?.proxy_wallet_address
      && (proxyWalletStatus === 'deploying' || proxyWalletStatus === 'signed'),
    )
  ), [proxyWalletStatus, user?.proxy_wallet_address])
  const tradingAuthSettings = user?.settings?.tradingAuth ?? null
  const hasTradingAuth = Boolean(
    tradingAuthSettings?.relayer?.enabled
    && tradingAuthSettings?.clob?.enabled,
  )
  const hasEffectiveTradingAuth = hasTradingAuth && !requiresTradingAuthRefresh
  const approvalsSettings = tradingAuthSettings?.approvals ?? null
  const hasTokenApprovals = Boolean(approvalsSettings?.enabled)
  const tradingAuthSatisfied = hasEffectiveTradingAuth || tradingAuthStep === 'completed'
  const localStepsComplete
    = proxyStep === 'completed'
      && tradingAuthStep === 'completed'
      && approvalsStep === 'completed'
  const tradingReady
    = (tradingAuthSatisfied && hasDeployedProxyWallet && hasTokenApprovals)
      || localStepsComplete
  const previousUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    const nextUserId = user?.id ?? null
    if (previousUserIdRef.current === nextUserId) {
      return
    }

    previousUserIdRef.current = nextUserId
    setProxyWalletError(null)
    setTradingAuthError(null)
    setTokenApprovalError(null)
    setShouldShowFundAfterProxy(false)
    setRequiresTradingAuthRefresh(false)

    if (!nextUserId) {
      setProxyStep('idle')
      setTradingAuthStep('idle')
      setApprovalsStep('idle')
      return
    }

    setProxyStep(hasDeployedProxyWallet ? 'completed' : isProxyWalletDeploying ? 'deploying' : 'idle')
    setTradingAuthStep(hasTradingAuth ? 'completed' : 'idle')
    setApprovalsStep(hasTokenApprovals ? 'completed' : 'idle')
  }, [hasDeployedProxyWallet, hasTokenApprovals, hasTradingAuth, isProxyWalletDeploying, user?.id])

  useEffect(() => {
    if (hasDeployedProxyWallet) {
      setProxyStep('completed')
    }
    else if (isProxyWalletDeploying) {
      setProxyStep(prev => (prev === 'completed' ? 'completed' : 'deploying'))
    }
  }, [hasDeployedProxyWallet, isProxyWalletDeploying])

  useEffect(() => {
    if (hasTradingAuth && !requiresTradingAuthRefresh) {
      setTradingAuthStep('completed')
    }
  }, [hasTradingAuth, requiresTradingAuthRefresh])

  useEffect(() => {
    if (hasTokenApprovals) {
      setApprovalsStep('completed')
    }
  }, [hasTokenApprovals])

  const refreshSessionUserState = useCallback(async () => {
    try {
      const session = await authClient.getSession({
        query: {
          disableCookieCache: true,
        },
      })
      const sessionUser = session?.data?.user as User | undefined
      if (sessionUser) {
        useUser.setState((previous) => {
          if (!previous) {
            return {
              ...sessionUser,
              image: sessionUser.image ?? '',
            }
          }

          return {
            ...previous,
            ...sessionUser,
            image: sessionUser.image ?? previous.image ?? '',
            settings: {
              ...(previous.settings ?? {}),
              ...(sessionUser.settings ?? {}),
            },
          }
        })
      }
    }
    catch (error) {
      console.error('Failed to refresh user session', error)
    }
  }, [])

  useEffect(() => {
    if (!enableModalOpen && !tradeModalOpen) {
      return
    }
    void refreshSessionUserState()
  }, [enableModalOpen, refreshSessionUserState, tradeModalOpen])

  useProxyWalletPolling({
    userId: user?.id,
    proxyWalletAddress: user?.proxy_wallet_address,
    proxyWalletStatus: user?.proxy_wallet_status,
    hasDeployedProxyWallet,
    hasProxyWalletAddress,
  })

  const resetPendingFundState = useCallback(() => {
    setShouldShowFundAfterProxy(false)
  }, [])

  const resetEnableFlowState = useCallback(() => {
    setProxyWalletError(null)
    setTradingAuthError(null)
    setTokenApprovalError(null)
    setShouldShowFundAfterProxy(false)
    setDepositModalOpen(false)
    setWithdrawModalOpen(false)
    if (proxyStep !== 'completed') {
      setProxyStep('idle')
    }
    if (!hasTradingAuth || requiresTradingAuthRefresh) {
      setTradingAuthStep('idle')
    }
    if (!hasTokenApprovals) {
      setApprovalsStep('idle')
    }
  }, [hasTokenApprovals, hasTradingAuth, proxyStep, requiresTradingAuthRefresh])

  const handleProxyWalletSignature = useCallback(async () => {
    setProxyWalletError(null)

    try {
      setProxyStep('signing')
      const domain = getSafeProxyDomain()

      const signature = await runWithSignaturePrompt(() => signTypedDataAsync({
        domain,
        types: SAFE_PROXY_TYPES,
        primaryType: SAFE_PROXY_PRIMARY_TYPE,
        message: SAFE_PROXY_CREATE_PROXY_MESSAGE,
      }))

      const result = await saveProxyWalletSignature({ signature })

      if (result.error || !result.data) {
        if (isTradingAuthRequiredError(result.error)) {
          setProxyStep('idle')
          resetEnableFlowState()
          setRequiresTradingAuthRefresh(true)
          setTradingAuthStep('idle')
          setTradingAuthError(null)
          setTradeModalOpen(true)
          return
        }
        setProxyStep('idle')
        setProxyWalletError(result.error ?? DEFAULT_ERROR_MESSAGE)
        return
      }

      useUser.setState((previous) => {
        if (!previous) {
          return previous
        }

        return {
          ...previous,
          ...result.data,
        }
      })

      const nextStatus = result.data.proxy_wallet_status
      if (nextStatus === 'deployed') {
        setProxyStep('completed')
      }
      else if (nextStatus === 'deploying' || nextStatus === 'signed') {
        setProxyStep('deploying')
      }
      else {
        setProxyStep('idle')
      }

      void refreshSessionUserState()

      setEnableModalOpen(false)

      if (shouldShowFundAfterProxy) {
        setFundModalOpen(true)
      }

      resetPendingFundState()
    }
    catch (error) {
      if (error instanceof UserRejectedRequestError) {
        setProxyWalletError('You rejected the signature request.')
        setProxyStep('idle')
      }
      else if (error instanceof Error) {
        setProxyWalletError(error.message || DEFAULT_ERROR_MESSAGE)
        setProxyStep('idle')
      }
      else {
        setProxyWalletError(DEFAULT_ERROR_MESSAGE)
        setProxyStep('idle')
      }
    }
  }, [
    refreshSessionUserState,
    resetEnableFlowState,
    resetPendingFundState,
    runWithSignaturePrompt,
    shouldShowFundAfterProxy,
    signTypedDataAsync,
  ])

  const handleTradingAuthSignature = useCallback(async () => {
    if (!user?.address) {
      setTradingAuthError('Unauthenticated.')
      return
    }

    setTradingAuthError(null)

    try {
      setTradingAuthStep('signing')
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const message = buildTradingAuthMessage({
        address: user.address as `0x${string}`,
        timestamp,
      })

      const signature = await runWithSignaturePrompt(() => signTypedDataAsync({
        domain: getTradingAuthDomain(),
        types: TRADING_AUTH_TYPES,
        primaryType: TRADING_AUTH_PRIMARY_TYPE,
        message,
      }))

      const result = await generateTradingAuthAction({
        signature,
        timestamp,
        nonce: message.nonce.toString(),
      })

      if (result.error || !result.data) {
        setTradingAuthError(result.error ?? DEFAULT_ERROR_MESSAGE)
        setTradingAuthStep('idle')
        return
      }

      useUser.setState((previous) => {
        if (!previous) {
          return previous
        }

        const nextSettings = { ...(previous.settings ?? {}) }
        nextSettings.tradingAuth = {
          ...(nextSettings.tradingAuth ?? {}),
          relayer: result.data?.relayer,
          clob: result.data?.clob,
        }

        return {
          ...previous,
          settings: nextSettings,
        }
      })

      void refreshSessionUserState()
      setRequiresTradingAuthRefresh(false)
      setTradingAuthStep('completed')
    }
    catch (error) {
      if (error instanceof UserRejectedRequestError) {
        setTradingAuthError('You rejected the signature request.')
        setTradingAuthStep('idle')
      }
      else if (error instanceof Error) {
        setTradingAuthError(error.message || DEFAULT_ERROR_MESSAGE)
        setTradingAuthStep('idle')
      }
      else {
        setTradingAuthError(DEFAULT_ERROR_MESSAGE)
        setTradingAuthStep('idle')
      }
    }
  }, [refreshSessionUserState, runWithSignaturePrompt, signTypedDataAsync, user])

  const resolveReferralExchanges = useCallback(async (safeAddress: `0x${string}`) => {
    const exchanges = [
      CTF_EXCHANGE_ADDRESS as `0x${string}`,
      NEG_RISK_CTF_EXCHANGE_ADDRESS as `0x${string}`,
    ]
    const results = await Promise.all(
      exchanges.map(exchange => fetchReferralLocked(exchange, safeAddress)),
    )
    if (results.includes(null)) {
      console.warn('Failed to read referral status; skipping locked/unknown exchanges.')
    }
    return exchanges.filter((_, index) => results[index] === false)
  }, [])

  const handleApproveTokens = useCallback(async () => {
    if (!user?.proxy_wallet_address) {
      setTokenApprovalError('Deploy your proxy wallet first.')
      return
    }

    if (!tradingAuthSatisfied) {
      setTokenApprovalError('Enable trading before approving tokens.')
      return
    }

    setTokenApprovalError(null)

    try {
      setApprovalsStep('signing')
      const nonceResult = await getSafeNonceAction()
      if (nonceResult.error || !nonceResult.nonce) {
        setTokenApprovalError(nonceResult.error ?? DEFAULT_ERROR_MESSAGE)
        setApprovalsStep('idle')
        return
      }

      const referralExchanges = await resolveReferralExchanges(
        user.proxy_wallet_address as `0x${string}`,
      )
      const transactions = buildApproveTokenTransactions({
        spenders: [
          CONDITIONAL_TOKENS_CONTRACT as `0x${string}`,
          CTF_EXCHANGE_ADDRESS as `0x${string}`,
          NEG_RISK_CTF_EXCHANGE_ADDRESS as `0x${string}`,
          UMA_NEG_RISK_ADAPTER_ADDRESS as `0x${string}`,
        ],
        operators: [
          CTF_EXCHANGE_ADDRESS as `0x${string}`,
          NEG_RISK_CTF_EXCHANGE_ADDRESS as `0x${string}`,
          UMA_NEG_RISK_ADAPTER_ADDRESS as `0x${string}`,
        ],
      })
      transactions.push(
        ...buildSetReferralTransactions({
          referrer: affiliateMetadata.referrerAddress,
          affiliate: affiliateMetadata.affiliateAddress,
          affiliateSharePercent: affiliateMetadata.affiliateSharePercent,
          exchanges: referralExchanges,
        }),
      )
      const aggregated = aggregateSafeTransactions(transactions)
      const typedData = getSafeTxTypedData({
        chainId: defaultNetwork.id,
        safeAddress: user.proxy_wallet_address as `0x${string}`,
        transaction: aggregated,
        nonce: nonceResult.nonce,
      })

      const structHash = hashTypedData({
        domain: typedData.domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message: typedData.message,
      }) as `0x${string}`

      const signature = await runWithSignaturePrompt(() => signMessageAsync({
        message: { raw: structHash },
      }))

      const requestPayload: SafeTransactionRequestPayload = {
        type: 'SAFE',
        from: user.address,
        to: aggregated.to,
        proxyWallet: user.proxy_wallet_address,
        data: aggregated.data,
        nonce: nonceResult.nonce,
        signature: packSafeSignature(signature as `0x${string}`),
        signatureParams: typedData.signatureParams,
        metadata: 'approve_tokens',
      }

      const submitResult = await submitSafeTransactionAction(requestPayload)
      if (submitResult.error) {
        setTokenApprovalError(submitResult.error)
        setApprovalsStep('idle')
        return
      }

      if (submitResult.approvals) {
        useUser.setState((previous) => {
          if (!previous) {
            return previous
          }
          const nextSettings = { ...(previous.settings ?? {}) }
          nextSettings.tradingAuth = {
            ...(nextSettings.tradingAuth ?? {}),
            approvals: submitResult.approvals,
          }
          return {
            ...previous,
            settings: nextSettings,
          }
        })

        void refreshSessionUserState()
      }

      setApprovalsStep('completed')
    }
    catch (error) {
      console.error('Failed to approve tokens', error)
      if (error instanceof Error) {
        setTokenApprovalError(error.message || DEFAULT_ERROR_MESSAGE)
      }
      else {
        setTokenApprovalError(DEFAULT_ERROR_MESSAGE)
      }
      setApprovalsStep('idle')
    }
  }, [
    affiliateMetadata,
    refreshSessionUserState,
    resolveReferralExchanges,
    runWithSignaturePrompt,
    signMessageAsync,
    tradingAuthSatisfied,
    user,
  ])

  const ensureTradingReady = useCallback(() => {
    if (!user) {
      queueMicrotask(() => {
        void open()
      })
      return false
    }

    if (tradingReady) {
      return true
    }

    resetEnableFlowState()
    setTradeModalOpen(true)
    return false
  }, [open, resetEnableFlowState, tradingReady, user])

  const openTradeRequirements = useCallback((options?: { forceTradingAuth?: boolean }) => {
    if (!user) {
      queueMicrotask(() => {
        void open()
      })
      return
    }

    resetEnableFlowState()
    if (options?.forceTradingAuth) {
      setRequiresTradingAuthRefresh(true)
      setTradingAuthStep('idle')
      setTradingAuthError(null)
    }
    setTradeModalOpen(true)
  }, [open, resetEnableFlowState, user])

  const openWalletModal = useCallback(() => {
    if (!user) {
      queueMicrotask(() => void open())
      return
    }
    if (!hasDeployedProxyWallet) {
      openTradeRequirements()
      return
    }
    setDepositModalOpen(true)
  }, [hasDeployedProxyWallet, open, openTradeRequirements, user])

  const startDepositFlow = useCallback(() => {
    if (!user) {
      queueMicrotask(() => {
        void open()
      })
      return
    }

    if (hasDeployedProxyWallet) {
      setDepositModalOpen(true)
      return
    }

    resetEnableFlowState()
    setShouldShowFundAfterProxy(true)
    setEnableModalOpen(true)
  }, [hasDeployedProxyWallet, open, resetEnableFlowState, user])

  const startWithdrawFlow = useCallback(() => {
    if (!user) {
      queueMicrotask(() => {
        void open()
      })
      return
    }

    if (!hasDeployedProxyWallet) {
      openTradeRequirements()
      return
    }

    setWithdrawModalOpen(true)
  }, [hasDeployedProxyWallet, open, openTradeRequirements, user])

  const closeFundModal = useCallback((nextOpen: boolean) => {
    setFundModalOpen(nextOpen)
    if (!nextOpen) {
      resetPendingFundState()
    }
  }, [resetPendingFundState])

  const contextValue = useMemo<TradingOnboardingContextValue>(() => ({
    startDepositFlow,
    startWithdrawFlow,
    ensureTradingReady,
    openTradeRequirements,
    hasProxyWallet: hasDeployedProxyWallet,
    openWalletModal,
  }), [ensureTradingReady, hasDeployedProxyWallet, openTradeRequirements, openWalletModal, startDepositFlow, startWithdrawFlow])

  const meldUrl = useMemo(() => {
    if (!hasDeployedProxyWallet || !user?.proxy_wallet_address) {
      return null
    }
    const params = new URLSearchParams({
      publicKey: 'WXETMuFUQmqqybHuRkSgxv:25B8LJHSfpG6LVjR2ytU5Cwh7Z4Sch2ocoU',
      destinationCurrencyCodeLocked: 'USDC',
      walletAddressLocked: user.proxy_wallet_address,
    })
    return `https://meldcrypto.com/?${params.toString()}`
  }, [hasDeployedProxyWallet, user])

  return (
    <TradingOnboardingContext value={contextValue}>
      {children}

      <TradingOnboardingDialogs
        enableModalOpen={enableModalOpen}
        onEnableOpenChange={(next) => {
          setEnableModalOpen(next)
          if (!next) {
            resetPendingFundState()
          }
        }}
        proxyStep={proxyStep}
        tradingAuthStep={tradingAuthStep}
        approvalsStep={approvalsStep}
        hasTradingAuth={hasEffectiveTradingAuth}
        hasDeployedProxyWallet={hasDeployedProxyWallet}
        proxyWalletError={proxyWalletError}
        tradingAuthError={tradingAuthError}
        tokenApprovalError={tokenApprovalError}
        onProxyAction={handleProxyWalletSignature}
        onTradingAuthAction={handleTradingAuthSignature}
        onApprovalsAction={handleApproveTokens}
        fundModalOpen={fundModalOpen}
        onFundOpenChange={closeFundModal}
        onFundDeposit={() => {
          closeFundModal(false)
          openWalletModal()
        }}
        onFundSkip={() => closeFundModal(false)}
        tradeModalOpen={tradeModalOpen}
        onTradeOpenChange={setTradeModalOpen}
        depositModalOpen={depositModalOpen}
        onDepositOpenChange={setDepositModalOpen}
        withdrawModalOpen={withdrawModalOpen}
        onWithdrawOpenChange={setWithdrawModalOpen}
        user={user}
        meldUrl={meldUrl}
      />
    </TradingOnboardingContext>
  )
}

export function useTradingOnboarding() {
  const context = use(TradingOnboardingContext)
  if (!context) {
    throw new Error('useTradingOnboarding must be used within TradingOnboardingProvider')
  }
  return context
}
