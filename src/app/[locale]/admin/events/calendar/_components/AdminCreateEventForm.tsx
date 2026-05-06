'use client'

import type { Route } from 'next'
import type { ChangeEvent } from 'react'
import type {
  AdminCreateEventFormProps,
  AiValidationIssue,
  AllowedCreatorCheckState,
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
  RecurringOccurrencePreview,
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
import { useAppKitAccount } from '@reown/appkit/react'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleHelpIcon,
  CopyIcon,
  ExternalLinkIcon,
  ImageIcon,
  ImageUp,
  Loader2Icon,
  PlusIcon,
  SparkleIcon,
  SquarePenIcon,
  Trash2Icon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createPublicClient, formatUnits, getAddress, http, isAddress, keccak256, stringToHex, toHex } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'
import AppLink from '@/components/AppLink'
import EventIconImage from '@/components/EventIconImage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
import { AMOY_CHAIN_ID } from '@/lib/network'
import { cn } from '@/lib/utils'
import { defaultViemNetwork, defaultViemRpcUrl } from '@/lib/viem-network'
import { useUser } from '@/stores/useUser'
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
  MIN_AMOY_PRIORITY_FEE_WEI,
  OPENROUTER_CHECK_TIMEOUT_MS,
  PREPARE_POLL_DELAY_MS,
  PREPARE_POLL_MAX_ATTEMPTS,
  RECURRENCE_OPTIONS,
  SIGNATURE_COUNTDOWN_INTERVAL_MS,
  SLUG_CHECK_TIMEOUT_MS,
  TEMPLATE_TOKEN_EXAMPLES,
  TEMPLATE_TOKEN_HELP_TEXT,
  TOTAL_STEPS,
  USDC_DECIMALS,
} from './admin-create-event-form-constants'
import { CheckIndicator, OutcomeStateDot, SignatureTxIndicator } from './admin-create-event-form-indicators'
import {
  areCategoryItemsEqual,
  areOptionItemsEqual,
  buildStepErrors,
  createInitialForm,
  createOption,
  extractTitleCategorySuggestions,
  fetchAdminApi,
  fetchAdminApiWithTimeout,
  formatEventScheduleLabel,
  formatSignatureCountdown,
  getAiIssueKey,
  getChainLabel,
  getExplorerTxBase,
  hasRecurringDeploymentHistory,
  isAiRulesResponse,
  isAiValidationResponse,
  isAllowedCreatorsResponse,
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
  parseMinTipCapFromError,
  readApiError,
  readResponseBody,
  readResponseErrorMessage,
  resolveStoredAssetFile,
  shortenAddress,
  shouldRetryFinalizeRequest,
} from './admin-create-event-form-utils'

function useAdminCreateEventForm({
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
  const { address: connectedAddress } = useAppKitAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
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
  const eoaAddress = useMemo(() => {
    const candidate = connectedAddress ?? user?.address ?? ''
    if (!candidate || !isAddress(candidate)) {
      return null
    }
    return getAddress(candidate)
  }, [connectedAddress, user?.address])
  const eoaShortAddress = useMemo(
    () => (eoaAddress ? shortenAddress(eoaAddress) : ''),
    [eoaAddress],
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
  const [requiredRewardUsdc, setRequiredRewardUsdc] = useState(FALLBACK_REQUIRED_USDC)
  const [targetChainId, setTargetChainId] = useState<number>(DEFAULT_CREATE_EVENT_CHAIN_ID)
  const [eoaUsdcBalance, setEoaUsdcBalance] = useState(0)
  const [fundingCheckState, setFundingCheckState] = useState<FundingCheckState>('idle')
  const [fundingCheckError, setFundingCheckError] = useState('')
  const [eoaPolBalance, setEoaPolBalance] = useState(0)
  const [requiredGasPol, setRequiredGasPol] = useState(0)
  const [nativeGasCheckState, setNativeGasCheckState] = useState<NativeGasCheckState>('idle')
  const [nativeGasCheckError, setNativeGasCheckError] = useState('')
  const [allowedCreatorCheckState, setAllowedCreatorCheckState] = useState<AllowedCreatorCheckState>('idle')
  const [allowedCreatorCheckError, setAllowedCreatorCheckError] = useState('')
  const [openRouterCheckState, setOpenRouterCheckState] = useState<OpenRouterCheckState>('idle')
  const [openRouterCheckError, setOpenRouterCheckError] = useState('')
  const [contentCheckState, setContentCheckState] = useState<ContentCheckState>('idle')
  const [contentCheckIssues, setContentCheckIssues] = useState<AiValidationIssue[]>([])
  const [contentCheckWarnings, setContentCheckWarnings] = useState<AiValidationIssue[]>([])
  const [bypassedIssueKeys, setBypassedIssueKeys] = useState<string[]>([])
  const [contentCheckProgressLine, setContentCheckProgressLine] = useState('')
  const [contentCheckError, setContentCheckError] = useState('')
  const [isAddingCreatorWallet, setIsAddingCreatorWallet] = useState(false)
  const [creatorWalletDialogOpen, setCreatorWalletDialogOpen] = useState(false)
  const [creatorWalletName, setCreatorWalletName] = useState('')
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
  const [expandedPreSignChecks, setExpandedPreSignChecks] = useState<Record<PreSignCheckKey, boolean>>({
    funding: true,
    nativeGas: true,
    allowedCreator: true,
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
  const slugWalletAddress = useMemo(
    () => creationMode === 'recurring'
      ? automaticWalletAddress.trim()
      : (eoaAddress || ''),
    [automaticWalletAddress, creationMode, eoaAddress],
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
    creator: automaticWalletAddress.trim().toLowerCase(),
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
    automaticWalletAddress,
    creationMode,
    eoaAddress,
    form,
    marketCount,
    recurrenceInterval,
    recurrenceUnit,
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
  const slugHasIssue = slugValidationState === 'duplicate' || slugValidationState === 'error'
  const openRouterHasIssue = openRouterCheckState === 'error'
  const contentIndicatorState = useMemo<'checking' | 'ok' | 'error'>(() => {
    if (openRouterCheckState === 'error') {
      return 'error'
    }
    if (openRouterCheckState !== 'ok') {
      return 'checking'
    }
    if (contentCheckState === 'checking' || contentCheckState === 'idle') {
      return 'checking'
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

  if (currentStep !== 4 && finalPreviewDialogOpen) {
    setFinalPreviewDialogOpen(false)
  }

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

  if (contentCheckResetFingerprintRef.current === null) {
    contentCheckResetFingerprintRef.current = contentCheckResetFingerprint
  }
  else if (contentCheckResetFingerprintRef.current !== contentCheckResetFingerprint) {
    contentCheckResetFingerprintRef.current = contentCheckResetFingerprint
    setContentCheckState('idle')
    setContentCheckIssues([])
    setContentCheckWarnings([])
    setBypassedIssueKeys([])
    setContentCheckError('')
    setContentCheckProgressLine('')
  }

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

  if (signatureResetFingerprintRef.current === null) {
    signatureResetFingerprintRef.current = signatureResetFingerprint
  }
  else if (signatureResetFingerprintRef.current !== signatureResetFingerprint) {
    signatureResetFingerprintRef.current = signatureResetFingerprint
    if (skipNextSignatureResetRef.current) {
      skipNextSignatureResetRef.current = false
    }
    else {
      setIsSigningAuth(false)
      setIsPreparingSignaturePlan(false)
      setIsExecutingSignatures(false)
      setIsFinalizingSignatureFlow(false)
      setAuthChallengeExpiresAtMs(null)
      setPreparedSignaturePlan(null)
      setSignatureTxs([])
      setSignatureFlowDone(false)
      setSignatureFlowError('')
    }
  }

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
    slugHasIssue,
    slugValidationState,
  ])

  if (preSignChecksAutoFingerprintRef.current === null) {
    preSignChecksAutoFingerprintRef.current = preSignChecksAutoFingerprint
  }
  else if (preSignChecksAutoFingerprintRef.current !== preSignChecksAutoFingerprint) {
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
      apply('slug', slugHasIssue, slugValidationState === 'unique')
      apply('openRouter', openRouterHasIssue, openRouterCheckState === 'ok')
      apply('content', contentHasIssue, contentIndicatorState === 'ok')

      return changed ? next : previous
    })
  }

  useEffect(function loadMainCategoriesOnMount() {
    async function loadMainCategories() {
      try {
        const response = await fetch('/admin/api/main-tags')
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

  if (!automaticWalletAddress && signers.length === 1) {
    if (creationMode === 'recurring' || !eoaAddress) {
      setAutomaticWalletAddress(signers[0]!.address)
    }
  }

  const shouldSyncServerDraft = (() => {
    const previous = serverDraftSyncDepsRef.current
    if (!previous) {
      return true
    }

    return previous.creationMode !== creationMode
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
  })()

  const initialSlugSeed = Math.floor(clientNowMs / 1000).toString()

  if (shouldSyncServerDraft) {
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
  }

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

  if (signatureStorageFingerprintRef.current !== signatureStorageFingerprint) {
    signatureStorageFingerprintRef.current = signatureStorageFingerprint
    if (typeof window !== 'undefined') {
      if (!preparedSignaturePlan) {
        window.localStorage.removeItem(CREATE_EVENT_SIGNATURE_STORAGE_KEY)
      }
      else {
        window.localStorage.setItem(CREATE_EVENT_SIGNATURE_STORAGE_KEY, signatureStorageFingerprint)
      }
    }
  }

  if (creationMode === 'recurring' && !isSportsEvent) {
    const nextTitle = recurringResolvedTitle
    const nextSlug = recurringResolvedSlug
    if (form.title !== nextTitle || form.slug !== nextSlug) {
      setForm(previous => ({
        ...previous,
        title: nextTitle,
        slug: nextSlug,
      }))
    }
  }

  if (isSportsEvent) {
    const shouldSyncSportsDerivedForm = form.slug !== sportsDerivedContent.eventSlug
      || form.marketMode !== 'multi_multiple'
      || !areCategoryItemsEqual(form.categories, sportsDerivedContent.categories)
      || !areOptionItemsEqual(form.options, sportsDerivedContent.options)
      || form.binaryQuestion !== ''
      || form.binaryOutcomeYes !== 'Yes'
      || form.binaryOutcomeNo !== 'No'
    if (shouldSyncSportsDerivedForm) {
      setForm(prev => ({
        ...prev,
        slug: sportsDerivedContent.eventSlug,
        marketMode: 'multi_multiple',
        categories: sportsDerivedContent.categories,
        options: sportsDerivedContent.options,
        binaryQuestion: '',
        binaryOutcomeYes: 'Yes',
        binaryOutcomeNo: 'No',
      }))
    }

    if (Object.keys(optionImageFiles).length > 0) {
      setOptionImageFiles({})
    }
  }

  const autoSlugFingerprint = `${creationMode}:${isSportsEvent ? 'sports' : 'default'}:${slugSuffix}:${sportsDerivedContent.eventSlug}:${form.title}`
  if (autoSlugFingerprintRef.current === null) {
    autoSlugFingerprintRef.current = autoSlugFingerprint
  }
  else if (autoSlugFingerprintRef.current !== autoSlugFingerprint) {
    autoSlugFingerprintRef.current = autoSlugFingerprint
    if (creationMode !== 'recurring' && !isSportsEvent) {
      const nextSlug = form.title.trim()
        ? appendEventCreationSlugSuffix(slugify(form.title), slugSuffix)
        : ''
      setForm(prev => (prev.slug === nextSlug
        ? prev
        : {
            ...prev,
            slug: nextSlug,
          }))
    }
  }

  if (slugResetValueRef.current === null) {
    slugResetValueRef.current = form.slug
  }
  else if (slugResetValueRef.current !== form.slug) {
    slugResetValueRef.current = form.slug
    if (slugValidationState !== 'idle') {
      setSlugValidationState('idle')
    }
    if (slugCheckError) {
      setSlugCheckError('')
    }
  }

  if (form.marketMode === 'binary') {
    const nextBinaryQuestion = form.title
    const nextOutcomeYes = form.binaryOutcomeYes.trim() ? form.binaryOutcomeYes : 'Yes'
    const nextOutcomeNo = form.binaryOutcomeNo.trim() ? form.binaryOutcomeNo : 'No'
    if (
      form.binaryQuestion !== nextBinaryQuestion
      || form.binaryOutcomeYes !== nextOutcomeYes
      || form.binaryOutcomeNo !== nextOutcomeNo
    ) {
      setForm(previous => ({
        ...previous,
        binaryQuestion: nextBinaryQuestion,
        binaryOutcomeYes: nextOutcomeYes,
        binaryOutcomeNo: nextOutcomeNo,
      }))
    }
  }

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
        ...(isSportsEvent ? sportsDerivedContent.categories : resolvedForm.categories),
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
  }, [creationMode, eoaAddress, getResolvedDateForms, isSportsEvent, recurringResolvedRules, selectedMainCategory, sportsDerivedContent.categories, sportsDerivedContent.options, sportsDerivedContent.payload, targetChainId])

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

  const runAllowedCreatorCheck = useCallback(async () => {
    setAllowedCreatorCheckState('checking')
    setAllowedCreatorCheckError('')

    if (!eoaAddress) {
      setAllowedCreatorCheckState('no_wallet')
      return false
    }

    try {
      const response = await fetchAdminApi(`/event-creations/allowed-creators?address=${encodeURIComponent(eoaAddress)}`, {
        method: 'GET',
        cache: 'no-store',
      })

      const payload = await response.json().catch(() => null) as unknown
      const apiError = readApiError(payload)

      if (!response.ok || apiError || !isAllowedCreatorsResponse(payload)) {
        throw new Error(apiError || `Allowed creators check failed (${response.status})`)
      }

      setAllowedCreatorCheckState(payload.allowed ? 'ok' : 'missing')
      return Boolean(payload.allowed)
    }
    catch (error) {
      console.error('Error validating allowed creator wallets:', error)
      setAllowedCreatorCheckState('error')
      setAllowedCreatorCheckError('Could not validate allowed market creator wallets.')
      return false
    }
  }, [eoaAddress])

  const addCurrentWalletToAllowedCreators = useCallback(async () => {
    if (!eoaAddress) {
      toast.error('Connect wallet first.')
      return
    }

    const trimmedCreatorWalletName = creatorWalletName.trim()
    if (!trimmedCreatorWalletName) {
      toast.error('Wallet name is required.')
      return
    }

    setIsAddingCreatorWallet(true)
    try {
      const response = await fetchAdminApi('/event-creations/allowed-creators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceType: 'wallet',
          walletAddress: eoaAddress,
          name: trimmedCreatorWalletName,
        }),
      })

      const payload = await response.json().catch(() => null) as unknown
      const apiError = readApiError(payload)

      if (!response.ok || apiError || !isAllowedCreatorsResponse(payload)) {
        throw new Error(apiError || `Failed to add allowed creator (${response.status})`)
      }

      toast.success('Wallet added to allowed market creator wallets.')
      setCreatorWalletDialogOpen(false)
      setCreatorWalletName('')
      await runAllowedCreatorCheck()
    }
    catch (error) {
      console.error('Error adding allowed creator wallet:', error)
      toast.error(error instanceof Error ? error.message : 'Could not add wallet to allowed market creator wallets.')
    }
    finally {
      setIsAddingCreatorWallet(false)
    }
  }, [creatorWalletName, eoaAddress, runAllowedCreatorCheck])

  const runFundingCheck = useCallback(async () => {
    setFundingCheckState('checking')
    setFundingCheckError('')

    try {
      const response = await fetch(`${process.env.CREATE_MARKET_URL}/market-config`, {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(`Failed to load market config (${response.status})`)
      }

      const payload: MarketConfigResponse = await response.json()
      const required = Number(payload.requiredCreatorFundingUsdc ?? FALLBACK_REQUIRED_USDC)
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
        transport: http(defaultViemRpcUrl),
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
  }, [eoaAddress, marketCount])

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
        transport: http(defaultViemRpcUrl),
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
  }, [eoaAddress, marketCount, publicClient])

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
    const [fundingOk, nativeGasOk, creatorOk, openRouterOk, slugOk] = await Promise.all([
      runFundingCheck(),
      runNativeGasCheck(),
      runAllowedCreatorCheck(),
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

    const nextResult = fundingOk && nativeGasOk && creatorOk && openRouterOk && slugOk && contentOk
    lastPreSignChecksFingerprintRef.current = preSignChecksFingerprint
    lastPreSignChecksCompletedRef.current = true
    lastPreSignChecksResultRef.current = nextResult

    return nextResult
  }, [preSignChecksFingerprint, runAllowedCreatorCheck, runContentCheck, runFundingCheck, runNativeGasCheck, runOpenRouterCheck, runSlugCheck])

  const getFeeOverridesForTx = useCallback(async (chainId: number) => {
    if (!publicClient) {
      return {}
    }

    const priorityFloor = chainId === AMOY_CHAIN_ID ? MIN_AMOY_PRIORITY_FEE_WEI : 0n

    try {
      const estimated = await publicClient.estimateFeesPerGas()
      const hasEip1559Fees = typeof estimated.maxFeePerGas === 'bigint' || typeof estimated.maxPriorityFeePerGas === 'bigint'
      if (hasEip1559Fees) {
        const maxPriorityFeePerGas = (() => {
          const value = estimated.maxPriorityFeePerGas ?? null
          if (!value) {
            return priorityFloor > 0n ? priorityFloor : null
          }
          if (value < priorityFloor) {
            return priorityFloor
          }
          return value
        })()

        const maxFeePerGas = (() => {
          const base = estimated.maxFeePerGas ?? (typeof estimated.gasPrice === 'bigint' ? estimated.gasPrice * 2n : null)
          if (!maxPriorityFeePerGas) {
            return base
          }
          if (!base || base <= maxPriorityFeePerGas) {
            return maxPriorityFeePerGas * 2n
          }
          return base
        })()

        if (typeof maxFeePerGas === 'bigint' && typeof maxPriorityFeePerGas === 'bigint') {
          return { maxFeePerGas, maxPriorityFeePerGas }
        }
      }

      if (typeof estimated.gasPrice === 'bigint') {
        const maxPriorityFeePerGas = estimated.gasPrice < priorityFloor ? priorityFloor : estimated.gasPrice
        return {
          maxPriorityFeePerGas,
          maxFeePerGas: maxPriorityFeePerGas * 2n,
        }
      }
    }
    catch (error) {
      console.warn('Could not estimate fees with estimateFeesPerGas:', error)
    }

    try {
      const gasPrice = await publicClient.getGasPrice()
      const maxPriorityFeePerGas = gasPrice < priorityFloor ? priorityFloor : gasPrice
      return {
        maxPriorityFeePerGas,
        maxFeePerGas: maxPriorityFeePerGas * 2n,
      }
    }
    catch (error) {
      console.warn('Could not estimate fees with getGasPrice:', error)
    }

    if (priorityFloor > 0n) {
      return {
        maxPriorityFeePerGas: priorityFloor,
        maxFeePerGas: priorityFloor * 2n,
      }
    }

    return {}
  }, [publicClient])

  const applyPreparedSignatureState = useCallback((input: {
    prepared: PrepareResponse
    confirmedTxs: PrepareFinalizeRequestTx[]
    errorMessage?: string | null
  }) => {
    const confirmedById = new Map(input.confirmedTxs.map(item => [item.id, item.hash]))
    const txs: SignatureExecutionTx[] = input.prepared.txPlan.map((planned) => {
      const hash = confirmedById.get(planned.id)
      return {
        ...planned,
        status: hash ? 'success' : 'idle',
        hash: hash ?? undefined,
      }
    })

    skipNextSignatureResetRef.current = true
    setTargetChainId(input.prepared.chainId)
    setPreparedSignaturePlan(input.prepared)
    setSignatureTxs(txs)
    setSignatureFlowDone(false)
    setSignatureFlowError(typeof input.errorMessage === 'string' ? input.errorMessage : '')
    setAuthChallengeExpiresAtMs(null)
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

    const response = await fetch(`${process.env.CREATE_MARKET_URL}/pending?${query.toString()}`, {
      method: 'GET',
      cache: 'no-store',
    })

    const payload = await response.json().catch(() => null) as unknown
    const apiError = readApiError(payload)
    if (!response.ok || apiError || !isPendingRequestResponse(payload)) {
      throw new Error(apiError || `Pending request lookup failed (${response.status})`)
    }

    return payload.request
  }, [eoaAddress])

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

        if (pending.prepared) {
          applyPreparedSignatureState({
            prepared: pending.prepared,
            confirmedTxs: pending.txs,
            errorMessage: pending.errorMessage,
          })
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
      return false
    }

    const silent = Boolean(options?.silent)
    setIsLoadingPendingRequest(true)

    try {
      const pending = await fetchPendingSignatureRequest({
        chainId: options?.chainId,
        requestId: options?.requestId,
      })

      if (!pending) {
        return false
      }

      if (options?.expectedPayloadHash && pending.payloadHash.toLowerCase() !== options.expectedPayloadHash.toLowerCase()) {
        return false
      }

      setPendingWorkflowRequestId(pending.requestId)
      setPendingWorkflowStatus(pending.status)

      if (pending.prepared) {
        if (!isAddress(pending.prepared.creator) || getAddress(pending.prepared.creator) !== eoaAddress) {
          setPendingWorkflowRequestId(null)
          setPendingWorkflowStatus(null)
          return false
        }

        applyPreparedSignatureState({
          prepared: pending.prepared,
          confirmedTxs: pending.txs,
          errorMessage: pending.errorMessage,
        })
        if (pending.status === 'finalized') {
          setSignatureFlowDone(true)
        }
        else {
          setSignatureFlowDone(false)
        }
      }

      if (pending.status === 'prepare_running') {
        await pollPendingPreparation({
          requestId: pending.requestId,
          chainId: pending.chainId,
          expectedPayloadHash: options?.expectedPayloadHash,
        })
      }
      else if (pending.status === 'finalize_running') {
        await pollPendingFinalization({
          requestId: pending.requestId,
          chainId: pending.chainId,
        })
      }
      else if (!pending.prepared) {
        setPendingWorkflowRequestId(null)
        setPendingWorkflowStatus(null)
        return false
      }
      else if (pending.status !== 'finalized' && pending.status !== 'finalize_in_progress') {
        setPendingWorkflowRequestId(null)
        setPendingWorkflowStatus(null)
      }

      if (!silent) {
        toast.success('Recovered pending signature progress from server.')
      }
      return true
    }
    catch (error) {
      console.error('Error loading pending signature plan:', error)
      setPendingWorkflowRequestId(null)
      setPendingWorkflowStatus(null)
      if (!silent) {
        const message = error instanceof Error ? error.message : 'Could not recover pending signature progress.'
        toast.error(message)
      }
      return false
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

    const response = await fetch(`${process.env.CREATE_MARKET_URL}/tx-confirm`, {
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
  }, [eoaAddress])

  const resumeAnyPendingSignaturePlan = useCallback(() => {
    void loadPendingSignaturePlan({
      silent: false,
      chainId: targetChainId,
    })
  }, [loadPendingSignaturePlan, targetChainId])

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
    if (!walletClient) {
      throw new Error('Wallet client not available.')
    }

    setIsPreparingSignaturePlan(true)
    setIsSigningAuth(true)
    setSignatureFlowError('')
    setSignatureFlowDone(false)
    setAuthChallengeExpiresAtMs(null)
    let currentPayloadHash = ''
    let currentPayloadChainId: number | null = null

    try {
      const activeWalletClient = walletClient
      const payload = buildPreparePayload()
      const payloadJson = JSON.stringify(payload)
      const payloadHash = keccak256(stringToHex(payloadJson))
      currentPayloadHash = payloadHash
      currentPayloadChainId = payload.chainId

      const authResponse = await fetch(`${process.env.CREATE_MARKET_URL}/prepare-auth`, {
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
      if (activeWalletClient.chain?.id && activeWalletClient.chain.id !== authPayload.chainId) {
        throw new Error(`Switch wallet to ${getChainLabel()} before signing auth.`)
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

      const response = await fetch(`${process.env.CREATE_MARKET_URL}/prepare`, {
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
          return
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
    eoaAddress,
    eventImageFile,
    form.options,
    isSportsEvent,
    storedAssets.eventImage,
    storedAssets.optionImages,
    storedAssets.teamLogos,
    loadPendingSignaturePlan,
    optionImageFiles,
    pollPendingPreparation,
    runWithSignaturePrompt,
    teamLogoFiles,
    walletClient,
  ])

  const finalizeSignatureFlow = useCallback(async (completedTxsInput?: PrepareFinalizeRequestTx[]) => {
    if (!preparedSignaturePlan) {
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
        const response = await fetch(`${process.env.CREATE_MARKET_URL}/finalize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requestId: preparedSignaturePlan.requestId,
            creator: eoaAddress,
            txs: completedTxs,
          }),
        })

        const { payload: responsePayload, text: responseText } = await readResponseBody(response)
        if (response.ok && isFinalizeResponse(responsePayload)) {
          if (responsePayload.requestId !== preparedSignaturePlan.requestId) {
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
              chainId: preparedSignaturePlan.chainId,
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
  }, [eoaAddress, pollPendingFinalization, preparedSignaturePlan, signatureTxs])

  const executeSignatureFlow = useCallback(async () => {
    if (!preparedSignaturePlan) {
      throw new Error('Prepare signatures first.')
    }
    if (!eoaAddress) {
      throw new Error('Connect wallet first.')
    }
    if (!walletClient) {
      throw new Error('Wallet client not available.')
    }
    if (!publicClient) {
      throw new Error('Public client not available.')
    }
    const senderAddress = eoaAddress
    const activeWalletClient = walletClient

    if (activeWalletClient.chain?.id && activeWalletClient.chain.id !== preparedSignaturePlan.chainId) {
      throw new Error(`Switch wallet to ${getChainLabel()} before signing.`)
    }

    setIsExecutingSignatures(true)
    setSignatureFlowError('')
    setSignatureFlowDone(false)

    try {
      const completedById = new Map<string, string>()
      for (let index = 0; index < preparedSignaturePlan.txPlan.length; index += 1) {
        const planned = preparedSignaturePlan.txPlan[index]
        const existing = signatureTxs[index]
        if (existing?.status === 'success' && existing.hash) {
          completedById.set(planned.id, existing.hash)
        }
      }

      for (let index = 0; index < preparedSignaturePlan.txPlan.length; index += 1) {
        const existingTx = signatureTxs[index]
        if (existingTx?.status === 'success') {
          continue
        }

        const tx = preparedSignaturePlan.txPlan[index]
        if (!isAddress(tx.to)) {
          throw new Error(`Invalid tx target for ${tx.id}.`)
        }
        const toAddress = tx.to as `0x${string}`
        if (!tx.data.startsWith('0x')) {
          throw new Error(`Invalid tx data for ${tx.id}.`)
        }

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

          const existingReceipt = await publicClient.waitForTransactionReceipt({
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
            await persistConfirmedTxs(preparedSignaturePlan.requestId, completedTxs)
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
          return activeWalletClient.sendTransaction({
            account: senderAddress,
            chain: activeWalletClient.chain,
            to: toAddress,
            data: tx.data as `0x${string}`,
            value: BigInt(tx.value || '0'),
            ...(overrides ?? {}),
          })
        }

        async function sendWithRpcFallback(overrides?: {
          maxFeePerGas?: bigint
          maxPriorityFeePerGas?: bigint
        }) {
          try {
            return await runWithSignaturePrompt(() => send(overrides), {
              title: 'Confirm transaction',
              description: 'Open your wallet and approve the transaction to continue.',
            })
          }
          catch (sendError) {
            const message = sendError instanceof Error ? sendError.message : String(sendError)
            if (!isBigIntSerializationError(message)) {
              throw sendError
            }

            const txRequest = {
              from: senderAddress,
              to: toAddress,
              data: tx.data as `0x${string}`,
              value: toHex(BigInt(tx.value || '0')),
            }
            const rpcHash = await runWithSignaturePrompt(
              () => activeWalletClient.request({
                method: 'eth_sendTransaction',
                params: [txRequest],
              }) as Promise<unknown>,
              {
                title: 'Confirm transaction',
                description: 'Open your wallet and approve the transaction to continue.',
              },
            )
            if (typeof rpcHash !== 'string' || !rpcHash.startsWith('0x')) {
              throw new Error('Wallet provider returned an invalid transaction hash.')
            }
            return rpcHash
          }
        }

        let hash: string
        try {
          hash = await sendWithRpcFallback()
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

          const minTip = parseMinTipCapFromError(message)
          if (minTip) {
            hash = await sendWithRpcFallback({
              maxPriorityFeePerGas: minTip,
              maxFeePerGas: minTip * 2n,
            })
          }
          else {
            const feeOverrides = await getFeeOverridesForTx(preparedSignaturePlan.chainId)
            const retryOverrides: {
              maxFeePerGas?: bigint
              maxPriorityFeePerGas?: bigint
            } = feeOverrides
            if (!retryOverrides.maxFeePerGas && !retryOverrides.maxPriorityFeePerGas) {
              throw sendError
            }
            hash = await sendWithRpcFallback(retryOverrides)
          }
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

        const receipt = await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` })
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
          await persistConfirmedTxs(preparedSignaturePlan.requestId, completedTxs)
        }
        catch (persistError) {
          console.error('Could not persist confirmed tx hashes:', persistError)
        }
      }

      const completedTxs = Array.from(completedById.entries()).map(([id, hash]) => ({ id, hash }))
      if (completedTxs.length > 0) {
        try {
          await persistConfirmedTxs(preparedSignaturePlan.requestId, completedTxs)
        }
        catch (persistError) {
          console.error('Could not persist confirmed tx hashes before finalize:', persistError)
        }
      }

      await finalizeSignatureFlow(completedTxs)
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
    getFeeOverridesForTx,
    persistConfirmedTxs,
    preparedSignaturePlan,
    publicClient,
    runWithSignaturePrompt,
    signatureTxs,
    walletClient,
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
    setAllowedCreatorCheckState('idle')
    setAllowedCreatorCheckError('')
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
    setAllowedCreatorCheckState('idle')
    setAllowedCreatorCheckError('')
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
            return
          }
          await prepareSignaturePlan()
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
    mainCategories,
    categoryQuery,
    setCategoryQuery,
    eventImageFile,
    teamLogoFiles,
    optionImageFiles,
    storedAssets,
    slugValidationState,
    slugCheckError,
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
    resumeAnyPendingSignaturePlan,
    continueFromFinalPreview,
    generateRulesWithAi,
    addCurrentWalletToAllowedCreators,
    isStepFourPreSignChecksRunning,
    stepFourNextButtonContent,
    creationMode,
    sportsSlugCatalog,
  }
}

export default function AdminCreateEventForm({
  sportsSlugCatalog,
  creationMode = 'single',
  initialDraftRecord = null,
  draftId = null,
  initialTitle = '',
  initialSlug = '',
  initialEndDateIso = '',
  allowPastResolutionDate = false,
  hasConfiguredServerSigners = true,
  serverDraftPayload = null,
  serverAssetPayload = null,
}: AdminCreateEventFormProps) {
  const hook = useAdminCreateEventForm({
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
  })

  const {
    router,
    eoaAddress,
    eoaShortAddress,
    currentStep,
    maxVisitedStep,
    form,
    titleTemplate,
    setTitleTemplate,
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
    mainCategories,
    categoryQuery,
    setCategoryQuery,
    slugValidationState,
    slugCheckError,
    requiredRewardUsdc,
    eoaUsdcBalance,
    fundingCheckState,
    fundingCheckError,
    eoaPolBalance,
    requiredGasPol,
    nativeGasCheckState,
    nativeGasCheckError,
    allowedCreatorCheckState,
    allowedCreatorCheckError,
    openRouterCheckState,
    openRouterCheckError,
    contentCheckState,
    contentCheckWarnings,
    contentCheckProgressLine,
    contentCheckError,
    isAddingCreatorWallet,
    creatorWalletDialogOpen,
    setCreatorWalletDialogOpen,
    creatorWalletName,
    setCreatorWalletName,
    isGeneratingRules,
    isSigningAuth,
    isPreparingSignaturePlan,
    isExecutingSignatures,
    isFinalizingSignatureFlow,
    isLoadingPendingRequest,
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
    selectedMainCategory,
    isSportsEvent,
    sportsMarketTypeGroups,
    availableLeagueOptions,
    sportSlugSelectValue,
    leagueSlugSelectValue,
    sportsDerivedContent,
    marketCount,
    requiredTotalRewardUsdc,
    optionQuestionPlaceholder,
    optionNamePlaceholder,
    optionShortNamePlaceholder,
    filteredCategorySuggestions,
    selectedCategoryChips,
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
    recurringEditorialWarnings,
    recurringRequiresServerWalletSetup,
    stepLabels,
    previewEndDate,
    previewTitle,
    previewMarkets,
    tradePreviewMarket,
    previewEventUrl,
    isMultiMarketPreview,
    pendingAiIssues,
    fundingHasIssue,
    nativeGasHasIssue,
    allowedCreatorHasIssue,
    slugHasIssue,
    openRouterHasIssue,
    contentHasIssue,
    contentIndicatorState,
    finalizeInProgressAccepted,
    finalizeStepSucceeded,
    finalizeStepIsRunning,
    finalizeStepHasError,
    totalSignatureUnits,
    completedSignatureUnits,
    signatureProgressPercent,
    authChallengeRemainingSeconds,
    authChallengeCountdownLabel,
    clickableStepMap,
    isStepValid,
    handleSportsFieldChange,
    handleSportsTeamChange,
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
    copyWalletAddress,
    openAdminSettings,
    handleResetFormClick,
    confirmResetForm,
    goNext,
    goBack,
    handleStepClick,
    bypassIssue,
    goToIssueStep,
    togglePreSignCheck,
    resumeAnyPendingSignaturePlan,
    continueFromFinalPreview,
    generateRulesWithAi,
    addCurrentWalletToAllowedCreators,
    stepFourNextButtonContent,
  } = hook

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault()
      }}
    >
      <Card className="bg-background">
        <CardContent className="py-4">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
            {stepLabels.map((label, index) => {
              const step = index + 1
              const active = currentStep === step
              const done = step !== currentStep && step <= maxVisitedStep && isStepValid(step)
              const clickable = clickableStepMap[step]

              return (
                <button
                  type="button"
                  key={label}
                  onClick={() => handleStepClick(step)}
                  disabled={!clickable}
                  className={cn(
                    'rounded-md border p-3 text-left text-sm transition-colors',
                    active && 'border-primary bg-primary/5 font-medium',
                    done && 'border-emerald-600/50',
                    clickable ? 'cursor-pointer hover:border-primary/40' : 'cursor-not-allowed opacity-60',
                  )}
                >
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">
                    STEP
                    {' '}
                    {step}
                  </p>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="text-base font-medium text-foreground">{label}</p>
                    {done && (
                      <span className="
                        flex size-5 shrink-0 items-center justify-center rounded-full border border-emerald-600
                        bg-emerald-600 text-background
                      "
                      >
                        <CheckIcon className="size-3" />
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {currentStep === 1 && (
        <div className="space-y-6">
          <Card className="bg-background">
            <CardHeader className="pt-8 pb-6">
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="size-5" />
                Event details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pb-8">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[224px_1fr]">
                <div className="space-y-3">
                  <Label htmlFor="event-image">Event image</Label>
                  <Input
                    id="event-image"
                    type="file"
                    accept="image/*"
                    onChange={handleEventImageUpload}
                    className="sr-only"
                  />
                  <label
                    htmlFor="event-image"
                    className={`
                      group relative flex size-56 cursor-pointer items-center justify-center overflow-hidden rounded-xl
                      border border-dashed border-border bg-muted/20 text-muted-foreground transition
                      hover:border-primary/60
                    `}
                  >
                    <span className={`
                      pointer-events-none absolute inset-0 bg-foreground/0 transition
                      group-hover:bg-foreground/5
                    `}
                    />
                    {eventImagePreviewUrl
                      ? (
                          <EventIconImage
                            src={eventImagePreviewUrl}
                            alt="Event image preview"
                            sizes="256px"
                            unoptimized
                            containerClassName="size-full"
                          />
                        )
                      : (
                          <div className="text-sm text-muted-foreground">256 × 256 preview</div>
                        )}
                    <ImageUp
                      className={`
                        pointer-events-none absolute top-1/2 left-1/2 z-10 size-7 -translate-1/2 text-foreground/70
                        opacity-0 transition
                        group-hover:opacity-100
                      `}
                    />
                  </label>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="event-title">
                        {creationMode === 'recurring' ? 'Title template' : 'Event title'}
                      </Label>
                      {creationMode === 'recurring' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="text-muted-foreground transition hover:text-foreground">
                              <CircleHelpIcon className="size-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-left">
                            <div className="grid gap-2">
                              <p>{TEMPLATE_TOKEN_HELP_TEXT}</p>
                              {TEMPLATE_TOKEN_EXAMPLES.map(item => (
                                <p key={`title-token-${item}`}>{item}</p>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <Input
                      id="event-title"
                      value={creationMode === 'recurring' ? titleTemplate : form.title}
                      onChange={event => (
                        creationMode === 'recurring'
                          ? setTitleTemplate(event.target.value)
                          : handleFieldChange('title', event.target.value)
                      )}
                      placeholder={creationMode === 'recurring'
                        ? 'Example: BTC UP or DOWN on {{date}}?'
                        : 'Example: Will the U.S. Senate pass the budget by March 31, 2026?'}
                    />
                    {creationMode === 'recurring' && recurringResolvedTitle && (
                      <p className="text-xs text-muted-foreground">
                        Preview:
                        {' '}
                        {recurringResolvedTitle}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="event-slug">
                        {creationMode === 'recurring' ? 'Slug template' : 'Slug'}
                      </Label>
                      {creationMode === 'recurring' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="text-muted-foreground transition hover:text-foreground">
                              <CircleHelpIcon className="size-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-left">
                            <div className="grid gap-2">
                              <p>{TEMPLATE_TOKEN_HELP_TEXT}</p>
                              {TEMPLATE_TOKEN_EXAMPLES.map(item => (
                                <p key={`slug-token-${item}`}>{item}</p>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <Input
                      id="event-slug"
                      value={creationMode === 'recurring' ? effectiveRecurringSlugTemplate : form.slug}
                      readOnly={creationMode !== 'recurring'}
                      onChange={event => setSlugTemplate(event.target.value)}
                      placeholder={creationMode === 'recurring' ? 'Example: btc-above-120k-{{day}}-{{month_name_lower}}' : ''}
                    />
                    {creationMode === 'recurring' && recurringResolvedSlug && (
                      <p className="text-xs text-muted-foreground">
                        Preview:
                        {' '}
                        {recurringResolvedSlug}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="event-end-date">
                          {creationMode === 'recurring'
                            ? (hasRecurringDeployHistory ? 'Next resolution date' : 'First resolution date')
                            : 'Resolution date'}
                        </Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="text-muted-foreground transition hover:text-foreground">
                              <CircleHelpIcon className="size-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-left">
                            <div className="grid gap-1">
                              {creationMode === 'recurring'
                                ? (
                                    <>
                                      <p>This date is always the resolution date for the occurrence shown here.</p>
                                      <p>
                                        {hasRecurringDeployHistory
                                          ? (
                                              automaticDeployAtDate
                                                ? `This occurrence becomes deployable on ${formatEventScheduleLabel(automaticDeployAtDate)}.`
                                                : 'Set the recurrence cadence to calculate the automatic deploy time.'
                                            )
                                          : 'The first recurring event becomes deployable immediately after saving.'}
                                      </p>
                                    </>
                                  )
                                : (
                                    <p>This date is the resolution date. Unique events go live when you sign and deploy them manually.</p>
                                  )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="space-y-1.5">
                        <Input
                          ref={eventEndDateInputRef}
                          id="event-end-date"
                          type="datetime-local"
                          value={form.endDateIso}
                          onChange={event => handleEndDateInputValueChange(event.currentTarget.value)}
                          onInput={event => handleEndDateInputValueChange(event.currentTarget.value)}
                          aria-describedby={!form.endDateIso ? 'event-end-date-hint' : undefined}
                          required
                          className="w-full md:max-w-[240px]"
                        />
                        {creationMode === 'recurring'
                          ? (
                              <>
                                {nextRecurringResolutionDate && nextRecurringDeployDate && (
                                  <p className="text-xs text-muted-foreground">
                                    Next cycle preview:
                                    {' '}
                                    resolves on
                                    {' '}
                                    {formatEventScheduleLabel(nextRecurringResolutionDate)}
                                    {' '}
                                    and becomes deployable on
                                    {' '}
                                    {formatEventScheduleLabel(nextRecurringDeployDate)}
                                    .
                                  </p>
                                )}
                              </>
                            )
                          : null}
                      </div>
                    </div>

                    <div className="min-w-0 space-y-2">
                      <Label>Creator</Label>
                      <Select
                        value={creationMode === 'recurring'
                          ? (automaticWalletAddress || undefined)
                          : (automaticWalletAddress || (eoaAddress ? '__eoa__' : undefined))}
                        onValueChange={value => setAutomaticWalletAddress(value === '__eoa__' ? '' : value)}
                      >
                        <SelectTrigger className="w-full min-w-0">
                          <SelectValue placeholder={creationMode === 'recurring'
                            ? (isLoadingSigners ? 'Loading creators...' : 'Select creator')
                            : (eoaAddress ? 'EOA wallet' : 'Connect EOA wallet')}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {creationMode !== 'recurring' && eoaAddress && (
                            <SelectItem value="__eoa__">
                              EOA wallet
                              {' · '}
                              {eoaShortAddress}
                            </SelectItem>
                          )}
                          {signers.map(signer => (
                            <SelectItem key={signer.address} value={signer.address}>
                              {signer.displayName}
                              {' · '}
                              {signer.shortAddress}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {creationMode === 'recurring' && (
                    <div className="grid gap-4 md:grid-cols-[120px_minmax(0,1fr)]">
                      <div className="space-y-2">
                        <Label htmlFor="recurrence-interval">Every</Label>
                        <Input
                          id="recurrence-interval"
                          inputMode="numeric"
                          value={recurrenceInterval}
                          onChange={event => setRecurrenceInterval(event.currentTarget.value.replace(/\D/g, '') || '1')}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Recurrence</Label>
                        <Select
                          value={recurrenceUnit || undefined}
                          onValueChange={value => setRecurrenceUnit(value as EventCreationRecurrenceUnit)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select cadence" />
                          </SelectTrigger>
                          <SelectContent>
                            {RECURRENCE_OPTIONS.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-background">
            <CardHeader className="pt-8 pb-6">
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pb-8">
              <div className="space-y-2">
                <Label htmlFor="main-category">Main category</Label>
                <Select
                  value={form.mainCategorySlug || undefined}
                  onValueChange={value => handleFieldChange('mainCategorySlug', value)}
                >
                  <SelectTrigger id="main-category" className="w-full">
                    <SelectValue placeholder="Select main category" />
                  </SelectTrigger>
                  <SelectContent>
                    {mainCategories.map(category => (
                      <SelectItem key={category.slug} value={category.slug}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isSportsEvent
                ? (
                    <>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="sports-section">Sports sub category</Label>
                          <Select
                            value={sportsForm.section || undefined}
                            onValueChange={value => handleSportsFieldChange('section', value as AdminSportsFormState['section'])}
                          >
                            <SelectTrigger id="sports-section" className="w-full">
                              <SelectValue placeholder="Select Games or Props" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="games">Games</SelectItem>
                              <SelectItem value="props">Props</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {sportsForm.section === 'games' && (
                        <>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="sports-start-time">Game start time</Label>
                              <Input
                                ref={sportsStartTimeInputRef}
                                id="sports-start-time"
                                type="datetime-local"
                                value={sportsForm.startTime}
                                onChange={event => handleSportsStartTimeInputValueChange(event.currentTarget.value)}
                                onInput={event => handleSportsStartTimeInputValueChange(event.currentTarget.value)}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="sports-sport-slug">Sport slug</Label>
                              <Select value={sportSlugSelectValue} onValueChange={handleSportSlugSelectChange}>
                                <SelectTrigger id="sports-sport-slug" className="w-full">
                                  <SelectValue placeholder="Select sport slug" />
                                </SelectTrigger>
                                <SelectContent>
                                  {sportsSlugCatalog.sportOptions.map(option => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value={CUSTOM_SPORTS_SLUG_SELECT_VALUE}>Custom</SelectItem>
                                </SelectContent>
                              </Select>
                              {isCustomSportSlug && (
                                <Input
                                  value={sportsForm.sportSlug}
                                  onChange={event => handleSportsFieldChange('sportSlug', event.target.value)}
                                  placeholder="Example: soccer"
                                />
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="sports-league-slug">League slug</Label>
                              <Select value={leagueSlugSelectValue} onValueChange={handleLeagueSlugSelectChange}>
                                <SelectTrigger id="sports-league-slug" className="w-full">
                                  <SelectValue placeholder="Select league slug" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableLeagueOptions.map(option => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value={CUSTOM_SPORTS_SLUG_SELECT_VALUE}>Custom</SelectItem>
                                </SelectContent>
                              </Select>
                              {isCustomLeagueSlug && (
                                <Input
                                  value={sportsForm.leagueSlug}
                                  onChange={event => handleSportsFieldChange('leagueSlug', event.target.value)}
                                  placeholder="Example: premier-league"
                                />
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {sportsForm.teams.map(team => (
                              <div key={team.hostStatus} className="space-y-4 rounded-md border p-4">
                                <div className="space-y-1">
                                  <p className="text-sm font-medium">
                                    {team.hostStatus === 'home' ? 'Home team' : 'Away team'}
                                  </p>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor={`sports-team-name-${team.hostStatus}`}>Team name</Label>
                                  <Input
                                    id={`sports-team-name-${team.hostStatus}`}
                                    value={team.name}
                                    onChange={event => handleSportsTeamChange(team.hostStatus, 'name', event.target.value)}
                                    placeholder={team.hostStatus === 'home' ? 'Example: Barcelona' : 'Example: Real Madrid'}
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor={`sports-team-abbreviation-${team.hostStatus}`}>Abbreviation (optional)</Label>
                                  <Input
                                    id={`sports-team-abbreviation-${team.hostStatus}`}
                                    value={team.abbreviation}
                                    onChange={event => handleSportsTeamChange(team.hostStatus, 'abbreviation', event.target.value)}
                                    placeholder={team.hostStatus === 'home' ? 'BAR' : 'RMA'}
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label>Team logo</Label>
                                  <Input
                                    id={`sports-team-logo-${team.hostStatus}`}
                                    type="file"
                                    accept="image/*"
                                    onChange={event => handleSportsTeamLogoUpload(team.hostStatus, event)}
                                    className="sr-only"
                                  />
                                  <label
                                    htmlFor={`sports-team-logo-${team.hostStatus}`}
                                    className={`
                                      group relative flex size-28 cursor-pointer items-center justify-center
                                      overflow-hidden rounded-xl border border-dashed border-border bg-muted/20
                                      text-muted-foreground transition
                                      hover:border-primary/60
                                    `}
                                  >
                                    <span className={`
                                      pointer-events-none absolute inset-0 bg-foreground/0 transition
                                      group-hover:bg-foreground/5
                                    `}
                                    />
                                    {teamLogoPreviewUrls[team.hostStatus]
                                      ? (
                                          <EventIconImage
                                            src={teamLogoPreviewUrls[team.hostStatus]!}
                                            alt={`${team.name || team.hostStatus} logo preview`}
                                            sizes="256px"
                                            unoptimized
                                            containerClassName="size-full"
                                          />
                                        )
                                      : (
                                          <div className="text-sm text-muted-foreground">Upload logo</div>
                                        )}
                                    <ImageUp
                                      className={`
                                        pointer-events-none absolute top-1/2 left-1/2 z-10 size-6 -translate-1/2
                                        text-foreground/70 opacity-0 transition
                                        group-hover:opacity-100
                                      `}
                                    />
                                  </label>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      <div className="space-y-2">
                        <Label>
                          Generated categories (
                          {sportsDerivedContent.categories.length}
                          )
                        </Label>
                        {sportsDerivedContent.categories.length === 0
                          ? (
                              <p className="text-sm text-muted-foreground">
                                Sports categories are generated automatically from the selected sports settings.
                              </p>
                            )
                          : (
                              <div className="flex flex-wrap gap-2">
                                {sportsDerivedContent.categories.map(item => (
                                  <div
                                    key={item.slug}
                                    className={cn(
                                      'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm',
                                      item.slug === selectedMainCategory?.slug && 'border-primary/40 bg-primary/10',
                                    )}
                                  >
                                    <span>{item.label}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                      </div>
                    </>
                  )
                : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="category-input">Sub categories</Label>
                        <div className="flex gap-2">
                          <Input
                            id="category-input"
                            value={categoryQuery}
                            onChange={event => setCategoryQuery(event.target.value)}
                            placeholder="Add at least 4 additional sub categories."
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                addCategoryFromInput()
                              }
                            }}
                          />
                          <Button type="button" variant="outline" onClick={addCategoryFromInput}>Add</Button>
                        </div>
                      </div>

                      {filteredCategorySuggestions.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {filteredCategorySuggestions.map(item => (
                            <Button key={item.slug} type="button" size="sm" variant="outline" onClick={() => addCategory(item)}>
                              {item.name}
                            </Button>
                          ))}
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>
                          Selected categories (
                          {selectedCategoryChips.length}
                          )
                        </Label>
                        {selectedCategoryChips.length === 0
                          ? (
                              <p className="text-sm text-muted-foreground">No categories selected.</p>
                            )
                          : (
                              <div className="flex flex-wrap gap-2">
                                {selectedCategoryChips.map(item => (
                                  <div
                                    key={item.slug}
                                    className={cn(
                                      'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm',
                                      item.slug === selectedMainCategory?.slug && 'border-primary/40 bg-primary/10',
                                    )}
                                  >
                                    <span>{item.label}</span>
                                    {item.slug === selectedMainCategory?.slug && (
                                      <span className="text-sm text-primary">Main</span>
                                    )}
                                    <button
                                      type="button"
                                      className="text-muted-foreground hover:text-foreground"
                                      onClick={() => removeCategory(item.slug)}
                                      disabled={item.slug === selectedMainCategory?.slug}
                                      aria-label={`Remove ${item.label}`}
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                      </div>
                    </>
                  )}
            </CardContent>
          </Card>
        </div>
      )}

      {currentStep === 2 && (
        <Card className="bg-background">
          <CardHeader className="pt-8 pb-6">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="size-5" />
              Market structure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pb-8">
            {isSportsEvent
              ? (
                  <>
                    {sportsForm.section && (
                      <div className="space-y-2">
                        <Label htmlFor="sports-event-variant">Sports template</Label>
                        <Select
                          value={sportsForm.eventVariant || undefined}
                          onValueChange={value => handleSportsFieldChange('eventVariant', value as AdminSportsFormState['eventVariant'])}
                        >
                          <SelectTrigger id="sports-event-variant" className="w-full md:max-w-md">
                            <SelectValue placeholder="Select a sports template" />
                          </SelectTrigger>
                          <SelectContent>
                            {sportsForm.section === 'games'
                              ? (
                                  <>
                                    <SelectItem value="standard">Standard game lines</SelectItem>
                                    <SelectItem value="more_markets">Soccer More Markets</SelectItem>
                                    <SelectItem value="exact_score">Exact Score</SelectItem>
                                    <SelectItem value="halftime_result">Halftime Result</SelectItem>
                                    <SelectItem value="custom">Custom sports market types</SelectItem>
                                  </>
                                )
                              : (
                                  <>
                                    <SelectItem value="standard">Player props</SelectItem>
                                    <SelectItem value="custom">Custom sports market types</SelectItem>
                                  </>
                                )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {sportsForm.section === 'games' && sportsForm.eventVariant && (
                      <div className="space-y-3 rounded-md border p-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            {sportsForm.eventVariant === 'standard' ? 'Standard game lines' : 'Moneyline base markets'}
                          </p>
                          {sportsForm.eventVariant !== 'standard' && (
                            <p className="text-sm text-muted-foreground">
                              The base game market is always created for sports games. Use this toggle to decide whether the base moneyline should include home / draw / away or only home / away.
                            </p>
                          )}
                        </div>
                        <label className="flex items-center gap-3 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            className="size-4 rounded-sm border"
                            checked={sportsForm.includeDraw}
                            onChange={event => handleSportsFieldChange('includeDraw', event.target.checked)}
                          />
                          Include draw market in addition to home and away.
                        </label>
                      </div>
                    )}

                    {sportsForm.section === 'games' && sportsForm.eventVariant === 'more_markets' && (
                      <div className="space-y-3 rounded-md border p-4">
                        <p className="text-sm font-medium">More Markets packs</p>
                        <label className="flex items-center gap-3 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            className="size-4 rounded-sm border"
                            checked={sportsForm.includeBothTeamsToScore}
                            onChange={event => handleSportsFieldChange('includeBothTeamsToScore', event.target.checked)}
                          />
                          Both Teams to Score
                        </label>
                        <label className="flex items-center gap-3 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            className="size-4 rounded-sm border"
                            checked={sportsForm.includeTotals}
                            onChange={event => handleSportsFieldChange('includeTotals', event.target.checked)}
                          />
                          Totals pack with fixed ladder 1.5 / 2.5 / 3.5 / 4.5
                        </label>
                        <label className="flex items-center gap-3 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            className="size-4 rounded-sm border"
                            checked={sportsForm.includeSpreads}
                            onChange={event => handleSportsFieldChange('includeSpreads', event.target.checked)}
                          />
                          Spreads pack with fixed ladder -1.5 for home and away
                        </label>
                      </div>
                    )}

                    {sportsForm.section === 'games' && (sportsForm.eventVariant === 'exact_score' || sportsForm.eventVariant === 'halftime_result') && (
                      <div className="rounded-md border p-4">
                        <p className="text-sm text-muted-foreground">
                          This pack is generated automatically from the selected teams and start time, and always includes the mandatory moneyline base markets using the draw selection above.
                        </p>
                      </div>
                    )}

                    {sportsForm.eventVariant === 'custom' && (
                      <div className="space-y-4 rounded-md border p-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Custom sports markets</p>
                          <p className="text-sm text-muted-foreground">
                            Choose any market type. Moneyline base markets are added automatically using the draw selection above, and row order is sent as the market group threshold automatically.
                          </p>
                        </div>

                        {sportsForm.customMarkets.map((market, index) => {
                          const marketTypeOption = resolveAdminSportsMarketTypeOption(market.sportsMarketType)
                          const defaultOutcomes = getAdminSportsMarketTypeDefaultOutcomes(market.sportsMarketType, {
                            homeTeamName: sportsForm.teams[0]?.name ?? '',
                            awayTeamName: sportsForm.teams[1]?.name ?? '',
                          })

                          return (
                            <div key={market.id} className="grid grid-cols-1 gap-4 rounded-md border p-4 md:grid-cols-2">
                              <div className="space-y-2 md:col-span-2">
                                <div className="flex items-center justify-between gap-3">
                                  <Label htmlFor={`sports-custom-market-type-${market.id}`}>
                                    Market
                                    {' '}
                                    {index + 1}
                                  </Label>
                                  <Button type="button" variant="outline" size="sm" onClick={() => removeSportsCustomMarket(market.id)}>
                                    <Trash2Icon className="mr-2 size-4" />
                                    Remove
                                  </Button>
                                </div>
                                <Select
                                  value={market.sportsMarketType || undefined}
                                  onValueChange={value => handleSportsCustomMarketChange(market.id, 'sportsMarketType', value)}
                                >
                                  <SelectTrigger id={`sports-custom-market-type-${market.id}`} className="w-full">
                                    <SelectValue placeholder="Select a sports market type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {sportsMarketTypeGroups.map(group => (
                                      <SelectGroup key={group.label}>
                                        <SelectLabel>{group.label}</SelectLabel>
                                        {group.options.map(option => (
                                          <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectGroup>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label>Question</Label>
                                <Input
                                  value={market.question}
                                  onChange={event => handleSportsCustomMarketChange(market.id, 'question', event.target.value)}
                                  placeholder={marketTypeOption?.label
                                    ? `Example: ${marketTypeOption.label}`
                                    : 'Example: 1H Moneyline'}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Title</Label>
                                <Input
                                  value={market.title}
                                  onChange={event => handleSportsCustomMarketChange(market.id, 'title', event.target.value)}
                                  placeholder={marketTypeOption?.label || 'Example: 1H Moneyline'}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Short name</Label>
                                <Input
                                  value={market.shortName}
                                  onChange={event => handleSportsCustomMarketChange(market.id, 'shortName', event.target.value)}
                                  placeholder={marketTypeOption?.label || 'Example: 1H ML'}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Slug override (optional)</Label>
                                <Input
                                  value={market.slug}
                                  onChange={event => handleSportsCustomMarketChange(market.id, 'slug', event.target.value)}
                                  placeholder="Leave blank to generate automatically"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Outcome 1</Label>
                                <Input
                                  value={market.outcomeOne}
                                  onChange={event => handleSportsCustomMarketChange(market.id, 'outcomeOne', event.target.value)}
                                  placeholder={defaultOutcomes?.[0] || 'Example: Over'}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Outcome 2</Label>
                                <Input
                                  value={market.outcomeTwo}
                                  onChange={event => handleSportsCustomMarketChange(market.id, 'outcomeTwo', event.target.value)}
                                  placeholder={defaultOutcomes?.[1] || 'Example: Under'}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>
                                  Line
                                  {marketTypeOption?.requiresLine ? '' : ' (optional)'}
                                </Label>
                                <Input
                                  value={market.line}
                                  onChange={event => handleSportsCustomMarketChange(market.id, 'line', event.target.value)}
                                  placeholder={marketTypeOption?.requiresLine ? 'Example: 110.5 or -1.5' : 'Optional'}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Group title (optional)</Label>
                                <Input
                                  value={market.groupItemTitle}
                                  onChange={event => handleSportsCustomMarketChange(market.id, 'groupItemTitle', event.target.value)}
                                  placeholder="Defaults to the title sent to metadata"
                                />
                              </div>

                              {sportsForm.section === 'games' && (
                                <div className="space-y-2 md:col-span-2">
                                  <Label>Icon</Label>
                                  <Select
                                    value={market.iconAssetKey || undefined}
                                    onValueChange={value => handleSportsCustomMarketChange(market.id, 'iconAssetKey', value)}
                                  >
                                    <SelectTrigger className="w-full md:max-w-xs">
                                      <SelectValue placeholder="No team icon" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">No team icon</SelectItem>
                                      <SelectItem value="home">
                                        {sportsForm.teams[0]?.name || 'Home team'}
                                        {' '}
                                        icon
                                      </SelectItem>
                                      <SelectItem value="away">
                                        {sportsForm.teams[1]?.name || 'Away team'}
                                        {' '}
                                        icon
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          )
                        })}

                        <Button type="button" variant="outline" onClick={addSportsCustomMarket}>
                          <PlusIcon className="mr-2 size-4" />
                          Add custom market
                        </Button>
                      </div>
                    )}

                    {sportsForm.section === 'props' && sportsForm.eventVariant !== 'custom' && (
                      <div className="space-y-4 rounded-md border p-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Player props</p>
                          <p className="text-sm text-muted-foreground">
                            Each row becomes one generated market with Over and Under outcomes.
                          </p>
                        </div>

                        {sportsForm.props.map((prop, index) => (
                          <div key={prop.id} className="grid grid-cols-1 gap-4 rounded-md border p-4 md:grid-cols-2">
                            <div className="space-y-2 md:col-span-2">
                              <div className="flex items-center justify-between gap-3">
                                <Label htmlFor={`sports-prop-player-${prop.id}`}>
                                  Prop
                                  {' '}
                                  {index + 1}
                                </Label>
                                <Button type="button" variant="outline" size="sm" onClick={() => removeSportsProp(prop.id)}>
                                  <Trash2Icon className="mr-2 size-4" />
                                  Remove
                                </Button>
                              </div>
                              <Input
                                id={`sports-prop-player-${prop.id}`}
                                value={prop.playerName}
                                onChange={event => handleSportsPropChange(prop.id, 'playerName', event.target.value)}
                                placeholder="Example: Jamal Murray"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Stat type</Label>
                              <Select
                                value={prop.statType || undefined}
                                onValueChange={value => handleSportsPropChange(prop.id, 'statType', value)}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select stat type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="points">Points</SelectItem>
                                  <SelectItem value="rebounds">Rebounds</SelectItem>
                                  <SelectItem value="assists">Assists</SelectItem>
                                  <SelectItem value="receiving_yards">Receiving Yards</SelectItem>
                                  <SelectItem value="rushing_yards">Rushing Yards</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Line</Label>
                              <Input
                                value={prop.line}
                                onChange={event => handleSportsPropChange(prop.id, 'line', event.target.value)}
                                placeholder="Example: 29.5"
                              />
                            </div>

                          </div>
                        ))}

                        <Button type="button" variant="outline" onClick={addSportsProp}>
                          <PlusIcon className="mr-2 size-4" />
                          Add prop
                        </Button>
                      </div>
                    )}
                  </>
                )
              : (
                  <>
                    <div className="space-y-3">
                      <Label>Select Event type</Label>
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                        <label
                          className={cn(
                            'cursor-pointer rounded-md border p-3 transition',
                            form.marketMode === 'binary'
                              ? 'border-primary bg-primary/5 text-primary'
                              : `hover:border-primary/40`,
                          )}
                        >
                          <input
                            type="radio"
                            name="market-mode"
                            className="sr-only"
                            checked={form.marketMode === 'binary'}
                            onChange={() => handleFieldChange('marketMode', 'binary')}
                          />
                          <p className="flex items-center gap-2 text-sm font-medium">
                            <span className={cn(
                              'inline-flex size-4 items-center justify-center rounded-full border',
                              form.marketMode === 'binary' ? 'border-primary bg-primary' : 'border-muted-foreground/50',
                            )}
                            >
                              {form.marketMode === 'binary' && <span className="size-1.5 rounded-full bg-background" />}
                            </span>
                            Binary market
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Eg. Will BTC close above $110k on Mar 31, 2028?
                          </p>
                          <div className="mt-3 space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                              <span>Yes</span>
                              <OutcomeStateDot value />
                            </div>
                            <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                              <span>No</span>
                              <OutcomeStateDot value={false} />
                            </div>
                          </div>
                        </label>

                        <label
                          className={cn(
                            'cursor-pointer rounded-md border p-3 transition',
                            form.marketMode === 'multi_multiple'
                              ? 'border-primary bg-primary/5 text-primary'
                              : `hover:border-primary/40`,
                          )}
                        >
                          <input
                            type="radio"
                            name="market-mode"
                            className="sr-only"
                            checked={form.marketMode === 'multi_multiple'}
                            onChange={() => handleFieldChange('marketMode', 'multi_multiple')}
                          />
                          <p className="flex items-center gap-2 text-sm font-medium">
                            <span className={cn(
                              'inline-flex size-4 items-center justify-center rounded-full border',
                              form.marketMode === 'multi_multiple'
                                ? 'border-primary bg-primary'
                                : `border-muted-foreground/50`,
                            )}
                            >
                              {form.marketMode === 'multi_multiple' && (
                                <span className="size-1.5 rounded-full bg-background" />
                              )}
                            </span>
                            Multi-market (multiple true outcomes)
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Eg. Which BTC milestones will be reached by Dec 31, 2028?
                          </p>
                          <div className="mt-3 space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                              <span>BTC above $100k (short: 100k)</span>
                              <OutcomeStateDot value />
                            </div>
                            <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                              <span>BTC above $110k (short: 110k)</span>
                              <OutcomeStateDot value />
                            </div>
                            <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                              <span>BTC above $120k (short: 120k)</span>
                              <OutcomeStateDot value={false} />
                            </div>
                          </div>
                        </label>

                        <label
                          className={cn(
                            'cursor-pointer rounded-md border p-3 transition',
                            form.marketMode === 'multi_unique'
                              ? 'border-primary bg-primary/5 text-primary'
                              : `hover:border-primary/40`,
                          )}
                        >
                          <input
                            type="radio"
                            name="market-mode"
                            className="sr-only"
                            checked={form.marketMode === 'multi_unique'}
                            onChange={() => handleFieldChange('marketMode', 'multi_unique')}
                          />
                          <p className="flex items-center gap-2 text-sm font-medium">
                            <span className={cn(
                              'inline-flex size-4 items-center justify-center rounded-full border',
                              form.marketMode === 'multi_unique'
                                ? 'border-primary bg-primary'
                                : `border-muted-foreground/50`,
                            )}
                            >
                              {form.marketMode === 'multi_unique' && (
                                <span className="size-1.5 rounded-full bg-background" />
                              )}
                            </span>
                            Multi-market (single true outcome)
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Eg. Who will win the 2028 U.S. presidential election?
                          </p>
                          <div className="mt-3 space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                              <span>Gavin Newsom (short: Newsom)</span>
                              <OutcomeStateDot value />
                            </div>
                            <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                              <span>Nikki Haley (short: Haley)</span>
                              <OutcomeStateDot value={false} />
                            </div>
                            <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                              <span>Donald Trump (short: Trump)</span>
                              <OutcomeStateDot value={false} />
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {form.marketMode === 'binary' && (
                      <div className="space-y-4 rounded-md border p-4">
                        <div className="space-y-2">
                          <Label htmlFor="binary-question">Question</Label>
                          <Input
                            id="binary-question"
                            value={form.title}
                            disabled
                            readOnly
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Outcomes</Label>
                          <div className="
                            grid grid-cols-1 items-center gap-2
                            md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem]
                          "
                          >
                            <Input
                              id="binary-outcome-yes"
                              value={form.binaryOutcomeYes}
                              onChange={event => handleFieldChange('binaryOutcomeYes', event.target.value)}
                              placeholder="Yes"
                              disabled={!isBinaryOutcomesEditable}
                            />
                            <Input
                              id="binary-outcome-no"
                              value={form.binaryOutcomeNo}
                              onChange={event => handleFieldChange('binaryOutcomeNo', event.target.value)}
                              placeholder="No"
                              disabled={!isBinaryOutcomesEditable}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-10 rounded-md"
                              onClick={() => setIsBinaryOutcomesEditable(previous => !previous)}
                              aria-label={isBinaryOutcomesEditable ? 'Lock outcomes' : 'Edit outcomes'}
                            >
                              <SquarePenIcon className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {(form.marketMode === 'multi_multiple' || form.marketMode === 'multi_unique') && (
                      <div className="space-y-4 rounded-md border p-4">
                        <p className="text-sm text-muted-foreground">Each option creates one child market.</p>

                        <div className="space-y-4">
                          {form.options.map((option, index) => (
                            <div key={option.id} className="space-y-3 rounded-md border p-4">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">
                                  Option
                                  {' '}
                                  {index + 1}
                                </p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeOption(option.id)}
                                  disabled={form.options.length <= 2}
                                >
                                  <Trash2Icon className="mr-2 size-4" />
                                  Remove
                                </Button>
                              </div>

                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2 md:col-span-2">
                                  <Label>Market question</Label>
                                  <Input
                                    value={option.question}
                                    onChange={event => handleOptionChange(option.id, 'question', event.target.value)}
                                    placeholder={optionQuestionPlaceholder}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Option name</Label>
                                  <Input
                                    value={option.title}
                                    onChange={event => handleOptionChange(option.id, 'title', event.target.value)}
                                    placeholder={optionNamePlaceholder}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Short name</Label>
                                  <Input
                                    value={option.shortName}
                                    onChange={event => handleOptionChange(option.id, 'shortName', event.target.value)}
                                    placeholder={optionShortNamePlaceholder}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Slug</Label>
                                  <Input value={option.slug} readOnly />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                  <Label>Outcomes</Label>
                                  <div className="
                                    grid grid-cols-1 items-center gap-2
                                    md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem]
                                  "
                                  >
                                    <Input
                                      value={option.outcomeYes}
                                      onChange={event => handleOptionChange(option.id, 'outcomeYes', event.target.value)}
                                      placeholder="Yes"
                                      disabled={!areMultiOutcomesEditable}
                                    />
                                    <Input
                                      value={option.outcomeNo}
                                      onChange={event => handleOptionChange(option.id, 'outcomeNo', event.target.value)}
                                      placeholder="No"
                                      disabled={!areMultiOutcomesEditable}
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="size-10 rounded-md"
                                      onClick={() => setAreMultiOutcomesEditable(previous => !previous)}
                                      aria-label={areMultiOutcomesEditable ? 'Lock outcomes' : 'Edit outcomes'}
                                    >
                                      <SquarePenIcon className="size-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label>Option image (optional)</Label>
                                <Input
                                  id={`option-image-${option.id}`}
                                  type="file"
                                  accept="image/*"
                                  onChange={event => handleOptionImageUpload(option.id, event)}
                                  className="sr-only"
                                />
                                <label
                                  htmlFor={`option-image-${option.id}`}
                                  className={`
                                    group relative flex size-28 cursor-pointer items-center justify-center
                                    overflow-hidden rounded-xl border border-dashed border-border bg-muted/20
                                    text-muted-foreground transition
                                    hover:border-primary/60
                                  `}
                                >
                                  <span className={`
                                    pointer-events-none absolute inset-0 bg-foreground/0 transition
                                    group-hover:bg-foreground/5
                                  `}
                                  />
                                  {optionImagePreviewUrls[option.id]
                                    ? (
                                        <EventIconImage
                                          src={optionImagePreviewUrls[option.id]}
                                          alt={`Option ${index + 1} image preview`}
                                          sizes="256px"
                                          unoptimized
                                          containerClassName="size-full"
                                        />
                                      )
                                    : (
                                        <div className="text-xs text-muted-foreground">No image</div>
                                      )}
                                  <ImageUp
                                    className={`
                                      pointer-events-none absolute top-1/2 left-1/2 z-10 size-6 -translate-1/2
                                      text-foreground/70 opacity-0 transition
                                      group-hover:opacity-100
                                    `}
                                  />
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>

                        <Button type="button" variant="outline" onClick={addOption}>
                          <PlusIcon className="mr-2 size-4" />
                          Add option
                        </Button>
                      </div>
                    )}
                  </>
                )}
          </CardContent>
        </Card>
      )}

      {currentStep === 3 && (
        <Card className="bg-background">
          <CardHeader className="pt-8 pb-6">
            <CardTitle>Resolution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pb-8">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resolution-source-url">Resolution source URL (optional)</Label>
                <Input
                  id="resolution-source-url"
                  value={form.resolutionSource}
                  onChange={event => handleFieldChange('resolutionSource', event.target.value)}
                  placeholder="https://www.reuters.com/"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="resolution-rules">Resolution rules</Label>
                    {creationMode === 'recurring' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="text-muted-foreground transition hover:text-foreground">
                            <CircleHelpIcon className="size-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-left">
                          <div className="grid gap-2">
                            <p>{TEMPLATE_TOKEN_HELP_TEXT}</p>
                            {TEMPLATE_TOKEN_EXAMPLES.map(item => (
                              <p key={`rules-token-${item}`}>{item}</p>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRulesGeneratorDialogOpen(true)}
                    disabled={isGeneratingRules}
                  >
                    {isGeneratingRules
                      ? <Loader2Icon className="mr-2 size-4 animate-spin" />
                      : <SparkleIcon className="mr-2 size-4" />}
                    Generate with AI
                  </Button>
                </div>
                <Textarea
                  id="resolution-rules"
                  value={form.resolutionRules}
                  onChange={event => handleFieldChange('resolutionRules', event.target.value)}
                  placeholder="Define official source, UTC cutoff, tie/cancellation handling, and fallback source."
                  className="min-h-36"
                />
                {creationMode === 'recurring' && recurringResolvedRules && recurringResolvedRules !== form.resolutionRules.trim() && (
                  <p className="text-xs whitespace-pre-wrap text-muted-foreground">
                    Preview:
                    {' '}
                    {recurringResolvedRules}
                  </p>
                )}
                {creationMode === 'recurring' && recurringOccurrencePreviews.length > 1 && (
                  <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                    <p className="text-xs font-medium text-foreground">Recurring preview samples</p>
                    <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                      {recurringOccurrencePreviews.map((preview, index) => (
                        <div key={`${preview.slug}-${index}`} className="space-y-1">
                          <p className="font-medium text-foreground">{index === 0 ? 'First occurrence' : 'Next occurrence'}</p>
                          <p>
                            <span className="font-medium text-foreground">Title:</span>
                            {' '}
                            {preview.title}
                          </p>
                          <p>
                            <span className="font-medium text-foreground">Slug:</span>
                            {' '}
                            {preview.slug}
                          </p>
                          <p className="whitespace-pre-wrap">
                            <span className="font-medium text-foreground">Rules:</span>
                            {' '}
                            {preview.resolutionRules}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {creationMode === 'recurring' && recurringEditorialWarnings.length > 0 && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Recurring warnings</p>
                    <div className="mt-2 space-y-1">
                      {recurringEditorialWarnings.map(warning => (
                        <p key={warning} className="text-sm text-amber-700 dark:text-amber-400">
                          {warning}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={creatorWalletDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!isAddingCreatorWallet) {
            setCreatorWalletDialogOpen(nextOpen)
            if (!nextOpen) {
              setCreatorWalletName('')
            }
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name this wallet</DialogTitle>
            <DialogDescription>
              Add a display name so this wallet can be recognized in mirrored market sources.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="creator-wallet-name">Wallet name</Label>
            <Input
              id="creator-wallet-name"
              value={creatorWalletName}
              onChange={event => setCreatorWalletName(event.target.value)}
              maxLength={80}
              placeholder="My creator wallet"
              disabled={isAddingCreatorWallet}
            />
            <p className="text-xs text-muted-foreground">
              {eoaAddress ?? 'Wallet not connected'}
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreatorWalletDialogOpen(false)
                setCreatorWalletName('')
              }}
              disabled={isAddingCreatorWallet}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void addCurrentWalletToAllowedCreators()}
              disabled={isAddingCreatorWallet || !creatorWalletName.trim() || !eoaAddress}
            >
              {isAddingCreatorWallet && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              Add wallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recurringRequiresServerWalletSetup} onOpenChange={() => {}}>
        <DialogContent
          showCloseButton={false}
          onEscapeKeyDown={event => event.preventDefault()}
          onInteractOutside={event => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Server Wallet Required</DialogTitle>
            <DialogDescription>
              Recurring events require adding the creator wallet private key to
              {' '}
              <code>EVENT_CREATION_SIGNER_PRIVATE_KEYS</code>
              {' '}
              in Vercel Environment Variables or your project&apos;s
              {' '}
              <code>.env</code>
              {' '}
              before you can create or edit recurring drafts.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" asChild>
              <AppLink href="/admin/events/calendar">
                <ArrowLeftIcon className="size-4" />
                Back to calendar
              </AppLink>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rulesGeneratorDialogOpen} onOpenChange={setRulesGeneratorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate rules with AI</DialogTitle>
            <DialogDescription>
              Experimental output generated by your configured AI provider.
              We recommend paid models (for example xAI or Manus with internet access) for better quality.
              Validate all text manually, including dates and links. You are responsible for the final rules.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRulesGeneratorDialogOpen(false)}
              disabled={isGeneratingRules}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void generateRulesWithAi()} disabled={isGeneratingRules}>
              {isGeneratingRules && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetFormDialogOpen} onOpenChange={setResetFormDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear form?</DialogTitle>
            <DialogDescription>
              This will remove all filled fields, uploaded images, and pre-sign checks from the wizard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setResetFormDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmResetForm}>
              Clear form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={finalPreviewDialogOpen} onOpenChange={setFinalPreviewDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Event preview</DialogTitle>
            <DialogDescription>
              Review how your event and markets will look before starting signatures.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[90vh] flex-col">
            <div className="border-b px-6 py-3">
              <div className="
                mx-auto w-full max-w-2xl rounded-md border bg-muted/20 px-3 py-2 text-center font-mono text-xs
                text-muted-foreground
              "
              >
                {previewEventUrl}
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="min-h-0 space-y-4 overflow-y-auto p-6">
                <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 rounded-md border p-4">
                  <div className="relative size-22 overflow-hidden rounded-md border bg-muted">
                    {eventImagePreviewUrl
                      ? (
                          <EventIconImage
                            src={eventImagePreviewUrl}
                            alt="Event preview"
                            sizes="88px"
                            containerClassName="size-full"
                          />
                        )
                      : (
                          <Skeleton className="size-full rounded-none" />
                        )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-lg font-semibold text-foreground">{previewTitle}</p>
                    <p className="text-xs text-muted-foreground">{previewEndDate}</p>
                  </div>
                </div>

                {isMultiMarketPreview && previewMarkets.length > 0 && (
                  <div className="space-y-3 rounded-md border p-4">
                    <p className="text-sm font-semibold text-foreground">Outcomes</p>
                    <div className="space-y-3">
                      {previewMarkets.map((market, index) => (
                        <div key={market.key} className="rounded-md border bg-muted/20 p-3">
                          <div className="flex items-center gap-3">
                            {market.imageUrl && (
                              <div className="relative size-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                                <EventIconImage
                                  src={market.imageUrl}
                                  alt={`Market ${index + 1} preview`}
                                  sizes="48px"
                                  containerClassName="size-full"
                                />
                              </div>
                            )}
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="text-sm font-semibold text-foreground">
                                {market.title || `Market ${index + 1}`}
                              </p>
                              <p className="text-xs text-muted-foreground">{market.question || 'Question pending'}</p>
                            </div>
                            <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                              <span className="
                                rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-sm
                                font-semibold text-emerald-600
                              "
                              >
                                {market.outcomeYes}
                              </span>
                              <span className="
                                rounded-md border border-red-500/40 bg-red-500/15 px-2.5 py-1.5 text-sm font-semibold
                                text-red-500
                              "
                              >
                                {market.outcomeNo}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-1.5 sm:hidden">
                            <span className="
                              rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-sm
                              font-semibold text-emerald-600
                            "
                            >
                              {market.outcomeYes}
                            </span>
                            <span className="
                              rounded-md border border-red-500/40 bg-red-500/15 px-2.5 py-1.5 text-sm font-semibold
                              text-red-500
                            "
                            >
                              {market.outcomeNo}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3 rounded-md border p-4">
                  <p className="text-sm font-semibold text-foreground">Resolution rules</p>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {effectiveResolutionRules || 'Rules not set.'}
                  </p>
                  {form.resolutionSource
                    ? (
                        <a
                          href={form.resolutionSource}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          {form.resolutionSource}
                          <ExternalLinkIcon className="size-3" />
                        </a>
                      )
                    : (
                        <p className="text-xs text-muted-foreground">No resolution source URL.</p>
                      )}
                </div>
              </div>

              <div className="border-t bg-muted/10 p-6 lg:border-t-0 lg:border-l">
                <p className="text-sm font-semibold text-foreground">Trade panel preview</p>
                <div className="mt-3 space-y-3 rounded-md border bg-background p-4">
                  <div className="flex items-center gap-4 text-sm font-semibold">
                    <span className="text-muted-foreground">Buy</span>
                    <span className="text-muted-foreground">Sell</span>
                  </div>
                  <div className="h-px w-full bg-border" />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled
                      className="
                        rounded-md border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-sm font-semibold
                        text-emerald-600
                      "
                    >
                      {tradePreviewMarket?.outcomeYes || 'Yes'}
                    </button>
                    <button
                      type="button"
                      disabled
                      className="
                        rounded-md border border-red-500/40 bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-500
                      "
                    >
                      {tradePreviewMarket?.outcomeNo || 'No'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Categories</p>
                  {selectedCategoryChips.length > 0
                    ? (
                        <div className="
                          flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]
                          [&::-webkit-scrollbar]:hidden
                        "
                        >
                          {selectedCategoryChips.map(item => (
                            <span
                              key={item.slug}
                              className="
                                shrink-0 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground
                              "
                            >
                              {item.label}
                            </span>
                          ))}
                        </div>
                      )
                    : (
                        <p className="text-xs text-muted-foreground">No categories selected.</p>
                      )}
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFinalPreviewDialogOpen(false)}
              >
                Back to edit
              </Button>
              <Button type="button" onClick={continueFromFinalPreview}>
                Continue to sign
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {currentStep === 4 && (
        <Card className="bg-background">
          <CardHeader className="pt-8 pb-6">
            <CardTitle>Create events and markets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-8">
            <div className="rounded-md border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => togglePreSignCheck('funding', fundingHasIssue)}
                  disabled={fundingHasIssue}
                  className={cn(
                    'flex items-center gap-2 text-left',
                    fundingHasIssue ? 'cursor-default' : 'cursor-pointer',
                  )}
                >
                  {expandedPreSignChecks.funding
                    ? <ChevronDownIcon className="size-5 text-muted-foreground" />
                    : (
                        <ChevronRightIcon className="size-5 text-muted-foreground" />
                      )}
                  <p className="text-xl font-semibold text-foreground">
                    EOA wallet balance (
                    {requiredTotalRewardUsdc.toFixed(2)}
                    {' '}
                    USDC required)
                  </p>
                </button>
                <CheckIndicator
                  state={
                    fundingCheckState === 'ok'
                      ? 'ok'
                      : (fundingCheckState === 'checking' || fundingCheckState === 'idle')
                          ? 'checking'
                          : 'error'
                  }
                />
              </div>
              {expandedPreSignChecks.funding && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-muted-foreground">
                    This reward pays the UMA proposer who resolves the question correctly.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Need
                    {' '}
                    {requiredRewardUsdc.toFixed(2)}
                    {' '}
                    ×
                    {' '}
                    {marketCount}
                    {' '}
                    markets =
                    {' '}
                    {requiredTotalRewardUsdc.toFixed(2)}
                    {' '}
                    USDC. Balance:
                    {' '}
                    {eoaUsdcBalance.toFixed(2)}
                    {' '}
                    USDC.
                  </p>
                  <div className="flex items-center gap-1.5">
                    <p className="font-mono text-sm break-all text-muted-foreground">
                      {eoaAddress ?? 'Wallet not connected'}
                    </p>
                    {eoaAddress && (
                      <button
                        type="button"
                        onClick={() => void copyWalletAddress()}
                        className="text-muted-foreground transition hover:text-foreground"
                        aria-label="Copy wallet address"
                      >
                        {isAddressCopied
                          ? <CheckIcon className="size-4 text-emerald-500" />
                          : (
                              <CopyIcon className="size-4" />
                            )}
                      </button>
                    )}
                  </div>
                </div>
              )}
              {fundingCheckError && <p className="mt-2 text-sm text-destructive">{fundingCheckError}</p>}
            </div>

            <div className="rounded-md border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => togglePreSignCheck('nativeGas', nativeGasHasIssue)}
                  disabled={nativeGasHasIssue}
                  className={cn(
                    'flex items-center gap-2 text-left',
                    nativeGasHasIssue ? 'cursor-default' : 'cursor-pointer',
                  )}
                >
                  {expandedPreSignChecks.nativeGas
                    ? <ChevronDownIcon className="size-5 text-muted-foreground" />
                    : (
                        <ChevronRightIcon className="size-5 text-muted-foreground" />
                      )}
                  <p className="text-xl font-semibold text-foreground">
                    EOA wallet gas (
                    {requiredGasPol.toFixed(4)}
                    {' '}
                    POL estimated)
                  </p>
                </button>
                <CheckIndicator
                  state={
                    nativeGasCheckState === 'ok'
                      ? 'ok'
                      : (nativeGasCheckState === 'checking' || nativeGasCheckState === 'idle')
                          ? 'checking'
                          : 'error'
                  }
                />
              </div>
              {expandedPreSignChecks.nativeGas && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-muted-foreground">
                    This POL pays gas for market creation transactions (approve + initialize).
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Estimated need:
                    {' '}
                    {requiredGasPol.toFixed(4)}
                    {' '}
                    POL. Balance:
                    {' '}
                    {eoaPolBalance.toFixed(4)}
                    {' '}
                    POL.
                  </p>
                  <div className="flex items-center gap-1.5">
                    <p className="font-mono text-sm break-all text-muted-foreground">
                      {eoaAddress ?? 'Wallet not connected'}
                    </p>
                    {eoaAddress && (
                      <button
                        type="button"
                        onClick={() => void copyWalletAddress()}
                        className="text-muted-foreground transition hover:text-foreground"
                        aria-label="Copy wallet address"
                      >
                        {isAddressCopied
                          ? <CheckIcon className="size-4 text-emerald-500" />
                          : (
                              <CopyIcon className="size-4" />
                            )}
                      </button>
                    )}
                  </div>
                </div>
              )}
              {nativeGasCheckError && <p className="mt-2 text-sm text-destructive">{nativeGasCheckError}</p>}
            </div>

            <div className="rounded-md border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => togglePreSignCheck('allowedCreator', allowedCreatorHasIssue)}
                  disabled={allowedCreatorHasIssue}
                  className={cn(
                    'flex items-center gap-2 text-left',
                    allowedCreatorHasIssue ? 'cursor-default' : 'cursor-pointer',
                  )}
                >
                  {expandedPreSignChecks.allowedCreator
                    ? <ChevronDownIcon className="size-5 text-muted-foreground" />
                    : (
                        <ChevronRightIcon className="size-5 text-muted-foreground" />
                      )}
                  <p className="text-xl font-semibold text-foreground">Wallet on allowed market creator wallets</p>
                </button>
                <CheckIndicator
                  state={
                    allowedCreatorCheckState === 'ok'
                      ? 'ok'
                      : (allowedCreatorCheckState === 'checking' || allowedCreatorCheckState === 'idle')
                          ? 'checking'
                          : 'error'
                  }
                />
              </div>
              {expandedPreSignChecks.allowedCreator && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Must be listed in "Allowed market creator wallets" in General settings so this wallet is recognized by the platform.
                  </p>
                  <div className="flex items-center gap-1.5">
                    <p className="font-mono text-sm break-all text-muted-foreground">
                      {eoaAddress ?? 'Wallet not connected'}
                    </p>
                    {eoaAddress && (
                      <button
                        type="button"
                        onClick={() => void copyWalletAddress()}
                        className="text-muted-foreground transition hover:text-foreground"
                        aria-label="Copy wallet address"
                      >
                        {isAddressCopied
                          ? <CheckIcon className="size-4 text-emerald-500" />
                          : (
                              <CopyIcon className="size-4" />
                            )}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {allowedCreatorCheckState === 'missing' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7"
                  onClick={() => setCreatorWalletDialogOpen(true)}
                  disabled={isAddingCreatorWallet || !eoaAddress}
                >
                  {isAddingCreatorWallet && <Loader2Icon className="mr-2 size-3.5 animate-spin" />}
                  Add wallet
                </Button>
              )}
              {allowedCreatorCheckError && <p className="mt-2 text-sm text-destructive">{allowedCreatorCheckError}</p>}
            </div>

            <div className="rounded-md border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => togglePreSignCheck('slug', slugHasIssue)}
                  disabled={slugHasIssue}
                  className={cn(
                    'flex items-center gap-2 text-left',
                    slugHasIssue ? 'cursor-default' : 'cursor-pointer',
                  )}
                >
                  {expandedPreSignChecks.slug
                    ? <ChevronDownIcon className="size-5 text-muted-foreground" />
                    : (
                        <ChevronRightIcon className="size-5 text-muted-foreground" />
                      )}
                  <p className="text-xl font-semibold text-foreground">Slug available</p>
                </button>
                <CheckIndicator
                  state={
                    slugValidationState === 'unique'
                      ? 'ok'
                      : (slugValidationState === 'checking' || slugValidationState === 'idle')
                          ? 'checking'
                          : 'error'
                  }
                />
              </div>
              {expandedPreSignChecks.slug && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-muted-foreground">Final uniqueness check against your database.</p>
                  {creationMode === 'recurring' && recurringOccurrencePreviews.length > 0
                    ? (
                        <div className="space-y-1">
                          {recurringOccurrencePreviews.map((preview, index) => (
                            <p
                              key={`${preview.slug}-${index}`}
                              className="font-mono text-sm break-all text-muted-foreground"
                            >
                              {index === 0 ? 'First' : 'Next'}
                              :
                              {' '}
                              {preview.slug}
                            </p>
                          ))}
                        </div>
                      )
                    : (
                        <p className="font-mono text-sm break-all text-muted-foreground">
                          {form.slug || 'Slug not generated'}
                        </p>
                      )}
                </div>
              )}
              {slugValidationState === 'duplicate' && (
                <p className="mt-2 text-sm text-destructive">
                  {slugCheckError || 'Slug already exists in your database.'}
                </p>
              )}
              {slugCheckError && slugValidationState !== 'duplicate' && (
                <p className="mt-2 text-sm text-destructive">{slugCheckError}</p>
              )}
            </div>

            <div className="rounded-md border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => togglePreSignCheck('openRouter', openRouterHasIssue)}
                  disabled={openRouterHasIssue}
                  className={cn(
                    'flex items-center gap-2 text-left',
                    openRouterHasIssue ? 'cursor-default' : 'cursor-pointer',
                  )}
                >
                  {expandedPreSignChecks.openRouter
                    ? <ChevronDownIcon className="size-5 text-muted-foreground" />
                    : (
                        <ChevronRightIcon className="size-5 text-muted-foreground" />
                      )}
                  <p className="text-xl font-semibold text-foreground">OpenRouter active</p>
                </button>
                <CheckIndicator
                  state={
                    openRouterCheckState === 'ok'
                      ? 'ok'
                      : (openRouterCheckState === 'checking' || openRouterCheckState === 'idle')
                          ? 'checking'
                          : 'error'
                  }
                />
              </div>
              {expandedPreSignChecks.openRouter && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Required before running content AI checker.
                  </p>
                </div>
              )}
              {openRouterCheckError && <p className="mt-2 text-sm text-destructive">{openRouterCheckError}</p>}
              {openRouterCheckState !== 'ok' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7"
                  onClick={openAdminSettings}
                >
                  <ExternalLinkIcon className="mr-2 size-3.5" />
                  Open admin settings
                </Button>
              )}
            </div>

            <div className="rounded-md border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => togglePreSignCheck('content', contentHasIssue)}
                  disabled={contentHasIssue}
                  className={cn(
                    'flex items-center gap-2 text-left',
                    contentHasIssue ? 'cursor-default' : 'cursor-pointer',
                  )}
                >
                  {expandedPreSignChecks.content
                    ? <ChevronDownIcon className="size-5 text-muted-foreground" />
                    : (
                        <ChevronRightIcon className="size-5 text-muted-foreground" />
                      )}
                  <p className="text-xl font-semibold text-foreground">Content AI checker</p>
                </button>
                <CheckIndicator
                  state={contentIndicatorState}
                />
              </div>
              {expandedPreSignChecks.content && (
                <div className="mt-2 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Checks language, deterministic rules, required fields, and event-date consistency.
                  </p>
                  {contentCheckProgressLine && (
                    <p className="text-sm text-muted-foreground">{contentCheckProgressLine}</p>
                  )}
                  {openRouterCheckState !== 'ok' && (
                    <p className="text-sm text-muted-foreground">Waiting for OpenRouter check.</p>
                  )}
                  {contentCheckError && (
                    <p className="text-sm text-destructive">{contentCheckError}</p>
                  )}

                  {pendingAiIssues.length > 0 && (
                    <div className="space-y-2">
                      {pendingAiIssues.map(issue => (
                        <div key={getAiIssueKey(issue)} className="rounded-md border border-red-500/30 bg-red-500/5 p-2">
                          <p className="text-sm text-red-500">
                            {issue.reason}
                          </p>
                          <div className="mt-2 flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7"
                              onClick={() => goToIssueStep(issue)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7"
                              onClick={() => bypassIssue(issue)}
                            >
                              Ignore
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {contentCheckWarnings.length > 0 && (
                    <div className="space-y-2">
                      {contentCheckWarnings.map(warning => (
                        <div
                          key={`warning-${getAiIssueKey(warning)}`}
                          className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2"
                        >
                          <p className="text-sm text-amber-700 dark:text-amber-400">
                            {warning.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 5 && (
        <Card className="bg-background">
          <CardHeader className="pt-8 pb-6">
            <CardTitle>Sign & create</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-8">
            <div className="rounded-md border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-base font-semibold text-foreground">Progress</p>
                  <p className="text-sm text-muted-foreground">
                    {completedSignatureUnits}
                    {' '}
                    /
                    {' '}
                    {totalSignatureUnits}
                    {' '}
                    completed
                  </p>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {signatureProgressPercent}
                  %
                </p>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${signatureProgressPercent}%` }}
                />
              </div>
            </div>

            <div className="rounded-md border px-4 py-3">
              <p className="text-base font-semibold text-foreground">Execution plan</p>
              {preparedSignaturePlan
                ? (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        {getChainLabel()}
                        {' '}
                        ·
                        {' '}
                        {signatureTxs.length}
                        {' '}
                        txs
                        {' '}
                        ·
                        {' '}
                        {preparedSignaturePlan.creator}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        request:
                        {' '}
                        {preparedSignaturePlan.requestId}
                      </p>
                    </div>
                  )
                : (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {pendingWorkflowRequestId
                          ? 'Server workflow is preparing your tx plan.'
                          : 'Sign auth to load tx plan.'}
                      </p>
                      {pendingWorkflowRequestId && (
                        <p className="font-mono text-xs text-muted-foreground">
                          request:
                          {' '}
                          {pendingWorkflowRequestId}
                        </p>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={resumeAnyPendingSignaturePlan}
                        disabled={isLoadingPendingRequest || isSigningAuth || isPreparingSignaturePlan || isExecutingSignatures || isFinalizingSignatureFlow}
                      >
                        {isLoadingPendingRequest
                          ? (
                              <>
                                <Loader2Icon className="mr-2 size-3.5 animate-spin" />
                                Loading pending...
                              </>
                            )
                          : (
                              'Resume pending plan'
                            )}
                      </Button>
                    </div>
                  )}
            </div>

            {signatureFlowError && (
              <div className="rounded-md border border-red-500/30 bg-red-500/5 px-4 py-3">
                <p className="text-sm text-red-500">{signatureFlowError}</p>
              </div>
            )}

            <div className="rounded-md border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Sign EIP-712 auth challenge</p>
                  <p className="text-xs text-muted-foreground">
                    {preparedSignaturePlan
                      ? authChallengeRemainingSeconds !== null
                        ? `Verified (auth time remaining: ${authChallengeCountdownLabel})`
                        : 'Verified'
                      : isSigningAuth
                        ? 'Awaiting wallet'
                        : isPreparingSignaturePlan || pendingWorkflowStatus === 'prepare_running'
                          ? 'Signed. Preparing tx plan on server'
                          : signatureFlowError
                            ? 'Failed'
                            : 'Pending'}
                  </p>
                  {authChallengeRemainingSeconds !== null && (
                    <p className={cn(
                      'text-xs',
                      authChallengeRemainingSeconds === 0 ? 'text-destructive' : 'text-red-500',
                    )}
                    >
                      {authChallengeRemainingSeconds === 0
                        ? 'Auth challenge expired. Click "Sign & prepare" to issue a new one.'
                        : preparedSignaturePlan
                          ? `Auth time remaining: ${authChallengeCountdownLabel}`
                          : `Auth challenge expires in ${authChallengeCountdownLabel}`}
                    </p>
                  )}
                </div>
                <SignatureTxIndicator
                  status={preparedSignaturePlan
                    ? 'success'
                    : isSigningAuth
                      ? 'awaiting_wallet'
                      : isPreparingSignaturePlan || pendingWorkflowStatus === 'prepare_running'
                        ? 'confirming'
                        : signatureFlowError
                          ? 'error'
                          : 'idle'}
                />
              </div>
            </div>

            {signatureTxs.length > 0 && (
              <div className="space-y-2">
                {signatureTxs.map((tx) => {
                  const explorerBase = preparedSignaturePlan ? getExplorerTxBase() : ''
                  const txHref = explorerBase && tx.hash ? `${explorerBase}${tx.hash}` : ''
                  const statusLabel = tx.status === 'idle'
                    ? 'Pending'
                    : tx.status === 'awaiting_wallet'
                      ? 'Awaiting wallet'
                      : tx.status === 'confirming'
                        ? 'Confirming'
                        : tx.status === 'success'
                          ? 'Confirmed'
                          : 'Failed'

                  return (
                    <div key={tx.id} className="rounded-md border px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">{tx.description}</p>
                          <p className="text-xs text-muted-foreground">{statusLabel}</p>
                          {tx.hash && (
                            <p className="text-xs text-muted-foreground">
                              {txHref
                                ? (
                                    <a
                                      href={txHref}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 hover:text-foreground"
                                    >
                                      {tx.hash.slice(0, 10)}
                                      ...
                                      {tx.hash.slice(-8)}
                                      <ExternalLinkIcon className="size-3" />
                                    </a>
                                  )
                                : (
                                    <>
                                      {tx.hash.slice(0, 10)}
                                      ...
                                      {tx.hash.slice(-8)}
                                    </>
                                  )}
                            </p>
                          )}
                          {tx.error && <p className="text-xs text-red-500">{tx.error}</p>}
                        </div>
                        <SignatureTxIndicator status={tx.status} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {preparedSignaturePlan && (
              <div className="rounded-md border px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Finalize and register markets</p>
                    <p className="text-xs text-muted-foreground">
                      {signatureFlowDone
                        ? 'Completed'
                        : finalizeInProgressAccepted
                          ? 'Accepted by server'
                          : finalizeStepIsRunning
                            ? 'Registering markets on server'
                            : finalizeStepHasError
                              ? 'Failed'
                              : 'Pending'}
                    </p>
                  </div>
                  <SignatureTxIndicator
                    status={finalizeStepSucceeded
                      ? 'success'
                      : finalizeStepIsRunning
                        ? 'confirming'
                        : finalizeStepHasError
                          ? 'error'
                          : 'idle'}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="bg-background">
        <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            Step
            {' '}
            {currentStep}
            {' '}
            of
            {' '}
            {TOTAL_STEPS}
          </p>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="
                border-destructive/30 text-destructive
                hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive
              "
              onClick={handleResetFormClick}
              disabled={
                isLoadingPendingRequest
                || isSigningAuth
                || isPreparingSignaturePlan
                || isExecutingSignatures
                || isFinalizingSignatureFlow
              }
            >
              Reset form
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (currentStep === 1) {
                  router.push('/admin/events/calendar' as Route)
                  return
                }

                goBack()
              }}
              disabled={
                isLoadingPendingRequest
                || isSigningAuth
                || isPreparingSignaturePlan
                || isExecutingSignatures
                || isFinalizingSignatureFlow
              }
            >
              <ArrowLeftIcon className="mr-2 size-4" />
              Back
            </Button>

            <Button
              type="button"
              onClick={goNext}
              disabled={
                (currentStep === 4
                  && (
                    fundingCheckState === 'checking'
                    || allowedCreatorCheckState === 'checking'
                    || slugValidationState === 'checking'
                    || openRouterCheckState === 'checking'
                    || contentCheckState === 'checking'
                  ))
                  || isSigningAuth
                  || isLoadingPendingRequest
                  || isPreparingSignaturePlan
                  || isExecutingSignatures
                  || isFinalizingSignatureFlow
              }
            >
              {currentStep === 5
                ? (
                    <>
                      {(isLoadingPendingRequest || isSigningAuth || isPreparingSignaturePlan || isExecutingSignatures || isFinalizingSignatureFlow) && (
                        <Loader2Icon className="mr-2 size-4 animate-spin" />
                      )}
                      {isLoadingPendingRequest
                        ? 'Loading...'
                        : isSigningAuth
                          ? 'Signing auth...'
                          : isPreparingSignaturePlan
                            ? 'Preparing...'
                            : isExecutingSignatures
                              ? 'Signing...'
                              : isFinalizingSignatureFlow
                                ? 'Finalizing...'
                                : signatureFlowDone
                                  ? 'Create another event'
                                  : preparedSignaturePlan
                                    ? 'Continue signatures'
                                    : 'Sign & prepare'}
                    </>
                  )
                : currentStep === 4
                  ? (
                      stepFourNextButtonContent
                    )
                  : (
                      <>
                        Next
                        <ArrowRightIcon className="ml-2 size-4" />
                      </>
                    )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
