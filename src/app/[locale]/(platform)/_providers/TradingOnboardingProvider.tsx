'use client'

import type { ReactNode } from 'react'
import type { TradingOnboardingContextValue } from '@/app/[locale]/(platform)/_providers/TradingOnboardingContext'
import type { SafeTransactionRequestPayload } from '@/lib/safe/transactions'
import type { User } from '@/types'
import { useCallback, useMemo, useState } from 'react'
import { hashTypedData, UserRejectedRequestError } from 'viem'
import { useSignMessage, useSignTypedData } from 'wagmi'
import { getSafeNonceAction, submitSafeTransactionAction } from '@/app/[locale]/(platform)/_actions/approve-tokens'
import { saveProxyWalletSignature } from '@/app/[locale]/(platform)/_actions/proxy-wallet'
import { generateTradingAuthAction } from '@/app/[locale]/(platform)/_actions/trading-auth'
import TradingOnboardingDialogs from '@/app/[locale]/(platform)/_components/TradingOnboardingDialogs'
import {
  TradingOnboardingContext,

  useOptionalTradingOnboarding,
  useTradingOnboarding,
} from '@/app/[locale]/(platform)/_providers/TradingOnboardingContext'
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
import { mergeSessionUserState, useUser } from '@/stores/useUser'

export function TradingOnboardingProvider({ children }: { children: ReactNode }) {
  const user = useUser()

  return (
    <TradingOnboardingProviderContent
      key={user?.id ?? 'guest'}
      user={user}
    >
      {children}
    </TradingOnboardingProviderContent>
  )
}

interface TradingOnboardingProviderContentProps {
  children: ReactNode
  user: User | null
}

type ProxyStep = 'idle' | 'signing' | 'deploying' | 'completed'
type TradingAuthStep = 'idle' | 'signing' | 'completed'
type ApprovalsStep = 'idle' | 'signing' | 'completed'

function useOnboardingDialogsState() {
  const [enableModalOpen, setEnableModalOpen] = useState(false)
  const [fundModalOpen, setFundModalOpen] = useState(false)
  const [tradeModalOpen, setTradeModalOpen] = useState(false)
  const [shouldShowFundAfterProxy, setShouldShowFundAfterProxy] = useState(false)
  const [depositModalOpen, setDepositModalOpen] = useState(false)
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)

  return {
    enableModalOpen,
    setEnableModalOpen,
    fundModalOpen,
    setFundModalOpen,
    tradeModalOpen,
    setTradeModalOpen,
    shouldShowFundAfterProxy,
    setShouldShowFundAfterProxy,
    depositModalOpen,
    setDepositModalOpen,
    withdrawModalOpen,
    setWithdrawModalOpen,
  }
}

function useOnboardingErrorsState() {
  const [proxyWalletError, setProxyWalletError] = useState<string | null>(null)
  const [tradingAuthError, setTradingAuthError] = useState<string | null>(null)
  const [tokenApprovalError, setTokenApprovalError] = useState<string | null>(null)

  return {
    proxyWalletError,
    setProxyWalletError,
    tradingAuthError,
    setTradingAuthError,
    tokenApprovalError,
    setTokenApprovalError,
  }
}

function useOnboardingStepsState({
  hasDeployedProxyWallet,
  isProxyWalletDeploying,
  hasTradingAuth,
  hasTokenApprovals,
}: {
  hasDeployedProxyWallet: boolean
  isProxyWalletDeploying: boolean
  hasTradingAuth: boolean
  hasTokenApprovals: boolean
}) {
  const [proxyStep, setProxyStep] = useState<ProxyStep>(
    hasDeployedProxyWallet ? 'completed' : isProxyWalletDeploying ? 'deploying' : 'idle',
  )
  const [tradingAuthStep, setTradingAuthStep] = useState<TradingAuthStep>(
    hasTradingAuth ? 'completed' : 'idle',
  )
  const [approvalsStep, setApprovalsStep] = useState<ApprovalsStep>(
    hasTokenApprovals ? 'completed' : 'idle',
  )
  const [requiresTradingAuthRefresh, setRequiresTradingAuthRefresh] = useState(false)

  return {
    proxyStep,
    setProxyStep,
    tradingAuthStep,
    setTradingAuthStep,
    approvalsStep,
    setApprovalsStep,
    requiresTradingAuthRefresh,
    setRequiresTradingAuthRefresh,
  }
}

function useSessionRefresher() {
  return useCallback(async () => {
    try {
      const session = await authClient.getSession({
        query: {
          disableCookieCache: true,
        },
      })
      const sessionUser = session?.data?.user as User | undefined
      if (sessionUser) {
        useUser.setState((previous) => {
          return mergeSessionUserState(previous, sessionUser)
        })
      }
    }
    catch (error) {
      console.error('Failed to refresh user session', error)
    }
  }, [])
}

function usePendingFundStateReset(setShouldShowFundAfterProxy: (value: boolean) => void) {
  return useCallback(() => {
    setShouldShowFundAfterProxy(false)
  }, [setShouldShowFundAfterProxy])
}

function useEnableFlowReset({
  hasTokenApprovals,
  hasTradingAuth,
  proxyStep,
  requiresTradingAuthRefresh,
  setProxyWalletError,
  setTradingAuthError,
  setTokenApprovalError,
  setShouldShowFundAfterProxy,
  setDepositModalOpen,
  setWithdrawModalOpen,
  setProxyStep,
  setTradingAuthStep,
  setApprovalsStep,
}: {
  hasTokenApprovals: boolean
  hasTradingAuth: boolean
  proxyStep: ProxyStep
  requiresTradingAuthRefresh: boolean
  setProxyWalletError: (value: string | null) => void
  setTradingAuthError: (value: string | null) => void
  setTokenApprovalError: (value: string | null) => void
  setShouldShowFundAfterProxy: (value: boolean) => void
  setDepositModalOpen: (value: boolean) => void
  setWithdrawModalOpen: (value: boolean) => void
  setProxyStep: (value: ProxyStep) => void
  setTradingAuthStep: (value: TradingAuthStep) => void
  setApprovalsStep: (value: ApprovalsStep) => void
}) {
  return useCallback(() => {
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
  }, [
    hasTokenApprovals,
    hasTradingAuth,
    proxyStep,
    requiresTradingAuthRefresh,
    setApprovalsStep,
    setDepositModalOpen,
    setProxyStep,
    setProxyWalletError,
    setShouldShowFundAfterProxy,
    setTokenApprovalError,
    setTradingAuthError,
    setTradingAuthStep,
    setWithdrawModalOpen,
  ])
}

function useProxyWalletSignatureFlow({
  shouldShowFundAfterProxy,
  refreshSessionUserState,
  resetEnableFlowState,
  resetPendingFundState,
  setProxyStep,
  setProxyWalletError,
  setTradingAuthStep,
  setTradingAuthError,
  setRequiresTradingAuthRefresh,
  setTradeModalOpen,
  setEnableModalOpen,
  setFundModalOpen,
}: {
  shouldShowFundAfterProxy: boolean
  refreshSessionUserState: () => Promise<void>
  resetEnableFlowState: () => void
  resetPendingFundState: () => void
  setProxyStep: (value: ProxyStep) => void
  setProxyWalletError: (value: string | null) => void
  setTradingAuthStep: (value: TradingAuthStep) => void
  setTradingAuthError: (value: string | null) => void
  setRequiresTradingAuthRefresh: (value: boolean) => void
  setTradeModalOpen: (value: boolean) => void
  setEnableModalOpen: (value: boolean) => void
  setFundModalOpen: (value: boolean) => void
}) {
  const { signTypedDataAsync } = useSignTypedData()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()

  return useCallback(async () => {
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
          void refreshSessionUserState()
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
    setEnableModalOpen,
    setFundModalOpen,
    setProxyStep,
    setProxyWalletError,
    setRequiresTradingAuthRefresh,
    setTradeModalOpen,
    setTradingAuthError,
    setTradingAuthStep,
    shouldShowFundAfterProxy,
    signTypedDataAsync,
  ])
}

function useTradingAuthSignatureFlow({
  user,
  refreshSessionUserState,
  setTradingAuthError,
  setTradingAuthStep,
  setRequiresTradingAuthRefresh,
}: {
  user: User | null
  refreshSessionUserState: () => Promise<void>
  setTradingAuthError: (value: string | null) => void
  setTradingAuthStep: (value: TradingAuthStep) => void
  setRequiresTradingAuthRefresh: (value: boolean) => void
}) {
  const { signTypedDataAsync } = useSignTypedData()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()

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
  }, [
    refreshSessionUserState,
    runWithSignaturePrompt,
    setRequiresTradingAuthRefresh,
    setTradingAuthError,
    setTradingAuthStep,
    signTypedDataAsync,
    user,
  ])

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

  return { handleTradingAuthSignature, resolveReferralExchanges }
}

function useTokenApprovalsFlow({
  user,
  tradingAuthSatisfied,
  resolveReferralExchanges,
  refreshSessionUserState,
  setApprovalsStep,
  setTokenApprovalError,
  setRequiresTradingAuthRefresh,
  setTradingAuthStep,
  setTradingAuthError,
}: {
  user: User | null
  tradingAuthSatisfied: boolean
  resolveReferralExchanges: (safeAddress: `0x${string}`) => Promise<`0x${string}`[]>
  refreshSessionUserState: () => Promise<void>
  setApprovalsStep: (value: ApprovalsStep) => void
  setTokenApprovalError: (value: string | null) => void
  setRequiresTradingAuthRefresh: (value: boolean) => void
  setTradingAuthStep: (value: TradingAuthStep) => void
  setTradingAuthError: (value: string | null) => void
}) {
  const { signMessageAsync } = useSignMessage()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const affiliateMetadata = useAffiliateOrderMetadata()

  return useCallback(async () => {
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
        if (isTradingAuthRequiredError(nonceResult.error)) {
          setRequiresTradingAuthRefresh(true)
          setTradingAuthStep('idle')
          setTradingAuthError(null)
          setTokenApprovalError(null)
          setApprovalsStep('idle')
          void refreshSessionUserState()
          return
        }
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
        if (isTradingAuthRequiredError(submitResult.error)) {
          setRequiresTradingAuthRefresh(true)
          setTradingAuthStep('idle')
          setTradingAuthError(null)
          setTokenApprovalError(null)
          setApprovalsStep('idle')
          void refreshSessionUserState()
          return
        }
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
    setApprovalsStep,
    setRequiresTradingAuthRefresh,
    setTokenApprovalError,
    setTradingAuthError,
    setTradingAuthStep,
    signMessageAsync,
    tradingAuthSatisfied,
    user,
  ])
}

function useTradingReadyGate({
  user,
  tradingReady,
  refreshSessionUserState,
  resetEnableFlowState,
  setTradeModalOpen,
  setRequiresTradingAuthRefresh,
  setTradingAuthStep,
  setTradingAuthError,
}: {
  user: User | null
  tradingReady: boolean
  refreshSessionUserState: () => Promise<void>
  resetEnableFlowState: () => void
  setTradeModalOpen: (value: boolean) => void
  setRequiresTradingAuthRefresh: (value: boolean) => void
  setTradingAuthStep: (value: TradingAuthStep) => void
  setTradingAuthError: (value: string | null) => void
}) {
  const { open } = useAppKit()

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
    void refreshSessionUserState()
    setTradeModalOpen(true)
    return false
  }, [open, refreshSessionUserState, resetEnableFlowState, setTradeModalOpen, tradingReady, user])

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
    void refreshSessionUserState()
    setTradeModalOpen(true)
  }, [
    open,
    refreshSessionUserState,
    resetEnableFlowState,
    setRequiresTradingAuthRefresh,
    setTradeModalOpen,
    setTradingAuthError,
    setTradingAuthStep,
    user,
  ])

  return { ensureTradingReady, openTradeRequirements, openAppKit: open }
}

function useWalletFlowControls({
  user,
  hasDeployedProxyWallet,
  openAppKit,
  openTradeRequirements,
  refreshSessionUserState,
  resetEnableFlowState,
  resetPendingFundState,
  setDepositModalOpen,
  setWithdrawModalOpen,
  setEnableModalOpen,
  setFundModalOpen,
  setShouldShowFundAfterProxy,
}: {
  user: User | null
  hasDeployedProxyWallet: boolean
  openAppKit: () => Promise<void>
  openTradeRequirements: (options?: { forceTradingAuth?: boolean }) => void
  refreshSessionUserState: () => Promise<void>
  resetEnableFlowState: () => void
  resetPendingFundState: () => void
  setDepositModalOpen: (value: boolean) => void
  setWithdrawModalOpen: (value: boolean) => void
  setEnableModalOpen: (value: boolean) => void
  setFundModalOpen: (value: boolean) => void
  setShouldShowFundAfterProxy: (value: boolean) => void
}) {
  const openWalletModal = useCallback(() => {
    if (!user) {
      queueMicrotask(() => void openAppKit())
      return
    }
    if (!hasDeployedProxyWallet) {
      openTradeRequirements()
      return
    }
    setDepositModalOpen(true)
  }, [hasDeployedProxyWallet, openAppKit, openTradeRequirements, setDepositModalOpen, user])

  const startDepositFlow = useCallback(() => {
    if (!user) {
      queueMicrotask(() => {
        void openAppKit()
      })
      return
    }

    if (hasDeployedProxyWallet) {
      setDepositModalOpen(true)
      return
    }

    resetEnableFlowState()
    setShouldShowFundAfterProxy(true)
    void refreshSessionUserState()
    setEnableModalOpen(true)
  }, [
    hasDeployedProxyWallet,
    openAppKit,
    refreshSessionUserState,
    resetEnableFlowState,
    setDepositModalOpen,
    setEnableModalOpen,
    setShouldShowFundAfterProxy,
    user,
  ])

  const startWithdrawFlow = useCallback(() => {
    if (!user) {
      queueMicrotask(() => {
        void openAppKit()
      })
      return
    }

    if (!hasDeployedProxyWallet) {
      openTradeRequirements()
      return
    }

    setWithdrawModalOpen(true)
  }, [hasDeployedProxyWallet, openAppKit, openTradeRequirements, setWithdrawModalOpen, user])

  const closeFundModal = useCallback((nextOpen: boolean) => {
    setFundModalOpen(nextOpen)
    if (!nextOpen) {
      resetPendingFundState()
    }
  }, [resetPendingFundState, setFundModalOpen])

  return { openWalletModal, startDepositFlow, startWithdrawFlow, closeFundModal }
}

function useMeldUrl({
  hasDeployedProxyWallet,
  user,
}: {
  hasDeployedProxyWallet: boolean
  user: User | null
}) {
  return useMemo(() => {
    if (!hasDeployedProxyWallet || !user?.proxy_wallet_address) {
      return null
    }
    const params = new URLSearchParams({
      destinationCurrencyCodeLocked: 'USDC_POLYGON',
      walletAddressLocked: user.proxy_wallet_address,
    })
    return `https://meldcrypto.com/?${params.toString()}`
  }, [hasDeployedProxyWallet, user])
}

function useTradingOnboardingContextValue({
  startDepositFlow,
  startWithdrawFlow,
  ensureTradingReady,
  openTradeRequirements,
  hasDeployedProxyWallet,
  openWalletModal,
}: {
  startDepositFlow: () => void
  startWithdrawFlow: () => void
  ensureTradingReady: () => boolean
  openTradeRequirements: (options?: { forceTradingAuth?: boolean }) => void
  hasDeployedProxyWallet: boolean
  openWalletModal: () => void
}): TradingOnboardingContextValue {
  return useMemo(() => ({
    startDepositFlow,
    startWithdrawFlow,
    ensureTradingReady,
    openTradeRequirements,
    hasProxyWallet: hasDeployedProxyWallet,
    openWalletModal,
  }), [ensureTradingReady, hasDeployedProxyWallet, openTradeRequirements, openWalletModal, startDepositFlow, startWithdrawFlow])
}

function TradingOnboardingProviderContent({
  children,
  user,
}: TradingOnboardingProviderContentProps) {
  const proxyWalletStatus = user?.proxy_wallet_status ?? null
  const hasProxyWalletAddress = Boolean(user?.proxy_wallet_address)
  const hasDeployedProxyWallet = Boolean(user?.proxy_wallet_address && proxyWalletStatus === 'deployed')
  const isProxyWalletDeploying = Boolean(
    user?.proxy_wallet_address
    && (proxyWalletStatus === 'deploying' || proxyWalletStatus === 'signed'),
  )
  const tradingAuthSettings = user?.settings?.tradingAuth ?? null
  const hasTradingAuth = Boolean(
    tradingAuthSettings?.relayer?.enabled
    && tradingAuthSettings?.clob?.enabled,
  )
  const approvalsSettings = tradingAuthSettings?.approvals ?? null
  const hasTokenApprovals = Boolean(approvalsSettings?.enabled)

  const {
    enableModalOpen,
    setEnableModalOpen,
    fundModalOpen,
    setFundModalOpen,
    tradeModalOpen,
    setTradeModalOpen,
    shouldShowFundAfterProxy,
    setShouldShowFundAfterProxy,
    depositModalOpen,
    setDepositModalOpen,
    withdrawModalOpen,
    setWithdrawModalOpen,
  } = useOnboardingDialogsState()

  const {
    proxyWalletError,
    setProxyWalletError,
    tradingAuthError,
    setTradingAuthError,
    tokenApprovalError,
    setTokenApprovalError,
  } = useOnboardingErrorsState()

  const {
    proxyStep,
    setProxyStep,
    tradingAuthStep,
    setTradingAuthStep,
    approvalsStep,
    setApprovalsStep,
    requiresTradingAuthRefresh,
    setRequiresTradingAuthRefresh,
  } = useOnboardingStepsState({
    hasDeployedProxyWallet,
    isProxyWalletDeploying,
    hasTradingAuth,
    hasTokenApprovals,
  })

  const hasEffectiveTradingAuth = hasTradingAuth && !requiresTradingAuthRefresh
  const effectiveProxyStep
    = hasDeployedProxyWallet
      ? 'completed'
      : isProxyWalletDeploying
        ? 'deploying'
        : proxyStep
  const effectiveTradingAuthStep = hasEffectiveTradingAuth ? 'completed' : tradingAuthStep
  const effectiveApprovalsStep = hasTokenApprovals ? 'completed' : approvalsStep
  const tradingAuthSatisfied = effectiveTradingAuthStep === 'completed'
  const tradingReady
    = effectiveProxyStep === 'completed'
      && effectiveTradingAuthStep === 'completed'
      && effectiveApprovalsStep === 'completed'

  const refreshSessionUserState = useSessionRefresher()

  useProxyWalletPolling({
    userId: user?.id,
    proxyWalletAddress: user?.proxy_wallet_address,
    proxyWalletStatus: user?.proxy_wallet_status,
    hasDeployedProxyWallet,
    hasProxyWalletAddress,
  })

  const resetPendingFundState = usePendingFundStateReset(setShouldShowFundAfterProxy)

  const resetEnableFlowState = useEnableFlowReset({
    hasTokenApprovals,
    hasTradingAuth,
    proxyStep,
    requiresTradingAuthRefresh,
    setProxyWalletError,
    setTradingAuthError,
    setTokenApprovalError,
    setShouldShowFundAfterProxy,
    setDepositModalOpen,
    setWithdrawModalOpen,
    setProxyStep,
    setTradingAuthStep,
    setApprovalsStep,
  })

  const handleProxyWalletSignature = useProxyWalletSignatureFlow({
    shouldShowFundAfterProxy,
    refreshSessionUserState,
    resetEnableFlowState,
    resetPendingFundState,
    setProxyStep,
    setProxyWalletError,
    setTradingAuthStep,
    setTradingAuthError,
    setRequiresTradingAuthRefresh,
    setTradeModalOpen,
    setEnableModalOpen,
    setFundModalOpen,
  })

  const { handleTradingAuthSignature, resolveReferralExchanges } = useTradingAuthSignatureFlow({
    user,
    refreshSessionUserState,
    setTradingAuthError,
    setTradingAuthStep,
    setRequiresTradingAuthRefresh,
  })

  const handleApproveTokens = useTokenApprovalsFlow({
    user,
    tradingAuthSatisfied,
    resolveReferralExchanges,
    refreshSessionUserState,
    setApprovalsStep,
    setTokenApprovalError,
    setRequiresTradingAuthRefresh,
    setTradingAuthStep,
    setTradingAuthError,
  })

  const { ensureTradingReady, openTradeRequirements, openAppKit } = useTradingReadyGate({
    user,
    tradingReady,
    refreshSessionUserState,
    resetEnableFlowState,
    setTradeModalOpen,
    setRequiresTradingAuthRefresh,
    setTradingAuthStep,
    setTradingAuthError,
  })

  const { openWalletModal, startDepositFlow, startWithdrawFlow, closeFundModal } = useWalletFlowControls({
    user,
    hasDeployedProxyWallet,
    openAppKit,
    openTradeRequirements,
    refreshSessionUserState,
    resetEnableFlowState,
    resetPendingFundState,
    setDepositModalOpen,
    setWithdrawModalOpen,
    setEnableModalOpen,
    setFundModalOpen,
    setShouldShowFundAfterProxy,
  })

  const contextValue = useTradingOnboardingContextValue({
    startDepositFlow,
    startWithdrawFlow,
    ensureTradingReady,
    openTradeRequirements,
    hasDeployedProxyWallet,
    openWalletModal,
  })

  const meldUrl = useMeldUrl({ hasDeployedProxyWallet, user })

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
        proxyStep={effectiveProxyStep}
        tradingAuthStep={effectiveTradingAuthStep}
        approvalsStep={effectiveApprovalsStep}
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

export { useOptionalTradingOnboarding, useTradingOnboarding }
