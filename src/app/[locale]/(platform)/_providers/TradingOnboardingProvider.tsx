'use client'

import type { ReactNode } from 'react'
import type { TradingOnboardingContextValue } from '@/app/[locale]/(platform)/_providers/TradingOnboardingContext'
import type { CommunityProfile } from '@/lib/community-profile'
import type { SumsubVerificationStatus } from '@/lib/sumsub/types'
import type { User } from '@/types'
import { useExtracted } from 'next-intl'
import { usePathname } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPublicClient, erc20Abi, erc1155Abi, http } from 'viem'
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
import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { authClient } from '@/lib/auth-client'
import {
  clearCommunityAuth,
  ensureCommunityToken,
  parseCommunityError,
} from '@/lib/community-auth'
import {
  COMMUNITY_PROFILE_LOOKUP_TIMEOUT_MS,
  fetchCommunityProfileByAddress,
  updateCommunityProfile,
} from '@/lib/community-profile'
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
import { SUMSUB_ENFORCEMENTS } from '@/lib/sumsub/types'
import {
  buildTradingAuthMessage,
  getTradingAuthDomain,
  TRADING_AUTH_PRIMARY_TYPE,
  TRADING_AUTH_TYPES,
} from '@/lib/trading-auth/client'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { hasUsableUserEmail } from '@/lib/user-email'
import { defaultViemNetwork, resolveViemRpcUrl } from '@/lib/viem-network'
import {
  isRecoverableWalletConnectorError,
  isUserRejectedRequestError,
} from '@/lib/wallet'
import { signAndSubmitDepositWalletCalls } from '@/lib/wallet/client'
import {
  buildAutoRedeemAllowanceCalls,
  buildCollateralApproveCall,
  buildConditionalSetApprovalForAllCall,
  buildSetReferralCalls,
  hasSufficientCollateralAllowance,
} from '@/lib/wallet/transactions'
import { mergeSessionUserState, useUser } from '@/stores/useUser'

type OnboardingModal = 'username' | 'email' | 'sumsub' | 'enable' | 'enable-status' | 'approve' | 'auto-redeem' | null
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

let routeAllowsTradingAuthPrompt = false
const routePromptListeners = new Set<() => void>()
const SUMSUB_ENFORCEMENT_SET: ReadonlySet<string> = new Set(SUMSUB_ENFORCEMENTS)

function subscribeRouteTradingAuthPrompt(onStoreChange: () => void) {
  routePromptListeners.add(onStoreChange)
  return () => {
    routePromptListeners.delete(onStoreChange)
  }
}

function getRouteTradingAuthPromptSnapshot() {
  return routeAllowsTradingAuthPrompt
}

function getServerRouteTradingAuthPromptSnapshot() {
  return false
}

function setRouteTradingAuthPrompt(nextValue: boolean) {
  if (routeAllowsTradingAuthPrompt === nextValue) {
    return
  }

  routeAllowsTradingAuthPrompt = nextValue
  routePromptListeners.forEach(listener => listener())
}

function useRouteTradingAuthPrompt() {
  return useSyncExternalStore(
    subscribeRouteTradingAuthPrompt,
    getRouteTradingAuthPromptSnapshot,
    getServerRouteTradingAuthPromptSnapshot,
  )
}

function TradingAuthRoutePromptSync() {
  const pathname = usePathname()

  useEffect(function syncRouteTradingAuthPrompt() {
    setRouteTradingAuthPrompt(pathname.includes('/event/'))
  }, [pathname])

  return null
}

function isGeneratedDepositWalletUsername(username?: string | null, depositWalletAddress?: string | null) {
  const trimmedUsername = username?.trim()
  const trimmedDepositWalletAddress = depositWalletAddress?.trim()
  if (!trimmedUsername || !trimmedDepositWalletAddress) {
    return false
  }

  const prefix = `${trimmedDepositWalletAddress.toLowerCase()}-`
  const normalizedUsername = trimmedUsername.toLowerCase()
  if (!normalizedUsername.startsWith(prefix)) {
    return false
  }

  return /^\d+$/.test(normalizedUsername.slice(prefix.length))
}

function hasUserProvidedUsername(user: User) {
  const username = user.username?.trim()
  return Boolean(
    username
    && !isGeneratedDepositWalletUsername(username, user.deposit_wallet_address),
  )
}

function getUsernameDefaultValue(user: User | null) {
  if (!user?.username) {
    return ''
  }
  if (isGeneratedDepositWalletUsername(user.username, user.deposit_wallet_address)) {
    return ''
  }
  return user.username
}

function syncDepositWalletDeployingState() {
  useUser.setState((previous) => {
    if (!previous) {
      return previous
    }
    return {
      ...previous,
      deposit_wallet_status: 'deploying',
    }
  })
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
    const hasUsername = Boolean(user && hasUserProvidedUsername(user))
    const needsUsername = Boolean(user && !hasUsername)
    const needsEmail = Boolean(
      user
      && !hasUsableUserEmail(user.email)
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
  needsSumsub,
}: {
  needsUsername: boolean
  needsEmail: boolean
  hasDeployedDepositWallet: boolean
  hasTradingAuth: boolean
  hasTokenApprovals: boolean
  allowTradingAuthPrompt: boolean
  needsSumsub: boolean
}): Exclude<OnboardingModal, null> | null {
  if (needsUsername) {
    return 'username'
  }
  if (needsEmail) {
    return 'email'
  }
  if (needsSumsub) {
    return 'sumsub'
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

async function hasDepositWalletCollateralBalance(depositWalletAddress: `0x${string}`, viemRpcUrl: string) {
  const client = createPublicClient({
    chain: defaultViemNetwork,
    transport: http(viemRpcUrl),
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

function isSumsubVerificationStatus(value: unknown): value is SumsubVerificationStatus {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<SumsubVerificationStatus>
  return typeof candidate.enabled === 'boolean'
    && typeof candidate.configured === 'boolean'
    && typeof candidate.effective === 'boolean'
    && SUMSUB_ENFORCEMENT_SET.has(candidate.enforcement ?? '')
    && typeof candidate.levelName === 'string'
    && ['not_started', 'pending', 'on_hold', 'approved', 'rejected', 'error'].includes(candidate.status ?? '')
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
  const [sumsubStatus, setSumsubStatus] = useState<SumsubVerificationStatus>({
    enabled: false,
    configured: false,
    effective: false,
    enforcement: 'disabled',
    levelName: '',
    status: 'not_started',
    approvedAt: null,
    updatedAt: null,
  })
  const [sumsubLoaded, setSumsubLoaded] = useState(false)
  const [sumsubObserveDismissed, setSumsubObserveDismissed] = useState(false)
  const pendingTradingReadyActionRef = useRef<(() => void) | null>(null)
  const pendingOpenRequirementRef = useRef<OpenNextRequirementOptions | null>(null)
  const [communityUsernameHint, setCommunityUsernameHint] = useState<{
    address: string
    username: string
  } | null>(null)
  const { signTypedDataAsync } = useSignTypedData()
  const { signMessageAsync } = useSignMessage()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const t = useExtracted()
  const signatureRejectedMessage = t('You rejected the signature request.')
  const walletConnectorReconnectMessage = t('Your wallet connection expired. Reconnect your wallet and try again.')
  const affiliateMetadata = useAffiliateOrderMetadata()
  const { open: openAppKit } = useAppKit()
  const refreshSessionUserState = useSessionRefresher()
  const { communityUrl, polygonRpcUrl } = usePublicRuntimeConfig()
  const allowsRouteTradingAuthPrompt = useRouteTradingAuthPrompt()
  const communityApiUrl = communityUrl
  const viemRpcUrl = useMemo(() => resolveViemRpcUrl(polygonRpcUrl), [polygonRpcUrl])
  const handleWalletActionError = useCallback((
    error: unknown,
    setError: (message: string) => void,
  ) => {
    if (isUserRejectedRequestError(error)) {
      setError(signatureRejectedMessage)
      return
    }

    if (isRecoverableWalletConnectorError(error)) {
      setError(walletConnectorReconnectMessage)
      void openAppKit({ view: 'Connect' })
      return
    }

    if (error instanceof Error) {
      setError(error.message || DEFAULT_ERROR_MESSAGE)
      return
    }

    setError(DEFAULT_ERROR_MESSAGE)
  }, [openAppKit, signatureRejectedMessage, walletConnectorReconnectMessage])

  const status = useOnboardingStatus(user, requiresTradingAuthRefresh)
  const sumsubApproved = sumsubStatus.status === 'approved'
  const sumsubRequired = sumsubStatus.effective && sumsubStatus.enforcement === 'required'
  const needsSumsub = sumsubStatus.effective && !sumsubApproved
  const needsSumsubForFlow = needsSumsub && !(sumsubStatus.enforcement === 'observe' && sumsubObserveDismissed)
  const tradingReady = sumsubLoaded && status.tradingReady && (!sumsubRequired || sumsubApproved)

  const refreshSumsubStatus = useCallback(async () => {
    if (!user) {
      return
    }
    try {
      const response = await fetch('/api/sumsub/status', { cache: 'no-store' })
      const payload = await response.json().catch(() => null) as unknown
      if (!response.ok) {
        if (isSumsubVerificationStatus(payload)) {
          setSumsubStatus(payload)
          setSumsubLoaded(true)
          return
        }
        if (sumsubRequired) {
          setSumsubStatus(previous => ({ ...previous, status: 'error' }))
        }
        return
      }
      if (!isSumsubVerificationStatus(payload)) {
        if (sumsubRequired) {
          setSumsubStatus(previous => ({ ...previous, status: 'error' }))
        }
        return
      }
      setSumsubStatus(payload)
      setSumsubLoaded(true)
    }
    catch {
      if (sumsubRequired) {
        setSumsubStatus(previous => ({ ...previous, status: 'error' }))
      }
    }
  }, [sumsubRequired, user])

  useEffect(function loadSumsubStatus() {
    void refreshSumsubStatus()
  }, [refreshSumsubStatus])

  useEffect(function pollSumsubStatusWhileOpen() {
    const reviewInProgress = sumsubStatus.effective
      && (sumsubStatus.status === 'pending' || sumsubStatus.status === 'on_hold')
    if (activeModal !== 'sumsub' && !reviewInProgress) {
      return
    }
    const interval = window.setInterval(() => void refreshSumsubStatus(), 5_000)
    return () => window.clearInterval(interval)
  }, [activeModal, refreshSumsubStatus, sumsubStatus.effective, sumsubStatus.status])
  const normalizedUserAddress = user?.address?.trim().toLowerCase() ?? ''
  const hasMatchingCommunityUsernameHint = Boolean(
    communityUsernameHint
    && normalizedUserAddress
    && communityUsernameHint.address.trim().toLowerCase() === normalizedUserAddress,
  )
  const communityUsernameHintForCurrentUser = hasMatchingCommunityUsernameHint ? communityUsernameHint : null

  useEffect(function preloadCommunityUsernameHint() {
    if (!user?.address || !status.needsUsername || activeModal !== 'username' || hasMatchingCommunityUsernameHint) {
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      controller.abort()
    }, COMMUNITY_PROFILE_LOOKUP_TIMEOUT_MS)
    let cancelled = false

    fetchCommunityProfileByAddress({
      communityApiUrl,
      address: user.address,
      signal: controller.signal,
    })
      .then((profile) => {
        if (cancelled) {
          return
        }

        const username = profile?.username?.trim()
        if (username) {
          setCommunityUsernameHint({
            address: user.address,
            username,
          })
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return
        }
        if (!cancelled) {
          console.error('Failed to preload community username', error)
        }
      })

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [activeModal, communityApiUrl, hasMatchingCommunityUsernameHint, status.needsUsername, user?.address])

  useDepositWalletPolling({
    userId: user?.id,
    depositWalletAddress: user?.deposit_wallet_address,
    depositWalletStatus: user?.deposit_wallet_status,
    hasDeployedDepositWallet: status.hasDeployedDepositWallet,
    hasDepositWalletAddress: status.hasDepositWalletAddress,
  })

  const nextModal = !sumsubLoaded && !status.needsUsername && !status.needsEmail
    ? null
    : resolveNextOnboardingModal({
        ...status,
        needsSumsub: needsSumsubForFlow,
        allowTradingAuthPrompt: allowsRouteTradingAuthPrompt,
      })

  useEffect(function advanceAfterSumsubApproval() {
    if (activeModal === 'sumsub' && sumsubApproved) {
      setSumsubObserveDismissed(false)
      setDismissedModal(null)
      setActiveModal(null)
    }
  }, [activeModal, sumsubApproved])

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

  useEffect(function resumePendingTradingAction() {
    if (!tradingReady || !pendingTradingReadyActionRef.current) {
      return
    }

    const action = pendingTradingReadyActionRef.current
    pendingTradingReadyActionRef.current = null
    action()
  }, [tradingReady])

  const openNextRequirement = useCallback((options?: OpenNextRequirementOptions) => {
    if (!user) {
      void openAppKit()
      return
    }

    if (!sumsubLoaded) {
      pendingOpenRequirementRef.current = options ?? {}
      void refreshSumsubStatus()
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
      || allowsRouteTradingAuthPrompt
    setShouldContinueTradingAuthPrompt(allowTradingAuthPrompt)

    const forcedStatus = options?.forceTradingAuth
      ? { ...status, hasTradingAuth: false, tradingReady: false }
      : status
    const modal = resolveNextOnboardingModal({
      ...forcedStatus,
      needsSumsub: needsSumsubForFlow,
      allowTradingAuthPrompt,
    })
    setActiveModal(modal)
  }, [
    allowsRouteTradingAuthPrompt,
    needsSumsubForFlow,
    openAppKit,
    refreshSessionUserState,
    refreshSumsubStatus,
    status,
    sumsubLoaded,
    user,
  ])

  useEffect(function openDeferredRequirementAfterSumsubLoads() {
    if (!sumsubLoaded || !pendingOpenRequirementRef.current) {
      return
    }
    const options = pendingOpenRequirementRef.current
    pendingOpenRequirementRef.current = null
    openNextRequirement(options)
  }, [openNextRequirement, sumsubLoaded])

  const openFundModalIfBalanceEmpty = useCallback(async () => {
    if (!user?.deposit_wallet_address) {
      setFundModalOpen(true)
      return
    }

    try {
      const hasBalance = await hasDepositWalletCollateralBalance(user.deposit_wallet_address as `0x${string}`, viemRpcUrl)
      if (!hasBalance) {
        setFundModalOpen(true)
      }
    }
    catch {
      setFundModalOpen(true)
    }
  }, [user?.deposit_wallet_address, viemRpcUrl])

  const handleModalOpenChange = useCallback((modal: Exclude<OnboardingModal, null>, open: boolean) => {
    if (open) {
      setDismissedModal(null)
      setActiveModal(modal)
      return
    }
    if (modal === 'username' && status.needsUsername) {
      setDismissedModal(null)
      setActiveModal('username')
      return
    }
    if (modal === 'email' && status.needsEmail) {
      setDismissedModal(null)
      setActiveModal('email')
      return
    }
    if (modal === 'sumsub') {
      if (sumsubStatus.enforcement === 'observe') {
        setSumsubObserveDismissed(true)
      }
      setDismissedModal('sumsub')
      setActiveModal(null)
      setShouldContinueTradingAuthPrompt(false)
      return
    }
    if ((modal === 'enable' || modal === 'enable-status') && !enableTradingError) {
      setDismissedModal(null)
      setActiveModal(modal)
      return
    }
    if (modal === 'approve' && !tokenApprovalError) {
      setDismissedModal(null)
      setActiveModal('approve')
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
  }, [
    enableTradingError,
    openFundModalIfBalanceEmpty,
    status.needsEmail,
    status.needsUsername,
    sumsubStatus.enforcement,
    tokenApprovalError,
  ])

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
        setUsernameError(t('Profile verification did not confirm the username.'))
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
              ? t('Profile verification did not confirm the username.')
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
      const allowTradingAuthPrompt = shouldContinueTradingAuthPrompt || allowsRouteTradingAuthPrompt
      const nextModal = status.needsEmail
        ? 'email'
        : resolveNextOnboardingModal({
            ...status,
            needsUsername: false,
            needsSumsub: needsSumsubForFlow,
            allowTradingAuthPrompt,
          })
      setActiveModal(nextModal)
      if (!nextModal) {
        setShouldContinueTradingAuthPrompt(false)
      }
    }
    catch (error) {
      handleWalletActionError(error, setUsernameError)
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
    handleWalletActionError,
    t,
    user?.address,
    user?.deposit_wallet_address,
    allowsRouteTradingAuthPrompt,
    needsSumsubForFlow,
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
      const allowTradingAuthPrompt = shouldContinueTradingAuthPrompt || allowsRouteTradingAuthPrompt
      const nextModal = resolveNextOnboardingModal({
        ...status,
        needsEmail: false,
        needsSumsub: needsSumsubForFlow,
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
  }, [allowsRouteTradingAuthPrompt, isEmailSubmitting, needsSumsubForFlow, refreshSessionUserState, shouldContinueTradingAuthPrompt, status])

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
      const allowTradingAuthPrompt = shouldContinueTradingAuthPrompt || allowsRouteTradingAuthPrompt
      const nextModal = resolveNextOnboardingModal({
        ...status,
        needsEmail: false,
        needsSumsub: needsSumsubForFlow,
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
  }, [allowsRouteTradingAuthPrompt, isEmailSubmitting, needsSumsubForFlow, refreshSessionUserState, shouldContinueTradingAuthPrompt, status])

  const enableTradingAuthForCurrentUser = useCallback(async () => {
    if (!user?.address) {
      throw new Error(DEFAULT_ERROR_MESSAGE)
    }

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
      throw new Error(result.error ?? DEFAULT_ERROR_MESSAGE)
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
    await refreshSessionUserState()
    setRequiresTradingAuthRefresh(false)
    setDismissedModal(null)
  }, [
    refreshSessionUserState,
    runWithSignaturePrompt,
    signTypedDataAsync,
    user?.address,
  ])

  const handleCreateDepositWallet = useCallback(async () => {
    if (!user?.address || enableTradingStep === 'enabling') {
      return
    }
    setEnableTradingError(null)

    try {
      setEnableTradingStep('enabling')
      let result = await createDepositWalletAction()

      if (result.error && isTradingAuthRequiredError(result.error)) {
        await enableTradingAuthForCurrentUser()
        setActiveModal('enable')
        result = await createDepositWalletAction()
      }

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
      handleWalletActionError(error, setEnableTradingError)
      setEnableTradingStep('idle')
    }
  }, [
    enableTradingAuthForCurrentUser,
    enableTradingStep,
    handleWalletActionError,
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
      await enableTradingAuthForCurrentUser()
      if (status.hasDeployedDepositWallet) {
        setEnableTradingStep('completed')
        setActiveModal(status.hasTokenApprovals ? null : 'approve')
      }
      else {
        setEnableTradingStep('idle')
        setActiveModal('enable')
      }
    }
    catch (error) {
      handleWalletActionError(error, setEnableTradingError)
      setEnableTradingStep('idle')
    }
  }, [
    enableTradingAuthForCurrentUser,
    enableTradingStep,
    handleWalletActionError,
    status.hasDeployedDepositWallet,
    status.hasTokenApprovals,
    user?.address,
  ])

  const resolveReferralExchanges = useCallback(async (depositWallet: `0x${string}`) => {
    const exchanges = [
      CTF_EXCHANGE_ADDRESS as `0x${string}`,
      NEG_RISK_CTF_EXCHANGE_ADDRESS as `0x${string}`,
    ]
    const results = await Promise.all(
      exchanges.map(exchange => fetchReferralLocked(exchange, depositWallet, viemRpcUrl)),
    )
    if (results.includes(null)) {
      console.warn('Failed to read referral status; skipping locked/unknown exchanges.')
    }
    return exchanges.filter((_, index) => results[index] === false)
  }, [viemRpcUrl])

  const resolveMissingApprovalCalls = useCallback(async (depositWalletAddress: `0x${string}`) => {
    const client = createPublicClient({
      chain: defaultViemNetwork,
      transport: http(viemRpcUrl),
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
  }, [viemRpcUrl])

  const ensureAutoRedeemStatusFromChain = useCallback(async (depositWalletAddress: `0x${string}`) => {
    const client = createPublicClient({
      chain: defaultViemNetwork,
      transport: http(viemRpcUrl),
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
  }, [refreshSessionUserState, viemRpcUrl])

  const handleApproveTokens = useCallback(async () => {
    if (!user?.deposit_wallet_address || approvalsStep === 'signing') {
      return
    }

    if (user.deposit_wallet_status !== 'deployed') {
      setTokenApprovalError(t('Your trading wallet is still being set up on-chain. Check back shortly.'))
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
        if (result.code === 'deposit_wallet_not_deployed') {
          syncDepositWalletDeployingState()
          setApprovalsStep('idle')
          setTokenApprovalError(t('Your trading wallet is still being set up on-chain. Check back shortly.'))
          return
        }
        if (result.code === 'deadline_expired') {
          setTokenApprovalError(t('Your signature expired. Click Sign again to create a fresh request.'))
        }
        else if (result.code === 'wallet_connector_not_connected') {
          setTokenApprovalError(walletConnectorReconnectMessage)
          void openAppKit({ view: 'Connect' })
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
      handleWalletActionError(error, setTokenApprovalError)
      setApprovalsStep('idle')
    }
  }, [
    affiliateMetadata,
    approvalsStep,
    handleWalletActionError,
    openFundModalIfBalanceEmpty,
    openNextRequirement,
    openAppKit,
    refreshSessionUserState,
    resolveMissingApprovalCalls,
    resolveReferralExchanges,
    signTypedDataAsync,
    ensureAutoRedeemStatusFromChain,
    t,
    walletConnectorReconnectMessage,
    user,
  ])

  const handleApproveAutoRedeem = useCallback(async () => {
    if (!user?.deposit_wallet_address || autoRedeemStep === 'signing') {
      return
    }

    if (user.deposit_wallet_status !== 'deployed') {
      setAutoRedeemError(t('Your trading wallet is still being set up on-chain. Check back shortly.'))
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
        if (result.code === 'deposit_wallet_not_deployed') {
          syncDepositWalletDeployingState()
          setAutoRedeemStep('idle')
          setAutoRedeemError(t('Your trading wallet is still being set up on-chain. Check back shortly.'))
          return
        }
        if (result.code === 'deadline_expired') {
          setAutoRedeemError(t('Your signature expired. Click Sign again to create a fresh request.'))
        }
        else if (result.code === 'wallet_connector_not_connected') {
          setAutoRedeemError(walletConnectorReconnectMessage)
          void openAppKit({ view: 'Connect' })
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
      handleWalletActionError(error, setAutoRedeemError)
      setAutoRedeemStep('idle')
    }
  }, [
    autoRedeemStep,
    handleWalletActionError,
    openFundModalIfBalanceEmpty,
    openNextRequirement,
    openAppKit,
    refreshSessionUserState,
    signTypedDataAsync,
    t,
    walletConnectorReconnectMessage,
    user,
  ])

  const ensureTradingReady = useCallback(() => {
    if (!user) {
      void openAppKit()
      return false
    }

    if (tradingReady) {
      return true
    }

    openNextRequirement({ allowTradingAuthPrompt: true })
    return false
  }, [openAppKit, openNextRequirement, tradingReady, user])

  const openTradeRequirements = useCallback((options?: {
    forceTradingAuth?: boolean
    onTradingReady?: () => void
  }) => {
    const { onTradingReady, ...requirementOptions } = options ?? {}
    if (onTradingReady) {
      pendingTradingReadyActionRef.current = onTradingReady
    }
    openNextRequirement({
      ...requirementOptions,
      allowTradingAuthPrompt: true,
    })
  }, [openNextRequirement])

  const promptAutoRedeem = useCallback(() => {
    if (!user) {
      void openAppKit()
      return false
    }
    if (status.hasAutoRedeemApproval) {
      return false
    }
    if (!tradingReady) {
      openNextRequirement({ allowTradingAuthPrompt: true })
      return false
    }
    if (!user.deposit_wallet_address) {
      return false
    }

    void ensureAutoRedeemStatusFromChain(user.deposit_wallet_address as `0x${string}`)
      .then((hasAutoRedeemOnChain) => {
        if (hasAutoRedeemOnChain) {
          return
        }

        setDismissedModal(null)
        setAutoRedeemStep('idle')
        setAutoRedeemError(null)
        setShouldContinueTradingAuthPrompt(false)
        setShouldShowFundAfterTradingReady(false)
        setActiveModal('auto-redeem')
      })
      .catch((error) => {
        console.warn('Failed to verify auto-redeem approval before prompting.', error)
        setDismissedModal(null)
        setAutoRedeemStep('idle')
        setAutoRedeemError(null)
        setShouldContinueTradingAuthPrompt(false)
        setShouldShowFundAfterTradingReady(false)
        setActiveModal('auto-redeem')
      })
    return true
  }, [
    ensureAutoRedeemStatusFromChain,
    openAppKit,
    openNextRequirement,
    status.hasAutoRedeemApproval,
    tradingReady,
    user,
  ])

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
    promptAutoRedeem,
    hasDepositWallet: status.hasDeployedDepositWallet,
    sumsubStatus,
    openWalletModal,
  }), [
    ensureTradingReady,
    openTradeRequirements,
    openWalletModal,
    promptAutoRedeem,
    startDepositFlow,
    startWithdrawFlow,
    status.hasDeployedDepositWallet,
    sumsubStatus,
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
      <Suspense fallback={null}>
        <TradingAuthRoutePromptSync />
      </Suspense>

      {children}

      <TradingOnboardingDialogs
        activeModal={activeModal}
        onModalOpenChange={handleModalOpenChange}
        usernameDefaultValue={communityUsernameHintForCurrentUser?.username ?? getUsernameDefaultValue(user)}
        usernameError={usernameError}
        isUsernameSubmitting={isUsernameSubmitting}
        onUsernameSubmit={handleUsernameSubmit}
        emailDefaultValue={hasUsableUserEmail(user?.email) ? user?.email ?? '' : ''}
        emailError={emailError}
        isEmailSubmitting={isEmailSubmitting}
        onEmailSubmit={handleEmailSubmit}
        onEmailSkip={handleEmailSkip}
        sumsubStatus={sumsubStatus}
        onSumsubStatusChange={setSumsubStatus}
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
