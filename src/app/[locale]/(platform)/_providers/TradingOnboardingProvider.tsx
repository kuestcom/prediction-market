'use client'

import type { ReactNode } from 'react'
import type { TradingOnboardingContextValue } from '@/app/[locale]/(platform)/_providers/TradingOnboardingContext'
import type { User } from '@/types'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { UserRejectedRequestError } from 'viem'
import { useSignTypedData } from 'wagmi'
import {
  enableDepositWalletTradingAction,
  updateOnboardingEmailAction,
  updateOnboardingUsernameAction,
} from '@/app/[locale]/(platform)/_actions/deposit-wallet'
import TradingOnboardingDialogs from '@/app/[locale]/(platform)/_components/TradingOnboardingDialogs'
import {
  TradingOnboardingContext,
  useOptionalTradingOnboarding,
  useTradingOnboarding,
} from '@/app/[locale]/(platform)/_providers/TradingOnboardingContext'
import { useAffiliateOrderMetadata } from '@/hooks/useAffiliateOrderMetadata'
import { useAppKit } from '@/hooks/useAppKit'
import { useDepositWalletPolling } from '@/hooks/useDepositWalletPolling'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { authClient } from '@/lib/auth-client'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import {
  CTF_EXCHANGE_ADDRESS,
  NEG_RISK_CTF_EXCHANGE_ADDRESS,
} from '@/lib/contracts'
import { fetchReferralLocked } from '@/lib/exchange'
import {
  buildTradingAuthMessage,
  getTradingAuthDomain,
  TRADING_AUTH_PRIMARY_TYPE,
  TRADING_AUTH_TYPES,
} from '@/lib/trading-auth/client'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { signAndSubmitDepositWalletCalls } from '@/lib/wallet/client'
import {
  buildApproveTokenCalls,
  buildAutoRedeemAllowanceCalls,
  buildSetReferralCalls,
} from '@/lib/wallet/transactions'
import { mergeSessionUserState, useUser } from '@/stores/useUser'

type OnboardingModal = 'username' | 'email' | 'enable' | 'enable-status' | 'approve' | 'auto-redeem' | null
type EnableTradingStep = 'idle' | 'enabling' | 'deploying' | 'completed'
type ApprovalsStep = 'idle' | 'signing' | 'completed'

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

function hasUsableEmail(email?: string | null) {
  return Boolean(email && /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(email))
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

function mergeUserSettings(previous: User, settingsPatch?: Record<string, any>) {
  if (!settingsPatch) {
    return previous.settings
  }

  return {
    ...(previous.settings ?? {}),
    ...settingsPatch,
    onboarding: {
      ...(previous.settings?.onboarding ?? {}),
      ...(settingsPatch.onboarding ?? {}),
    },
    tradingAuth: {
      ...(previous.settings?.tradingAuth ?? {}),
      ...(settingsPatch.tradingAuth ?? {}),
    },
  }
}

function useOnboardingStatus(user: User | null, requiresTradingAuthRefresh: boolean) {
  return useMemo(() => {
    const onboardingSettings = user?.settings?.onboarding ?? {}
    const tradingAuthSettings = user?.settings?.tradingAuth ?? null
    const hasUsername = Boolean(user?.username?.trim())
    const needsUsername = Boolean(user && !hasUsername)
    const needsEmail = Boolean(
      user
      && !hasUsableEmail(user.email)
      && !onboardingSettings.emailSkippedAt
      && !onboardingSettings.emailCompletedAt,
    )
    const hasDepositWalletAddress = Boolean(user?.deposit_wallet_address)
    const hasDeployedDepositWallet = Boolean(user?.deposit_wallet_address && user?.deposit_wallet_status === 'deployed')
    const isDepositWalletDeploying = Boolean(
      user?.deposit_wallet_address
      && (user.deposit_wallet_status === 'deploying' || user.deposit_wallet_status === 'signed'),
    )
    const hasTradingAuth = Boolean(
      tradingAuthSettings?.relayer?.enabled
      && tradingAuthSettings?.clob?.enabled
      && !requiresTradingAuthRefresh,
    )
    const hasTokenApprovals = Boolean(tradingAuthSettings?.approvals?.enabled)
    const tradingReady = hasDeployedDepositWallet && hasTradingAuth && hasTokenApprovals

    return {
      needsUsername,
      needsEmail,
      hasDepositWalletAddress,
      hasDeployedDepositWallet,
      isDepositWalletDeploying,
      hasTradingAuth,
      hasTokenApprovals,
      tradingReady,
    }
  }, [requiresTradingAuthRefresh, user])
}

function resolveNextOnboardingModal({
  needsUsername,
  needsEmail,
  hasDeployedDepositWallet,
  hasDepositWalletAddress,
  hasTradingAuth,
  hasTokenApprovals,
}: {
  needsUsername: boolean
  needsEmail: boolean
  hasDeployedDepositWallet: boolean
  hasDepositWalletAddress: boolean
  hasTradingAuth: boolean
  hasTokenApprovals: boolean
}): Exclude<OnboardingModal, null> | null {
  if (needsUsername) {
    return 'username'
  }
  if (needsEmail) {
    return 'email'
  }
  if (!hasDeployedDepositWallet || !hasTradingAuth) {
    return hasDepositWalletAddress ? 'enable-status' : 'enable'
  }
  if (!hasTokenApprovals) {
    return 'approve'
  }
  return null
}

function TradingOnboardingProviderContent({
  children,
  user,
}: TradingOnboardingProviderContentProps) {
  const [activeModal, setActiveModal] = useState<OnboardingModal>(null)
  const [dismissedModal, setDismissedModal] = useState<OnboardingModal>(null)
  const [fundModalOpen, setFundModalOpen] = useState(false)
  const [shouldShowFundAfterTradingReady, setShouldShowFundAfterTradingReady] = useState(false)
  const [depositModalOpen, setDepositModalOpen] = useState(false)
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [enableTradingError, setEnableTradingError] = useState<string | null>(null)
  const [tokenApprovalError, setTokenApprovalError] = useState<string | null>(null)
  const [autoRedeemError, setAutoRedeemError] = useState<string | null>(null)
  const [isUsernameSubmitting, setIsUsernameSubmitting] = useState(false)
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false)
  const [enableTradingStep, setEnableTradingStep] = useState<EnableTradingStep>('idle')
  const [approvalsStep, setApprovalsStep] = useState<ApprovalsStep>('idle')
  const [autoRedeemStep, setAutoRedeemStep] = useState<ApprovalsStep>('idle')
  const [requiresTradingAuthRefresh, setRequiresTradingAuthRefresh] = useState(false)
  const { signTypedDataAsync } = useSignTypedData()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const t = useExtracted()
  const affiliateMetadata = useAffiliateOrderMetadata()
  const { open: openAppKit } = useAppKit()
  const refreshSessionUserState = useSessionRefresher()

  const status = useOnboardingStatus(user, requiresTradingAuthRefresh)

  useDepositWalletPolling({
    userId: user?.id,
    depositWalletAddress: user?.deposit_wallet_address,
    depositWalletStatus: user?.deposit_wallet_status,
    hasDeployedDepositWallet: status.hasDeployedDepositWallet,
    hasDepositWalletAddress: status.hasDepositWalletAddress,
  })

  const nextModal = resolveNextOnboardingModal(status)

  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-derived-state, react-you-might-not-need-an-effect/no-adjust-state-on-prop-change, react-you-might-not-need-an-effect/no-chain-state-updates, react/set-state-in-effect -- These effects coordinate onboarding modal transitions from async wallet/auth state. */
  useEffect(() => {
    if (!user || activeModal || fundModalOpen || depositModalOpen || withdrawModalOpen) {
      return
    }
    if (!nextModal || dismissedModal === nextModal) {
      return
    }
    setActiveModal(nextModal)
  }, [activeModal, depositModalOpen, dismissedModal, fundModalOpen, nextModal, user, withdrawModalOpen])

  useEffect(() => {
    if (status.hasDeployedDepositWallet && enableTradingStep === 'deploying') {
      setEnableTradingStep('completed')
      if (!status.hasTokenApprovals) {
        setActiveModal('approve')
      }
      else {
        setActiveModal(null)
      }
    }
  }, [enableTradingStep, status.hasDeployedDepositWallet, status.hasTokenApprovals])

  useEffect(() => {
    if (status.tradingReady && shouldShowFundAfterTradingReady) {
      setShouldShowFundAfterTradingReady(false)
      setFundModalOpen(true)
    }
  }, [shouldShowFundAfterTradingReady, status.tradingReady])
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler, react-you-might-not-need-an-effect/no-derived-state, react-you-might-not-need-an-effect/no-adjust-state-on-prop-change, react-you-might-not-need-an-effect/no-chain-state-updates, react/set-state-in-effect */

  const openNextRequirement = useCallback((options?: { forceTradingAuth?: boolean }) => {
    if (!user) {
      void openAppKit()
      return
    }

    if (options?.forceTradingAuth) {
      setRequiresTradingAuthRefresh(true)
    }

    setDismissedModal(null)
    setUsernameError(null)
    setEmailError(null)
    setEnableTradingError(null)
    setTokenApprovalError(null)
    setAutoRedeemError(null)
    void refreshSessionUserState()

    const forcedStatus = options?.forceTradingAuth
      ? { ...status, hasTradingAuth: false, tradingReady: false }
      : status
    const modal = resolveNextOnboardingModal(forcedStatus)
    setActiveModal(modal)
  }, [openAppKit, refreshSessionUserState, status, user])

  const handleModalOpenChange = useCallback((modal: Exclude<OnboardingModal, null>, open: boolean) => {
    if (open) {
      setDismissedModal(null)
      setActiveModal(modal)
      return
    }
    if (modal === 'auto-redeem') {
      setDismissedModal(modal)
      setActiveModal(null)
      setShouldShowFundAfterTradingReady(false)
      setFundModalOpen(true)
      return
    }
    setDismissedModal(modal)
    setActiveModal(null)
  }, [])

  const handleUsernameSubmit = useCallback(async (username: string, termsAccepted: boolean) => {
    if (isUsernameSubmitting) {
      return
    }
    setIsUsernameSubmitting(true)
    setUsernameError(null)
    try {
      const result = await updateOnboardingUsernameAction({ username, termsAccepted })
      if (result.error || !result.data) {
        setUsernameError(
          result.code === 'username_taken'
            ? t('That username is already taken.')
            : result.error ?? DEFAULT_ERROR_MESSAGE,
        )
        return
      }
      const data = result.data
      useUser.setState((previous) => {
        if (!previous) {
          return previous
        }
        return {
          ...previous,
          username: data.username,
          settings: mergeUserSettings(previous, data.settings),
        }
      })
      void refreshSessionUserState()
      setDismissedModal(null)
      setActiveModal(status.needsEmail
        ? 'email'
        : resolveNextOnboardingModal({
            ...status,
            needsUsername: false,
          }))
    }
    finally {
      setIsUsernameSubmitting(false)
    }
  }, [isUsernameSubmitting, refreshSessionUserState, status, t])

  const handleEmailSubmit = useCallback(async (email: string) => {
    if (isEmailSubmitting) {
      return
    }
    setIsEmailSubmitting(true)
    setEmailError(null)
    try {
      const result = await updateOnboardingEmailAction({ email })
      if (result.error || !result.data) {
        setEmailError(result.error ?? DEFAULT_ERROR_MESSAGE)
        return
      }
      const data = result.data
      useUser.setState((previous) => {
        if (!previous) {
          return previous
        }
        return {
          ...previous,
          email: data.email,
          settings: mergeUserSettings(previous, data.settings),
        }
      })
      void refreshSessionUserState()
      setDismissedModal(null)
      setActiveModal(resolveNextOnboardingModal({
        ...status,
        needsEmail: false,
      }))
    }
    finally {
      setIsEmailSubmitting(false)
    }
  }, [isEmailSubmitting, refreshSessionUserState, status])

  const handleEmailSkip = useCallback(async () => {
    if (isEmailSubmitting) {
      return
    }
    setIsEmailSubmitting(true)
    setEmailError(null)
    try {
      const result = await updateOnboardingEmailAction({ skip: true })
      if (result.error || !result.data) {
        setEmailError(result.error ?? DEFAULT_ERROR_MESSAGE)
        return
      }
      const data = result.data
      useUser.setState((previous) => {
        if (!previous) {
          return previous
        }
        return {
          ...previous,
          settings: mergeUserSettings(previous, data.settings),
        }
      })
      void refreshSessionUserState()
      setDismissedModal(null)
      setActiveModal(resolveNextOnboardingModal({
        ...status,
        needsEmail: false,
      }))
    }
    finally {
      setIsEmailSubmitting(false)
    }
  }, [isEmailSubmitting, refreshSessionUserState, status])

  const handleEnableTrading = useCallback(async () => {
    if (!user?.address || enableTradingStep === 'enabling') {
      return
    }
    setEnableTradingError(null)

    try {
      setEnableTradingStep('enabling')
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

      const result = await enableDepositWalletTradingAction({
        signature,
        timestamp,
        nonce: message.nonce.toString(),
      })

      if (result.error || !result.data) {
        setEnableTradingError(result.error ?? DEFAULT_ERROR_MESSAGE)
        setEnableTradingStep('idle')
        return
      }
      const data = result.data

      useUser.setState((previous) => {
        if (!previous) {
          return previous
        }
        return {
          ...previous,
          ...data,
          settings: mergeUserSettings(previous, {
            tradingAuth: data.tradingAuth,
          }),
        }
      })
      void refreshSessionUserState()
      setRequiresTradingAuthRefresh(false)

      if (data.deposit_wallet_status === 'deployed') {
        setEnableTradingStep('completed')
        setDismissedModal(null)
        setActiveModal(activeModal === 'enable-status' || status.hasTokenApprovals ? null : 'approve')
      }
      else {
        setEnableTradingStep('deploying')
      }
    }
    catch (error) {
      if (error instanceof UserRejectedRequestError) {
        setEnableTradingError(t('You rejected the signature request.'))
      }
      else if (error instanceof Error) {
        setEnableTradingError(error.message || DEFAULT_ERROR_MESSAGE)
      }
      else {
        setEnableTradingError(DEFAULT_ERROR_MESSAGE)
      }
      setEnableTradingStep('idle')
    }
  }, [
    enableTradingStep,
    activeModal,
    refreshSessionUserState,
    runWithSignaturePrompt,
    signTypedDataAsync,
    status.hasTokenApprovals,
    t,
    user?.address,
  ])

  const resolveReferralExchanges = useCallback(async (depositWallet: `0x${string}`) => {
    const exchanges = [
      CTF_EXCHANGE_ADDRESS as `0x${string}`,
      NEG_RISK_CTF_EXCHANGE_ADDRESS as `0x${string}`,
    ]
    const results = await Promise.all(
      exchanges.map(exchange => fetchReferralLocked(exchange, depositWallet)),
    )
    if (results.includes(null)) {
      console.warn('Failed to read referral status; skipping locked/unknown exchanges.')
    }
    return exchanges.filter((_, index) => results[index] === false)
  }, [])

  const handleApproveTokens = useCallback(async () => {
    if (!user?.deposit_wallet_address || approvalsStep === 'signing') {
      return
    }
    if (!status.hasTradingAuth) {
      openNextRequirement({ forceTradingAuth: true })
      return
    }

    setApprovalsStep('signing')
    setTokenApprovalError(null)

    try {
      const referralExchanges = await resolveReferralExchanges(user.deposit_wallet_address as `0x${string}`)
      const calls = [
        ...buildApproveTokenCalls(),
        ...buildSetReferralCalls({
          referrer: affiliateMetadata.referrerAddress,
          affiliate: affiliateMetadata.affiliateAddress,
          affiliateSharePercent: affiliateMetadata.affiliateSharePercent,
          exchanges: referralExchanges,
        }),
      ]
      const result = await signAndSubmitDepositWalletCalls({
        user,
        calls,
        metadata: 'approve_tokens',
        signTypedDataAsync,
      })

      if (result.error) {
        if (isTradingAuthRequiredError(result.error)) {
          setRequiresTradingAuthRefresh(true)
          setApprovalsStep('idle')
          setTokenApprovalError(null)
          openNextRequirement({ forceTradingAuth: true })
          return
        }
        if (result.code === 'deadline_expired') {
          setTokenApprovalError(t('Your signature expired. Click Sign again to create a fresh request.'))
        }
        else {
          setTokenApprovalError(result.error)
        }
        setApprovalsStep('idle')
        return
      }

      if (result.approvals) {
        useUser.setState((previous) => {
          if (!previous) {
            return previous
          }
          return {
            ...previous,
            settings: mergeUserSettings(previous, {
              tradingAuth: {
                approvals: result.approvals,
              },
            }),
          }
        })
        void refreshSessionUserState()
      }

      setApprovalsStep('completed')
      setDismissedModal(null)
      setAutoRedeemStep('idle')
      setAutoRedeemError(null)
      setActiveModal('auto-redeem')
      setShouldShowFundAfterTradingReady(false)
    }
    catch (error) {
      if (error instanceof UserRejectedRequestError) {
        setTokenApprovalError(t('You rejected the signature request.'))
      }
      else if (error instanceof Error) {
        setTokenApprovalError(error.message || DEFAULT_ERROR_MESSAGE)
      }
      else {
        setTokenApprovalError(DEFAULT_ERROR_MESSAGE)
      }
      setApprovalsStep('idle')
    }
  }, [
    affiliateMetadata,
    approvalsStep,
    openNextRequirement,
    refreshSessionUserState,
    resolveReferralExchanges,
    signTypedDataAsync,
    status.hasTradingAuth,
    t,
    user,
  ])

  const handleApproveAutoRedeem = useCallback(async () => {
    if (!user?.deposit_wallet_address || autoRedeemStep === 'signing') {
      return
    }
    if (!status.hasTradingAuth) {
      openNextRequirement({ forceTradingAuth: true })
      return
    }

    setAutoRedeemStep('signing')
    setAutoRedeemError(null)

    try {
      const result = await signAndSubmitDepositWalletCalls({
        user,
        calls: buildAutoRedeemAllowanceCalls(),
        metadata: 'auto_redeem_approval',
        signTypedDataAsync,
      })

      if (result.error) {
        if (isTradingAuthRequiredError(result.error)) {
          setRequiresTradingAuthRefresh(true)
          setAutoRedeemStep('idle')
          setAutoRedeemError(null)
          openNextRequirement({ forceTradingAuth: true })
          return
        }
        if (result.code === 'deadline_expired') {
          setAutoRedeemError(t('Your signature expired. Click Sign again to create a fresh request.'))
        }
        else {
          setAutoRedeemError(result.error)
        }
        setAutoRedeemStep('idle')
        return
      }

      setAutoRedeemStep('completed')
      setDismissedModal(null)
      setActiveModal(null)
      setShouldShowFundAfterTradingReady(false)
      setFundModalOpen(true)
    }
    catch (error) {
      if (error instanceof UserRejectedRequestError) {
        setAutoRedeemError(t('You rejected the signature request.'))
      }
      else if (error instanceof Error) {
        setAutoRedeemError(error.message || DEFAULT_ERROR_MESSAGE)
      }
      else {
        setAutoRedeemError(DEFAULT_ERROR_MESSAGE)
      }
      setAutoRedeemStep('idle')
    }
  }, [
    autoRedeemStep,
    openNextRequirement,
    signTypedDataAsync,
    status.hasTradingAuth,
    t,
    user,
  ])

  const ensureTradingReady = useCallback(() => {
    if (!user) {
      void openAppKit()
      return false
    }

    if (status.tradingReady) {
      return true
    }

    openNextRequirement()
    return false
  }, [openAppKit, openNextRequirement, status.tradingReady, user])

  const openTradeRequirements = useCallback((options?: { forceTradingAuth?: boolean }) => {
    openNextRequirement(options)
  }, [openNextRequirement])

  const openWalletModal = useCallback(() => {
    if (!user) {
      void openAppKit()
      return
    }
    if (!status.hasDeployedDepositWallet) {
      openNextRequirement()
      return
    }
    setDepositModalOpen(true)
  }, [openAppKit, openNextRequirement, status.hasDeployedDepositWallet, user])

  const startDepositFlow = useCallback(() => {
    if (!user) {
      void openAppKit()
      return
    }

    if (status.tradingReady) {
      setDepositModalOpen(true)
      return
    }

    setShouldShowFundAfterTradingReady(true)
    openNextRequirement()
  }, [openAppKit, openNextRequirement, status.tradingReady, user])

  const startWithdrawFlow = useCallback(() => {
    if (!user) {
      void openAppKit()
      return
    }

    if (!status.hasDeployedDepositWallet) {
      openNextRequirement()
      return
    }

    setWithdrawModalOpen(true)
  }, [openAppKit, openNextRequirement, status.hasDeployedDepositWallet, user])

  const closeFundModal = useCallback((nextOpen: boolean) => {
    setFundModalOpen(nextOpen)
    if (!nextOpen) {
      setShouldShowFundAfterTradingReady(false)
    }
  }, [])

  const contextValue: TradingOnboardingContextValue = useMemo(() => ({
    startDepositFlow,
    startWithdrawFlow,
    ensureTradingReady,
    openTradeRequirements,
    hasDepositWallet: status.hasDeployedDepositWallet,
    openWalletModal,
  }), [
    ensureTradingReady,
    openTradeRequirements,
    openWalletModal,
    startDepositFlow,
    startWithdrawFlow,
    status.hasDeployedDepositWallet,
  ])

  const meldUrl = useMemo(() => {
    if (!status.hasDeployedDepositWallet || !user?.deposit_wallet_address) {
      return null
    }
    const params = new URLSearchParams({
      destinationCurrencyCodeLocked: 'USDC_POLYGON',
      walletAddressLocked: user.deposit_wallet_address,
    })
    return `https://meldcrypto.com/?${params.toString()}`
  }, [status.hasDeployedDepositWallet, user?.deposit_wallet_address])

  return (
    <TradingOnboardingContext value={contextValue}>
      {children}

      <TradingOnboardingDialogs
        activeModal={activeModal}
        onModalOpenChange={handleModalOpenChange}
        usernameDefaultValue={user?.username ?? ''}
        usernameError={usernameError}
        isUsernameSubmitting={isUsernameSubmitting}
        onUsernameSubmit={handleUsernameSubmit}
        emailDefaultValue={hasUsableEmail(user?.email) ? user?.email ?? '' : ''}
        emailError={emailError}
        isEmailSubmitting={isEmailSubmitting}
        onEmailSubmit={handleEmailSubmit}
        onEmailSkip={handleEmailSkip}
        enableTradingStep={status.isDepositWalletDeploying ? 'deploying' : enableTradingStep}
        enableTradingError={enableTradingError}
        onEnableTrading={handleEnableTrading}
        hasDeployedDepositWallet={status.hasDeployedDepositWallet}
        hasTradingAuth={status.hasTradingAuth}
        hasTokenApprovals={status.hasTokenApprovals}
        approvalsStep={approvalsStep}
        tokenApprovalError={tokenApprovalError}
        onApproveTokens={handleApproveTokens}
        autoRedeemStep={autoRedeemStep}
        autoRedeemError={autoRedeemError}
        onApproveAutoRedeem={handleApproveAutoRedeem}
        fundModalOpen={fundModalOpen}
        onFundOpenChange={closeFundModal}
        onFundDeposit={() => {
          closeFundModal(false)
          openWalletModal()
        }}
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
