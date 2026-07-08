'use client'

/* eslint-disable react/set-state-in-effect -- This hook coordinates a persisted multi-step admin wizard and intentionally syncs state after drafts, assets, signature progress, and derived form inputs change. */
/* eslint-disable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change, react-you-might-not-need-an-effect/no-chain-state-updates, react-you-might-not-need-an-effect/no-derived-state, react-you-might-not-need-an-effect/no-event-handler -- The synchronized effects replace prior render-time state updates and preserve draft/signature recovery behavior. */

import type { ChangeEvent } from 'react'
import type {
  LoadedSignaturePlan,
  PreSignIndicatorState,
  RpcWalletProvider,
} from './admin-create-event-form-signature-helpers'
import type {
  AiValidationIssue,
  CategoryItem,
  CategorySuggestion,
  ContentCheckState,
  EventCreationMode,
  FormState,
  FundingCheckState,
  MainCategory,
  MainTagsApiResponse,
  MarketConfigResponse,
  MarketMode,
  NativeGasCheckState,
  OpenRouterCheckState,
  OptionItem,
  PrepareFinalizeRequestTx,
  PreparePayloadBody,
  PrepareResponse,
  PreSignCheckKey,
  ProposerWhitelistCheckState,
  RecurringOccurrencePreview,
  ResolutionType,
  SignatureExecutionTx,
  SignerOption,
  SlugValidationState,
  TeamLogoFileMap,
} from './admin-create-event-form-types'
import type {
  AdminSportsCustomMarketState,
  AdminSportsFormState,
  AdminSportsPropState,
  AdminSportsSlugCatalog,
  AdminSportsTeamHostStatus,
} from '@/lib/admin-sports-create'
import type { EventCreationDraftRecord } from '@/lib/db/queries/event-creations'
import type { EventCreationAssetPayload, EventCreationRecurrenceUnit } from '@/lib/event-creation'
import { useAppKitAccount, useAppKitNetworkCore, useAppKitProvider } from '@reown/appkit/react'
import {
  Loader2Icon,
} from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createPublicClient, createWalletClient, custom, formatUnits, getAddress, http, isAddress, keccak256, stringToHex } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'

import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { useRouter } from '@/i18n/navigation'
import {
  buildAdminSportsDerivedContent,
  createAdminSportsCustomMarket,
  createAdminSportsProp,
  createInitialAdminSportsForm,
  getAdminSportsMarketTypeDefaultOutcomes,
  getAdminSportsMarketTypeGroups,
  isSportsMainCategory,
  resolveAdminSportsMarketTypeOption,
} from '@/lib/admin-sports-create'
import { formatDateTimeLocalValue, normalizeDateTimeLocalValue } from '@/lib/datetime-local'
import {
  addRecurrenceInterval,
  appendEventCreationSlugSuffix,
  applyEventCreationTemplate,
  buildDefaultDeployAt,
  buildEventCreationTimestampSeed,
  buildEventCreationWalletTail,
  buildImmediateDeployAt,
  buildScheduledRecurringDeployAt,
  hasEventCreationDateTemplateVariable,
  normalizeEventCreationAssetPayload,
  slugifyEventCreationValue as slugify,
  slugifyEventCreationTemplate as slugifyTemplate,
} from '@/lib/event-creation'
import {
  isProposerWhitelistStatusResponse,
  resolveProposerWhitelistAddress,
} from '@/lib/proposer-whitelist'
import { buildSportsSourceDefaultSearchQuery } from '@/lib/sports-source/search-query'
import { sendWithEstimatedFeeRetry } from '@/lib/transaction-fees'
import { defaultViemNetwork, resolveViemNetworkByChainId, resolveViemRpcUrl } from '@/lib/viem-network'
import { useUser } from '@/stores/useUser'
import {
  buildCategorySlugSet,
  mergeCategoryItems,
  removeGeneratedCategoryItems,
} from './admin-create-event-form-category-helpers'
import {
  APPROVE_GAS_UNITS_ESTIMATE,
  CONTENT_CHECK_PROGRESS,
  CONTENT_CHECK_PROGRESS_INTERVAL_MS,
  CONTENT_CHECK_TIMEOUT_MS,
  CREATE_EVENT_SIGNATURE_STORAGE_KEY,
  CUSTOM_SPORTS_SLUG_SELECT_VALUE,
  DEFAULT_CREATE_EVENT_CHAIN_ID,
  EOA_BALANCE_ABI,
  FALLBACK_MAX_FEE_PER_GAS_WEI,
  FALLBACK_REQUIRED_USDC,
  FINALIZE_MAX_ATTEMPTS,
  FINALIZE_POLL_DELAY_MS,
  FINALIZE_POLL_MAX_ATTEMPTS,
  FINALIZE_RETRY_DELAY_MS,
  GAS_ESTIMATE_BUFFER_DENOMINATOR,
  GAS_ESTIMATE_BUFFER_NUMERATOR,
  INITIALIZE_GAS_UNITS_ESTIMATE,
  OPENROUTER_CHECK_TIMEOUT_MS,
  PREPARE_POLL_DELAY_MS,
  PREPARE_POLL_MAX_ATTEMPTS,
  SIGNATURE_COUNTDOWN_INTERVAL_MS,
  SLUG_CHECK_TIMEOUT_MS,
  TOTAL_STEPS,
  USDC_DECIMALS,
} from './admin-create-event-form-constants'
import {
  buildLoadedSignaturePlan,
  buildSignatureExecutionTxs,
  isEmbeddedWalletProvider,
  isFinalizationPendingStatus,
  isRpcWalletProvider,
  isSameAddress,
  resolveChainId,
} from './admin-create-event-form-signature-helpers'
import {
  areCategoryItemsEqual,
  areOptionItemsEqual,
  buildRpcTransactionRequest,
  createInitialForm,
  createOption,
  extractTitleCategorySuggestions,
  fetchAdminApi,
  fetchAdminApiWithTimeout,
  formatSignatureCountdown,
  getAiIssueKey,
  getChainLabel,
  hasRecurringDeploymentHistory,
  isAiRulesResponse,
  isAiValidationResponse,
  isAlreadyInitializedError,
  isBigIntSerializationError,
  isEventCreationRecurrenceUnit,
  isFinalizeResponse,
  isOpenRouterStatusResponse,
  isPendingRequestResponse,
  isPrepareAcceptedResponse,
  isPrepareAuthChallengeResponse,
  isSlugCheckResponse,
  mapSignatureFlowErrorForUser,
  readApiError,
  readResponseBody,
  readResponseErrorMessage,
  resolveStoredAssetFile,
  shortenAddress,
  shouldRetryFinalizeRequest,
} from './admin-create-event-form-utils'
import { buildStepErrors } from './admin-create-event-form-validation'
import { useAllowedCreatorWallets } from './useAllowedCreatorWallets'

const UMA_RESOLUTION_TEMPORARILY_DISABLED = true

interface SportsMatchCandidate {
  provider: string
  eventId: string
  gameId: string | null
  leagueId: string | null
  leagueName: string | null
  leagueSlug: string | null
  sportSlug: string | null
  startTime: string | null
  homeTeam: { name: string, abbreviation?: string | null } | null
  awayTeam: { name: string, abbreviation?: string | null } | null
  score: string | null
  live: boolean | null
  ended: boolean | null
  livestreamUrl: string | null
  confidence: number
  matchReason: string[]
}

function formatSportsSearchDate(value: string | null | undefined) {
  const normalized = value?.trim()
  if (!normalized) {
    return null
  }

  const localDateMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})/)
  if (localDateMatch?.[1]) {
    return localDateMatch[1]
  }

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

function resolveSportsSearchCategory(mainCategorySlug: string) {
  return mainCategorySlug.trim().toLowerCase() === 'esports' ? 'esports' : 'sports'
}

export function useAdminCreateEventForm({
  sportsSlugCatalog,
  creationMode,
  initialDraftRecord,
  draftId,
  initialTitle,
  initialSlug,
  initialEndDateIso,
  allowPastResolutionDate,
  hasConfiguredServerSigners,
  serverDraftPayload,
  serverAssetPayload,
}: {
  sportsSlugCatalog: AdminSportsSlugCatalog
  creationMode: EventCreationMode
  initialDraftRecord: EventCreationDraftRecord | null
  draftId: string | null
  initialTitle: string
  initialSlug: string
  initialEndDateIso: string
  allowPastResolutionDate: boolean
  hasConfiguredServerSigners: boolean
  serverDraftPayload: Record<string, unknown> | null
  serverAssetPayload: EventCreationAssetPayload | null
}) {
  const router = useRouter()
  const appKitAccount = useAppKitAccount({ namespace: 'eip155' })
  const { address: connectedAddress } = appKitAccount
  const { walletProvider, walletProviderType } = useAppKitProvider<RpcWalletProvider>('eip155')
  const { chainId: appKitChainId } = useAppKitNetworkCore()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const { createMarketUrl, polygonRpcUrl } = usePublicRuntimeConfig()
  const viemRpcUrl = useMemo(() => resolveViemRpcUrl(polygonRpcUrl), [polygonRpcUrl])
  const t = useExtracted()
  const user = useUser()
  const normalizedInitialTitle = initialTitle.trim()
  const normalizedInitialSlug = initialSlug.trim()
  const normalizedInitialEndDateIso = normalizeDateTimeLocalValue(initialEndDateIso)
  const initialTitleTemplate = initialDraftRecord?.titleTemplate?.trim() || normalizedInitialTitle
  const initialSlugTemplate = initialDraftRecord?.slugTemplate?.trim() || normalizedInitialSlug
  const initialWalletAddress = initialDraftRecord?.walletAddress ?? ''
  const initialRecurrenceUnit = creationMode === 'recurring'
    ? (initialDraftRecord?.recurrenceUnit ?? '')
    : ''
  const initialRecurrenceInterval = initialDraftRecord?.recurrenceInterval
    ? String(initialDraftRecord.recurrenceInterval)
    : '1'
  const eoaAddress = useMemo(
    () => resolveProposerWhitelistAddress(connectedAddress, user?.address),
    [connectedAddress, user?.address],
  )
  const eoaShortAddress = useMemo(
    () => (eoaAddress ? shortenAddress(eoaAddress) : ''),
    [eoaAddress],
  )
  const isEmbeddedWallet = Boolean(appKitAccount.embeddedWalletInfo)
    || walletProviderType === 'AUTH'
    || isEmbeddedWalletProvider(walletProvider)
  const connectedWalletTransportChainId = resolveChainId(appKitChainId)
  const walletClientMatchesConnectedAddress = Boolean(
    walletClient?.account?.address
    && isSameAddress(walletClient.account.address, eoaAddress),
  )

  const [currentStep, setCurrentStep] = useState(1)
  const [maxVisitedStep, setMaxVisitedStep] = useState(1)
  const [form, setForm] = useState<FormState>(() => createInitialForm({
    title: normalizedInitialTitle,
    slug: normalizedInitialSlug,
    endDateIso: normalizedInitialEndDateIso,
  }))
  const [titleTemplate, setTitleTemplate] = useState(initialTitleTemplate)
  const [slugTemplate, setSlugTemplate] = useState(initialSlugTemplate)
  const [automaticWalletAddress, setAutomaticWalletAddress] = useState(initialWalletAddress)
  const [recurrenceUnit, setRecurrenceUnit] = useState<EventCreationRecurrenceUnit | ''>(initialRecurrenceUnit)
  const [recurrenceInterval, setRecurrenceInterval] = useState(initialRecurrenceInterval)
  const [signers, setSigners] = useState<SignerOption[]>([])
  const [isLoadingSigners, setIsLoadingSigners] = useState(false)
  const [sportsForm, setSportsForm] = useState<AdminSportsFormState>(() => createInitialAdminSportsForm())
  const [sportsMatchQuery, setSportsMatchQuery] = useState('')
  const [sportsMatchCandidates, setSportsMatchCandidates] = useState<SportsMatchCandidate[]>([])
  const [selectedSportsMatch, setSelectedSportsMatch] = useState<SportsMatchCandidate | null>(null)
  const [isSearchingSportsMatches, setIsSearchingSportsMatches] = useState(false)
  const [sportsMatchError, setSportsMatchError] = useState('')
  const sportsMatchSearchControllerRef = useRef<AbortController | null>(null)
  const lastAutoSportsMatchQueryRef = useRef('')
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([])
  const [globalCategories, setGlobalCategories] = useState<CategorySuggestion[]>([])
  const [categoryQuery, setCategoryQuery] = useState('')
  const [eventImageFile, setEventImageFile] = useState<File | null>(null)
  const [teamLogoFiles, setTeamLogoFiles] = useState<TeamLogoFileMap>({
    home: null,
    away: null,
  })
  const [optionImageFiles, setOptionImageFiles] = useState<Record<string, File | null>>({})
  const [storedAssets, setStoredAssets] = useState<EventCreationAssetPayload>(() => normalizeEventCreationAssetPayload(serverAssetPayload))
  const [slugValidationState, setSlugValidationState] = useState<SlugValidationState>('idle')
  const [slugCheckError, setSlugCheckError] = useState('')
  const [resolutionType, setResolutionType] = useState<ResolutionType>('dro_moov2')
  const [resolutionTypeTouched, setResolutionTypeTouched] = useState(false)
  const [requiredRewardUsdc, setRequiredRewardUsdc] = useState(FALLBACK_REQUIRED_USDC)
  const [targetChainId, setTargetChainId] = useState<number>(DEFAULT_CREATE_EVENT_CHAIN_ID)
  const sportsSearchCategory = resolveSportsSearchCategory(form.mainCategorySlug)
  const defaultSportsMatchQuery = useMemo(() => buildSportsSourceDefaultSearchQuery({
    title: form.title,
    teams: sportsForm.teams,
    category: sportsSearchCategory,
    tags: [sportsSearchCategory],
  }), [form.title, sportsForm.teams, sportsSearchCategory])

  useEffect(() => {
    if (sportsSearchCategory !== 'esports' || !defaultSportsMatchQuery) {
      const previousAutoQuery = lastAutoSportsMatchQueryRef.current
      if (previousAutoQuery) {
        setSportsMatchQuery((current) => {
          if (current.trim() === previousAutoQuery) {
            return ''
          }

          return current
        })
        lastAutoSportsMatchQueryRef.current = ''
      }

      return
    }

    setSportsMatchQuery((current) => {
      const normalizedCurrent = current.trim()
      if (normalizedCurrent && normalizedCurrent !== lastAutoSportsMatchQueryRef.current) {
        return current
      }

      lastAutoSportsMatchQueryRef.current = defaultSportsMatchQuery
      return defaultSportsMatchQuery
    })
  }, [defaultSportsMatchQuery, sportsSearchCategory])
  const [eoaUsdcBalance, setEoaUsdcBalance] = useState(0)
  const [fundingCheckState, setFundingCheckState] = useState<FundingCheckState>('idle')
  const [fundingCheckError, setFundingCheckError] = useState('')
  const [eoaPolBalance, setEoaPolBalance] = useState(0)
  const [requiredGasPol, setRequiredGasPol] = useState(0)
  const [nativeGasCheckState, setNativeGasCheckState] = useState<NativeGasCheckState>('idle')
  const [nativeGasCheckError, setNativeGasCheckError] = useState('')
  const [proposerWhitelistCheckState, setProposerWhitelistCheckState] = useState<ProposerWhitelistCheckState>('idle')
  const [proposerWhitelistCheckError, setProposerWhitelistCheckError] = useState('')
  const [openRouterCheckState, setOpenRouterCheckState] = useState<OpenRouterCheckState>('idle')
  const [openRouterCheckError, setOpenRouterCheckError] = useState('')
  const [contentCheckState, setContentCheckState] = useState<ContentCheckState>('idle')
  const [contentCheckIssues, setContentCheckIssues] = useState<AiValidationIssue[]>([])
  const [contentCheckWarnings, setContentCheckWarnings] = useState<AiValidationIssue[]>([])
  const [bypassedIssueKeys, setBypassedIssueKeys] = useState<string[]>([])
  const [contentCheckProgressLine, setContentCheckProgressLine] = useState('')
  const [contentCheckError, setContentCheckError] = useState('')
  const [creatorWalletDialogOpen, setCreatorWalletDialogOpen] = useState(false)
  const [proposersDialogOpen, setProposersDialogOpen] = useState(false)
  const [creatorWalletName, setCreatorWalletName] = useState('')
  const {
    allowedCreatorCheckState,
    allowedCreatorCheckError,
    isAddingCreatorWallet,
    runAllowedCreatorCheck,
    addCurrentWalletToAllowedCreators,
    resetAllowedCreatorCheck,
  } = useAllowedCreatorWallets({
    eoaAddress,
    creatorWalletName,
    setCreatorWalletDialogOpen,
    setCreatorWalletName,
  })
  const [isGeneratingRules, setIsGeneratingRules] = useState(false)
  const [isSigningAuth, setIsSigningAuth] = useState(false)
  const [isPreparingSignaturePlan, setIsPreparingSignaturePlan] = useState(false)
  const [isExecutingSignatures, setIsExecutingSignatures] = useState(false)
  const [isFinalizingSignatureFlow, setIsFinalizingSignatureFlow] = useState(false)
  const [isLoadingPendingRequest, setIsLoadingPendingRequest] = useState(false)
  const [authChallengeExpiresAtMs, setAuthChallengeExpiresAtMs] = useState<number | null>(null)
  const [signatureNowMs, setSignatureNowMs] = useState(0)
  const [signatureFlowDone, setSignatureFlowDone] = useState(false)
  const [signatureFlowError, setSignatureFlowError] = useState('')
  const [pendingWorkflowRequestId, setPendingWorkflowRequestId] = useState<string | null>(null)
  const [pendingWorkflowStatus, setPendingWorkflowStatus] = useState<string | null>(null)
  const [preparedSignaturePlan, setPreparedSignaturePlan] = useState<PrepareResponse | null>(null)
  const [signatureTxs, setSignatureTxs] = useState<SignatureExecutionTx[]>([])
  const resolutionSelectionRef = useRef<{ resolutionType: ResolutionType, touched: boolean }>({
    resolutionType: 'dro_moov2',
    touched: false,
  })
  useEffect(() => {
    resolutionSelectionRef.current = {
      resolutionType,
      touched: resolutionTypeTouched,
    }
  }, [resolutionType, resolutionTypeTouched])
  const handleResolutionTypeChange = useCallback((nextResolutionType: ResolutionType) => {
    if (nextResolutionType === 'uma_moov2' && UMA_RESOLUTION_TEMPORARILY_DISABLED) {
      toast.warning(t('UMA resolution is temporarily unavailable. Direct resolution is currently used for new markets.'))
      return
    }
    if (nextResolutionType === resolutionSelectionRef.current.resolutionType) {
      return
    }

    resolutionSelectionRef.current = {
      resolutionType: nextResolutionType,
      touched: true,
    }
    setResolutionTypeTouched(true)
    setResolutionType(nextResolutionType)
    setFundingCheckState('idle')
    setPreparedSignaturePlan(null)
    setSignatureTxs([])
    setPendingWorkflowRequestId(null)
    setPendingWorkflowStatus(null)
    setSignatureFlowError('')
    setSignatureFlowDone(false)
  }, [t])
  const [expandedPreSignChecks, setExpandedPreSignChecks] = useState<Record<PreSignCheckKey, boolean>>({
    funding: true,
    nativeGas: true,
    allowedCreator: true,
    proposerWhitelist: true,
    slug: true,
    openRouter: true,
    content: true,
  })
  const [rulesGeneratorDialogOpen, setRulesGeneratorDialogOpen] = useState(false)
  const [finalPreviewDialogOpen, setFinalPreviewDialogOpen] = useState(false)
  const [resetFormDialogOpen, setResetFormDialogOpen] = useState(false)
  const [isAddressCopied, setIsAddressCopied] = useState(false)
  const [isBinaryOutcomesEditable, setIsBinaryOutcomesEditable] = useState(false)
  const [areMultiOutcomesEditable, setAreMultiOutcomesEditable] = useState(false)
  const [slugSeed, setSlugSeed] = useState('0')
  const [clientNowMs] = useState(() => Date.now())
  const [previewSiteOrigin] = useState(() => {
    if (typeof window !== 'undefined' && window.location.origin) {
      return window.location.origin
    }

    return 'https://your-site.com'
  })
  const [isCustomSportSlug, setIsCustomSportSlug] = useState(false)
  const [isCustomLeagueSlug, setIsCustomLeagueSlug] = useState(false)

  const copyTimeoutRef = useRef<number | null>(null)
  const draftAutosaveTimeoutRef = useRef<number | null>(null)
  const lastDraftAutosaveFingerprintRef = useRef<string | null>(null)
  const contentCheckProgressRef = useRef<number | null>(null)
  const contentCheckFinishedTimeoutRef = useRef<number | null>(null)
  const lastDraftLoadErrorMessageRef = useRef<string | null>(null)
  const lastPreSignChecksFingerprintRef = useRef<string | null>(null)
  const lastPreSignChecksCompletedRef = useRef(false)
  const lastPreSignChecksResultRef = useRef(false)
  const skipNextSignatureResetRef = useRef(false)
  const pendingResumeKeyRef = useRef<string | null>(null)
  const contentCheckResetFingerprintRef = useRef<string | null>(null)
  const signatureResetFingerprintRef = useRef<string | null>(null)
  const signatureStorageFingerprintRef = useRef<string | null>(null)
  const preSignChecksAutoFingerprintRef = useRef<string | null>(null)
  const serverDraftSyncDepsRef = useRef<{
    creationMode: EventCreationMode
    initialRecurrenceInterval: string
    initialRecurrenceUnit: EventCreationRecurrenceUnit | ''
    initialSlugTemplate: string
    initialTitleTemplate: string
    initialWalletAddress: string
    normalizedInitialEndDateIso: string
    normalizedInitialSlug: string
    normalizedInitialTitle: string
    serverAssetPayload: EventCreationAssetPayload | null
    serverDraftPayload: Record<string, unknown> | null
  } | null>(null)
  const autoSlugFingerprintRef = useRef<string | null>(null)
  const slugResetValueRef = useRef<string | null>(null)
  const eventEndDateInputRef = useRef<HTMLInputElement | null>(null)
  const sportsStartTimeInputRef = useRef<HTMLInputElement | null>(null)
  const sportsGeneratedCategorySlugsRef = useRef<Set<string>>(new Set())

  const eventImagePreviewUrl = useMemo(
    () => (eventImageFile ? URL.createObjectURL(eventImageFile) : (storedAssets.eventImage?.publicUrl || null)),
    [eventImageFile, storedAssets.eventImage?.publicUrl],
  )
  const optionImagePreviewUrls = useMemo(() => {
    const previewUrls: Record<string, string> = Object.fromEntries(
      Object.entries(storedAssets.optionImages).map(([optionId, asset]) => [optionId, asset.publicUrl]),
    )
    Object.entries(optionImageFiles).forEach(([optionId, file]) => {
      if (file) {
        previewUrls[optionId] = URL.createObjectURL(file)
      }
    })
    return previewUrls
  }, [optionImageFiles, storedAssets.optionImages])
  const teamLogoPreviewUrls = useMemo(() => ({
    home: teamLogoFiles.home ? URL.createObjectURL(teamLogoFiles.home) : (storedAssets.teamLogos.home?.publicUrl || null),
    away: teamLogoFiles.away ? URL.createObjectURL(teamLogoFiles.away) : (storedAssets.teamLogos.away?.publicUrl || null),
  }), [storedAssets.teamLogos.away?.publicUrl, storedAssets.teamLogos.home?.publicUrl, teamLogoFiles])
  const hasEventImage = Boolean(eventImageFile || storedAssets.eventImage?.publicUrl)
  const hasTeamLogoByHostStatus = useMemo(() => ({
    home: Boolean(teamLogoFiles.home || storedAssets.teamLogos.home?.publicUrl),
    away: Boolean(teamLogoFiles.away || storedAssets.teamLogos.away?.publicUrl),
  }), [storedAssets.teamLogos.away?.publicUrl, storedAssets.teamLogos.home?.publicUrl, teamLogoFiles.away, teamLogoFiles.home])

  const selectedMainCategory = useMemo(
    () => mainCategories.find(category => category.slug === form.mainCategorySlug) ?? null,
    [form.mainCategorySlug, mainCategories],
  )
  const isSportsEvent = useMemo(
    () => isSportsMainCategory(form.mainCategorySlug),
    [form.mainCategorySlug],
  )
  const sportsMarketTypeGroups = useMemo(
    () => getAdminSportsMarketTypeGroups(sportsForm.section === 'props' ? 'props' : 'games'),
    [sportsForm.section],
  )
  const normalizedSportSlug = useMemo(
    () => slugify(sportsForm.sportSlug),
    [sportsForm.sportSlug],
  )
  const availableLeagueOptions = useMemo(() => {
    if (normalizedSportSlug) {
      const matchingOptions = sportsSlugCatalog.leagueOptionsBySport[normalizedSportSlug]
      if (Array.isArray(matchingOptions) && matchingOptions.length > 0) {
        return matchingOptions
      }
    }

    return sportsSlugCatalog.allLeagueOptions
  }, [normalizedSportSlug, sportsSlugCatalog.allLeagueOptions, sportsSlugCatalog.leagueOptionsBySport])
  const normalizedLeagueSlug = useMemo(
    () => slugify(sportsForm.leagueSlug),
    [sportsForm.leagueSlug],
  )
  const isKnownSportSlug = useMemo(
    () => sportsSlugCatalog.sportOptions.some(option => option.value === normalizedSportSlug),
    [normalizedSportSlug, sportsSlugCatalog.sportOptions],
  )
  const isKnownLeagueSlug = useMemo(
    () => availableLeagueOptions.some(option => option.value === normalizedLeagueSlug),
    [availableLeagueOptions, normalizedLeagueSlug],
  )
  const sportSlugSelectValue = useMemo(() => {
    if (isCustomSportSlug) {
      return CUSTOM_SPORTS_SLUG_SELECT_VALUE
    }

    return isKnownSportSlug ? normalizedSportSlug : undefined
  }, [isCustomSportSlug, isKnownSportSlug, normalizedSportSlug])
  const leagueSlugSelectValue = useMemo(() => {
    if (isCustomLeagueSlug) {
      return CUSTOM_SPORTS_SLUG_SELECT_VALUE
    }

    return isKnownLeagueSlug ? normalizedLeagueSlug : undefined
  }, [isCustomLeagueSlug, isKnownLeagueSlug, normalizedLeagueSlug])
  const selectedCreatorAddress = useMemo(() => {
    const candidate = automaticWalletAddress.trim() || eoaAddress || ''
    if (!candidate || !isAddress(candidate)) {
      return null
    }
    return getAddress(candidate)
  }, [automaticWalletAddress, eoaAddress])
  const slugWalletAddress = useMemo(
    () => selectedCreatorAddress ?? '',
    [selectedCreatorAddress],
  )
  const creatorSlugTail = useMemo(
    () => buildEventCreationWalletTail(slugWalletAddress),
    [slugWalletAddress],
  )
  const slugSuffix = useMemo(
    () => `${slugSeed}${creatorSlugTail}`,
    [creatorSlugTail, slugSeed],
  )
  const baseEventSlug = useMemo(
    () => {
      const base = slugify(form.title)
      return appendEventCreationSlugSuffix(base, slugSuffix)
    },
    [form.title, slugSuffix],
  )
  const sportsDerivedContent = useMemo(
    () => buildAdminSportsDerivedContent({
      baseSlug: baseEventSlug,
      sports: sportsForm,
    }),
    [baseEventSlug, sportsForm],
  )

  useEffect(function syncCustomSportsSlugFlags() {
    if (sportsForm.sportSlug.trim()) {
      const nextCustomSportSlug = !isKnownSportSlug
      if (nextCustomSportSlug !== isCustomSportSlug) {
        setIsCustomSportSlug(nextCustomSportSlug)
      }
    }

    if (sportsForm.leagueSlug.trim()) {
      const nextCustomLeagueSlug = !isKnownLeagueSlug
      if (nextCustomLeagueSlug !== isCustomLeagueSlug) {
        setIsCustomLeagueSlug(nextCustomLeagueSlug)
      }
    }
  }, [
    isCustomLeagueSlug,
    isCustomSportSlug,
    isKnownLeagueSlug,
    isKnownSportSlug,
    sportsForm.leagueSlug,
    sportsForm.sportSlug,
  ])
  const marketCount = useMemo(() => {
    if (form.marketMode === 'binary') {
      return 1
    }

    if (form.marketMode === 'multi_multiple' || form.marketMode === 'multi_unique') {
      return Math.max(1, form.options.length)
    }

    return 1
  }, [form.marketMode, form.options.length])
  const requiredTotalRewardUsdc = useMemo(
    () => requiredRewardUsdc * marketCount,
    [marketCount, requiredRewardUsdc],
  )
  const preSignChecksFingerprint = useMemo(() => JSON.stringify({
    eoaAddress: eoaAddress?.toLowerCase() ?? '',
    creationMode,
    creator: selectedCreatorAddress?.toLowerCase() ?? '',
    recurrenceUnit,
    recurrenceInterval,
    targetChainId,
    marketCount,
    form: {
      title: form.title.trim(),
      slug: form.slug.trim().toLowerCase(),
      endDateIso: form.endDateIso.trim(),
      mainCategorySlug: form.mainCategorySlug.trim().toLowerCase(),
      categories: form.categories.map(category => ({
        label: category.label.trim(),
        slug: category.slug.trim().toLowerCase(),
      })),
      marketMode: form.marketMode ?? '',
      binaryQuestion: form.binaryQuestion.trim(),
      binaryOutcomeYes: form.binaryOutcomeYes.trim(),
      binaryOutcomeNo: form.binaryOutcomeNo.trim(),
      options: form.options.map(option => ({
        id: option.id,
        question: option.question.trim(),
        title: option.title.trim(),
        shortName: option.shortName.trim(),
        slug: option.slug.trim().toLowerCase(),
        outcomeYes: option.outcomeYes.trim(),
        outcomeNo: option.outcomeNo.trim(),
      })),
      sports: sportsDerivedContent.payload,
      resolutionSource: form.resolutionSource.trim(),
      resolutionRules: form.resolutionRules.trim(),
    },
  }), [
    creationMode,
    eoaAddress,
    form,
    marketCount,
    recurrenceInterval,
    recurrenceUnit,
    selectedCreatorAddress,
    sportsDerivedContent.payload,
    targetChainId,
  ])
  const optionQuestionPlaceholder = useMemo(
    () => form.marketMode === 'multi_unique'
      ? 'Example: Will Gavin Newsom win the 2028 U.S. presidential election?'
      : 'Example: Will BTC close above $120k on Dec 31, 2028?',
    [form.marketMode],
  )
  const optionNamePlaceholder = useMemo(
    () => form.marketMode === 'multi_unique'
      ? 'Example: Gavin Newsom'
      : 'Example: BTC above $120k by Dec 31, 2028',
    [form.marketMode],
  )
  const optionShortNamePlaceholder = useMemo(
    () => form.marketMode === 'multi_unique'
      ? 'Example: Newsom'
      : 'Example: 120k',
    [form.marketMode],
  )
  const titleCategorySuggestions = useMemo(
    () => extractTitleCategorySuggestions(form.title),
    [form.title],
  )

  const categorySuggestionsPool = useMemo(() => {
    const source = selectedMainCategory?.childs?.length
      ? selectedMainCategory.childs
      : globalCategories

    const sourceHead = source.slice(0, 4)
    const sourceTail = source.slice(4)
    const ordered = [...sourceHead, ...titleCategorySuggestions, ...sourceTail]

    const bySlug = new Map<string, CategorySuggestion>()
    ordered.forEach((item) => {
      if (!bySlug.has(item.slug)) {
        bySlug.set(item.slug, item)
      }
    })

    return Array.from(bySlug.values())
  }, [globalCategories, selectedMainCategory, titleCategorySuggestions])

  const filteredCategorySuggestions = useMemo(() => {
    const query = categoryQuery.trim().toLowerCase()
    const selectedSlugs = new Set(form.categories.map(category => category.slug))

    return categorySuggestionsPool
      .filter((item) => {
        if (selectedSlugs.has(item.slug)) {
          return false
        }

        if (!query) {
          return true
        }

        return item.name.toLowerCase().includes(query) || item.slug.toLowerCase().includes(query)
      })
      .slice(0, 10)
  }, [categoryQuery, categorySuggestionsPool, form.categories])

  const selectedCategoryChips = useMemo(() => {
    const chips = [...form.categories]
    if (!selectedMainCategory) {
      return chips
    }

    const exists = chips.some(category => category.slug === selectedMainCategory.slug)
    if (!exists) {
      return [{ label: selectedMainCategory.name, slug: selectedMainCategory.slug }, ...chips]
    }

    return chips
  }, [form.categories, selectedMainCategory])
  const sportsGeneratedCategorySlugs = useMemo(
    () => buildCategorySlugSet(sportsDerivedContent.categories),
    [sportsDerivedContent.categories],
  )
  const sportsCustomCategoryChips = useMemo(
    () => removeGeneratedCategoryItems(form.categories, sportsGeneratedCategorySlugs),
    [form.categories, sportsGeneratedCategorySlugs],
  )
  const scheduleDateValue = useMemo(
    () => normalizeDateTimeLocalValue(form.endDateIso),
    [form.endDateIso],
  )
  const scheduleOccurrenceDate = useMemo(() => {
    if (!scheduleDateValue) {
      return null
    }

    const parsed = new Date(scheduleDateValue)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }, [scheduleDateValue])
  const recurrenceIntervalNumber = useMemo(
    () => Math.max(1, Number.parseInt(recurrenceInterval || '1', 10) || 1),
    [recurrenceInterval],
  )
  const hasRecurringDeployHistory = useMemo(
    () => creationMode === 'recurring' && hasRecurringDeploymentHistory(initialDraftRecord),
    [creationMode, initialDraftRecord],
  )
  const automaticDeployAtIso = useMemo(() => {
    if (!scheduleOccurrenceDate) {
      return null
    }

    if (creationMode !== 'recurring') {
      return buildDefaultDeployAt(scheduleOccurrenceDate)?.toISOString() ?? null
    }

    if (!hasRecurringDeployHistory) {
      return buildImmediateDeployAt(clientNowMs)?.toISOString() ?? null
    }

    return buildScheduledRecurringDeployAt(
      scheduleOccurrenceDate,
      recurrenceUnit || null,
      recurrenceIntervalNumber,
    )?.toISOString() ?? null
  }, [clientNowMs, creationMode, hasRecurringDeployHistory, recurrenceIntervalNumber, recurrenceUnit, scheduleOccurrenceDate])
  const automaticDeployAtDate = useMemo(() => {
    if (!automaticDeployAtIso) {
      return null
    }

    const parsed = new Date(automaticDeployAtIso)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }, [automaticDeployAtIso])
  const nextRecurringResolutionDate = useMemo(() => {
    if (creationMode !== 'recurring' || !scheduleOccurrenceDate || !recurrenceUnit) {
      return null
    }

    return addRecurrenceInterval(scheduleOccurrenceDate, recurrenceUnit, recurrenceIntervalNumber)
  }, [creationMode, recurrenceIntervalNumber, recurrenceUnit, scheduleOccurrenceDate])
  const nextRecurringDeployDate = useMemo(() => {
    if (!nextRecurringResolutionDate || !recurrenceUnit) {
      return null
    }

    return buildScheduledRecurringDeployAt(nextRecurringResolutionDate, recurrenceUnit, recurrenceIntervalNumber)
  }, [nextRecurringResolutionDate, recurrenceIntervalNumber, recurrenceUnit])
  const recurringResolvedTitle = useMemo(() => {
    if (creationMode !== 'recurring') {
      return ''
    }

    const baseTemplate = titleTemplate.trim()
    if (!baseTemplate) {
      return ''
    }

    if (!scheduleOccurrenceDate) {
      return baseTemplate
    }

    return applyEventCreationTemplate(baseTemplate, scheduleOccurrenceDate, baseTemplate).trim() || baseTemplate
  }, [creationMode, scheduleOccurrenceDate, titleTemplate])
  const derivedRecurringSlugTemplate = useMemo(() => {
    if (creationMode !== 'recurring') {
      return ''
    }

    return slugifyTemplate(titleTemplate)
  }, [creationMode, titleTemplate])
  const recurringSlugSuffix = useMemo(() => {
    if (creationMode !== 'recurring') {
      return ''
    }

    const timestampSeed = scheduleOccurrenceDate
      ? buildEventCreationTimestampSeed(scheduleOccurrenceDate)
      : slugSeed

    return `${timestampSeed}${creatorSlugTail}`
  }, [creationMode, creatorSlugTail, scheduleOccurrenceDate, slugSeed])
  const effectiveRecurringSlugTemplate = useMemo(() => {
    if (creationMode !== 'recurring') {
      return ''
    }

    return slugTemplate.trim() || derivedRecurringSlugTemplate
  }, [creationMode, derivedRecurringSlugTemplate, slugTemplate])
  const recurringResolvedSlug = useMemo(() => {
    if (creationMode !== 'recurring') {
      return ''
    }

    const baseTemplate = effectiveRecurringSlugTemplate
      || slugify(recurringResolvedTitle)
    if (!baseTemplate) {
      return ''
    }

    const rawSlug = scheduleOccurrenceDate
      ? applyEventCreationTemplate(baseTemplate, scheduleOccurrenceDate, baseTemplate)
      : baseTemplate

    if (!scheduleOccurrenceDate) {
      return appendEventCreationSlugSuffix(baseTemplate, recurringSlugSuffix)
    }

    return appendEventCreationSlugSuffix(slugify(rawSlug || baseTemplate), recurringSlugSuffix)
  }, [creationMode, effectiveRecurringSlugTemplate, recurringResolvedTitle, recurringSlugSuffix, scheduleOccurrenceDate])
  const recurringResolvedRules = useMemo(() => {
    if (creationMode !== 'recurring') {
      return ''
    }

    const baseTemplate = form.resolutionRules.trim()
    if (!baseTemplate) {
      return ''
    }

    if (!scheduleOccurrenceDate) {
      return baseTemplate
    }

    return applyEventCreationTemplate(baseTemplate, scheduleOccurrenceDate, baseTemplate).trim() || baseTemplate
  }, [creationMode, form.resolutionRules, scheduleOccurrenceDate])
  const effectiveResolutionRules = useMemo(
    () => creationMode === 'recurring'
      ? (recurringResolvedRules || form.resolutionRules.trim())
      : form.resolutionRules.trim(),
    [creationMode, form.resolutionRules, recurringResolvedRules],
  )
  const buildRecurringOccurrencePreview = useCallback((date: Date | null): RecurringOccurrencePreview | null => {
    if (creationMode !== 'recurring' || !date) {
      return null
    }

    const rawTitleTemplate = titleTemplate.trim()
    const resolvedTitle = applyEventCreationTemplate(rawTitleTemplate, date, rawTitleTemplate).trim()
      || rawTitleTemplate
      || form.title.trim()

    const rawSlugTemplate = (effectiveRecurringSlugTemplate || slugify(resolvedTitle)).trim()
    const resolvedBaseSlug = slugify(applyEventCreationTemplate(rawSlugTemplate, date, rawSlugTemplate) || rawSlugTemplate)
    const suffix = `${buildEventCreationTimestampSeed(date)}${creatorSlugTail}`
    const resolvedSlug = appendEventCreationSlugSuffix(resolvedBaseSlug, suffix)
    const rawRulesTemplate = form.resolutionRules.trim()
    const resolvedRules = applyEventCreationTemplate(rawRulesTemplate, date, rawRulesTemplate).trim() || rawRulesTemplate

    return {
      endDateIso: date.toISOString(),
      title: resolvedTitle,
      slug: resolvedSlug,
      resolutionRules: resolvedRules,
    }
  }, [creationMode, creatorSlugTail, effectiveRecurringSlugTemplate, form.resolutionRules, form.title, titleTemplate])
  const recurringOccurrencePreviews = useMemo(
    () => creationMode === 'recurring'
      ? [buildRecurringOccurrencePreview(scheduleOccurrenceDate), buildRecurringOccurrencePreview(nextRecurringResolutionDate)].filter(Boolean) as RecurringOccurrencePreview[]
      : [],
    [buildRecurringOccurrencePreview, creationMode, nextRecurringResolutionDate, scheduleOccurrenceDate],
  )
  const recurringPreviewErrors = useMemo(() => {
    if (creationMode !== 'recurring') {
      return [] as string[]
    }

    const errors: string[] = []
    const [currentPreview, nextPreview] = recurringOccurrencePreviews

    if (scheduleOccurrenceDate && !currentPreview?.slug) {
      errors.push('Recurring slug preview is invalid.')
    }

    if (scheduleOccurrenceDate && !currentPreview?.title) {
      errors.push('Recurring title preview is invalid.')
    }

    if (scheduleOccurrenceDate && !currentPreview?.resolutionRules) {
      errors.push('Recurring resolution rules preview is invalid.')
    }

    if (currentPreview && nextPreview && currentPreview.slug === nextPreview.slug) {
      errors.push('Recurring slug preview must change between occurrences.')
    }

    return errors
  }, [creationMode, recurringOccurrencePreviews, scheduleOccurrenceDate])
  const recurringEditorialWarnings = useMemo(() => {
    if (creationMode !== 'recurring') {
      return [] as string[]
    }

    const warnings = new Set<string>()
    const [currentPreview, nextPreview] = recurringOccurrencePreviews

    if (titleTemplate.trim() && !hasEventCreationDateTemplateVariable(titleTemplate)) {
      warnings.add('Title template has no date variable, so recurring event titles may look identical between occurrences.')
    }

    if (form.resolutionRules.trim() && !hasEventCreationDateTemplateVariable(form.resolutionRules)) {
      warnings.add('Resolution rules have no date variable, so recurring rules may look identical between occurrences.')
    }

    if (currentPreview && nextPreview && currentPreview.title.trim().toLowerCase() === nextPreview.title.trim().toLowerCase()) {
      warnings.add('First and next recurring title previews are identical.')
    }

    if (currentPreview && nextPreview && currentPreview.resolutionRules.trim().toLowerCase() === nextPreview.resolutionRules.trim().toLowerCase()) {
      warnings.add('First and next recurring resolution rules previews are identical.')
    }

    return Array.from(warnings)
  }, [creationMode, form.resolutionRules, recurringOccurrencePreviews, titleTemplate])
  const recurringRequiresServerWalletSetup = creationMode === 'recurring' && !hasConfiguredServerSigners

  const stepLabels = useMemo(
    () => ['Event', 'Market Structure', 'Resolution', 'Pre-sign', 'Sign & Create'],
    [],
  )
  const previewEndDate = useMemo(() => {
    const normalizedEndDate = normalizeDateTimeLocalValue(form.endDateIso)
    if (!normalizedEndDate) {
      return 'Resolution date not set'
    }
    const parsed = new Date(normalizedEndDate)
    if (Number.isNaN(parsed.getTime())) {
      return normalizedEndDate
    }
    return parsed.toLocaleString()
  }, [form.endDateIso])
  const previewTitle = useMemo(
    () => creationMode === 'recurring'
      ? (recurringResolvedTitle || titleTemplate.trim() || 'Untitled event')
      : (form.title || 'Untitled event'),
    [creationMode, form.title, recurringResolvedTitle, titleTemplate],
  )
  const previewSlug = useMemo(
    () => creationMode === 'recurring'
      ? (recurringResolvedSlug || effectiveRecurringSlugTemplate || 'event-slug')
      : (form.slug || 'event-slug'),
    [creationMode, effectiveRecurringSlugTemplate, form.slug, recurringResolvedSlug],
  )
  const previewMarkets = useMemo(() => {
    if (form.marketMode === 'binary') {
      return [
        {
          key: 'binary',
          title: previewTitle.trim(),
          question: (previewTitle || form.binaryQuestion).trim(),
          shortName: '',
          outcomeYes: form.binaryOutcomeYes.trim() || 'Yes',
          outcomeNo: form.binaryOutcomeNo.trim() || 'No',
          imageUrl: eventImagePreviewUrl,
        },
      ]
    }

    if (form.marketMode === 'multi_multiple' || form.marketMode === 'multi_unique') {
      return form.options.map((option, index) => ({
        key: option.id || `option-${index + 1}`,
        title: option.title.trim(),
        question: option.question.trim(),
        shortName: option.shortName.trim(),
        outcomeYes: option.outcomeYes.trim() || 'Yes',
        outcomeNo: option.outcomeNo.trim() || 'No',
        imageUrl: optionImagePreviewUrls[option.id] ?? null,
      }))
    }

    return []
  }, [
    eventImagePreviewUrl,
    form.binaryOutcomeNo,
    form.binaryOutcomeYes,
    form.binaryQuestion,
    form.marketMode,
    form.options,
    optionImagePreviewUrls,
    previewTitle,
  ])
  const tradePreviewMarket = useMemo(
    () => previewMarkets[0] ?? null,
    [previewMarkets],
  )
  const previewEventUrl = useMemo(
    () => `${previewSiteOrigin}/event/${previewSlug}`,
    [previewSiteOrigin, previewSlug],
  )
  const isMultiMarketPreview = form.marketMode === 'multi_multiple' || form.marketMode === 'multi_unique'

  const pendingAiIssues = useMemo(
    () => contentCheckIssues.filter(issue => !bypassedIssueKeys.includes(getAiIssueKey(issue))),
    [bypassedIssueKeys, contentCheckIssues],
  )
  const fundingHasIssue = fundingCheckState === 'insufficient' || fundingCheckState === 'no_wallet' || fundingCheckState === 'error'
  const nativeGasHasIssue = nativeGasCheckState === 'insufficient'
    || nativeGasCheckState === 'no_wallet'
    || nativeGasCheckState === 'error'
  const allowedCreatorHasIssue = allowedCreatorCheckState === 'missing'
    || allowedCreatorCheckState === 'no_wallet'
    || allowedCreatorCheckState === 'error'
  const proposerWhitelistHasIssue = proposerWhitelistCheckState === 'missing'
    || proposerWhitelistCheckState === 'no_wallet'
    || proposerWhitelistCheckState === 'error'
  const slugHasIssue = slugValidationState === 'duplicate' || slugValidationState === 'error'
  const openRouterHasIssue = openRouterCheckState === 'error'
  const contentIndicatorState = useMemo<PreSignIndicatorState>(() => {
    if (openRouterCheckState === 'error') {
      return 'error'
    }
    if (openRouterCheckState === 'checking' || contentCheckState === 'checking') {
      return 'checking'
    }
    if (openRouterCheckState === 'idle' || contentCheckState === 'idle') {
      return 'idle'
    }
    if (contentCheckError || pendingAiIssues.length > 0 || contentCheckState === 'error') {
      return 'error'
    }
    return 'ok'
  }, [contentCheckError, contentCheckState, openRouterCheckState, pendingAiIssues.length])
  const contentHasIssue = contentIndicatorState === 'error'
  const completedSignatureCount = useMemo(
    () => signatureTxs.filter(item => item.status === 'success').length,
    [signatureTxs],
  )
  const finalizeInProgressAccepted = pendingWorkflowStatus === 'finalize_in_progress'
  const finalizeStepSucceeded = signatureFlowDone || finalizeInProgressAccepted
  const finalizeStepIsRunning = isFinalizingSignatureFlow || pendingWorkflowStatus === 'finalize_running'
  const finalizeStepHasError = !finalizeStepSucceeded
    && Boolean(signatureFlowError)
    && completedSignatureCount === signatureTxs.length
    && signatureTxs.length > 0
  const authPhaseCompleted = Boolean(preparedSignaturePlan)
  const totalSignatureUnits = useMemo(
    () => (preparedSignaturePlan ? signatureTxs.length + 2 : 2),
    [preparedSignaturePlan, signatureTxs.length],
  )
  const completedSignatureUnits = useMemo(
    () => {
      let completed = authPhaseCompleted ? 1 : 0
      completed += completedSignatureCount
      if (finalizeStepSucceeded) {
        completed += 1
      }
      return completed
    },
    [authPhaseCompleted, completedSignatureCount, finalizeStepSucceeded],
  )
  const signatureProgressPercent = useMemo(() => {
    if (totalSignatureUnits <= 0) {
      return 0
    }
    return Math.min(100, Math.round((completedSignatureUnits / totalSignatureUnits) * 100))
  }, [completedSignatureUnits, totalSignatureUnits])
  const authChallengeRemainingSeconds = useMemo(() => {
    if (!authChallengeExpiresAtMs || signatureNowMs <= 0) {
      return null
    }
    return Math.max(0, Math.floor((authChallengeExpiresAtMs - signatureNowMs) / 1000))
  }, [authChallengeExpiresAtMs, signatureNowMs])
  const authChallengeCountdownLabel = useMemo(() => {
    if (authChallengeRemainingSeconds === null) {
      return ''
    }
    return formatSignatureCountdown(authChallengeRemainingSeconds)
  }, [authChallengeRemainingSeconds])

  const readNormalizedDateTimeInputValue = useCallback((input: HTMLInputElement | null, fallbackValue: string) => {
    const rawInputValue = input?.value?.trim() ?? ''
    const inputValue = normalizeDateTimeLocalValue(rawInputValue)
    if (inputValue) {
      return inputValue
    }

    const inputDate = input?.valueAsDate
    if (inputDate instanceof Date && !Number.isNaN(inputDate.getTime())) {
      return formatDateTimeLocalValue(inputDate)
    }

    const normalizedFallbackValue = normalizeDateTimeLocalValue(fallbackValue)
    if (normalizedFallbackValue) {
      return normalizedFallbackValue
    }

    return rawInputValue || fallbackValue.trim()
  }, [])

  const getResolvedDateForms = useCallback(() => {
    const resolvedEndDateIso = readNormalizedDateTimeInputValue(eventEndDateInputRef.current, form.endDateIso)
    const resolvedSportsStartTime = readNormalizedDateTimeInputValue(sportsStartTimeInputRef.current, sportsForm.startTime)

    return {
      resolvedForm: {
        ...form,
        endDateIso: resolvedEndDateIso,
      },
      resolvedSportsForm: {
        ...sportsForm,
        startTime: resolvedSportsStartTime,
      },
    }
  }, [form, readNormalizedDateTimeInputValue, sportsForm])

  const syncResolvedDateInputs = useCallback(() => {
    const { resolvedForm, resolvedSportsForm } = getResolvedDateForms()

    if (resolvedForm.endDateIso && resolvedForm.endDateIso !== form.endDateIso) {
      setForm(prev => (prev.endDateIso === resolvedForm.endDateIso
        ? prev
        : {
            ...prev,
            endDateIso: resolvedForm.endDateIso,
          }))
    }

    if (resolvedSportsForm.startTime && resolvedSportsForm.startTime !== sportsForm.startTime) {
      setSportsForm(prev => (prev.startTime === resolvedSportsForm.startTime
        ? prev
        : {
            ...prev,
            startTime: resolvedSportsForm.startTime,
          }))
    }

    return { resolvedForm, resolvedSportsForm }
  }, [form.endDateIso, getResolvedDateForms, sportsForm.startTime])

  const isStepValid = useCallback((step: number) => {
    const { resolvedForm, resolvedSportsForm } = getResolvedDateForms()

    return buildStepErrors(step, {
      form: resolvedForm,
      creationMode,
      sportsForm: resolvedSportsForm,
      hasEventImage,
      hasTeamLogoByHostStatus,
      slugValidationState,
      fundingCheckState,
      nativeGasCheckState,
      allowedCreatorCheckState,
      proposerWhitelistCheckState,
      openRouterCheckState,
      contentCheckState,
      hasPendingAiErrors: pendingAiIssues.length > 0,
      hasContentCheckFatalError: Boolean(contentCheckError),
      allowPastResolutionDate,
      hasCreatorSelection: creationMode !== 'recurring' || Boolean(automaticWalletAddress.trim()),
      hasRecurringCadence: creationMode !== 'recurring' || Boolean(recurrenceUnit),
      recurringPreviewErrors,
    }).length === 0
  }, [
    automaticWalletAddress,
    creationMode,
    allowedCreatorCheckState,
    allowPastResolutionDate,
    contentCheckState,
    getResolvedDateForms,
    fundingCheckState,
    hasEventImage,
    hasTeamLogoByHostStatus,
    nativeGasCheckState,
    contentCheckError,
    openRouterCheckState,
    pendingAiIssues.length,
    proposerWhitelistCheckState,
    recurrenceUnit,
    recurringPreviewErrors,
    slugValidationState,
  ])

  const clickableStepMap = useMemo(() => {
    const map: Record<number, boolean> = {}

    for (let step = 1; step <= TOTAL_STEPS; step += 1) {
      if (step === currentStep) {
        map[step] = true
        continue
      }

      if (step > maxVisitedStep) {
        map[step] = false
        continue
      }

      let prerequisitesValid = true
      for (let index = 1; index < step; index += 1) {
        if (!isStepValid(index)) {
          prerequisitesValid = false
          break
        }
      }

      map[step] = prerequisitesValid
    }

    return map
  }, [currentStep, isStepValid, maxVisitedStep])

  useEffect(function revokeEventImagePreviewObjectUrl() {
    if (!eventImagePreviewUrl || !eventImagePreviewUrl.startsWith('blob:')) {
      return
    }

    return function cleanupEventImagePreviewObjectUrl() {
      URL.revokeObjectURL(eventImagePreviewUrl)
    }
  }, [eventImagePreviewUrl])

  useEffect(function revokeOptionImagePreviewObjectUrls() {
    return function cleanupOptionImagePreviewObjectUrls() {
      Object.values(optionImagePreviewUrls).forEach((url) => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url)
        }
      })
    }
  }, [optionImagePreviewUrls])

  useEffect(function revokeTeamLogoPreviewObjectUrls() {
    return function cleanupTeamLogoPreviewObjectUrls() {
      Object.values(teamLogoPreviewUrls).forEach((url) => {
        if (url?.startsWith('blob:')) {
          URL.revokeObjectURL(url)
        }
      })
    }
  }, [teamLogoPreviewUrls])

  useEffect(function cleanupPendingTimersOnUnmount() {
    return function clearPendingTimers() {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current)
      }

      if (contentCheckProgressRef.current !== null) {
        window.clearInterval(contentCheckProgressRef.current)
      }

      if (contentCheckFinishedTimeoutRef.current !== null) {
        window.clearTimeout(contentCheckFinishedTimeoutRef.current)
      }
    }
  }, [])

  useEffect(function runAuthChallengeCountdown() {
    if (!authChallengeExpiresAtMs) {
      return
    }

    const timer = window.setInterval(function tickSignatureCountdownNow() {
      setSignatureNowMs(Date.now())
    }, SIGNATURE_COUNTDOWN_INTERVAL_MS)

    return function clearAuthChallengeCountdownTimer() {
      window.clearInterval(timer)
    }
  }, [authChallengeExpiresAtMs])

  useEffect(function closeFinalPreviewWhenLeavingPreSignStep() {
    if (currentStep !== 4 && finalPreviewDialogOpen) {
      setFinalPreviewDialogOpen(false)
    }
  }, [currentStep, finalPreviewDialogOpen])

  const contentCheckResetFingerprint = useMemo(() => JSON.stringify({
    automaticWalletAddress,
    creationMode,
    title: form.title,
    slug: form.slug,
    endDateIso: form.endDateIso,
    mainCategorySlug: form.mainCategorySlug,
    categories: form.categories,
    marketMode: form.marketMode,
    binaryQuestion: form.binaryQuestion,
    binaryOutcomeYes: form.binaryOutcomeYes,
    binaryOutcomeNo: form.binaryOutcomeNo,
    options: form.options,
    resolutionSource: form.resolutionSource,
    resolutionRules: form.resolutionRules,
    recurrenceInterval,
    recurrenceUnit,
    slugTemplate,
    titleTemplate,
  }), [
    automaticWalletAddress,
    creationMode,
    form.title,
    form.slug,
    form.endDateIso,
    form.mainCategorySlug,
    form.categories,
    form.marketMode,
    form.binaryQuestion,
    form.binaryOutcomeYes,
    form.binaryOutcomeNo,
    form.options,
    form.resolutionSource,
    form.resolutionRules,
    recurrenceInterval,
    recurrenceUnit,
    slugTemplate,
    titleTemplate,
  ])

  useEffect(function resetContentChecksWhenPayloadChanges() {
    if (contentCheckResetFingerprintRef.current === null) {
      contentCheckResetFingerprintRef.current = contentCheckResetFingerprint
      return
    }
    if (contentCheckResetFingerprintRef.current === contentCheckResetFingerprint) {
      return
    }

    contentCheckResetFingerprintRef.current = contentCheckResetFingerprint
    setContentCheckState('idle')
    setContentCheckIssues([])
    setContentCheckWarnings([])
    setBypassedIssueKeys([])
    setContentCheckError('')
    setContentCheckProgressLine('')
  }, [contentCheckResetFingerprint])

  const signatureResetFingerprint = useMemo(() => JSON.stringify({
    eoaAddress,
    eventImageFileName: eventImageFile?.name ?? '',
    optionImageKeys: Object.keys(optionImageFiles).sort(),
    form,
    targetChainId,
  }), [
    eoaAddress,
    eventImageFile,
    optionImageFiles,
    form,
    targetChainId,
  ])

  useEffect(function resetSignatureFlowWhenPayloadChanges() {
    if (signatureResetFingerprintRef.current === null) {
      signatureResetFingerprintRef.current = signatureResetFingerprint
      return
    }
    if (signatureResetFingerprintRef.current === signatureResetFingerprint) {
      return
    }

    signatureResetFingerprintRef.current = signatureResetFingerprint
    if (skipNextSignatureResetRef.current) {
      skipNextSignatureResetRef.current = false
      return
    }

    setIsSigningAuth(false)
    setIsPreparingSignaturePlan(false)
    setIsExecutingSignatures(false)
    setIsFinalizingSignatureFlow(false)
    setAuthChallengeExpiresAtMs(null)
    setPreparedSignaturePlan(null)
    setSignatureTxs([])
    setSignatureFlowDone(false)
    setSignatureFlowError('')
  }, [signatureResetFingerprint])

  const preSignChecksAutoFingerprint = useMemo(() => JSON.stringify({
    allowedCreatorCheckState,
    allowedCreatorHasIssue,
    contentHasIssue,
    contentIndicatorState,
    fundingCheckState,
    fundingHasIssue,
    nativeGasCheckState,
    nativeGasHasIssue,
    openRouterCheckState,
    openRouterHasIssue,
    proposerWhitelistCheckState,
    proposerWhitelistHasIssue,
    slugHasIssue,
    slugValidationState,
  }), [
    allowedCreatorCheckState,
    allowedCreatorHasIssue,
    contentHasIssue,
    contentIndicatorState,
    fundingCheckState,
    fundingHasIssue,
    nativeGasCheckState,
    nativeGasHasIssue,
    openRouterCheckState,
    openRouterHasIssue,
    proposerWhitelistCheckState,
    proposerWhitelistHasIssue,
    slugHasIssue,
    slugValidationState,
  ])

  useEffect(function syncExpandedPreSignChecks() {
    if (preSignChecksAutoFingerprintRef.current === null) {
      preSignChecksAutoFingerprintRef.current = preSignChecksAutoFingerprint
      return
    }
    if (preSignChecksAutoFingerprintRef.current === preSignChecksAutoFingerprint) {
      return
    }

    preSignChecksAutoFingerprintRef.current = preSignChecksAutoFingerprint
    setExpandedPreSignChecks((previous) => {
      const next = { ...previous }
      let changed = false

      function apply(key: PreSignCheckKey, hasIssue: boolean, resolved: boolean) {
        let desired = previous[key]
        if (hasIssue) {
          desired = true
        }
        else if (resolved) {
          desired = false
        }

        if (desired !== previous[key]) {
          next[key] = desired
          changed = true
        }
      }

      apply('funding', fundingHasIssue, fundingCheckState === 'ok')
      apply('nativeGas', nativeGasHasIssue, nativeGasCheckState === 'ok')
      apply('allowedCreator', allowedCreatorHasIssue, allowedCreatorCheckState === 'ok')
      apply('proposerWhitelist', proposerWhitelistHasIssue, proposerWhitelistCheckState === 'ok')
      apply('slug', slugHasIssue, slugValidationState === 'unique')
      apply('openRouter', openRouterHasIssue, openRouterCheckState === 'ok')
      apply('content', contentHasIssue, contentIndicatorState === 'ok')

      return changed ? next : previous
    })
  }, [
    allowedCreatorCheckState,
    allowedCreatorHasIssue,
    contentHasIssue,
    contentIndicatorState,
    fundingCheckState,
    fundingHasIssue,
    nativeGasCheckState,
    nativeGasHasIssue,
    openRouterCheckState,
    openRouterHasIssue,
    preSignChecksAutoFingerprint,
    proposerWhitelistCheckState,
    proposerWhitelistHasIssue,
    slugHasIssue,
    slugValidationState,
  ])

  useEffect(function loadMainCategoriesOnMount() {
    async function loadMainCategories() {
      try {
        const response = await fetchAdminApi('/main-tags')
        if (!response.ok) {
          throw new Error(`Failed to load categories (${response.status})`)
        }

        const payload: MainTagsApiResponse = await response.json()
        setMainCategories(payload.mainCategories ?? [])
        setGlobalCategories(payload.globalCategories ?? [])
      }
      catch (error) {
        console.error('Error loading categories:', error)
        toast.error('Could not load categories.')
      }
    }

    void loadMainCategories()
  }, [])

  useEffect(function loadSignerWalletsOnMount() {
    async function loadSignerWallets() {
      try {
        setIsLoadingSigners(true)
        const response = await fetchAdminApi('/event-creations/signers', {
          method: 'GET',
          cache: 'no-store',
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(typeof payload?.error === 'string' ? payload.error : 'Could not load server wallets.')
        }

        const payload = await response.json().catch(() => null) as { data?: SignerOption[] } | null
        setSigners(Array.isArray(payload?.data) ? payload.data : [])
      }
      catch (error) {
        console.error('Failed to load event creation signers', error)
        toast.error(error instanceof Error ? error.message : 'Could not load server wallets.')
      }
      finally {
        setIsLoadingSigners(false)
      }
    }

    void loadSignerWallets()
  }, [])

  useEffect(function selectOnlyAvailableSignerWhenNeeded() {
    if (!automaticWalletAddress && signers.length === 1 && (creationMode === 'recurring' || !eoaAddress)) {
      setAutomaticWalletAddress(signers[0]!.address)
    }
  }, [automaticWalletAddress, creationMode, eoaAddress, signers])

  const initialSlugSeed = Math.floor(clientNowMs / 1000).toString()

  useEffect(function syncServerDraftPayload() {
    const previous = serverDraftSyncDepsRef.current
    const shouldSyncServerDraft = !previous
      || previous.creationMode !== creationMode
      || previous.initialRecurrenceInterval !== initialRecurrenceInterval
      || previous.initialRecurrenceUnit !== initialRecurrenceUnit
      || previous.initialSlugTemplate !== initialSlugTemplate
      || previous.initialTitleTemplate !== initialTitleTemplate
      || previous.initialWalletAddress !== initialWalletAddress
      || previous.normalizedInitialEndDateIso !== normalizedInitialEndDateIso
      || previous.normalizedInitialSlug !== normalizedInitialSlug
      || previous.normalizedInitialTitle !== normalizedInitialTitle
      || previous.serverAssetPayload !== serverAssetPayload
      || previous.serverDraftPayload !== serverDraftPayload

    if (!shouldSyncServerDraft) {
      return
    }

    serverDraftSyncDepsRef.current = {
      creationMode,
      initialRecurrenceInterval,
      initialRecurrenceUnit,
      initialSlugTemplate,
      initialTitleTemplate,
      initialWalletAddress,
      normalizedInitialEndDateIso,
      normalizedInitialSlug,
      normalizedInitialTitle,
      serverAssetPayload,
      serverDraftPayload,
    }

    const source = serverDraftPayload

    if (!source) {
      setSlugSeed(initialSlugSeed)
      setStoredAssets(normalizeEventCreationAssetPayload(serverAssetPayload))
    }
    else {
      try {
        const parsed = (typeof source === 'string' ? JSON.parse(source) : source) as {
          form?: Partial<FormState>
          sportsForm?: Partial<AdminSportsFormState>
          titleTemplate?: unknown
          slugTemplate?: unknown
          walletAddress?: unknown
          recurrenceUnit?: unknown
          recurrenceInterval?: unknown
          currentStep?: number
          maxVisitedStep?: number
          slugSeed?: string
          isBinaryOutcomesEditable?: boolean
          areMultiOutcomesEditable?: boolean
        }
        setStoredAssets(normalizeEventCreationAssetPayload(serverAssetPayload))

        setSlugSeed(
          typeof parsed.slugSeed === 'string' && parsed.slugSeed.trim()
            ? parsed.slugSeed.trim()
            : initialSlugSeed,
        )
        setTitleTemplate(typeof parsed.titleTemplate === 'string' ? parsed.titleTemplate : initialTitleTemplate)
        setSlugTemplate(typeof parsed.slugTemplate === 'string' ? parsed.slugTemplate : initialSlugTemplate)
        setAutomaticWalletAddress(typeof parsed.walletAddress === 'string' ? parsed.walletAddress : initialWalletAddress)
        setRecurrenceUnit(isEventCreationRecurrenceUnit(parsed.recurrenceUnit) ? parsed.recurrenceUnit : initialRecurrenceUnit)
        setRecurrenceInterval(
          typeof parsed.recurrenceInterval === 'string' && parsed.recurrenceInterval.trim()
            ? parsed.recurrenceInterval.replace(/\D/g, '') || '1'
            : typeof parsed.recurrenceInterval === 'number' && Number.isFinite(parsed.recurrenceInterval)
              ? String(Math.max(1, Math.floor(parsed.recurrenceInterval)))
              : initialRecurrenceInterval,
        )

        if (parsed.form && typeof parsed.form === 'object') {
          const fallback = createInitialForm({
            title: normalizedInitialTitle,
            slug: normalizedInitialSlug,
            endDateIso: normalizedInitialEndDateIso,
          })
          const parsedOptions = Array.isArray(parsed.form.options)
            ? parsed.form.options
                .map((item, optionIndex) => {
                  if (!item || typeof item !== 'object') {
                    return null
                  }
                  const candidate = item as Partial<OptionItem>
                  return {
                    id: typeof candidate.id === 'string' && candidate.id.trim()
                      ? candidate.id
                      : `opt-loaded-${optionIndex + 1}`,
                    question: typeof candidate.question === 'string' ? candidate.question : '',
                    title: typeof candidate.title === 'string' ? candidate.title : '',
                    shortName: typeof candidate.shortName === 'string' ? candidate.shortName : '',
                    slug: typeof candidate.slug === 'string' ? candidate.slug : '',
                    outcomeYes: typeof candidate.outcomeYes === 'string' && candidate.outcomeYes.trim()
                      ? candidate.outcomeYes
                      : 'Yes',
                    outcomeNo: typeof candidate.outcomeNo === 'string' && candidate.outcomeNo.trim()
                      ? candidate.outcomeNo
                      : 'No',
                  } satisfies OptionItem
                })
                .filter((item): item is OptionItem => Boolean(item))
            : []

          setForm({
            title: typeof parsed.form.title === 'string' ? parsed.form.title : fallback.title,
            slug: typeof parsed.form.slug === 'string' ? parsed.form.slug : fallback.slug,
            endDateIso: creationMode === 'recurring' && normalizedInitialEndDateIso
              ? normalizedInitialEndDateIso
              : typeof parsed.form.endDateIso === 'string'
                ? normalizeDateTimeLocalValue(parsed.form.endDateIso)
                : fallback.endDateIso,
            mainCategorySlug: typeof parsed.form.mainCategorySlug === 'string' ? parsed.form.mainCategorySlug : fallback.mainCategorySlug,
            categories: Array.isArray(parsed.form.categories)
              ? parsed.form.categories
                  .map((item) => {
                    if (!item || typeof item !== 'object') {
                      return null
                    }
                    const category = item as Partial<CategoryItem>
                    const label = typeof category.label === 'string' ? category.label.trim() : ''
                    const slug = typeof category.slug === 'string' ? category.slug.trim() : ''
                    if (!label || !slug) {
                      return null
                    }
                    return { label, slug } satisfies CategoryItem
                  })
                  .filter((item): item is CategoryItem => Boolean(item))
              : fallback.categories,
            marketMode: parsed.form.marketMode === 'binary'
              || parsed.form.marketMode === 'multi_multiple'
              || parsed.form.marketMode === 'multi_unique'
              ? parsed.form.marketMode
              : fallback.marketMode,
            binaryQuestion: typeof parsed.form.binaryQuestion === 'string' ? parsed.form.binaryQuestion : fallback.binaryQuestion,
            binaryOutcomeYes: typeof parsed.form.binaryOutcomeYes === 'string' && parsed.form.binaryOutcomeYes.trim()
              ? parsed.form.binaryOutcomeYes
              : fallback.binaryOutcomeYes,
            binaryOutcomeNo: typeof parsed.form.binaryOutcomeNo === 'string' && parsed.form.binaryOutcomeNo.trim()
              ? parsed.form.binaryOutcomeNo
              : fallback.binaryOutcomeNo,
            options: parsedOptions.length > 0 ? parsedOptions : fallback.options,
            resolutionSource: typeof parsed.form.resolutionSource === 'string' ? parsed.form.resolutionSource : fallback.resolutionSource,
            resolutionRules: typeof parsed.form.resolutionRules === 'string' ? parsed.form.resolutionRules : fallback.resolutionRules,
          })
        }

        if (parsed.sportsForm && typeof parsed.sportsForm === 'object') {
          const fallbackSports = createInitialAdminSportsForm()
          const candidateTeams = Array.isArray(parsed.sportsForm.teams)
            ? parsed.sportsForm.teams
                .map((team, index) => {
                  if (!team || typeof team !== 'object') {
                    return null
                  }

                  const item = team as Partial<AdminSportsFormState['teams'][number]>
                  const hostStatus = index === 0 ? 'home' : 'away'
                  return {
                    hostStatus,
                    name: typeof item.name === 'string' ? item.name : '',
                    abbreviation: typeof item.abbreviation === 'string' ? item.abbreviation : '',
                  }
                })
                .filter((item): item is AdminSportsFormState['teams'][number] => Boolean(item))
            : []
          const candidateProps = Array.isArray(parsed.sportsForm.props)
            ? parsed.sportsForm.props
                .map((prop, index) => {
                  if (!prop || typeof prop !== 'object') {
                    return null
                  }

                  const item = prop as Partial<AdminSportsPropState>
                  return {
                    id: typeof item.id === 'string' && item.id.trim() ? item.id : `prop-loaded-${index + 1}`,
                    playerName: typeof item.playerName === 'string' ? item.playerName : '',
                    statType: item.statType === 'points'
                      || item.statType === 'rebounds'
                      || item.statType === 'assists'
                      || item.statType === 'receiving_yards'
                      || item.statType === 'rushing_yards'
                      ? item.statType
                      : '',
                    line: typeof item.line === 'string' ? item.line : '',
                    teamHostStatus: item.teamHostStatus === 'home' || item.teamHostStatus === 'away'
                      ? item.teamHostStatus
                      : '',
                  } satisfies AdminSportsPropState
                })
                .filter((item): item is AdminSportsPropState => Boolean(item))
            : []
          const candidateCustomMarkets = Array.isArray(parsed.sportsForm.customMarkets)
            ? parsed.sportsForm.customMarkets
                .map((market, index) => {
                  if (!market || typeof market !== 'object') {
                    return null
                  }

                  const item = market as Partial<AdminSportsCustomMarketState>
                  return {
                    id: typeof item.id === 'string' && item.id.trim() ? item.id : `market-loaded-${index + 1}`,
                    sportsMarketType: typeof item.sportsMarketType === 'string' ? item.sportsMarketType : '',
                    question: typeof item.question === 'string' ? item.question : '',
                    title: typeof item.title === 'string' ? item.title : '',
                    shortName: typeof item.shortName === 'string' ? item.shortName : '',
                    slug: typeof item.slug === 'string' ? item.slug : '',
                    outcomeOne: typeof item.outcomeOne === 'string' ? item.outcomeOne : '',
                    outcomeTwo: typeof item.outcomeTwo === 'string' ? item.outcomeTwo : '',
                    line: typeof item.line === 'string' ? item.line : '',
                    groupItemTitle: typeof item.groupItemTitle === 'string' ? item.groupItemTitle : '',
                    iconAssetKey: item.iconAssetKey === 'home' || item.iconAssetKey === 'away'
                      ? item.iconAssetKey
                      : '',
                  } satisfies AdminSportsCustomMarketState
                })
                .filter((item): item is AdminSportsCustomMarketState => Boolean(item))
            : []

          setSportsForm({
            section: parsed.sportsForm.section === 'games' || parsed.sportsForm.section === 'props'
              ? parsed.sportsForm.section
              : fallbackSports.section,
            eventVariant: parsed.sportsForm.eventVariant === 'standard'
              || parsed.sportsForm.eventVariant === 'more_markets'
              || parsed.sportsForm.eventVariant === 'exact_score'
              || parsed.sportsForm.eventVariant === 'halftime_result'
              || parsed.sportsForm.eventVariant === 'custom'
              ? parsed.sportsForm.eventVariant
              : fallbackSports.eventVariant,
            sportSlug: typeof parsed.sportsForm.sportSlug === 'string' ? parsed.sportsForm.sportSlug : fallbackSports.sportSlug,
            leagueSlug: typeof parsed.sportsForm.leagueSlug === 'string' ? parsed.sportsForm.leagueSlug : fallbackSports.leagueSlug,
            startTime: typeof parsed.sportsForm.startTime === 'string'
              ? normalizeDateTimeLocalValue(parsed.sportsForm.startTime)
              : fallbackSports.startTime,
            sourceProvider: typeof parsed.sportsForm.sourceProvider === 'string' ? parsed.sportsForm.sourceProvider : fallbackSports.sourceProvider,
            sourceEventId: typeof parsed.sportsForm.sourceEventId === 'string' ? parsed.sportsForm.sourceEventId : fallbackSports.sourceEventId,
            sourceGameId: typeof parsed.sportsForm.sourceGameId === 'string' ? parsed.sportsForm.sourceGameId : fallbackSports.sourceGameId,
            sourceLeagueId: typeof parsed.sportsForm.sourceLeagueId === 'string' ? parsed.sportsForm.sourceLeagueId : fallbackSports.sourceLeagueId,
            sourceLeagueLabel: typeof parsed.sportsForm.sourceLeagueLabel === 'string' ? parsed.sportsForm.sourceLeagueLabel : fallbackSports.sourceLeagueLabel,
            sourceMatchConfidence: typeof parsed.sportsForm.sourceMatchConfidence === 'string' ? parsed.sportsForm.sourceMatchConfidence : fallbackSports.sourceMatchConfidence,
            livestreamUrl: typeof parsed.sportsForm.livestreamUrl === 'string' ? parsed.sportsForm.livestreamUrl : fallbackSports.livestreamUrl,
            includeDraw: Boolean(parsed.sportsForm.includeDraw),
            includeBothTeamsToScore: parsed.sportsForm.includeBothTeamsToScore !== false,
            includeSpreads: parsed.sportsForm.includeSpreads !== false,
            includeTotals: parsed.sportsForm.includeTotals !== false,
            teams: candidateTeams.length === 2
              ? [candidateTeams[0], candidateTeams[1]]
              : fallbackSports.teams,
            props: candidateProps.length > 0 ? candidateProps : fallbackSports.props,
            customMarkets: candidateCustomMarkets.length > 0 ? candidateCustomMarkets : fallbackSports.customMarkets,
          })
        }

        const parsedCurrentStep = Number(parsed.currentStep ?? 1)
        const parsedMaxVisitedStep = Number(parsed.maxVisitedStep ?? 1)
        const nextCurrentStep = Number.isFinite(parsedCurrentStep)
          ? Math.min(TOTAL_STEPS, Math.max(1, Math.floor(parsedCurrentStep)))
          : 1
        const nextMaxVisitedStep = Number.isFinite(parsedMaxVisitedStep)
          ? Math.min(TOTAL_STEPS, Math.max(nextCurrentStep, Math.floor(parsedMaxVisitedStep)))
          : nextCurrentStep

        setCurrentStep(nextCurrentStep)
        setMaxVisitedStep(nextMaxVisitedStep)
        setIsBinaryOutcomesEditable(Boolean(parsed.isBinaryOutcomesEditable))
        setAreMultiOutcomesEditable(Boolean(parsed.areMultiOutcomesEditable))
      }
      catch (error) {
        const draftLoadErrorMessage = error instanceof Error && error.message.trim()
          ? error.message.trim()
          : 'The saved draft could not be parsed.'
        if (lastDraftLoadErrorMessageRef.current !== draftLoadErrorMessage) {
          lastDraftLoadErrorMessageRef.current = draftLoadErrorMessage
          toast.error('Failed to load saved draft.', {
            id: 'admin-create-event-draft-load-error',
            description: draftLoadErrorMessage,
          })
        }
        setSlugSeed(initialSlugSeed)
      }
    }
  }, [
    creationMode,
    initialRecurrenceInterval,
    initialRecurrenceUnit,
    initialSlugSeed,
    initialSlugTemplate,
    initialTitleTemplate,
    initialWalletAddress,
    normalizedInitialEndDateIso,
    normalizedInitialSlug,
    normalizedInitialTitle,
    serverAssetPayload,
    serverDraftPayload,
  ])

  useEffect(function autosaveDraftPayload() {
    if (!draftId || typeof window === 'undefined') {
      return
    }

    const endDateValue = normalizeDateTimeLocalValue(form.endDateIso)
    const draftPayload = {
      form,
      sportsForm,
      titleTemplate,
      slugTemplate,
      walletAddress: automaticWalletAddress,
      recurrenceUnit,
      recurrenceInterval,
      currentStep,
      maxVisitedStep,
      slugSeed,
      isBinaryOutcomesEditable,
      areMultiOutcomesEditable,
    }
    const canScheduleAutomatically = Boolean(automaticWalletAddress.trim())
      && Boolean(endDateValue)
      && isStepValid(1)
      && isStepValid(2)
      && isStepValid(3)
      && (creationMode !== 'recurring' || Boolean(recurrenceUnit))
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim() || null,
      titleTemplate: creationMode === 'recurring' ? titleTemplate.trim() || null : null,
      slugTemplate: creationMode === 'recurring' ? effectiveRecurringSlugTemplate || null : null,
      startAt: endDateValue ? new Date(endDateValue).toISOString() : null,
      deployAt: automaticDeployAtIso,
      walletAddress: automaticWalletAddress.trim() || null,
      status: canScheduleAutomatically ? 'scheduled' : 'draft',
      recurrenceUnit: creationMode === 'recurring' ? recurrenceUnit || null : null,
      recurrenceInterval: creationMode === 'recurring' && recurrenceUnit
        ? Math.max(1, Number.parseInt(recurrenceInterval || '1', 10) || 1)
        : null,
      recurrenceUntil: null,
      endDate: endDateValue ? new Date(endDateValue).toISOString() : null,
      mainCategorySlug: form.mainCategorySlug.trim() || null,
      categorySlugs: form.categories
        .map(item => item.slug.trim().toLowerCase())
        .filter(Boolean),
      marketMode: form.marketMode ?? null,
      binaryQuestion: form.binaryQuestion.trim() || null,
      binaryOutcomeYes: form.binaryOutcomeYes.trim() || null,
      binaryOutcomeNo: form.binaryOutcomeNo.trim() || null,
      resolutionSource: form.resolutionSource.trim() || null,
      resolutionRules: form.resolutionRules.trim() || null,
      draftPayload,
    }
    const fingerprint = JSON.stringify(payload)
    if (lastDraftAutosaveFingerprintRef.current === fingerprint) {
      return
    }

    if (draftAutosaveTimeoutRef.current !== null) {
      window.clearTimeout(draftAutosaveTimeoutRef.current)
    }

    draftAutosaveTimeoutRef.current = window.setTimeout(() => {
      void fetchAdminApi(`/event-creations/${draftId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
        .then(async (response) => {
          if (!response.ok) {
            const responsePayload = await response.json().catch(() => ({}))
            throw new Error(typeof responsePayload?.error === 'string' ? responsePayload.error : `Draft save failed (${response.status})`)
          }
          lastDraftAutosaveFingerprintRef.current = fingerprint
        })
        .catch((error) => {
          console.error('Error autosaving draft payload:', error)
        })
    }, 800)

    return function clearDraftAutosaveTimeout() {
      if (draftAutosaveTimeoutRef.current !== null) {
        window.clearTimeout(draftAutosaveTimeoutRef.current)
        draftAutosaveTimeoutRef.current = null
      }
    }
  }, [
    areMultiOutcomesEditable,
    currentStep,
    draftId,
    form,
    isBinaryOutcomesEditable,
    isStepValid,
    maxVisitedStep,
    automaticDeployAtIso,
    automaticWalletAddress,
    creationMode,
    recurrenceInterval,
    recurrenceUnit,
    slugSeed,
    slugTemplate,
    sportsForm,
    effectiveRecurringSlugTemplate,
    titleTemplate,
  ])

  const signatureStorageFingerprint = useMemo(() => JSON.stringify({
    preparedSignaturePlan,
    signatureTxs,
    signatureFlowDone,
    signatureFlowError,
    authChallengeExpiresAtMs,
  }), [authChallengeExpiresAtMs, preparedSignaturePlan, signatureFlowDone, signatureFlowError, signatureTxs])

  useEffect(function persistSignatureStorageFingerprint() {
    if (signatureStorageFingerprintRef.current === signatureStorageFingerprint) {
      return
    }

    signatureStorageFingerprintRef.current = signatureStorageFingerprint
    if (typeof window === 'undefined') {
      return
    }

    if (!preparedSignaturePlan) {
      window.localStorage.removeItem(CREATE_EVENT_SIGNATURE_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(CREATE_EVENT_SIGNATURE_STORAGE_KEY, signatureStorageFingerprint)
  }, [preparedSignaturePlan, signatureStorageFingerprint])

  useEffect(function syncRecurringResolvedFormFields() {
    if (creationMode !== 'recurring' || isSportsEvent) {
      return
    }

    const nextTitle = recurringResolvedTitle
    const nextSlug = recurringResolvedSlug
    if (form.title === nextTitle && form.slug === nextSlug) {
      return
    }

    setForm(previous => ({
      ...previous,
      title: nextTitle,
      slug: nextSlug,
    }))
  }, [creationMode, form.slug, form.title, isSportsEvent, recurringResolvedSlug, recurringResolvedTitle])

  useEffect(function syncSportsDerivedFormFields() {
    if (!isSportsEvent) {
      if (sportsGeneratedCategorySlugsRef.current.size > 0) {
        sportsGeneratedCategorySlugsRef.current = new Set()
      }
      return
    }

    const previousGeneratedCategorySlugs = sportsGeneratedCategorySlugsRef.current
    const mergedSportsCategories = mergeCategoryItems(
      sportsDerivedContent.categories,
      removeGeneratedCategoryItems(form.categories, previousGeneratedCategorySlugs),
    )
    const shouldSyncSportsDerivedForm = form.slug !== sportsDerivedContent.eventSlug
      || form.marketMode !== 'multi_multiple'
      || !areCategoryItemsEqual(form.categories, mergedSportsCategories)
      || !areOptionItemsEqual(form.options, sportsDerivedContent.options)
      || form.binaryQuestion !== ''
      || form.binaryOutcomeYes !== 'Yes'
      || form.binaryOutcomeNo !== 'No'

    if (shouldSyncSportsDerivedForm) {
      setForm(prev => ({
        ...prev,
        slug: sportsDerivedContent.eventSlug,
        marketMode: 'multi_multiple',
        categories: mergeCategoryItems(
          sportsDerivedContent.categories,
          removeGeneratedCategoryItems(prev.categories, previousGeneratedCategorySlugs),
        ),
        options: sportsDerivedContent.options,
        binaryQuestion: '',
        binaryOutcomeYes: 'Yes',
        binaryOutcomeNo: 'No',
      }))
    }

    if (Object.keys(optionImageFiles).length > 0) {
      setOptionImageFiles({})
    }

    if (sportsGeneratedCategorySlugsRef.current !== sportsGeneratedCategorySlugs) {
      sportsGeneratedCategorySlugsRef.current = sportsGeneratedCategorySlugs
    }
  }, [
    form.binaryOutcomeNo,
    form.binaryOutcomeYes,
    form.binaryQuestion,
    form.categories,
    form.marketMode,
    form.options,
    form.slug,
    isSportsEvent,
    optionImageFiles,
    sportsDerivedContent.categories,
    sportsDerivedContent.eventSlug,
    sportsDerivedContent.options,
    sportsGeneratedCategorySlugs,
  ])

  const autoSlugFingerprint = `${creationMode}:${isSportsEvent ? 'sports' : 'default'}:${slugSuffix}:${sportsDerivedContent.eventSlug}:${form.title}`
  useEffect(function syncAutoSlug() {
    if (autoSlugFingerprintRef.current === null) {
      autoSlugFingerprintRef.current = autoSlugFingerprint
      return
    }
    if (autoSlugFingerprintRef.current === autoSlugFingerprint) {
      return
    }

    autoSlugFingerprintRef.current = autoSlugFingerprint
    if (creationMode === 'recurring' || isSportsEvent) {
      return
    }

    const nextSlug = form.title.trim()
      ? appendEventCreationSlugSuffix(slugify(form.title), slugSuffix)
      : ''
    setForm(prev => (prev.slug === nextSlug
      ? prev
      : {
          ...prev,
          slug: nextSlug,
        }))
  }, [autoSlugFingerprint, creationMode, form.title, isSportsEvent, slugSuffix])

  useEffect(function resetSlugValidationWhenSlugChanges() {
    if (slugResetValueRef.current === null) {
      slugResetValueRef.current = form.slug
      return
    }
    if (slugResetValueRef.current === form.slug) {
      return
    }

    slugResetValueRef.current = form.slug
    if (slugValidationState !== 'idle') {
      setSlugValidationState('idle')
    }
    if (slugCheckError) {
      setSlugCheckError('')
    }
  }, [form.slug, slugCheckError, slugValidationState])

  useEffect(function syncBinaryMarketFields() {
    if (form.marketMode !== 'binary') {
      return
    }

    const nextBinaryQuestion = form.title
    const nextOutcomeYes = form.binaryOutcomeYes.trim() ? form.binaryOutcomeYes : 'Yes'
    const nextOutcomeNo = form.binaryOutcomeNo.trim() ? form.binaryOutcomeNo : 'No'
    if (
      form.binaryQuestion === nextBinaryQuestion
      && form.binaryOutcomeYes === nextOutcomeYes
      && form.binaryOutcomeNo === nextOutcomeNo
    ) {
      return
    }

    setForm(previous => ({
      ...previous,
      binaryQuestion: nextBinaryQuestion,
      binaryOutcomeYes: nextOutcomeYes,
      binaryOutcomeNo: nextOutcomeNo,
    }))
  }, [form.binaryOutcomeNo, form.binaryOutcomeYes, form.binaryQuestion, form.marketMode, form.title])

  const showFirstError = useCallback((errors: string[]) => {
    if (errors.length > 0) {
      toast.error(errors[0])
    }
  }, [])

  const handleSportsFieldChange = useCallback(
    <K extends keyof AdminSportsFormState>(field: K, value: AdminSportsFormState[K]) => {
      setSportsForm((prev) => {
        if (field === 'startTime') {
          return {
            ...prev,
            startTime: normalizeDateTimeLocalValue(typeof value === 'string' ? value : ''),
          }
        }

        if (field === 'section') {
          if (value === 'props') {
            return {
              ...prev,
              section: value,
              eventVariant: 'standard',
            }
          }

          if (value === 'games') {
            return {
              ...prev,
              section: value,
              eventVariant: '',
            }
          }
        }

        return {
          ...prev,
          [field]: value,
        }
      })
    },
    [],
  )

  const handleSportsTeamChange = useCallback((
    hostStatus: AdminSportsTeamHostStatus,
    field: 'name' | 'abbreviation',
    value: string,
  ) => {
    setSportsForm(prev => ({
      ...prev,
      teams: prev.teams.map(team => team.hostStatus === hostStatus
        ? {
            ...team,
            [field]: value,
          }
        : team) as AdminSportsFormState['teams'],
    }))
  }, [])

  const applySportsMatchCandidate = useCallback((candidate: SportsMatchCandidate) => {
    setSelectedSportsMatch(candidate)
    setSportsForm((prev) => {
      const nextStartTime = candidate.startTime
        ? formatDateTimeLocalValue(new Date(candidate.startTime))
        : prev.startTime

      return {
        ...prev,
        section: prev.section || 'games',
        sportSlug: candidate.sportSlug || prev.sportSlug,
        leagueSlug: candidate.leagueSlug || prev.leagueSlug,
        startTime: nextStartTime,
        sourceProvider: candidate.provider,
        sourceEventId: candidate.eventId,
        sourceGameId: candidate.gameId ?? '',
        sourceLeagueId: candidate.leagueId ?? '',
        sourceLeagueLabel: candidate.leagueName ?? '',
        sourceMatchConfidence: String(candidate.confidence ?? ''),
        livestreamUrl: candidate.livestreamUrl ?? prev.livestreamUrl,
        teams: [
          {
            ...prev.teams[0],
            name: candidate.homeTeam?.name || prev.teams[0].name,
            abbreviation: candidate.homeTeam?.abbreviation || prev.teams[0].abbreviation,
          },
          {
            ...prev.teams[1],
            name: candidate.awayTeam?.name || prev.teams[1].name,
            abbreviation: candidate.awayTeam?.abbreviation || prev.teams[1].abbreviation,
          },
        ],
      }
    })
  }, [])

  const clearSportsMatchCandidate = useCallback(() => {
    setSelectedSportsMatch(null)
    setSportsForm(prev => ({
      ...prev,
      sourceProvider: '',
      sourceEventId: '',
      sourceGameId: '',
      sourceLeagueId: '',
      sourceLeagueLabel: '',
      sourceMatchConfidence: '',
      livestreamUrl: '',
    }))
  }, [])

  const searchSportsMatches = useCallback(async () => {
    const query = sportsMatchQuery.trim() || defaultSportsMatchQuery || form.title.trim()
    if (!query) {
      setSportsMatchError(t('Enter a match search first.'))
      return
    }

    sportsMatchSearchControllerRef.current?.abort()
    const controller = new AbortController()
    sportsMatchSearchControllerRef.current = controller

    try {
      setIsSearchingSportsMatches(true)
      setSportsMatchError('')
      const params = new URLSearchParams()
      params.set('q', query)
      params.set('limit', '8')
      params.set('category', sportsSearchCategory)
      if (sportsForm.sportSlug.trim()) {
        params.set('sport', sportsForm.sportSlug.trim())
      }
      if (sportsForm.leagueSlug.trim()) {
        params.set('league', sportsForm.leagueSlug.trim())
      }
      const derivedEventDate = buildAdminSportsDerivedContent({
        baseSlug: baseEventSlug,
        sports: sportsForm,
      }).payload?.eventDate
      const eventDate = derivedEventDate ?? formatSportsSearchDate(form.endDateIso)
      if (eventDate) {
        params.set('date', eventDate)
      }

      const response = await fetchAdminApi(`/sports/events/search?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      })
      if (sportsMatchSearchControllerRef.current !== controller) {
        return
      }
      if (!response.ok) {
        const { payload, text } = await readResponseBody(response)
        setSportsMatchError(readResponseErrorMessage(payload, text) || t('Could not search sports matches.'))
        return
      }

      const payload = await response.json().catch(() => null) as { candidates?: SportsMatchCandidate[] } | null
      if (sportsMatchSearchControllerRef.current !== controller) {
        return
      }
      setSportsMatchCandidates(Array.isArray(payload?.candidates) ? payload.candidates : [])
    }
    catch (error) {
      if (controller.signal.aborted) {
        return
      }
      console.error('Failed to search sports matches', error)
      setSportsMatchError(t('Could not search sports matches.'))
    }
    finally {
      if (sportsMatchSearchControllerRef.current === controller) {
        sportsMatchSearchControllerRef.current = null
        setIsSearchingSportsMatches(false)
      }
    }
  }, [baseEventSlug, defaultSportsMatchQuery, form.endDateIso, form.title, sportsForm, sportsMatchQuery, sportsSearchCategory, t])

  function handleSportsTeamLogoUpload(hostStatus: AdminSportsTeamHostStatus, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setTeamLogoFiles(prev => ({
      ...prev,
      [hostStatus]: file,
    }))
    if (file) {
      void uploadDraftAsset('teamLogo', hostStatus, file).catch((error) => {
        console.error('Error uploading team logo:', error)
        toast.error(error instanceof Error ? error.message : 'Could not save team logo.')
      })
    }
  }

  const handleSportsPropChange = useCallback((
    propId: string,
    field: keyof AdminSportsPropState,
    value: string,
  ) => {
    setSportsForm(prev => ({
      ...prev,
      props: prev.props.map(prop => prop.id === propId
        ? {
            ...prop,
            [field]: value,
          }
        : prop),
    }))
  }, [])

  const handleSportSlugSelectChange = useCallback((value: string) => {
    if (value === CUSTOM_SPORTS_SLUG_SELECT_VALUE) {
      setIsCustomSportSlug(true)
      handleSportsFieldChange('sportSlug', '')
      return
    }

    const nextLeagueOptions = sportsSlugCatalog.leagueOptionsBySport[value] ?? []
    setIsCustomSportSlug(false)
    handleSportsFieldChange('sportSlug', value)

    if (
      nextLeagueOptions.length > 0
      && normalizedLeagueSlug
      && !nextLeagueOptions.some(option => option.value === normalizedLeagueSlug)
    ) {
      setIsCustomLeagueSlug(false)
      handleSportsFieldChange('leagueSlug', '')
    }
  }, [handleSportsFieldChange, normalizedLeagueSlug, sportsSlugCatalog.leagueOptionsBySport])

  const handleLeagueSlugSelectChange = useCallback((value: string) => {
    if (value === CUSTOM_SPORTS_SLUG_SELECT_VALUE) {
      setIsCustomLeagueSlug(true)
      handleSportsFieldChange('leagueSlug', '')
      return
    }

    setIsCustomLeagueSlug(false)
    handleSportsFieldChange('leagueSlug', value)
  }, [handleSportsFieldChange])

  const addSportsProp = useCallback(() => {
    setSportsForm((prev) => {
      const existingIds = new Set(prev.props.map(prop => prop.id))
      let nextIndex = prev.props.length + 1
      let nextId = `prop-${nextIndex}`
      while (existingIds.has(nextId)) {
        nextIndex += 1
        nextId = `prop-${nextIndex}`
      }

      return {
        ...prev,
        props: [...prev.props, createAdminSportsProp(nextId)],
      }
    })
  }, [])

  const removeSportsProp = useCallback((propId: string) => {
    setSportsForm((prev) => {
      if (prev.props.length <= 1) {
        toast.error('At least 1 prop is required.')
        return prev
      }

      return {
        ...prev,
        props: prev.props.filter(prop => prop.id !== propId),
      }
    })
  }, [])

  const handleSportsCustomMarketChange = useCallback((
    marketId: string,
    field: keyof AdminSportsCustomMarketState,
    value: string,
  ) => {
    setSportsForm((prev) => {
      const homeTeamName = prev.teams.find(team => team.hostStatus === 'home')?.name ?? ''
      const awayTeamName = prev.teams.find(team => team.hostStatus === 'away')?.name ?? ''

      return {
        ...prev,
        customMarkets: prev.customMarkets.map((market) => {
          if (market.id !== marketId) {
            return market
          }

          if (field !== 'sportsMarketType') {
            return {
              ...market,
              [field]: field === 'iconAssetKey' && value === 'none' ? '' : value,
            }
          }

          const typeOption = resolveAdminSportsMarketTypeOption(value)
          const defaultOutcomes = getAdminSportsMarketTypeDefaultOutcomes(value, {
            homeTeamName,
            awayTeamName,
          })

          return {
            ...market,
            sportsMarketType: value,
            title: market.title || typeOption?.label || '',
            shortName: market.shortName || typeOption?.label || '',
            groupItemTitle: market.groupItemTitle || typeOption?.label || '',
            outcomeOne: market.outcomeOne || defaultOutcomes?.[0] || '',
            outcomeTwo: market.outcomeTwo || defaultOutcomes?.[1] || '',
            iconAssetKey: market.iconAssetKey,
          }
        }),
      }
    })
  }, [])

  const addSportsCustomMarket = useCallback(() => {
    setSportsForm((prev) => {
      const existingIds = new Set(prev.customMarkets.map(market => market.id))
      let nextIndex = prev.customMarkets.length + 1
      let nextId = `market-${nextIndex}`
      while (existingIds.has(nextId)) {
        nextIndex += 1
        nextId = `market-${nextIndex}`
      }

      return {
        ...prev,
        customMarkets: [...prev.customMarkets, createAdminSportsCustomMarket(nextId)],
      }
    })
  }, [])

  const removeSportsCustomMarket = useCallback((marketId: string) => {
    setSportsForm((prev) => {
      if (prev.customMarkets.length <= 1) {
        toast.error('At least 1 custom sports market row is required.')
        return prev
      }

      return {
        ...prev,
        customMarkets: prev.customMarkets.filter(market => market.id !== marketId),
      }
    })
  }, [])

  const handleFieldChange = useCallback(
    <K extends keyof FormState>(field: K, value: FormState[K]) => {
      if (field === 'endDateIso') {
        setForm(prev => ({
          ...prev,
          endDateIso: normalizeDateTimeLocalValue(typeof value === 'string' ? value : ''),
        }))
        return
      }

      if (field === 'mainCategorySlug') {
        const nextMainCategorySlug = typeof value === 'string' ? value : ''
        setForm((prev) => {
          if (isSportsMainCategory(nextMainCategorySlug)) {
            return {
              ...prev,
              mainCategorySlug: nextMainCategorySlug,
              marketMode: 'multi_multiple',
              categories: [],
              options: [],
            }
          }

          if (isSportsMainCategory(prev.mainCategorySlug)) {
            const fallback = createInitialForm()
            return {
              ...prev,
              mainCategorySlug: nextMainCategorySlug,
              categories: [],
              marketMode: null,
              options: fallback.options,
              binaryQuestion: fallback.binaryQuestion,
              binaryOutcomeYes: fallback.binaryOutcomeYes,
              binaryOutcomeNo: fallback.binaryOutcomeNo,
            }
          }

          return {
            ...prev,
            mainCategorySlug: nextMainCategorySlug,
          }
        })
        return
      }

      setForm(prev => ({ ...prev, [field]: value }))
    },
    [],
  )

  const handleEndDateInputValueChange = useCallback((value: string) => {
    handleFieldChange('endDateIso', value)
  }, [handleFieldChange])

  const handleSportsStartTimeInputValueChange = useCallback((value: string) => {
    handleSportsFieldChange('startTime', value)
  }, [handleSportsFieldChange])

  const addCategory = useCallback((category: CategorySuggestion | CategoryItem) => {
    const nextLabel = ('name' in category ? category.name : category.label).trim()
    const nextSlug = slugify(category.slug || nextLabel)

    if (!nextSlug || !nextLabel) {
      return
    }

    setForm((prev) => {
      const alreadyExists = prev.categories.some(item => item.slug === nextSlug)
      if (alreadyExists) {
        return prev
      }

      return {
        ...prev,
        categories: [
          ...prev.categories,
          {
            label: nextLabel,
            slug: nextSlug,
          },
        ],
      }
    })

    setCategoryQuery('')
  }, [])

  const addCategoryFromInput = useCallback(() => {
    const text = categoryQuery.trim()
    if (!text) {
      return
    }

    const querySlug = slugify(text)
    const exactMatch = filteredCategorySuggestions.find(item => item.slug === querySlug)

    if (exactMatch) {
      addCategory(exactMatch)
      return
    }

    addCategory({
      label: text,
      slug: querySlug,
    })
  }, [addCategory, categoryQuery, filteredCategorySuggestions])

  const removeCategory = useCallback((slug: string) => {
    setForm(prev => ({
      ...prev,
      categories: prev.categories.filter(item => item.slug !== slug),
    }))
  }, [])

  async function uploadDraftAsset(
    kind: 'eventImage' | 'optionImage' | 'teamLogo',
    targetKey: string,
    file: File | null,
  ) {
    if (!draftId || !file) {
      return
    }

    const body = new FormData()
    body.append('kind', kind)
    if (targetKey) {
      body.append('targetKey', targetKey)
    }
    body.append('file', file, file.name)

    const response = await fetchAdminApi(`/event-creations/${draftId}/assets`, {
      method: 'POST',
      body,
    })
    const payload = await response.json().catch(() => null) as {
      data?: { assetPayload?: unknown }
      error?: string
    } | null

    if (!response.ok) {
      throw new Error(payload?.error || `Asset upload failed (${response.status})`)
    }

    setStoredAssets(normalizeEventCreationAssetPayload(payload?.data?.assetPayload))
  }

  function handleEventImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setEventImageFile(file)
    if (file) {
      void uploadDraftAsset('eventImage', '', file).catch((error) => {
        console.error('Error uploading event image:', error)
        toast.error(error instanceof Error ? error.message : 'Could not save event image.')
      })
    }
  }

  const handleOptionChange = useCallback((optionId: string, field: 'question' | 'title' | 'shortName' | 'outcomeYes' | 'outcomeNo', value: string) => {
    setForm((prev) => {
      const options = prev.options.map((option) => {
        if (option.id !== optionId) {
          return option
        }

        if (field === 'question') {
          return {
            ...option,
            question: value,
          }
        }

        if (field === 'title') {
          return {
            ...option,
            title: value,
            slug: slugify(value),
          }
        }

        if (field === 'outcomeYes') {
          return {
            ...option,
            outcomeYes: value,
          }
        }

        if (field === 'outcomeNo') {
          return {
            ...option,
            outcomeNo: value,
          }
        }

        return {
          ...option,
          shortName: value,
        }
      })

      return { ...prev, options }
    })
  }, [])

  const addOption = useCallback(() => {
    setForm((prev) => {
      const existingIds = new Set(prev.options.map(option => option.id))
      let nextIndex = prev.options.length + 1
      let nextId = `opt-${nextIndex}`
      while (existingIds.has(nextId)) {
        nextIndex += 1
        nextId = `opt-${nextIndex}`
      }

      return {
        ...prev,
        options: [...prev.options, createOption(nextId)],
      }
    })
  }, [])

  const removeOption = useCallback((optionId: string) => {
    setForm((prev) => {
      if (prev.options.length <= 2) {
        toast.error('At least 2 options are required.')
        return prev
      }

      return {
        ...prev,
        options: prev.options.filter(option => option.id !== optionId),
      }
    })

    setOptionImageFiles((prev) => {
      const { [optionId]: _removed, ...rest } = prev
      return rest
    })
  }, [])

  function handleOptionImageUpload(optionId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setOptionImageFiles(prev => ({
      ...prev,
      [optionId]: file,
    }))
    if (file) {
      void uploadDraftAsset('optionImage', optionId, file).catch((error) => {
        console.error('Error uploading option image:', error)
        toast.error(error instanceof Error ? error.message : 'Could not save option image.')
      })
    }
  }

  const buildAiPayload = useCallback(() => {
    const { resolvedForm } = getResolvedDateForms()
    const normalizedMarketMode = isSportsEvent ? 'multi_multiple' : resolvedForm.marketMode
    const normalizedBinaryQuestion = normalizedMarketMode === 'binary'
      ? resolvedForm.title
      : resolvedForm.binaryQuestion
    const normalizedOptions = normalizedMarketMode === 'binary'
      ? []
      : resolvedForm.options.map(option => ({
          question: option.question,
          title: option.title,
          shortName: option.shortName,
          slug: option.slug,
          outcomeYes: option.outcomeYes,
          outcomeNo: option.outcomeNo,
        }))

    return {
      creationMode,
      recurrenceUnit: creationMode === 'recurring' ? (recurrenceUnit || null) : null,
      recurrenceInterval: creationMode === 'recurring' ? recurrenceIntervalNumber : null,
      titleTemplate: creationMode === 'recurring' ? titleTemplate.trim() : '',
      slugTemplate: creationMode === 'recurring' ? effectiveRecurringSlugTemplate.trim() : '',
      resolutionRulesTemplate: creationMode === 'recurring' ? form.resolutionRules.trim() : '',
      resolvedOccurrences: creationMode === 'recurring' ? recurringOccurrencePreviews : [],
      title: resolvedForm.title,
      slug: resolvedForm.slug,
      endDateIso: resolvedForm.endDateIso,
      mainCategorySlug: resolvedForm.mainCategorySlug,
      categories: resolvedForm.categories,
      marketMode: normalizedMarketMode,
      binaryQuestion: normalizedBinaryQuestion,
      binaryOutcomeYes: resolvedForm.binaryOutcomeYes,
      binaryOutcomeNo: resolvedForm.binaryOutcomeNo,
      options: normalizedOptions,
      sports: isSportsEvent ? sportsDerivedContent.payload : undefined,
      resolutionSource: resolvedForm.resolutionSource,
      resolutionRules: creationMode === 'recurring'
        ? (recurringResolvedRules || resolvedForm.resolutionRules)
        : resolvedForm.resolutionRules,
    }
  }, [
    creationMode,
    effectiveRecurringSlugTemplate,
    form.resolutionRules,
    getResolvedDateForms,
    isSportsEvent,
    recurrenceIntervalNumber,
    recurrenceUnit,
    recurringOccurrencePreviews,
    recurringResolvedRules,
    sportsDerivedContent.payload,
    titleTemplate,
  ])

  const buildPreparePayload = useCallback((): PreparePayloadBody => {
    const { resolvedForm } = getResolvedDateForms()

    if (!eoaAddress) {
      throw new Error('Connect wallet first.')
    }
    if (!resolvedForm.marketMode && !isSportsEvent) {
      throw new Error('Select a market type.')
    }

    const mergedCategories = (() => {
      const base: CategoryItem[] = [
        {
          label: selectedMainCategory?.name || resolvedForm.mainCategorySlug,
          slug: resolvedForm.mainCategorySlug,
        },
        ...(isSportsEvent
          ? mergeCategoryItems(sportsDerivedContent.categories, resolvedForm.categories)
          : resolvedForm.categories),
      ]
      return Array.from(new Map(
        base
          .filter(item => item.slug.trim() && item.label.trim())
          .map(item => [item.slug.trim().toLowerCase(), {
            label: item.label.trim(),
            slug: item.slug.trim().toLowerCase(),
          }]),
      ).values())
    })()

    if (mergedCategories.length < 5) {
      throw new Error('Select at least 4 sub categories in addition to the main category.')
    }

    if (isSportsEvent && !sportsDerivedContent.payload) {
      throw new Error('Sports event fields are incomplete.')
    }

    const payload: PreparePayloadBody = {
      chainId: targetChainId,
      resolutionType,
      creator: eoaAddress,
      title: resolvedForm.title.trim(),
      slug: resolvedForm.slug.trim(),
      endDateIso: resolvedForm.endDateIso,
      mainCategorySlug: resolvedForm.mainCategorySlug.trim(),
      categories: mergedCategories,
      marketMode: isSportsEvent ? 'multi_multiple' : (resolvedForm.marketMode as MarketMode),
      resolutionSource: resolvedForm.resolutionSource.trim(),
      resolutionRules: creationMode === 'recurring'
        ? (recurringResolvedRules || resolvedForm.resolutionRules.trim())
        : resolvedForm.resolutionRules.trim(),
    }

    if (isSportsEvent && sportsDerivedContent.payload) {
      payload.options = sportsDerivedContent.options.map(option => ({
        id: option.id,
        question: option.question.trim(),
        title: option.title.trim(),
        shortName: option.shortName.trim(),
        slug: option.slug.trim(),
      }))
      payload.sports = sportsDerivedContent.payload
      return payload
    }

    if (resolvedForm.marketMode === 'binary') {
      payload.binaryQuestion = resolvedForm.title.trim()
      payload.binaryOutcomeYes = resolvedForm.binaryOutcomeYes.trim()
      payload.binaryOutcomeNo = resolvedForm.binaryOutcomeNo.trim()
      return payload
    }

    payload.options = resolvedForm.options.map(option => ({
      id: option.id,
      question: option.question.trim(),
      title: option.title.trim(),
      shortName: option.shortName.trim(),
      slug: option.slug.trim(),
    }))
    return payload
  }, [creationMode, eoaAddress, getResolvedDateForms, isSportsEvent, recurringResolvedRules, resolutionType, selectedMainCategory, sportsDerivedContent.categories, sportsDerivedContent.options, sportsDerivedContent.payload, targetChainId])

  const runOpenRouterCheck = useCallback(async () => {
    setOpenRouterCheckState('checking')
    setOpenRouterCheckError('')

    try {
      const response = await fetchAdminApiWithTimeout('/event-creations/ai', OPENROUTER_CHECK_TIMEOUT_MS, {
        method: 'GET',
        cache: 'no-store',
      })

      const payload = await response.json().catch(() => null) as unknown
      const apiError = readApiError(payload)
      if (!response.ok || apiError || !isOpenRouterStatusResponse(payload)) {
        throw new Error(apiError || `OpenRouter check failed (${response.status})`)
      }

      setOpenRouterCheckState(payload.configured ? 'ok' : 'error')
      if (!payload.configured) {
        setOpenRouterCheckError('Enable OpenRouter in Admin > General to continue.')
      }
      return payload.configured
    }
    catch (error) {
      console.error('Error checking OpenRouter status:', error)
      setOpenRouterCheckState('error')
      setOpenRouterCheckError('Could not validate OpenRouter status right now.')
      return false
    }
  }, [])

  const runContentCheck = useCallback(async () => {
    setContentCheckState('checking')
    setContentCheckError('')
    setContentCheckWarnings([])
    setContentCheckProgressLine(CONTENT_CHECK_PROGRESS[0])

    if (contentCheckProgressRef.current !== null) {
      window.clearInterval(contentCheckProgressRef.current)
      contentCheckProgressRef.current = null
    }
    if (contentCheckFinishedTimeoutRef.current !== null) {
      window.clearTimeout(contentCheckFinishedTimeoutRef.current)
      contentCheckFinishedTimeoutRef.current = null
    }

    let progressIndex = 0
    contentCheckProgressRef.current = window.setInterval(() => {
      progressIndex = (progressIndex + 1) % CONTENT_CHECK_PROGRESS.length
      setContentCheckProgressLine(CONTENT_CHECK_PROGRESS[progressIndex] ?? CONTENT_CHECK_PROGRESS[0])
    }, CONTENT_CHECK_PROGRESS_INTERVAL_MS)

    try {
      const response = await fetchAdminApiWithTimeout('/event-creations/ai', CONTENT_CHECK_TIMEOUT_MS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'check_content',
          data: buildAiPayload(),
        }),
      })

      const payload = await response.json().catch(() => null) as unknown
      const apiError = readApiError(payload)

      if (!response.ok || apiError || !isAiValidationResponse(payload)) {
        throw new Error(apiError || `AI checker failed (${response.status})`)
      }

      const nextIssues = Array.isArray(payload.errors) ? payload.errors : []
      const nextWarnings = Array.isArray(payload.warnings) ? payload.warnings : []
      setContentCheckIssues(nextIssues)
      setContentCheckWarnings(nextWarnings)
      setContentCheckState(nextIssues.length === 0 ? 'ok' : 'error')

      if (nextIssues.length === 0) {
        toast.success('Content AI checker passed.')
      }
      else {
        toast.error('Content AI checker found issues.')
      }

      setContentCheckProgressLine('finished')
      contentCheckFinishedTimeoutRef.current = window.setTimeout(() => {
        setContentCheckProgressLine('')
      }, 2200)
      return nextIssues.length === 0
    }
    catch (error) {
      console.error('Error checking content:', error)
      setContentCheckIssues([])
      setContentCheckWarnings([])
      setContentCheckState('error')
      setContentCheckError('Could not run content AI checker right now.')
      setContentCheckProgressLine('finished')
      contentCheckFinishedTimeoutRef.current = window.setTimeout(() => {
        setContentCheckProgressLine('')
      }, 2200)
      return false
    }
    finally {
      if (contentCheckProgressRef.current !== null) {
        window.clearInterval(contentCheckProgressRef.current)
        contentCheckProgressRef.current = null
      }
    }
  }, [buildAiPayload])

  const runSlugCheck = useCallback(async () => {
    const slugSamples = creationMode === 'recurring'
      ? recurringOccurrencePreviews
          .map((preview, index) => ({
            slug: preview.slug.trim().toLowerCase(),
            label: index === 0 ? 'first recurring occurrence' : 'next recurring occurrence',
          }))
          .filter((sample, index, collection) => sample.slug && collection.findIndex(entry => entry.slug === sample.slug) === index)
      : [{ slug: form.slug.trim().toLowerCase(), label: 'event' }]

    setSlugValidationState('checking')
    setSlugCheckError('')

    if (slugSamples.length === 0 || slugSamples.some(sample => !sample.slug)) {
      setSlugValidationState('error')
      setSlugCheckError('Slug is required.')
      return false
    }

    try {
      for (const sample of slugSamples) {
        const response = await fetchAdminApiWithTimeout(`/events/check-slug?slug=${encodeURIComponent(sample.slug)}`, SLUG_CHECK_TIMEOUT_MS, {
          method: 'GET',
          cache: 'no-store',
        })
        const payload = await response.json().catch(() => null) as unknown
        const apiError = readApiError(payload)

        if (!response.ok || apiError || !isSlugCheckResponse(payload)) {
          throw new Error(apiError || `Slug check failed (${response.status})`)
        }

        if (payload.exists) {
          setSlugValidationState('duplicate')
          setSlugCheckError(`Slug already exists for the ${sample.label}.`)
          return false
        }
      }

      setSlugValidationState('unique')
      return true
    }
    catch (error) {
      console.error('Error checking slug:', error)
      setSlugValidationState('error')
      setSlugCheckError('Could not validate slug right now.')
      return false
    }
  }, [creationMode, form.slug, recurringOccurrencePreviews])

  const runProposerWhitelistCheck = useCallback(async () => {
    setProposerWhitelistCheckState('checking')
    setProposerWhitelistCheckError('')

    if (!selectedCreatorAddress) {
      setProposerWhitelistCheckState('no_wallet')
      return false
    }

    try {
      const response = await fetchAdminApi(`/proposer-whitelists?creator=${encodeURIComponent(selectedCreatorAddress)}`, {
        method: 'GET',
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => null) as unknown
      const apiError = readApiError(payload)

      if (!response.ok || apiError || !isProposerWhitelistStatusResponse(payload) || !payload.status) {
        throw new Error(apiError || t('Proposer whitelist check failed ({status})', { status: String(response.status) }))
      }

      const hasWhitelist = Boolean(payload.status.whitelistAddress)
      setProposerWhitelistCheckState(hasWhitelist ? 'ok' : 'missing')
      return hasWhitelist
    }
    catch (error) {
      console.error('Error validating proposer whitelist:', error)
      setProposerWhitelistCheckState('error')
      setProposerWhitelistCheckError(t('Could not validate resolution proposers whitelist.'))
      return false
    }
  }, [selectedCreatorAddress, t])

  const runFundingCheck = useCallback(async () => {
    const resolutionSelectionAtStart = resolutionSelectionRef.current
    setFundingCheckState('checking')
    setFundingCheckError('')

    try {
      const response = await fetch(`${createMarketUrl}/market-config`, {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(`Failed to load market config (${response.status})`)
      }

      const payload: MarketConfigResponse = await response.json()
      const resolvedServerDefaultResolutionType: ResolutionType
        = payload.defaultResolutionType === 'dro_moov2' || payload.defaultResolutionType === 'uma_moov2'
          ? payload.defaultResolutionType
          : 'dro_moov2'
      const serverDefaultResolutionType: ResolutionType
        = resolvedServerDefaultResolutionType === 'uma_moov2' && UMA_RESOLUTION_TEMPORARILY_DISABLED
          ? 'dro_moov2'
          : resolvedServerDefaultResolutionType
      const resolutionSelectionChanged
        = resolutionSelectionRef.current.resolutionType !== resolutionSelectionAtStart.resolutionType
          || resolutionSelectionRef.current.touched !== resolutionSelectionAtStart.touched
      if (resolutionSelectionChanged) {
        setFundingCheckState('idle')
        return false
      }

      const effectiveResolutionType = resolutionSelectionAtStart.touched
        ? resolutionSelectionAtStart.resolutionType
        : serverDefaultResolutionType
      if (!resolutionSelectionAtStart.touched && resolutionSelectionAtStart.resolutionType !== serverDefaultResolutionType) {
        resolutionSelectionRef.current = {
          resolutionType: serverDefaultResolutionType,
          touched: false,
        }
        setResolutionType(serverDefaultResolutionType)
      }
      const directFee = form.marketMode === 'multi_unique'
        ? payload.directNegRiskQuestionFeeUsdc
        : payload.directNormalMarketFeeUsdc
      const required = Number(
        effectiveResolutionType === 'dro_moov2'
          ? directFee ?? payload.requiredCreatorFundingUsdc ?? FALLBACK_REQUIRED_USDC
          : payload.requiredCreatorFundingUsdc ?? FALLBACK_REQUIRED_USDC,
      )
      const normalizedRequired = Number.isFinite(required) && required > 0 ? required : FALLBACK_REQUIRED_USDC
      setRequiredRewardUsdc(normalizedRequired)
      const configuredChainId = typeof payload.defaultChainId === 'number' && payload.defaultChainId > 0
        ? payload.defaultChainId
        : DEFAULT_CREATE_EVENT_CHAIN_ID
      setTargetChainId(configuredChainId)

      const usdcToken = typeof payload.usdcToken === 'string' && isAddress(payload.usdcToken)
        ? getAddress(payload.usdcToken)
        : null

      if (!usdcToken) {
        throw new Error('Invalid USDC token in market-config')
      }

      if (!eoaAddress) {
        setEoaUsdcBalance(0)
        setFundingCheckState('no_wallet')
        return false
      }

      const client = createPublicClient({
        chain: defaultViemNetwork,
        transport: http(viemRpcUrl),
      })

      const balanceRaw = await client.readContract({
        address: usdcToken,
        abi: EOA_BALANCE_ABI,
        functionName: 'balanceOf',
        args: [eoaAddress],
      }) as bigint

      const balance = Number(formatUnits(balanceRaw, USDC_DECIMALS))
      const normalizedBalance = Number.isFinite(balance) ? balance : 0
      setEoaUsdcBalance(normalizedBalance)
      const totalRequired = normalizedRequired * marketCount
      setFundingCheckState(normalizedBalance >= totalRequired ? 'ok' : 'insufficient')
      return normalizedBalance >= totalRequired
    }
    catch (error) {
      console.error('Error validating EOA USDC balance:', error)
      setEoaUsdcBalance(0)
      setFundingCheckState('error')
      setFundingCheckError('Could not validate USDC balance right now.')
      return false
    }
  }, [createMarketUrl, eoaAddress, form.marketMode, marketCount, viemRpcUrl])

  const runNativeGasCheck = useCallback(async () => {
    setNativeGasCheckState('checking')
    setNativeGasCheckError('')

    try {
      if (!eoaAddress) {
        setEoaPolBalance(0)
        setRequiredGasPol(0)
        setNativeGasCheckState('no_wallet')
        return false
      }

      const client = publicClient ?? createPublicClient({
        chain: defaultViemNetwork,
        transport: http(viemRpcUrl),
      })

      const [balanceRaw, feeEstimate] = await Promise.all([
        client.getBalance({ address: eoaAddress }),
        client.estimateFeesPerGas().catch(() => null),
      ])

      const maxFeePerGas = (() => {
        if (feeEstimate?.maxFeePerGas && feeEstimate.maxFeePerGas > 0n) {
          return feeEstimate.maxFeePerGas
        }
        if (feeEstimate?.gasPrice && feeEstimate.gasPrice > 0n) {
          return feeEstimate.gasPrice * 2n
        }
        return FALLBACK_MAX_FEE_PER_GAS_WEI
      })()

      const estimatedGasUnits = APPROVE_GAS_UNITS_ESTIMATE + (INITIALIZE_GAS_UNITS_ESTIMATE * BigInt(marketCount))
      const estimatedCostWei = (estimatedGasUnits * maxFeePerGas * GAS_ESTIMATE_BUFFER_NUMERATOR) / GAS_ESTIMATE_BUFFER_DENOMINATOR

      const balancePol = Number(formatUnits(balanceRaw, 18))
      const requiredPol = Number(formatUnits(estimatedCostWei, 18))
      setEoaPolBalance(Number.isFinite(balancePol) ? balancePol : 0)
      setRequiredGasPol(Number.isFinite(requiredPol) ? requiredPol : 0)

      const hasEnoughGas = balanceRaw >= estimatedCostWei
      setNativeGasCheckState(hasEnoughGas ? 'ok' : 'insufficient')
      return hasEnoughGas
    }
    catch (error) {
      console.error('Error validating EOA POL balance for gas:', error)
      setEoaPolBalance(0)
      setRequiredGasPol(0)
      setNativeGasCheckState('error')
      setNativeGasCheckError('Could not validate POL gas balance right now.')
      return false
    }
  }, [eoaAddress, marketCount, publicClient, viemRpcUrl])

  const runAllPreSignChecks = useCallback(async (options?: { force?: boolean }) => {
    const shouldForce = Boolean(options?.force)
    if (
      !shouldForce
      && lastPreSignChecksCompletedRef.current
      && lastPreSignChecksFingerprintRef.current === preSignChecksFingerprint
    ) {
      return lastPreSignChecksResultRef.current
    }

    lastPreSignChecksCompletedRef.current = false
    const [fundingOk, nativeGasOk, creatorOk, proposerWhitelistOk, openRouterOk, slugOk] = await Promise.all([
      runFundingCheck(),
      runNativeGasCheck(),
      runAllowedCreatorCheck(),
      runProposerWhitelistCheck(),
      runOpenRouterCheck(),
      runSlugCheck(),
    ])

    let contentOk = false
    if (openRouterOk) {
      contentOk = await runContentCheck()
    }
    else {
      setContentCheckState('idle')
      setContentCheckIssues([])
      setContentCheckWarnings([])
      setBypassedIssueKeys([])
      setContentCheckError('')
      setContentCheckProgressLine('')
    }

    const nextResult = fundingOk && nativeGasOk && creatorOk && proposerWhitelistOk && openRouterOk && slugOk && contentOk
    lastPreSignChecksFingerprintRef.current = preSignChecksFingerprint
    lastPreSignChecksCompletedRef.current = true
    lastPreSignChecksResultRef.current = nextResult

    return nextResult
  }, [preSignChecksFingerprint, runAllowedCreatorCheck, runContentCheck, runFundingCheck, runNativeGasCheck, runOpenRouterCheck, runProposerWhitelistCheck, runSlugCheck])

  const applyPreparedSignatureState = useCallback((input: {
    prepared: PrepareResponse
    confirmedTxs: PrepareFinalizeRequestTx[]
    errorMessage?: string | null
  }) => {
    const txs = buildSignatureExecutionTxs(input.prepared, input.confirmedTxs)

    skipNextSignatureResetRef.current = true
    setTargetChainId(input.prepared.chainId)
    setPreparedSignaturePlan(input.prepared)
    setSignatureTxs(txs)
    setSignatureFlowDone(false)
    setSignatureFlowError(typeof input.errorMessage === 'string' ? input.errorMessage : '')
    setAuthChallengeExpiresAtMs(null)
    return txs
  }, [])

  const fetchPendingSignatureRequest = useCallback(async (options?: {
    chainId?: number
    requestId?: string
  }) => {
    if (!eoaAddress) {
      return null
    }

    const query = new URLSearchParams({
      creator: eoaAddress,
    })
    if (typeof options?.chainId === 'number' && options.chainId > 0) {
      query.set('chainId', String(options.chainId))
    }
    if (options?.requestId) {
      query.set('requestId', options.requestId)
    }

    const response = await fetch(`${createMarketUrl}/pending?${query.toString()}`, {
      method: 'GET',
      cache: 'no-store',
    })

    const payload = await response.json().catch(() => null) as unknown
    const apiError = readApiError(payload)
    if (!response.ok || apiError || !isPendingRequestResponse(payload)) {
      throw new Error(apiError || `Pending request lookup failed (${response.status})`)
    }

    return payload.request
  }, [createMarketUrl, eoaAddress])

  const pollPendingPreparation = useCallback(async (input: {
    requestId: string
    chainId: number
    expectedPayloadHash?: string
  }) => {
    for (let attempt = 1; attempt <= PREPARE_POLL_MAX_ATTEMPTS; attempt += 1) {
      const pending = await fetchPendingSignatureRequest({
        chainId: input.chainId,
        requestId: input.requestId,
      })

      if (pending) {
        if (input.expectedPayloadHash && pending.payloadHash.toLowerCase() !== input.expectedPayloadHash.toLowerCase()) {
          throw new Error('Pending request payload hash mismatch.')
        }

        setPendingWorkflowRequestId(pending.requestId)
        setPendingWorkflowStatus(pending.status)

        if (pending.prepared) {
          applyPreparedSignatureState({
            prepared: pending.prepared,
            confirmedTxs: pending.txs,
            errorMessage: pending.errorMessage,
          })
          setPendingWorkflowRequestId(null)
          setPendingWorkflowStatus(null)
          return pending
        }

        if (pending.status === 'failed') {
          setPendingWorkflowRequestId(null)
          setPendingWorkflowStatus(null)
          throw new Error(mapSignatureFlowErrorForUser(pending.errorMessage || 'Could not prepare signatures.'))
        }
      }

      if (attempt < PREPARE_POLL_MAX_ATTEMPTS) {
        await new Promise(resolve => window.setTimeout(resolve, PREPARE_POLL_DELAY_MS))
      }
    }

    setPendingWorkflowRequestId(null)
    setPendingWorkflowStatus(null)
    throw new Error('Timed out while preparing signatures. Please retry the pending plan.')
  }, [applyPreparedSignatureState, fetchPendingSignatureRequest])

  const pollPendingFinalization = useCallback(async (input: {
    requestId: string
    chainId: number
  }) => {
    for (let attempt = 1; attempt <= FINALIZE_POLL_MAX_ATTEMPTS; attempt += 1) {
      const pending = await fetchPendingSignatureRequest({
        chainId: input.chainId,
        requestId: input.requestId,
      })

      if (pending) {
        setPendingWorkflowRequestId(pending.requestId)
        setPendingWorkflowStatus(pending.status)

        const loadedSignaturePlan = buildLoadedSignaturePlan(pending)
        if (loadedSignaturePlan) {
          applyPreparedSignatureState({
            prepared: loadedSignaturePlan.prepared,
            confirmedTxs: pending.txs,
            errorMessage: pending.errorMessage,
          })
        }

        if (pending.status === 'metadata_update_pending' && loadedSignaturePlan) {
          setPendingWorkflowRequestId(null)
          setPendingWorkflowStatus(null)
          return pending
        }

        if (pending.status === 'finalized') {
          setSignatureFlowDone(true)
          setSignatureFlowError('')
          setPendingWorkflowRequestId(null)
          setPendingWorkflowStatus(null)
          toast.success('All signatures completed. Your created event will be available on your site shortly.', {
            duration: 10_000,
          })
          return pending
        }

        if (pending.status === 'failed') {
          setPendingWorkflowRequestId(null)
          setPendingWorkflowStatus(null)
          throw new Error(mapSignatureFlowErrorForUser(pending.errorMessage || 'Could not finalize the market.'))
        }
      }

      if (attempt < FINALIZE_POLL_MAX_ATTEMPTS) {
        await new Promise(resolve => window.setTimeout(resolve, FINALIZE_POLL_DELAY_MS))
      }
    }

    setPendingWorkflowRequestId(null)
    setPendingWorkflowStatus(null)
    throw new Error('Timed out while finalizing the market. Please retry the pending plan.')
  }, [applyPreparedSignatureState, fetchPendingSignatureRequest])

  const loadPendingSignaturePlan = useCallback(async (options?: {
    silent?: boolean
    chainId?: number
    expectedPayloadHash?: string
    requestId?: string
  }) => {
    if (!eoaAddress) {
      return null
    }

    const silent = Boolean(options?.silent)
    setIsLoadingPendingRequest(true)
    let loadedPlan: LoadedSignaturePlan | null = null

    try {
      const pending = await fetchPendingSignatureRequest({
        chainId: options?.chainId,
        requestId: options?.requestId,
      })

      if (!pending) {
        return null
      }

      if (options?.expectedPayloadHash && pending.payloadHash.toLowerCase() !== options.expectedPayloadHash.toLowerCase()) {
        return null
      }

      setPendingWorkflowRequestId(pending.requestId)
      setPendingWorkflowStatus(pending.status)

      const loadedSignaturePlan = buildLoadedSignaturePlan(pending)
      if (loadedSignaturePlan) {
        if (!isAddress(loadedSignaturePlan.prepared.creator) || getAddress(loadedSignaturePlan.prepared.creator) !== eoaAddress) {
          setPendingWorkflowRequestId(null)
          setPendingWorkflowStatus(null)
          return null
        }

        const loadedSignatureTxs = applyPreparedSignatureState({
          prepared: loadedSignaturePlan.prepared,
          confirmedTxs: pending.txs,
          errorMessage: pending.errorMessage,
        })
        loadedPlan = {
          pending,
          prepared: loadedSignaturePlan.prepared,
          signatureTxs: loadedSignatureTxs,
        }
        if (pending.status === 'finalized') {
          setSignatureFlowDone(true)
        }
        else {
          setSignatureFlowDone(false)
        }
      }

      if (pending.status === 'prepare_running') {
        const preparedPending = await pollPendingPreparation({
          requestId: pending.requestId,
          chainId: pending.chainId,
          expectedPayloadHash: options?.expectedPayloadHash,
        })
        loadedPlan = buildLoadedSignaturePlan(preparedPending)
      }
      else if (pending.status === 'finalize_running') {
        const finalizedPending = await pollPendingFinalization({
          requestId: pending.requestId,
          chainId: pending.chainId,
        })
        loadedPlan = buildLoadedSignaturePlan(finalizedPending)
      }
      else if (!pending.prepared) {
        setPendingWorkflowRequestId(null)
        setPendingWorkflowStatus(null)
        return null
      }
      else if (pending.status !== 'finalized' && pending.status !== 'finalize_in_progress') {
        setPendingWorkflowRequestId(null)
        setPendingWorkflowStatus(null)
      }

      if (!silent) {
        toast.success('Recovered pending signature progress from server.')
      }
      return loadedPlan
    }
    catch (error) {
      console.error('Error loading pending signature plan:', error)
      setPendingWorkflowRequestId(null)
      setPendingWorkflowStatus(null)
      if (!silent) {
        const message = error instanceof Error ? error.message : 'Could not recover pending signature progress.'
        toast.error(message)
      }
      return null
    }
    finally {
      setIsLoadingPendingRequest(false)
    }
  }, [
    applyPreparedSignatureState,
    eoaAddress,
    fetchPendingSignatureRequest,
    pollPendingFinalization,
    pollPendingPreparation,
  ])

  const persistConfirmedTxs = useCallback(async (requestId: string, txs: PrepareFinalizeRequestTx[]) => {
    if (!eoaAddress || txs.length === 0) {
      return
    }

    const response = await fetch(`${createMarketUrl}/tx-confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requestId,
        creator: eoaAddress,
        txs,
      }),
    })

    const payload = await response.json().catch(() => null) as unknown
    const apiError = readApiError(payload)
    if (!response.ok || apiError) {
      throw new Error(apiError || `Could not persist confirmed tx hashes (${response.status})`)
    }
  }, [createMarketUrl, eoaAddress])

  const getConnectedWalletConnection = useCallback(() => {
    if (!eoaAddress) {
      throw new Error('Connect wallet first.')
    }

    const rpcProvider = isRpcWalletProvider(walletProvider)
      ? walletProvider
      : walletClientMatchesConnectedAddress && isRpcWalletProvider(walletClient)
        ? walletClient
        : null
    const walletClientMatchesAddress = walletClientMatchesConnectedAddress

    if (!walletClientMatchesAddress && !rpcProvider) {
      throw new Error('Wallet connection is not ready. Please try again.')
    }

    return {
      rpcProvider,
      walletClient,
      walletClientMatchesAddress,
      chainId: connectedWalletTransportChainId ?? null,
    }
  }, [
    connectedWalletTransportChainId,
    eoaAddress,
    walletClient,
    walletClientMatchesConnectedAddress,
    walletProvider,
  ])

  const generateRulesWithAi = useCallback(async () => {
    setIsGeneratingRules(true)
    try {
      const response = await fetchAdminApi('/event-creations/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'generate_rules',
          data: buildAiPayload(),
        }),
      })

      const payload = await response.json().catch(() => null) as unknown
      const apiError = readApiError(payload)
      if (!response.ok || apiError || !isAiRulesResponse(payload)) {
        throw new Error(apiError || `Rules generation failed (${response.status})`)
      }

      setForm(prev => ({
        ...prev,
        resolutionRules: payload.rules,
      }))
      setRulesGeneratorDialogOpen(false)
      toast.success(`Rules generated from ${payload.samplesUsed} samples.`)
    }
    catch (error) {
      console.error('Error generating rules:', error)
      const message = error instanceof Error ? error.message : 'Could not generate rules with AI right now.'
      toast.error(message)
    }
    finally {
      setIsGeneratingRules(false)
    }
  }, [buildAiPayload])

  const prepareSignaturePlan = useCallback(async () => {
    if (!eoaAddress) {
      throw new Error('Connect wallet first.')
    }

    setIsPreparingSignaturePlan(true)
    setIsSigningAuth(true)
    setSignatureFlowError('')
    setSignatureFlowDone(false)
    setAuthChallengeExpiresAtMs(null)
    let currentPayloadHash = ''
    let currentPayloadChainId: number | null = null

    try {
      const connection = getConnectedWalletConnection()
      const payload = buildPreparePayload()
      const payloadNetwork = resolveViemNetworkByChainId(payload.chainId)
      const activeWalletClient = connection.walletClientMatchesAddress && connection.walletClient
        ? connection.walletClient
        : connection.rpcProvider
          ? createWalletClient({
              account: eoaAddress,
              transport: custom(connection.rpcProvider),
              ...(payloadNetwork ? { chain: payloadNetwork } : {}),
            })
          : null
      if (!activeWalletClient) {
        throw new Error('Wallet connection is not ready. Please try again.')
      }
      const payloadJson = JSON.stringify(payload)
      const payloadHash = keccak256(stringToHex(payloadJson))
      currentPayloadHash = payloadHash
      currentPayloadChainId = payload.chainId

      const authResponse = await fetch(`${createMarketUrl}/prepare-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creator: eoaAddress,
          chainId: payload.chainId,
          payloadHash,
        }),
      })

      const authPayload = await authResponse.json().catch(() => null) as unknown
      const authApiError = readApiError(authPayload)
      if (!authResponse.ok || authApiError || !isPrepareAuthChallengeResponse(authPayload)) {
        throw new Error(authApiError || `Auth challenge failed (${authResponse.status})`)
      }

      if (!isAddress(authPayload.creator) || getAddress(authPayload.creator) !== eoaAddress) {
        throw new Error('Creator mismatch in auth challenge response.')
      }
      if (authPayload.payloadHash.toLowerCase() !== payloadHash.toLowerCase()) {
        throw new Error('Payload hash mismatch in auth challenge response.')
      }
      if (!isAddress(authPayload.domain.verifyingContract)) {
        throw new Error('Invalid verifying contract in auth challenge response.')
      }
      if (connection.chainId && connection.chainId !== authPayload.chainId) {
        throw new Error(`Switch wallet to ${getChainLabel(authPayload.chainId)} before signing auth.`)
      }
      setAuthChallengeExpiresAtMs(authPayload.expiresAt)
      setSignatureNowMs(Date.now())

      const authSignature = await runWithSignaturePrompt(() => activeWalletClient.signTypedData({
        account: eoaAddress,
        domain: {
          name: authPayload.domain.name,
          version: authPayload.domain.version,
          chainId: authPayload.chainId,
          verifyingContract: getAddress(authPayload.domain.verifyingContract),
        },
        types: {
          CreateMarketAuth: [
            { name: 'requestId', type: 'string' },
            { name: 'creator', type: 'address' },
            { name: 'payloadHash', type: 'bytes32' },
            { name: 'nonce', type: 'bytes32' },
            { name: 'expiresAt', type: 'uint256' },
            { name: 'chainId', type: 'uint256' },
          ],
        },
        primaryType: 'CreateMarketAuth',
        message: {
          requestId: authPayload.requestId,
          creator: eoaAddress,
          payloadHash,
          nonce: authPayload.nonce as `0x${string}`,
          expiresAt: BigInt(authPayload.expiresAt),
          chainId: BigInt(authPayload.chainId),
        },
      }), {
        title: 'Sign auth challenge',
        description: 'Open your wallet and approve the signature to continue.',
      })

      setIsSigningAuth(false)

      const body = new FormData()
      body.append('payload', payloadJson)
      body.append('auth', JSON.stringify({
        requestId: authPayload.requestId,
        nonce: authPayload.nonce,
        expiresAt: authPayload.expiresAt,
        payloadHash,
        signature: authSignature,
      }))
      const resolvedEventImage = await resolveStoredAssetFile(eventImageFile, storedAssets.eventImage, 'Event image')
      if (!resolvedEventImage) {
        throw new Error('Event image is required.')
      }
      body.append('eventImage', resolvedEventImage, resolvedEventImage.name)

      for (const option of form.options) {
        const optionImage = await resolveStoredAssetFile(
          optionImageFiles[option.id] ?? null,
          storedAssets.optionImages[option.id] ?? null,
          `Option image ${option.id}`,
        )
        if (optionImage) {
          body.append(`optionImage:${option.id}`, optionImage, optionImage.name)
        }
      }

      if (isSportsEvent) {
        for (const hostStatus of ['home', 'away'] as const) {
          const teamLogo = await resolveStoredAssetFile(
            teamLogoFiles[hostStatus],
            storedAssets.teamLogos[hostStatus] ?? null,
            `Team logo ${hostStatus}`,
          )
          if (teamLogo) {
            body.append(`teamLogo:${hostStatus}`, teamLogo, teamLogo.name)
          }
        }
      }

      const response = await fetch(`${createMarketUrl}/prepare`, {
        method: 'POST',
        body,
      })

      const responsePayload = await response.json().catch(() => null) as unknown
      const apiError = readApiError(responsePayload)

      if (!response.ok || apiError || !isPrepareAcceptedResponse(responsePayload)) {
        throw new Error(apiError || `Prepare failed (${response.status})`)
      }

      if (!isAddress(responsePayload.creator) || getAddress(responsePayload.creator) !== eoaAddress) {
        throw new Error('Creator address mismatch between wallet and prepare response.')
      }

      setPendingWorkflowRequestId(responsePayload.requestId)
      setPendingWorkflowStatus(responsePayload.status)
      const preparedPending = await pollPendingPreparation({
        requestId: responsePayload.requestId,
        chainId: responsePayload.chainId,
        expectedPayloadHash: payloadHash,
      })
      const txCount = preparedPending.prepared?.txPlan.length ?? 0
      if (txCount === 0) {
        toast.success('Auth completed. No creator transactions were returned.')
      }
      else {
        toast.success(`Auth completed. Prepared ${txCount} signature request${txCount > 1 ? 's' : ''}.`)
      }
      return buildLoadedSignaturePlan(preparedPending)
    }
    catch (error) {
      console.error('Error preparing signature plan:', error)
      const message = error instanceof Error ? error.message : 'Could not prepare signatures.'
      const userMessage = mapSignatureFlowErrorForUser(message)

      if (isAlreadyInitializedError(message)) {
        const resumed = await loadPendingSignaturePlan({
          silent: false,
          chainId: currentPayloadChainId ?? undefined,
          expectedPayloadHash: currentPayloadHash || undefined,
        })
        if (resumed) {
          return resumed
        }
      }

      setPendingWorkflowRequestId(null)
      setPendingWorkflowStatus(null)
      setPreparedSignaturePlan(null)
      setSignatureTxs([])
      setSignatureFlowDone(false)
      setSignatureFlowError(userMessage)
      throw new Error(userMessage)
    }
    finally {
      setIsSigningAuth(false)
      setIsPreparingSignaturePlan(false)
    }
  }, [
    buildPreparePayload,
    createMarketUrl,
    eoaAddress,
    eventImageFile,
    form.options,
    getConnectedWalletConnection,
    isSportsEvent,
    storedAssets.eventImage,
    storedAssets.optionImages,
    storedAssets.teamLogos,
    loadPendingSignaturePlan,
    optionImageFiles,
    pollPendingPreparation,
    runWithSignaturePrompt,
    teamLogoFiles,
  ])

  const finalizeSignatureFlow = useCallback(async (
    completedTxsInput?: PrepareFinalizeRequestTx[],
    preparedInput?: PrepareResponse,
  ) => {
    const activePreparedSignaturePlan = preparedInput ?? preparedSignaturePlan

    if (!activePreparedSignaturePlan) {
      throw new Error('Prepare signatures first.')
    }
    if (!eoaAddress) {
      throw new Error('Connect wallet first.')
    }

    const completedTxs: PrepareFinalizeRequestTx[] = completedTxsInput
      ?? signatureTxs
        .filter(item => item.status === 'success' && Boolean(item.hash))
        .map(item => ({
          id: item.id,
          hash: item.hash as string,
        }))

    setIsFinalizingSignatureFlow(true)
    setSignatureFlowError('')

    try {
      for (let attempt = 1; attempt <= FINALIZE_MAX_ATTEMPTS; attempt += 1) {
        const response = await fetch(`${createMarketUrl}/finalize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requestId: activePreparedSignaturePlan.requestId,
            creator: eoaAddress,
            txs: completedTxs,
          }),
        })

        const { payload: responsePayload, text: responseText } = await readResponseBody(response)
        if (response.ok && isFinalizeResponse(responsePayload)) {
          if (responsePayload.requestId !== activePreparedSignaturePlan.requestId) {
            throw new Error('Finalize response requestId mismatch.')
          }

          if (responsePayload.status === 'finalized') {
            setSignatureFlowDone(true)
            setSignatureFlowError('')
            setPendingWorkflowRequestId(null)
            setPendingWorkflowStatus(null)
            toast.success('All signatures completed. Your created event will be available on your site shortly.', {
              duration: 10_000,
            })
            return
          }

          if (responsePayload.status === 'finalize_in_progress') {
            setPendingWorkflowRequestId(responsePayload.requestId)
            setPendingWorkflowStatus(responsePayload.status)
            await pollPendingFinalization({
              requestId: responsePayload.requestId,
              chainId: activePreparedSignaturePlan.chainId,
            })
            return
          }

          if (responsePayload.status === 'metadata_update_pending') {
            setPendingWorkflowRequestId(null)
            setPendingWorkflowStatus(null)
            if (responsePayload.metadataUpdateTxPlan?.length) {
              applyPreparedSignatureState({
                prepared: {
                  ...activePreparedSignaturePlan,
                  txPlan: responsePayload.metadataUpdateTxPlan,
                },
                confirmedTxs: completedTxs,
              })
              return
            }
            await pollPendingFinalization({
              requestId: responsePayload.requestId,
              chainId: activePreparedSignaturePlan.chainId,
            })
            return
          }

          throw new Error(`Unexpected finalize status: ${responsePayload.status}`)
        }

        const failureMessage = readResponseErrorMessage(responsePayload, responseText) || `Finalize failed (${response.status})`
        const canRetry = attempt < FINALIZE_MAX_ATTEMPTS && shouldRetryFinalizeRequest(failureMessage)
        if (!canRetry) {
          throw new Error(failureMessage)
        }

        await new Promise(resolve => window.setTimeout(resolve, FINALIZE_RETRY_DELAY_MS * attempt))
      }
    }
    finally {
      setIsFinalizingSignatureFlow(false)
    }
  }, [applyPreparedSignatureState, createMarketUrl, eoaAddress, pollPendingFinalization, preparedSignaturePlan, signatureTxs])

  const executeSignatureFlow = useCallback(async (input?: {
    prepared: PrepareResponse
    signatureTxs: SignatureExecutionTx[]
  }) => {
    const activePreparedSignaturePlan = input?.prepared ?? preparedSignaturePlan
    const activeSignatureTxs = input?.signatureTxs ?? signatureTxs

    if (!activePreparedSignaturePlan) {
      throw new Error('Prepare signatures first.')
    }
    if (!eoaAddress) {
      throw new Error('Connect wallet first.')
    }
    if (!publicClient) {
      throw new Error('Public client not available.')
    }
    const chainPublicClient = publicClient
    const connection = getConnectedWalletConnection()
    const senderAddress = eoaAddress
    const preparedNetwork = resolveViemNetworkByChainId(activePreparedSignaturePlan.chainId)
    const activeWalletClient = connection.walletClientMatchesAddress && connection.walletClient
      ? connection.walletClient
      : connection.rpcProvider
        ? createWalletClient({
            account: senderAddress,
            transport: custom(connection.rpcProvider),
            ...(preparedNetwork ? { chain: preparedNetwork } : {}),
          })
        : null
    if (!activeWalletClient) {
      throw new Error('Wallet connection is not ready. Please try again.')
    }

    if (connection.chainId && connection.chainId !== activePreparedSignaturePlan.chainId) {
      throw new Error(`Switch wallet to ${getChainLabel(activePreparedSignaturePlan.chainId)} before signing.`)
    }

    if (input) {
      skipNextSignatureResetRef.current = true
      setTargetChainId(activePreparedSignaturePlan.chainId)
      setPreparedSignaturePlan(activePreparedSignaturePlan)
      setSignatureTxs(activeSignatureTxs)
    }

    setIsExecutingSignatures(true)
    setSignatureFlowError('')
    setSignatureFlowDone(false)

    try {
      const completedById = new Map<string, string>()
      for (let index = 0; index < activePreparedSignaturePlan.txPlan.length; index += 1) {
        const planned = activePreparedSignaturePlan.txPlan[index]
        const existing = activeSignatureTxs[index]
        if (existing?.status === 'success' && existing.hash) {
          completedById.set(planned.id, existing.hash)
        }
      }

      for (let index = 0; index < activePreparedSignaturePlan.txPlan.length; index += 1) {
        const existingTx = activeSignatureTxs[index]
        if (existingTx?.status === 'success') {
          continue
        }

        const tx = activePreparedSignaturePlan.txPlan[index]
        if (!isAddress(tx.to)) {
          throw new Error(`Invalid tx target for ${tx.id}.`)
        }
        const toAddress = tx.to as `0x${string}`
        if (!tx.data.startsWith('0x')) {
          throw new Error(`Invalid tx data for ${tx.id}.`)
        }
        const signaturePromptCopy = (() => {
          if (tx.id === 'approve-uma-reward' || tx.id === 'approve-direct-resolution-fee') {
            return {
              title: t('Approve USDC spending'),
              description: t('Open your wallet to allow the market creation fees.'),
            }
          }
          if (tx.id.startsWith('pay-direct-')) {
            return {
              title: t('Pay direct resolution fee'),
              description: t('Open your wallet to pay the direct resolution fee.'),
            }
          }
          if (tx.id.startsWith('initialize-market-')) {
            return {
              title: t('Initialize market'),
              description: t('Open your wallet to create the market onchain.'),
            }
          }
          if (tx.id.startsWith('update-metadata-')) {
            return {
              title: t('Start market'),
              description: t('Open your wallet to activate trading for this market.'),
            }
          }

          return {
            title: t('Confirm transaction'),
            description: t('Open your wallet and approve the transaction to continue.'),
          }
        })()

        if (existingTx?.hash) {
          setSignatureTxs(previous => previous.map((item, itemIndex) => {
            if (itemIndex !== index) {
              return item
            }
            return {
              ...item,
              status: 'confirming',
              error: undefined,
            }
          }))

          const existingReceipt = await chainPublicClient.waitForTransactionReceipt({
            hash: existingTx.hash as `0x${string}`,
          })
          if (existingReceipt.status !== 'success') {
            throw new Error(`Transaction ${tx.id} failed on-chain.`)
          }

          setSignatureTxs(previous => previous.map((item, itemIndex) => {
            if (itemIndex !== index) {
              return item
            }
            return {
              ...item,
              status: 'success',
            }
          }))
          completedById.set(tx.id, existingTx.hash)
          const completedTxs = Array.from(completedById.entries()).map(([id, hash]) => ({ id, hash }))
          try {
            await persistConfirmedTxs(activePreparedSignaturePlan.requestId, completedTxs)
          }
          catch (persistError) {
            console.error('Could not persist previously confirmed tx hashes:', persistError)
          }
          continue
        }

        setSignatureTxs(previous => previous.map((item, itemIndex) => {
          if (itemIndex !== index) {
            return item
          }
          return {
            ...item,
            status: 'awaiting_wallet',
            error: undefined,
          }
        }))

        function send(overrides?: {
          maxFeePerGas?: bigint
          maxPriorityFeePerGas?: bigint
        }) {
          if (!connection.walletClient || !connection.walletClientMatchesAddress) {
            throw new Error('Wallet connection is not ready. Please try again.')
          }

          return connection.walletClient.sendTransaction({
            account: senderAddress,
            chain: connection.walletClient.chain,
            to: toAddress,
            data: tx.data as `0x${string}`,
            value: BigInt(tx.value || '0'),
            ...(overrides ?? {}),
          })
        }

        async function estimateEmbeddedGas() {
          try {
            const estimatedGas = await chainPublicClient.estimateGas({
              account: senderAddress,
              to: toAddress,
              data: tx.data as `0x${string}`,
              value: BigInt(tx.value || '0'),
            })

            return (estimatedGas * 12n) / 10n
          }
          catch {
            return undefined
          }
        }

        async function sendRpc(overrides?: {
          maxFeePerGas?: bigint
          maxPriorityFeePerGas?: bigint
        }) {
          if (!connection.rpcProvider) {
            throw new Error('Wallet connection is not ready. Please try again.')
          }
          const rpcProvider = connection.rpcProvider

          const rpcWalletClient = createWalletClient({
            account: senderAddress,
            transport: custom(rpcProvider),
            ...(preparedNetwork ? { chain: preparedNetwork } : {}),
          })

          if (isEmbeddedWallet) {
            const gas = await estimateEmbeddedGas()
            const txRequest = buildRpcTransactionRequest({
              from: senderAddress,
              to: toAddress,
              data: tx.data as `0x${string}`,
              value: BigInt(tx.value || '0'),
              gas,
              ...(overrides ?? {}),
            })
            const rpcHash = await runWithSignaturePrompt(
              () => rpcProvider.request({
                method: 'eth_sendTransaction',
                params: [txRequest],
              }),
              signaturePromptCopy,
            )
            if (typeof rpcHash !== 'string' || !rpcHash.startsWith('0x')) {
              throw new Error('Wallet provider returned an invalid transaction hash.')
            }
            return rpcHash
          }

          const rpcHash = await runWithSignaturePrompt(
            () => rpcWalletClient.sendTransaction({
              account: senderAddress,
              chain: preparedNetwork ?? undefined,
              to: toAddress,
              data: tx.data as `0x${string}`,
              value: BigInt(tx.value || '0'),
              ...(overrides ?? {}),
            }),
            signaturePromptCopy,
          )
          if (typeof rpcHash !== 'string' || !rpcHash.startsWith('0x')) {
            throw new Error('Wallet provider returned an invalid transaction hash.')
          }
          return rpcHash
        }

        async function sendWithRpcFallback(overrides?: {
          maxFeePerGas?: bigint
          maxPriorityFeePerGas?: bigint
        }) {
          if (isEmbeddedWallet) {
            return await sendRpc(overrides)
          }

          if (!connection.walletClientMatchesAddress) {
            return await sendRpc(overrides)
          }

          try {
            return await runWithSignaturePrompt(() => send(overrides), signaturePromptCopy)
          }
          catch (sendError) {
            const message = sendError instanceof Error ? sendError.message : String(sendError)
            if (!isBigIntSerializationError(message)) {
              throw sendError
            }

            return await sendRpc(overrides)
          }
        }

        let hash: string
        try {
          hash = isEmbeddedWallet
            ? await sendWithRpcFallback()
            : await sendWithEstimatedFeeRetry({
                chainId: activePreparedSignaturePlan.chainId,
                client: chainPublicClient,
                send: sendWithRpcFallback,
              })
        }
        catch (sendError) {
          const message = sendError instanceof Error ? sendError.message : String(sendError)
          if (tx.id.startsWith('initialize-market-') && isAlreadyInitializedError(message)) {
            setSignatureTxs(previous => previous.map((item, itemIndex) => {
              if (itemIndex !== index) {
                return item
              }
              return {
                ...item,
                status: 'success',
                error: undefined,
              }
            }))
            continue
          }

          throw sendError
        }

        setSignatureTxs(previous => previous.map((item, itemIndex) => {
          if (itemIndex !== index) {
            return item
          }
          return {
            ...item,
            status: 'confirming',
            hash,
          }
        }))

        const receipt = await chainPublicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` })
        if (receipt.status !== 'success') {
          throw new Error(`Transaction ${tx.id} failed on-chain.`)
        }

        setSignatureTxs(previous => previous.map((item, itemIndex) => {
          if (itemIndex !== index) {
            return item
          }
          return {
            ...item,
            status: 'success',
          }
        }))
        completedById.set(tx.id, hash)
        const completedTxs = Array.from(completedById.entries()).map(([id, confirmedHash]) => ({
          id,
          hash: confirmedHash,
        }))
        try {
          await persistConfirmedTxs(activePreparedSignaturePlan.requestId, completedTxs)
        }
        catch (persistError) {
          console.error('Could not persist confirmed tx hashes:', persistError)
        }
      }

      const completedTxs = Array.from(completedById.entries()).map(([id, hash]) => ({ id, hash }))
      if (completedTxs.length > 0) {
        try {
          await persistConfirmedTxs(activePreparedSignaturePlan.requestId, completedTxs)
        }
        catch (persistError) {
          console.error('Could not persist confirmed tx hashes before finalize:', persistError)
        }
      }

      await finalizeSignatureFlow(completedTxs, activePreparedSignaturePlan)
    }
    catch (error) {
      console.error('Error executing signature flow:', error)
      const message = error instanceof Error ? error.message : 'Could not complete signatures.'
      const userMessage = mapSignatureFlowErrorForUser(message)
      setSignatureFlowError(userMessage)
      setSignatureTxs((previous) => {
        const activeIndex = previous.findIndex(item => item.status === 'awaiting_wallet' || item.status === 'confirming')
        if (activeIndex < 0) {
          return previous
        }
        return previous.map((item, itemIndex) => {
          if (itemIndex !== activeIndex) {
            return item
          }
          return {
            ...item,
            status: 'error',
            error: userMessage,
          }
        })
      })
      throw new Error(userMessage)
    }
    finally {
      setIsExecutingSignatures(false)
    }
  }, [
    eoaAddress,
    finalizeSignatureFlow,
    getConnectedWalletConnection,
    isEmbeddedWallet,
    persistConfirmedTxs,
    preparedSignaturePlan,
    publicClient,
    runWithSignaturePrompt,
    signatureTxs,
    t,
  ])

  const copyWalletAddress = useCallback(async () => {
    if (!eoaAddress) {
      return
    }

    try {
      await navigator.clipboard.writeText(eoaAddress)
      setIsAddressCopied(true)
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current)
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setIsAddressCopied(false)
      }, 1400)
    }
    catch (error) {
      console.error('Error copying wallet address:', error)
    }
  }, [eoaAddress])

  const openAdminSettings = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    const segments = window.location.pathname.split('/').filter(Boolean)
    const href = segments.length >= 2 && segments[1] === 'admin'
      ? `/${segments[0]}/admin`
      : '/admin'
    window.open(href, '_blank', 'noopener,noreferrer')
  }, [])

  const validateStep = useCallback((step: number, withToast = true) => {
    const { resolvedForm, resolvedSportsForm } = syncResolvedDateInputs()
    const errors = buildStepErrors(step, {
      form: resolvedForm,
      creationMode,
      sportsForm: resolvedSportsForm,
      hasEventImage,
      hasTeamLogoByHostStatus,
      slugValidationState,
      fundingCheckState,
      nativeGasCheckState,
      allowedCreatorCheckState,
      proposerWhitelistCheckState,
      openRouterCheckState,
      contentCheckState,
      hasPendingAiErrors: pendingAiIssues.length > 0,
      hasContentCheckFatalError: Boolean(contentCheckError),
      allowPastResolutionDate,
      hasCreatorSelection: creationMode !== 'recurring' || Boolean(automaticWalletAddress.trim()),
      hasRecurringCadence: creationMode !== 'recurring' || Boolean(recurrenceUnit),
      recurringPreviewErrors,
    })

    if (errors.length > 0) {
      if (withToast) {
        showFirstError(errors)
      }
      return false
    }

    return true
  }, [
    automaticWalletAddress,
    creationMode,
    allowedCreatorCheckState,
    allowPastResolutionDate,
    contentCheckState,
    fundingCheckState,
    hasEventImage,
    hasTeamLogoByHostStatus,
    nativeGasCheckState,
    contentCheckError,
    openRouterCheckState,
    pendingAiIssues.length,
    proposerWhitelistCheckState,
    recurrenceUnit,
    recurringPreviewErrors,
    showFirstError,
    slugValidationState,
    syncResolvedDateInputs,
  ])

  const resetCreateEventFlow = useCallback(() => {
    const nextSlugSeed = Math.floor(Date.now() / 1000).toString()

    skipNextSignatureResetRef.current = true
    pendingResumeKeyRef.current = null
    lastPreSignChecksFingerprintRef.current = null
    lastPreSignChecksCompletedRef.current = false
    lastPreSignChecksResultRef.current = false

    setCurrentStep(1)
    setMaxVisitedStep(1)
    setForm(createInitialForm({
      title: normalizedInitialTitle,
      slug: normalizedInitialSlug,
      endDateIso: normalizedInitialEndDateIso,
    }))
    setTitleTemplate(initialTitleTemplate)
    setSlugTemplate(initialSlugTemplate)
    setAutomaticWalletAddress(initialWalletAddress)
    setRecurrenceUnit(initialRecurrenceUnit)
    setRecurrenceInterval(initialRecurrenceInterval)
    setSportsForm(createInitialAdminSportsForm())
    setSlugSeed(nextSlugSeed)
    setCategoryQuery('')
    setEventImageFile(null)
    setTeamLogoFiles({ home: null, away: null })
    setOptionImageFiles({})
    setFinalPreviewDialogOpen(false)
    setRulesGeneratorDialogOpen(false)
    setIsAddressCopied(false)
    setIsBinaryOutcomesEditable(false)
    setAreMultiOutcomesEditable(false)

    setSlugValidationState('idle')
    setSlugCheckError('')
    setFundingCheckState('idle')
    setFundingCheckError('')
    setNativeGasCheckState('idle')
    setNativeGasCheckError('')
    resetAllowedCreatorCheck()
    setProposerWhitelistCheckState('idle')
    setProposerWhitelistCheckError('')
    setOpenRouterCheckState('idle')
    setOpenRouterCheckError('')
    setContentCheckState('idle')
    setContentCheckIssues([])
    setContentCheckWarnings([])
    setBypassedIssueKeys([])
    setContentCheckProgressLine('')
    setContentCheckError('')

    setIsSigningAuth(false)
    setIsPreparingSignaturePlan(false)
    setIsExecutingSignatures(false)
    setIsFinalizingSignatureFlow(false)
    setIsLoadingPendingRequest(false)
    setAuthChallengeExpiresAtMs(null)
    setSignatureNowMs(0)
    setPendingWorkflowRequestId(null)
    setPendingWorkflowStatus(null)
    setPreparedSignaturePlan(null)
    setSignatureTxs([])
    setSignatureFlowDone(false)
    setSignatureFlowError('')

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CREATE_EVENT_SIGNATURE_STORAGE_KEY)
    }
  }, [
    initialRecurrenceInterval,
    initialRecurrenceUnit,
    initialSlugTemplate,
    initialTitleTemplate,
    initialWalletAddress,
    normalizedInitialEndDateIso,
    normalizedInitialSlug,
    normalizedInitialTitle,
    resetAllowedCreatorCheck,
  ])

  const resetFormDraft = useCallback(() => {
    const nextSlugSeed = Math.floor(Date.now() / 1000).toString()
    const preserveSignatureState = Boolean(preparedSignaturePlan)
      || Boolean(pendingWorkflowRequestId)
      || signatureTxs.length > 0
      || signatureFlowDone
      || Boolean(signatureFlowError)
      || Boolean(authChallengeExpiresAtMs)

    if (preserveSignatureState) {
      skipNextSignatureResetRef.current = true
    }

    pendingResumeKeyRef.current = null
    lastPreSignChecksFingerprintRef.current = null
    lastPreSignChecksCompletedRef.current = false
    lastPreSignChecksResultRef.current = false

    setCurrentStep(1)
    setMaxVisitedStep(1)
    setForm(createInitialForm({
      title: normalizedInitialTitle,
      slug: normalizedInitialSlug,
      endDateIso: normalizedInitialEndDateIso,
    }))
    setTitleTemplate(initialTitleTemplate)
    setSlugTemplate(initialSlugTemplate)
    setAutomaticWalletAddress(initialWalletAddress)
    setRecurrenceUnit(initialRecurrenceUnit)
    setRecurrenceInterval(initialRecurrenceInterval)
    setSportsForm(createInitialAdminSportsForm())
    setSlugSeed(nextSlugSeed)
    setCategoryQuery('')
    setEventImageFile(null)
    setTeamLogoFiles({ home: null, away: null })
    setOptionImageFiles({})
    setFinalPreviewDialogOpen(false)
    setRulesGeneratorDialogOpen(false)
    setIsAddressCopied(false)
    setIsBinaryOutcomesEditable(false)
    setAreMultiOutcomesEditable(false)

    setSlugValidationState('idle')
    setSlugCheckError('')
    setFundingCheckState('idle')
    setFundingCheckError('')
    setNativeGasCheckState('idle')
    setNativeGasCheckError('')
    resetAllowedCreatorCheck()
    setProposerWhitelistCheckState('idle')
    setProposerWhitelistCheckError('')
    setOpenRouterCheckState('idle')
    setOpenRouterCheckError('')
    setContentCheckState('idle')
    setContentCheckIssues([])
    setContentCheckWarnings([])
    setBypassedIssueKeys([])
    setContentCheckProgressLine('')
    setContentCheckError('')

    if (typeof window !== 'undefined' && !preserveSignatureState) {
      window.localStorage.removeItem(CREATE_EVENT_SIGNATURE_STORAGE_KEY)
    }
  }, [
    authChallengeExpiresAtMs,
    initialRecurrenceInterval,
    initialRecurrenceUnit,
    initialSlugTemplate,
    initialTitleTemplate,
    initialWalletAddress,
    normalizedInitialEndDateIso,
    normalizedInitialSlug,
    normalizedInitialTitle,
    pendingWorkflowRequestId,
    preparedSignaturePlan,
    resetAllowedCreatorCheck,
    signatureFlowDone,
    signatureFlowError,
    signatureTxs.length,
  ])

  const handleResetFormClick = useCallback(() => {
    setResetFormDialogOpen(true)
  }, [])

  const confirmResetForm = useCallback(() => {
    setResetFormDialogOpen(false)
    resetFormDraft()
    toast.success('Form cleared.')
  }, [resetFormDraft])

  const goNext = useCallback(() => {
    if (currentStep <= 3) {
      if (!validateStep(currentStep)) {
        return
      }

      const nextStep = currentStep + 1
      setCurrentStep(nextStep)
      setMaxVisitedStep(prev => Math.max(prev, nextStep))
      if (nextStep === 4) {
        void runAllPreSignChecks()
      }
      return
    }

    if (currentStep === 4) {
      if (!isStepValid(4)) {
        void runAllPreSignChecks({ force: true })
        return
      }

      setFinalPreviewDialogOpen(true)
      return
    }

    if (currentStep !== 5) {
      return
    }
    if (isLoadingPendingRequest || isSigningAuth || isPreparingSignaturePlan || isExecutingSignatures || isFinalizingSignatureFlow) {
      return
    }

    if (signatureFlowDone) {
      resetCreateEventFlow()
      toast.success('Form cleared.')
      return
    }

    async function run() {
      try {
        if (!preparedSignaturePlan) {
          const payload = buildPreparePayload()
          const payloadHash = keccak256(stringToHex(JSON.stringify(payload)))
          const resumed = await loadPendingSignaturePlan({
            silent: true,
            chainId: payload.chainId,
            expectedPayloadHash: payloadHash,
          })
          if (resumed) {
            if (!isFinalizationPendingStatus(resumed.pending.status)) {
              await executeSignatureFlow({
                prepared: resumed.prepared,
                signatureTxs: resumed.signatureTxs,
              })
            }
            return
          }
          const prepared = await prepareSignaturePlan()
          if (prepared && !isFinalizationPendingStatus(prepared.pending.status)) {
            await executeSignatureFlow({
              prepared: prepared.prepared,
              signatureTxs: prepared.signatureTxs,
            })
          }
          return
        }
        await executeSignatureFlow()
      }
      catch (error) {
        const message = error instanceof Error ? error.message : 'Could not complete signature flow.'
        toast.error(message)
      }
    }

    void run()
  }, [
    buildPreparePayload,
    currentStep,
    executeSignatureFlow,
    isFinalizingSignatureFlow,
    isExecutingSignatures,
    isLoadingPendingRequest,
    isSigningAuth,
    isPreparingSignaturePlan,
    isStepValid,
    loadPendingSignaturePlan,
    prepareSignaturePlan,
    preparedSignaturePlan,
    runAllPreSignChecks,
    resetCreateEventFlow,
    setFinalPreviewDialogOpen,
    signatureFlowDone,
    validateStep,
  ])

  const maybeResumePendingSignaturePlan = useCallback((targetStep: number) => {
    if (targetStep !== 5 || !eoaAddress || preparedSignaturePlan || isSigningAuth || isPreparingSignaturePlan || isLoadingPendingRequest) {
      return
    }

    const key = eoaAddress.toLowerCase()
    if (pendingResumeKeyRef.current === key) {
      return
    }
    pendingResumeKeyRef.current = key

    let payload: PreparePayloadBody
    try {
      payload = buildPreparePayload()
    }
    catch {
      return
    }

    const payloadHash = keccak256(stringToHex(JSON.stringify(payload)))
    void loadPendingSignaturePlan({
      silent: true,
      chainId: payload.chainId,
      expectedPayloadHash: payloadHash,
    })
  }, [
    buildPreparePayload,
    eoaAddress,
    isLoadingPendingRequest,
    isPreparingSignaturePlan,
    isSigningAuth,
    loadPendingSignaturePlan,
    preparedSignaturePlan,
  ])

  const continueFromFinalPreview = useCallback(() => {
    setFinalPreviewDialogOpen(false)
    setCurrentStep(5)
    setMaxVisitedStep(prev => Math.max(prev, 5))
    maybeResumePendingSignaturePlan(5)
  }, [maybeResumePendingSignaturePlan])

  const goBack = useCallback(() => {
    setCurrentStep(prev => Math.max(1, prev - 1))
  }, [])

  const handleStepClick = useCallback((step: number) => {
    if (!clickableStepMap[step]) {
      return
    }

    setCurrentStep(step)
    setMaxVisitedStep(prev => Math.max(prev, step))
    if (step === 4) {
      void runAllPreSignChecks()
    }
    if (step === 5) {
      maybeResumePendingSignaturePlan(step)
    }
  }, [clickableStepMap, maybeResumePendingSignaturePlan, runAllPreSignChecks])

  const bypassIssue = useCallback((issue: AiValidationIssue) => {
    const key = getAiIssueKey(issue)
    setBypassedIssueKeys((previous) => {
      if (previous.includes(key)) {
        return previous
      }
      return [...previous, key]
    })
  }, [])

  const goToIssueStep = useCallback((issue: AiValidationIssue) => {
    setCurrentStep(issue.step)
    setMaxVisitedStep(prev => Math.max(prev, issue.step))
  }, [])

  const togglePreSignCheck = useCallback((key: PreSignCheckKey, hasIssue: boolean) => {
    if (hasIssue) {
      return
    }
    setExpandedPreSignChecks(previous => ({
      ...previous,
      [key]: !previous[key],
    }))
  }, [])

  const isStepFourPreSignChecksRunning = fundingCheckState === 'checking'
    || allowedCreatorCheckState === 'checking'
    || proposerWhitelistCheckState === 'checking'
    || slugValidationState === 'checking'
    || openRouterCheckState === 'checking'
    || contentCheckState === 'checking'
  const stepFourNextButtonContent = isStepValid(4)
    ? 'Preview'
    : (
        <>
          {isStepFourPreSignChecksRunning && <Loader2Icon className="mr-2 size-4 animate-spin" />}
          {isStepFourPreSignChecksRunning ? 'Re-checking...' : 'Re-check'}
        </>
      )

  return {
    router,
    eoaAddress,
    eoaShortAddress,
    selectedCreatorAddress,
    currentStep,
    maxVisitedStep,
    form,
    titleTemplate,
    setTitleTemplate,
    slugTemplate,
    setSlugTemplate,
    automaticWalletAddress,
    setAutomaticWalletAddress,
    recurrenceUnit,
    setRecurrenceUnit,
    recurrenceInterval,
    setRecurrenceInterval,
    signers,
    isLoadingSigners,
    sportsForm,
    defaultSportsMatchQuery,
    sportsMatchQuery,
    setSportsMatchQuery,
    sportsMatchCandidates,
    selectedSportsMatch,
    isSearchingSportsMatches,
    sportsMatchError,
    mainCategories,
    categoryQuery,
    setCategoryQuery,
    eventImageFile,
    teamLogoFiles,
    optionImageFiles,
    storedAssets,
    slugValidationState,
    slugCheckError,
    resolutionType,
    handleResolutionTypeChange,
    requiredRewardUsdc,
    targetChainId,
    eoaUsdcBalance,
    fundingCheckState,
    fundingCheckError,
    eoaPolBalance,
    requiredGasPol,
    nativeGasCheckState,
    nativeGasCheckError,
    allowedCreatorCheckState,
    allowedCreatorCheckError,
    proposerWhitelistCheckState,
    proposerWhitelistCheckError,
    openRouterCheckState,
    openRouterCheckError,
    contentCheckState,
    contentCheckIssues,
    contentCheckWarnings,
    bypassedIssueKeys,
    contentCheckProgressLine,
    contentCheckError,
    isAddingCreatorWallet,
    creatorWalletDialogOpen,
    setCreatorWalletDialogOpen,
    proposersDialogOpen,
    setProposersDialogOpen,
    creatorWalletName,
    setCreatorWalletName,
    isGeneratingRules,
    isSigningAuth,
    isPreparingSignaturePlan,
    isExecutingSignatures,
    isFinalizingSignatureFlow,
    isLoadingPendingRequest,
    authChallengeExpiresAtMs,
    signatureFlowDone,
    signatureFlowError,
    pendingWorkflowRequestId,
    pendingWorkflowStatus,
    preparedSignaturePlan,
    signatureTxs,
    expandedPreSignChecks,
    rulesGeneratorDialogOpen,
    setRulesGeneratorDialogOpen,
    finalPreviewDialogOpen,
    setFinalPreviewDialogOpen,
    resetFormDialogOpen,
    setResetFormDialogOpen,
    isAddressCopied,
    isBinaryOutcomesEditable,
    setIsBinaryOutcomesEditable,
    areMultiOutcomesEditable,
    setAreMultiOutcomesEditable,
    isCustomSportSlug,
    isCustomLeagueSlug,
    eventEndDateInputRef,
    sportsStartTimeInputRef,
    eventImagePreviewUrl,
    optionImagePreviewUrls,
    teamLogoPreviewUrls,
    hasEventImage,
    hasTeamLogoByHostStatus,
    selectedMainCategory,
    isSportsEvent,
    sportsMarketTypeGroups,
    normalizedSportSlug: slugify(sportsForm.sportSlug),
    availableLeagueOptions,
    isKnownSportSlug: sportsSlugCatalog.sportOptions.some(option => option.value === slugify(sportsForm.sportSlug)),
    isKnownLeagueSlug: availableLeagueOptions.some(option => option.value === slugify(sportsForm.leagueSlug)),
    sportSlugSelectValue,
    leagueSlugSelectValue,
    baseEventSlug,
    sportsDerivedContent,
    marketCount,
    requiredTotalRewardUsdc,
    optionQuestionPlaceholder,
    optionNamePlaceholder,
    optionShortNamePlaceholder,
    titleCategorySuggestions,
    filteredCategorySuggestions,
    selectedCategoryChips,
    sportsCustomCategoryChips,
    scheduleDateValue,
    scheduleOccurrenceDate,
    recurrenceIntervalNumber,
    hasRecurringDeployHistory,
    automaticDeployAtDate,
    nextRecurringResolutionDate,
    nextRecurringDeployDate,
    recurringResolvedTitle,
    effectiveRecurringSlugTemplate,
    recurringResolvedSlug,
    recurringResolvedRules,
    effectiveResolutionRules,
    recurringOccurrencePreviews,
    recurringPreviewErrors,
    recurringEditorialWarnings,
    recurringRequiresServerWalletSetup,
    stepLabels,
    previewEndDate,
    previewTitle,
    previewSlug,
    previewMarkets,
    tradePreviewMarket,
    previewEventUrl,
    isMultiMarketPreview,
    pendingAiIssues,
    fundingHasIssue,
    nativeGasHasIssue,
    allowedCreatorHasIssue,
    proposerWhitelistHasIssue,
    slugHasIssue,
    openRouterHasIssue,
    contentHasIssue,
    contentIndicatorState,
    completedSignatureCount,
    finalizeInProgressAccepted,
    finalizeStepSucceeded,
    finalizeStepIsRunning,
    finalizeStepHasError,
    authPhaseCompleted,
    totalSignatureUnits,
    completedSignatureUnits,
    signatureProgressPercent,
    authChallengeRemainingSeconds,
    authChallengeCountdownLabel,
    clickableStepMap,
    isStepValid,
    handleSportsFieldChange,
    handleSportsTeamChange,
    applySportsMatchCandidate,
    clearSportsMatchCandidate,
    searchSportsMatches,
    handleSportsTeamLogoUpload,
    handleSportsPropChange,
    handleSportSlugSelectChange,
    handleLeagueSlugSelectChange,
    addSportsProp,
    removeSportsProp,
    handleSportsCustomMarketChange,
    addSportsCustomMarket,
    removeSportsCustomMarket,
    handleFieldChange,
    handleEndDateInputValueChange,
    handleSportsStartTimeInputValueChange,
    addCategory,
    addCategoryFromInput,
    removeCategory,
    handleEventImageUpload,
    handleOptionChange,
    addOption,
    removeOption,
    handleOptionImageUpload,
    showFirstError,
    copyWalletAddress,
    openAdminSettings,
    validateStep,
    resetCreateEventFlow,
    handleResetFormClick,
    confirmResetForm,
    goNext,
    goBack,
    handleStepClick,
    bypassIssue,
    goToIssueStep,
    togglePreSignCheck,
    continueFromFinalPreview,
    generateRulesWithAi,
    addCurrentWalletToAllowedCreators,
    runProposerWhitelistCheck,
    setProposerWhitelistCheckState,
    isStepFourPreSignChecksRunning,
    stepFourNextButtonContent,
    creationMode,
    sportsSlugCatalog,
  }
}
