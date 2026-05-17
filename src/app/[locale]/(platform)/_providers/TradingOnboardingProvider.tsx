'use client'

import type { ReactNode } from 'react'
import type { TradingOnboardingContextValue } from '@/app/[locale]/(platform)/_providers/TradingOnboardingContext'
import type { CommunityProfile } from '@/lib/community-profile'
import type { User } from '@/types'
import { useExtracted } from 'next-intl'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPublicClient, erc20Abi, erc1155Abi, http, UserRejectedRequestError } from 'viem'
import { useSignMessage, useSignTypedData } from 'wagmi'
import { markApprovalStateWithoutTransactionAction } from '@/app/[locale]/(platform)/_actions/approve-tokens'
import {
  createDepositWalletAction,
  enableTradingAuthAction,
  markAutoRedeemApprovalCompletedAction,
  updateOnboardingEmailAction,
  updateOnboardingUsernameAction,
} from '@/app/[locale]/(platform)/_actions/deposit-wallet'
import TradingOnboardingDialogs from '@/app/[locale]/(platform)/_components/TradingOnboardingDialogs'
import {
  TradingOnboardingContext,
  useTradingOnboarding,
} from '@/app/[locale]/(platform)/_providers/TradingOnboardingContext'
import { useAffiliateOrderMetadata } from '@/hooks/useAffiliateOrderMetadata'
import { useAppKit } from '@/hooks/useAppKit'
import { useDepositWalletPolling } from '@/hooks/useDepositWalletPolling'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { authClient } from '@/lib/auth-client'
import {
  clearCommunityAuth,
  ensureCommunityToken,
  parseCommunityError,
} from '@/lib/community-auth'
import { updateCommunityProfile } from '@/lib/community-profile'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import {
  COLLATERAL_TOKEN_ADDRESS,
  CONDITIONAL_TOKENS_CONTRACT,
  CTF_AUTO_REDEEM_ADDRESS,
  CTF_EXCHANGE_ADDRESS,
  NEG_RISK_CTF_EXCHANGE_ADDRESS,
  UMA_NEG_RISK_ADAPTER_ADDRESS,
} from '@/lib/contracts'
import { fetchReferralLocked } from '@/lib/exchange'
import {
  buildTradingAuthMessage,
  getTradingAuthDomain,
  TRADING_AUTH_PRIMARY_TYPE,
  TRADING_AUTH_TYPES,
} from '@/lib/trading-auth/client'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { defaultViemNetwork, defaultViemRpcUrl } from '@/lib/viem-network'
import { signAndSubmitDepositWalletCalls } from '@/lib/wallet/client'
import {
  buildAutoRedeemAllowanceCalls,
  buildCollateralApproveCall,
  buildConditionalSetApprovalForAllCall,
  buildSetReferralCalls,
  hasSufficientCollateralAllowance,
} from '@/lib/wallet/transactions'
import { mergeSessionUserState, useUser } from '@/stores/useUser'

type OnboardingModal = 'username' | 'email' | 'enable' | 'enable-status' | 'approve' | 'auto-redeem' | null
type EnableTradingStep = 'idle' | 'enabling' | 'deploying' | 'completed'
type ApprovalsStep = 'idle' | 'signing' | 'completed'
interface OpenNextRequirementOptions {
  forceTradingAuth?: boolean
  allowTradingAuthPrompt?: boolean
}

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
    const hasAutoRedeemApproval = Boolean(tradingAuthSettings?.autoRedeem?.enabled)
    const tradingReady = hasDeployedDepositWallet && hasTradingAuth && hasTokenApprovals

    return {
      needsUsername,
      needsEmail,
      hasDepositWalletAddress,
      hasDeployedDepositWallet,
      isDepositWalletDeploying,
      hasTradingAuth,
      hasTokenApprovals,
      hasAutoRedeemApproval,
      tradingReady,
    }
  }, [requiresTradingAuthRefresh, user])
}

function resolveNextOnboardingModal({
  needsUsername,
  needsEmail,
  hasDeployedDepositWallet,
  hasTradingAuth,
  hasTokenApprovals,
  allowTradingAuthPrompt,
}: {
  needsUsername: boolean
  needsEmail: boolean
  hasDeployedDepositWallet: boolean
  hasTradingAuth: boolean
  hasTokenApprovals: boolean
  allowTradingAuthPrompt: boolean
}): Exclude<OnboardingModal, null> | null {
  if (needsUsername) {
    return 'username'
  }
  if (needsEmail) {
    return 'email'
  }
  if (!hasDeployedDepositWallet) {
    return 'enable'
  }
  if (allowTradingAuthPrompt && !hasTradingAuth) {
    return 'enable-status'
  }
  if (allowTradingAuthPrompt && !hasTokenApprovals) {
    return 'approve'
  }
  return null
}

function openNextModalWhenAvailable({
  activeModal,
  depositModalOpen,
  dismissedModal,
  fundModalOpen,
  nextModal,
  setActiveModal,
  user,
  withdrawModalOpen,
}: {
  activeModal: OnboardingModal
  depositModalOpen: boolean
  dismissedModal: OnboardingModal
  fundModalOpen: boolean
  nextModal: Exclude<OnboardingModal, null> | null
  setActiveModal: (modal: OnboardingModal) => void
  user: User | null
  withdrawModalOpen: boolean
}) {
  if (!user || activeModal || fundModalOpen || depositModalOpen || withdrawModalOpen) {
    return
  }
  if (!nextModal) {
    return
  }
  if (dismissedModal === nextModal) {
    return
  }
  setActiveModal(nextModal)
}

function completeDepositWalletDeployment({
  enableTradingStep,
  hasDeployedDepositWallet,
  hasTokenApprovals,
  setActiveModal,
  setEnableTradingStep,
}: {
  enableTradingStep: EnableTradingStep
  hasDeployedDepositWallet: boolean
  hasTokenApprovals: boolean
  setActiveModal: (modal: OnboardingModal) => void
  setEnableTradingStep: (step: EnableTradingStep) => void
}) {
  if (hasDeployedDepositWallet && enableTradingStep === 'deploying') {
    setEnableTradingStep('completed')
    if (!hasTokenApprovals) {
      setActiveModal('approve')
    }
    else {
      setActiveModal(null)
    }
  }
}

async function hasDepositWalletCollateralBalance(depositWalletAddress: `0x${string}`) {
  const client = createPublicClient({
    chain: defaultViemNetwork,
    transport: http(defaultViemRpcUrl),
  })

  const balance = await client.readContract({
    address: COLLATERAL_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [depositWalletAddress],
  }) as bigint

  return balance > 0n
}

function openFundModalAfterTradingReady({
  hasDeployedDepositWallet,
  hasTokenApprovals,
  setFundModalOpen,
  setShouldShowFundAfterTradingReady,
  shouldShowFundAfterTradingReady,
}: {
  hasDeployedDepositWallet: boolean
  hasTokenApprovals: boolean
  setFundModalOpen: (open: boolean) => void
  setShouldShowFundAfterTradingReady: (shouldShow: boolean) => void
  shouldShowFundAfterTradingReady: boolean
}) {
  if (hasDeployedDepositWallet && hasTokenApprovals && shouldShowFundAfterTradingReady) {
    setShouldShowFundAfterTradingReady(false)
    setFundModalOpen(true)
  }
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
  const [shouldContinueTradingAuthPrompt, setShouldContinueTradingAuthPrompt] = useState(false)
  const { signTypedDataAsync } = useSignTypedData()
  const { signMessageAsync } = useSignMessage()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const t = useExtracted()
  const pathname = usePathname()
  const affiliateMetadata = useAffiliateOrderMetadata()
  const { open: openAppKit } = useAppKit()
  const refreshSessionUserState = useSessionRefresher()
  const communityApiUrl = process.env.COMMUNITY_URL!

  const status = useOnboardingStatus(user, requiresTradingAuthRefresh)

  useDepositWalletPolling({
    userId: user?.id,
    depositWalletAddress: user?.deposit_wallet_address,
    depositWalletStatus: user?.deposit_wallet_status,
    hasDeployedDepositWallet: status.hasDeployedDepositWallet,
    hasDepositWalletAddress: status.hasDepositWalletAddress,
  })

  const isEventRoute = pathname.includes('/event/')
  const nextModal = resolveNextOnboardingModal({
    ...status,
    allowTradingAuthPrompt: isEventRoute,
  })

  useEffect(function syncNextOnboardingModal() {
    openNextModalWhenAvailable({
      activeModal,
      depositModalOpen,
      dismissedModal,
      fundModalOpen,
      nextModal,
      setActiveModal,
      user,
      withdrawModalOpen,
    })
  }, [activeModal, depositModalOpen, dismissedModal, fundModalOpen, nextModal, user, withdrawModalOpen])

  useEffect(function syncDepositWalletDeploymentCompletion() {
    completeDepositWalletDeployment({
      enableTradingStep,
      hasDeployedDepositWallet: status.hasDeployedDepositWallet,
      hasTokenApprovals: status.hasTokenApprovals,
      setActiveModal,
      setEnableTradingStep,
    })
  }, [enableTradingStep, status.hasDeployedDepositWallet, status.hasTokenApprovals])

  useEffect(function syncFundModalAfterTradingReady() {
    openFundModalAfterTradingReady({
      hasDeployedDepositWallet: status.hasDeployedDepositWallet,
      hasTokenApprovals: status.hasTokenApprovals,
      setFundModalOpen,
      setShouldShowFundAfterTradingReady,
      shouldShowFundAfterTradingReady,
    })
  }, [shouldShowFundAfterTradingReady, status.hasDeployedDepositWallet, status.hasTokenApprovals])

  const openNextRequirement = useCallback((options?: OpenNextRequirementOptions) => {
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

    const allowTradingAuthPrompt = Boolean(options?.allowTradingAuthPrompt)
      || Boolean(options?.forceTradingAuth)
      || isEventRoute
    setShouldContinueTradingAuthPrompt(allowTradingAuthPrompt)

    const forcedStatus = options?.forceTradingAuth
      ? { ...status, hasTradingAuth: false, tradingReady: false }
      : status
    const modal = resolveNextOnboardingModal({
      ...forcedStatus,
      allowTradingAuthPrompt,
    })
    setActiveModal(modal)
  }, [isEventRoute, openAppKit, refreshSessionUserState, status, user])

  const openFundModalIfBalanceEmpty = useCallback(async () => {
    if (!user?.deposit_wallet_address) {
      setFundModalOpen(true)
      return
    }

    try {
      const hasBalance = await hasDepositWalletCollateralBalance(user.deposit_wallet_address as `0x${string}`)
      if (!hasBalance) {
        setFundModalOpen(true)
      }
    }
    catch {
      setFundModalOpen(true)
    }
  }, [user?.deposit_wallet_address])

  const handleModalOpenChange = useCallback((modal: Exclude<OnboardingModal, null>, open: boolean) => {
    if (open) {
      setDismissedModal(null)
      setActiveModal(modal)
      return
    }
    if (modal === 'auto-redeem') {
      setDismissedModal(modal)
      setActiveModal(null)
      setShouldContinueTradingAuthPrompt(false)
      setShouldShowFundAfterTradingReady(false)
      void openFundModalIfBalanceEmpty()
      return
    }
    setDismissedModal(modal)
    setActiveModal(null)
    setShouldContinueTradingAuthPrompt(false)
  }, [openFundModalIfBalanceEmpty])

  const handleUsernameSubmit = useCallback(async (username: string, termsAccepted: boolean) => {
    if (isUsernameSubmitting) {
      return
    }
    if (!user?.address) {
      setUsernameError(DEFAULT_ERROR_MESSAGE)
      return
    }
    setIsUsernameSubmitting(true)
    setUsernameError(null)
    try {
      const token = await ensureCommunityToken({
        address: user.address,
        signMessageAsync: args => runWithSignaturePrompt(() => signMessageAsync(args)),
        communityApiUrl,
        depositWalletAddress: user.deposit_wallet_address ?? null,
      })

      const response = await updateCommunityProfile({
        communityApiUrl,
        token,
        username,
      })

      if (response.status === 401) {
        clearCommunityAuth()
      }
      if (!response.ok) {
        setUsernameError(
          response.status === 409
            ? t('That username is already taken.')
            : await parseCommunityError(response, DEFAULT_ERROR_MESSAGE),
        )
        return
      }

      const payload = await response.json() as CommunityProfile
      const communityUsername = payload.username?.trim()
      if (!communityUsername) {
        setUsernameError(t('Community profile did not confirm the username.'))
        return
      }

      const result = await updateOnboardingUsernameAction({
        username,
        communityUsername,
        termsAccepted,
      })
      if (result.error || !result.data) {
        setUsernameError(
          result.code === 'username_taken'
            ? t('That username is already taken.')
            : result.code === 'community_profile_not_synced'
              ? t('Community profile did not confirm the username.')
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
      const allowTradingAuthPrompt = shouldContinueTradingAuthPrompt || isEventRoute
      const nextModal = status.needsEmail
        ? 'email'
        : resolveNextOnboardingModal({
            ...status,
            needsUsername: false,
            allowTradingAuthPrompt,
          })
      setActiveModal(nextModal)
      if (!nextModal) {
        setShouldContinueTradingAuthPrompt(false)
      }
    }
    catch (error) {
      setUsernameError(
        error instanceof UserRejectedRequestError
          ? t('You rejected the signature request.')
          : error instanceof Error
            ? error.message
            : DEFAULT_ERROR_MESSAGE,
      )
    }
    finally {
      setIsUsernameSubmitting(false)
    }
  }, [
    communityApiUrl,
    isUsernameSubmitting,
    refreshSessionUserState,
    runWithSignaturePrompt,
    signMessageAsync,
    shouldContinueTradingAuthPrompt,
    status,
    t,
    user?.address,
    user?.deposit_wallet_address,
    isEventRoute,
  ])

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
      const allowTradingAuthPrompt = shouldContinueTradingAuthPrompt || isEventRoute
      const nextModal = resolveNextOnboardingModal({
        ...status,
        needsEmail: false,
        allowTradingAuthPrompt,
      })
      setActiveModal(nextModal)
      if (!nextModal) {
        setShouldContinueTradingAuthPrompt(false)
      }
    }
    finally {
      setIsEmailSubmitting(false)
    }
  }, [isEmailSubmitting, refreshSessionUserState, shouldContinueTradingAuthPrompt, status, isEventRoute])

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
      const allowTradingAuthPrompt = shouldContinueTradingAuthPrompt || isEventRoute
      const nextModal = resolveNextOnboardingModal({
        ...status,
        needsEmail: false,
        allowTradingAuthPrompt,
      })
      setActiveModal(nextModal)
      if (!nextModal) {
        setShouldContinueTradingAuthPrompt(false)
      }
    }
    finally {
      setIsEmailSubmitting(false)
    }
  }, [isEmailSubmitting, refreshSessionUserState, shouldContinueTradingAuthPrompt, status, isEventRoute])

  const handleCreateDepositWallet = useCallback(async () => {
    if (!user?.address || enableTradingStep === 'enabling') {
      return
    }
    setEnableTradingError(null)

    try {
      setEnableTradingStep('enabling')
      const result = await createDepositWalletAction()

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
        }
      })
      void refreshSessionUserState()

      if (data.deposit_wallet_status === 'deployed') {
        setEnableTradingStep('completed')
        setDismissedModal(null)
        setActiveModal(status.hasTokenApprovals ? null : 'approve')
      }
      else {
        setEnableTradingStep('deploying')
      }
    }
    catch (error) {
      if (error instanceof Error) {
        setEnableTradingError(error.message || DEFAULT_ERROR_MESSAGE)
      }
      else {
        setEnableTradingError(DEFAULT_ERROR_MESSAGE)
      }
      setEnableTradingStep('idle')
    }
  }, [
    enableTradingStep,
    refreshSessionUserState,
    status.hasTokenApprovals,
    user?.address,
  ])

  const handleEnableTradingAuth = useCallback(async () => {
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

      const result = await enableTradingAuthAction({
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
          settings: mergeUserSettings(previous, {
            tradingAuth: data.tradingAuth,
          }),
        }
      })
      void refreshSessionUserState()
      setRequiresTradingAuthRefresh(false)
      setEnableTradingStep('completed')
      setDismissedModal(null)
      setActiveModal(status.hasTokenApprovals ? null : 'approve')
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

  const resolveMissingApprovalCalls = useCallback(async (depositWalletAddress: `0x${string}`) => {
    const client = createPublicClient({
      chain: defaultViemNetwork,
      transport: http(defaultViemRpcUrl),
    })

    const collateralSpenders = [
      CONDITIONAL_TOKENS_CONTRACT,
      CTF_EXCHANGE_ADDRESS,
      NEG_RISK_CTF_EXCHANGE_ADDRESS,
      UMA_NEG_RISK_ADAPTER_ADDRESS,
    ] as const
    const conditionalOperators = [
      CTF_EXCHANGE_ADDRESS,
      NEG_RISK_CTF_EXCHANGE_ADDRESS,
      UMA_NEG_RISK_ADAPTER_ADDRESS,
    ] as const

    const [allowances, operatorApprovals] = await Promise.all([
      Promise.all(collateralSpenders.map(spender =>
        client.readContract({
          address: COLLATERAL_TOKEN_ADDRESS,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [depositWalletAddress, spender],
        }) as Promise<bigint>,
      )),
      Promise.all(conditionalOperators.map(operator =>
        client.readContract({
          address: CONDITIONAL_TOKENS_CONTRACT,
          abi: erc1155Abi,
          functionName: 'isApprovedForAll',
          args: [depositWalletAddress, operator],
        }) as Promise<boolean>,
      )),
    ])

    const approvalCalls = collateralSpenders.flatMap((spender, index) =>
      hasSufficientCollateralAllowance(allowances[index]) ? [] : [buildCollateralApproveCall(spender)],
    )
    const operatorCalls = conditionalOperators.flatMap((operator, index) =>
      operatorApprovals[index] ? [] : [buildConditionalSetApprovalForAllCall(operator)],
    )

    return [...approvalCalls, ...operatorCalls]
  }, [])

  const ensureAutoRedeemStatusFromChain = useCallback(async (depositWalletAddress: `0x${string}`) => {
    const client = createPublicClient({
      chain: defaultViemNetwork,
      transport: http(defaultViemRpcUrl),
    })
    const approved = await client.readContract({
      address: CONDITIONAL_TOKENS_CONTRACT,
      abi: erc1155Abi,
      functionName: 'isApprovedForAll',
      args: [depositWalletAddress, CTF_AUTO_REDEEM_ADDRESS],
    }) as boolean

    if (!approved) {
      return false
    }

    const result = await markAutoRedeemApprovalCompletedAction()
    const autoRedeem = result.data?.autoRedeem
    if (result.error || !autoRedeem) {
      return true
    }

    useUser.setState((previous) => {
      if (!previous) {
        return previous
      }
      return {
        ...previous,
        settings: mergeUserSettings(previous, {
          tradingAuth: {
            autoRedeem,
          },
        }),
      }
    })
    void refreshSessionUserState()
    return true
  }, [refreshSessionUserState])

  const handleApproveTokens = useCallback(async () => {
    if (!user?.deposit_wallet_address || approvalsStep === 'signing') {
      return
    }

    setApprovalsStep('signing')
    setTokenApprovalError(null)

    try {
      const referralExchanges = await resolveReferralExchanges(user.deposit_wallet_address as `0x${string}`)
      const missingApprovalCalls = await resolveMissingApprovalCalls(user.deposit_wallet_address as `0x${string}`)
      const calls = [
        ...missingApprovalCalls,
        ...buildSetReferralCalls({
          referrer: affiliateMetadata.referrerAddress,
          affiliate: affiliateMetadata.affiliateAddress,
          affiliateSharePercent: affiliateMetadata.affiliateSharePercent,
          exchanges: referralExchanges,
        }),
      ]
      const result = calls.length > 0
        ? await signAndSubmitDepositWalletCalls({
            user,
            calls,
            metadata: 'approve_tokens',
            signTypedDataAsync,
          })
        : await markApprovalStateWithoutTransactionAction('approve_tokens')

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
      const hasAutoRedeemOnChain = await ensureAutoRedeemStatusFromChain(user.deposit_wallet_address as `0x${string}`)
      if (hasAutoRedeemOnChain) {
        setActiveModal(null)
        setShouldShowFundAfterTradingReady(false)
        await openFundModalIfBalanceEmpty()
      }
      else {
        setActiveModal('auto-redeem')
        setShouldShowFundAfterTradingReady(false)
      }
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
    openFundModalIfBalanceEmpty,
    openNextRequirement,
    refreshSessionUserState,
    resolveMissingApprovalCalls,
    resolveReferralExchanges,
    signTypedDataAsync,
    ensureAutoRedeemStatusFromChain,
    t,
    user,
  ])

  const handleApproveAutoRedeem = useCallback(async () => {
    if (!user?.deposit_wallet_address || autoRedeemStep === 'signing') {
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

      if (result.autoRedeem) {
        useUser.setState((previous) => {
          if (!previous) {
            return previous
          }
          return {
            ...previous,
            settings: mergeUserSettings(previous, {
              tradingAuth: {
                autoRedeem: result.autoRedeem,
              },
            }),
          }
        })
        void refreshSessionUserState()
      }

      setAutoRedeemStep('completed')
      setDismissedModal(null)
      setActiveModal(null)
      setShouldShowFundAfterTradingReady(false)
      await openFundModalIfBalanceEmpty()
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
    openFundModalIfBalanceEmpty,
    openNextRequirement,
    refreshSessionUserState,
    signTypedDataAsync,
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

    openNextRequirement({ allowTradingAuthPrompt: true })
    return false
  }, [openAppKit, openNextRequirement, status.tradingReady, user])

  const openTradeRequirements = useCallback((options?: { forceTradingAuth?: boolean }) => {
    openNextRequirement({
      ...options,
      allowTradingAuthPrompt: true,
    })
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

    if (status.hasDeployedDepositWallet) {
      setDepositModalOpen(true)
      return
    }

    setShouldShowFundAfterTradingReady(true)
    openNextRequirement()
  }, [openAppKit, openNextRequirement, status.hasDeployedDepositWallet, user])

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
        onCreateDepositWallet={handleCreateDepositWallet}
        onEnableTradingAuth={handleEnableTradingAuth}
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

export { useTradingOnboarding }
