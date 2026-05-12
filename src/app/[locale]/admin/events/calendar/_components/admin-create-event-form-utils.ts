import type {
  AiRulesResponse,
  AiValidationIssue,
  AiValidationResponse,
  AllowedCreatorCheckState,
  AllowedCreatorsResponse,
  CategoryItem,
  CategorySuggestion,
  ContentCheckState,
  EventCreationMode,
  FinalizeResponse,
  FormState,
  FundingCheckState,
  NativeGasCheckState,
  OpenRouterCheckState,
  OpenRouterStatusResponse,
  OptionItem,
  PendingRequestItem,
  PendingRequestResponse,
  PrepareAcceptedResponse,
  PrepareAuthChallengeResponse,
  PrepareFinalizeRequestTx,
  PrepareResponse,
  PrepareTxPlanItem,
  SlugCheckResponse,
  SlugValidationState,
} from './admin-create-event-form-types'
import type { AdminSportsFormState, AdminSportsTeamHostStatus } from '@/lib/admin-sports-create'
import type { EventCreationDraftRecord } from '@/lib/db/queries/event-creations'
import type { EventCreationAssetRef, EventCreationRecurrenceUnit } from '@/lib/event-creation'
import { buildAdminSportsStepErrors, isSportsMainCategory } from '@/lib/admin-sports-create'
import { normalizeDateTimeLocalValue } from '@/lib/datetime-local'
import { slugifyEventCreationValue as slugify } from '@/lib/event-creation'
import { IS_TEST_MODE, POLYGON_SCAN_BASE } from '@/lib/network'
import { MIN_SUB_CATEGORIES, TITLE_CATEGORY_MIN_LENGTH } from './admin-create-event-form-constants'

export function readApiError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const maybeError = (payload as { error?: unknown }).error
  if (typeof maybeError === 'string') {
    const normalized = maybeError.trim()
    return normalized.length > 0 ? normalized : null
  }

  if (maybeError && typeof maybeError === 'object') {
    const maybeMessage = (maybeError as { message?: unknown }).message
    if (typeof maybeMessage === 'string') {
      const normalized = maybeMessage.trim()
      return normalized.length > 0 ? normalized : null
    }
  }

  return null
}

export function formatEventScheduleLabel(value: Date | null) {
  if (!value || Number.isNaN(value.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value)
}

export function hasRecurringDeploymentHistory(record: EventCreationDraftRecord | null | undefined) {
  if (!record || record.creationMode !== 'recurring' || !record.startAt || !record.endDate) {
    return false
  }

  const startAt = new Date(record.startAt)
  const endDate = new Date(record.endDate)
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endDate.getTime())) {
    return false
  }

  return startAt.getTime() !== endDate.getTime()
}

export async function readResponseBody(response: Response): Promise<{
  payload: unknown
  text: string | null
}> {
  const raw = await response.text().catch(() => '')
  const normalized = raw.trim()
  if (!normalized) {
    return {
      payload: null,
      text: null,
    }
  }

  try {
    return {
      payload: JSON.parse(normalized) as unknown,
      text: normalized,
    }
  }
  catch {
    return {
      payload: null,
      text: normalized,
    }
  }
}

export function readResponseErrorMessage(payload: unknown, text: string | null): string | null {
  const apiError = readApiError(payload)
  if (apiError) {
    return apiError
  }
  if (!text) {
    return null
  }

  const cleaned = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned.length > 0 ? cleaned : null
}

export function isAllowedCreatorsResponse(payload: unknown): payload is AllowedCreatorsResponse {
  if (!payload || typeof payload !== 'object') {
    return false
  }
  const candidate = payload as Partial<AllowedCreatorsResponse>
  return Array.isArray(candidate.wallets) && typeof candidate.allowed === 'boolean'
}

export function isAiValidationResponse(payload: unknown): payload is AiValidationResponse {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Partial<AiValidationResponse>
  if (typeof candidate.ok !== 'boolean' || !candidate.checks || typeof candidate.checks !== 'object') {
    return false
  }

  const checks = candidate.checks as Partial<AiValidationResponse['checks']>
  return typeof checks.mandatory === 'boolean'
    && typeof checks.language === 'boolean'
    && typeof checks.deterministic === 'boolean'
    && Array.isArray(candidate.errors)
    && (typeof candidate.warnings === 'undefined' || Array.isArray(candidate.warnings))
}

export function isAiRulesResponse(payload: unknown): payload is AiRulesResponse {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Partial<AiRulesResponse>
  return typeof candidate.rules === 'string' && typeof candidate.samplesUsed === 'number'
}

export function isOpenRouterStatusResponse(payload: unknown): payload is OpenRouterStatusResponse {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  return typeof (payload as Partial<OpenRouterStatusResponse>).configured === 'boolean'
}

function isPrepareTxPlanItem(payload: unknown): payload is PrepareTxPlanItem {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Partial<PrepareTxPlanItem>
  return typeof candidate.id === 'string'
    && typeof candidate.to === 'string'
    && typeof candidate.value === 'string'
    && typeof candidate.data === 'string'
    && typeof candidate.description === 'string'
}

function isPrepareResponse(payload: unknown): payload is PrepareResponse {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Partial<PrepareResponse>
  return typeof candidate.requestId === 'string'
    && typeof candidate.chainId === 'number'
    && typeof candidate.creator === 'string'
    && Array.isArray(candidate.txPlan)
    && candidate.txPlan.every(item => isPrepareTxPlanItem(item))
}

export function isPrepareAcceptedResponse(payload: unknown): payload is PrepareAcceptedResponse {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Partial<PrepareAcceptedResponse>
  return typeof candidate.requestId === 'string'
    && typeof candidate.chainId === 'number'
    && typeof candidate.creator === 'string'
    && typeof candidate.status === 'string'
}

export function formatSignatureCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function isPrepareAuthChallengeResponse(payload: unknown): payload is PrepareAuthChallengeResponse {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Partial<PrepareAuthChallengeResponse>
  return typeof candidate.requestId === 'string'
    && typeof candidate.nonce === 'string'
    && typeof candidate.expiresAt === 'number'
    && typeof candidate.creator === 'string'
    && typeof candidate.chainId === 'number'
    && typeof candidate.payloadHash === 'string'
    && !!candidate.domain
    && typeof candidate.domain === 'object'
    && typeof (candidate.domain as { name?: unknown }).name === 'string'
    && typeof (candidate.domain as { version?: unknown }).version === 'string'
    && typeof (candidate.domain as { verifyingContract?: unknown }).verifyingContract === 'string'
}

export function isFinalizeResponse(payload: unknown): payload is FinalizeResponse {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Partial<FinalizeResponse>
  return typeof candidate.requestId === 'string' && typeof candidate.status === 'string'
}

function isPrepareFinalizeRequestTx(payload: unknown): payload is PrepareFinalizeRequestTx {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Partial<PrepareFinalizeRequestTx>
  return typeof candidate.id === 'string'
    && typeof candidate.hash === 'string'
    && /^0x[a-fA-F0-9]{64}$/.test(candidate.hash)
}

export function isPendingRequestResponse(payload: unknown): payload is PendingRequestResponse {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Partial<PendingRequestResponse>
  if (candidate.request === null) {
    return true
  }
  if (!candidate.request || typeof candidate.request !== 'object') {
    return false
  }

  const request = candidate.request as Partial<PendingRequestItem>
  return typeof request.requestId === 'string'
    && typeof request.payloadHash === 'string'
    && typeof request.status === 'string'
    && typeof request.creator === 'string'
    && typeof request.chainId === 'number'
    && typeof request.expiresAt === 'number'
    && typeof request.updatedAt === 'number'
    && (typeof request.errorMessage === 'string' || request.errorMessage === null)
    && (request.prepared === null || isPrepareResponse(request.prepared))
    && Array.isArray(request.txs)
    && request.txs.every(item => isPrepareFinalizeRequestTx(item))
}

export function isSlugCheckResponse(payload: unknown): payload is SlugCheckResponse {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  return typeof (payload as Partial<SlugCheckResponse>).exists === 'boolean'
}

export async function fetchAdminApi(pathname: string, init?: RequestInit) {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  const primaryUrl = `/admin/api${normalizedPath}`
  const primaryResponse = await fetch(primaryUrl, init)
  if (primaryResponse.status !== 404 || typeof window === 'undefined') {
    return primaryResponse
  }

  const [maybeLocale] = window.location.pathname.split('/').filter(Boolean)
  if (!maybeLocale) {
    return primaryResponse
  }

  return fetch(`/${maybeLocale}/admin/api${normalizedPath}`, init)
}

export async function fetchAdminApiWithTimeout(pathname: string, timeoutMs: number, init?: RequestInit) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  try {
    return await fetchAdminApi(pathname, {
      ...init,
      signal: controller.signal,
    })
  }
  catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out. Try again in a few moments.')
    }
    throw error
  }
  finally {
    window.clearTimeout(timeoutId)
  }
}

export async function resolveStoredAssetFile(localFile: File | null, asset: EventCreationAssetRef | null, label: string) {
  if (localFile) {
    return localFile
  }

  if (!asset?.publicUrl) {
    return null
  }

  const response = await fetch(asset.publicUrl, {
    method: 'GET',
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`Could not load ${label.toLowerCase()} from storage.`)
  }

  const blob = await response.blob()
  return new File([blob], asset.fileName || 'asset', {
    type: asset.contentType || blob.type || 'application/octet-stream',
  })
}

export function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function isValidUrl(value: string) {
  try {
    const parsed = new URL(value)
    return Boolean(parsed.protocol)
  }
  catch {
    return false
  }
}

export function extractTitleCategorySuggestions(title: string): CategorySuggestion[] {
  const sanitized = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^\w\s-]/g, ' ')

  const words = sanitized
    .split(/\s+/)
    .map(word => word.trim())
    .filter(word => word.length >= TITLE_CATEGORY_MIN_LENGTH)
    .filter(word => /[a-z]/.test(word))
    .slice(0, 12)

  const bySlug = new Map<string, CategorySuggestion>()
  words.forEach((word) => {
    const wordSlug = slugify(word)
    if (!wordSlug || bySlug.has(wordSlug)) {
      return
    }

    bySlug.set(wordSlug, {
      name: word,
      slug: wordSlug,
    })
  })

  return Array.from(bySlug.values())
}

export function createOption(id: string): OptionItem {
  return {
    id,
    question: '',
    title: '',
    shortName: '',
    slug: '',
    outcomeYes: 'Yes',
    outcomeNo: 'No',
  }
}

export function createInitialForm(input?: {
  title?: string
  slug?: string
  endDateIso?: string
}): FormState {
  return {
    title: input?.title?.trim() || '',
    slug: input?.slug?.trim() || '',
    endDateIso: normalizeDateTimeLocalValue(input?.endDateIso ?? ''),
    mainCategorySlug: '',
    categories: [],
    marketMode: null,
    binaryQuestion: '',
    binaryOutcomeYes: 'Yes',
    binaryOutcomeNo: 'No',
    options: [createOption('opt-1'), createOption('opt-2')],
    resolutionSource: '',
    resolutionRules: '',
  }
}

export function areCategoryItemsEqual(left: CategoryItem[], right: CategoryItem[]) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((item, index) => {
    const candidate = right[index]
    return candidate?.label === item.label && candidate.slug === item.slug
  })
}

export function areOptionItemsEqual(left: OptionItem[], right: OptionItem[]) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((item, index) => {
    const candidate = right[index]
    return candidate?.id === item.id
      && candidate.question === item.question
      && candidate.title === item.title
      && candidate.shortName === item.shortName
      && candidate.slug === item.slug
      && candidate.outcomeYes === item.outcomeYes
      && candidate.outcomeNo === item.outcomeNo
  })
}

export function isEventCreationRecurrenceUnit(value: unknown): value is EventCreationRecurrenceUnit {
  return value === 'minute'
    || value === 'hour'
    || value === 'day'
    || value === 'week'
    || value === 'month'
    || value === 'quarter'
    || value === 'semiannual'
    || value === 'year'
}

export function buildStepErrors(
  step: number,
  args: {
    form: FormState
    creationMode: EventCreationMode
    sportsForm: AdminSportsFormState
    hasEventImage: boolean
    hasTeamLogoByHostStatus: Record<AdminSportsTeamHostStatus, boolean>
    slugValidationState: SlugValidationState
    fundingCheckState: FundingCheckState
    nativeGasCheckState: NativeGasCheckState
    allowedCreatorCheckState: AllowedCreatorCheckState
    openRouterCheckState: OpenRouterCheckState
    contentCheckState: ContentCheckState
    hasPendingAiErrors: boolean
    hasContentCheckFatalError: boolean
    allowPastResolutionDate: boolean
    hasCreatorSelection: boolean
    hasRecurringCadence: boolean
    recurringPreviewErrors: string[]
  },
): string[] {
  const errors: string[] = []
  const sportsEventSelected = isSportsMainCategory(args.form.mainCategorySlug)

  if (step === 1) {
    if (!args.form.title.trim()) {
      errors.push('Event title is required.')
    }

    if (!args.form.slug.trim()) {
      errors.push('Event slug is required.')
    }

    if (!args.form.endDateIso) {
      errors.push('Event end date and time is required.')
    }
    else {
      const parsedEndDate = new Date(args.form.endDateIso)
      if (Number.isNaN(parsedEndDate.getTime())) {
        errors.push('Event end date is invalid.')
      }
      else if (!args.allowPastResolutionDate && parsedEndDate.getTime() <= Date.now()) {
        errors.push('Event end date must be in the future.')
      }
    }

    if (!args.hasEventImage) {
      errors.push('Event image is required.')
    }

    if (!args.form.mainCategorySlug) {
      errors.push('Main category is required.')
    }

    if (!sportsEventSelected && args.form.categories.length < MIN_SUB_CATEGORIES) {
      errors.push(`Select at least ${MIN_SUB_CATEGORIES} sub categories.`)
    }

    if (args.creationMode === 'recurring') {
      if (!args.hasCreatorSelection) {
        errors.push('Select a creator for recurring deployments.')
      }
      if (!args.hasRecurringCadence) {
        errors.push('Select a valid recurrence cadence.')
      }
    }

    if (sportsEventSelected) {
      errors.push(...buildAdminSportsStepErrors({
        step,
        sports: args.sportsForm,
        hasTeamLogoByHostStatus: args.hasTeamLogoByHostStatus,
      }))
    }
  }

  if (step === 2) {
    if (sportsEventSelected) {
      errors.push(...buildAdminSportsStepErrors({
        step,
        sports: args.sportsForm,
        hasTeamLogoByHostStatus: args.hasTeamLogoByHostStatus,
      }))
      return errors
    }

    if (!args.form.marketMode) {
      errors.push('Select a market type.')
      return errors
    }

    if (args.form.marketMode === 'binary') {
      if (!args.form.binaryQuestion.trim()) {
        errors.push('Binary question is required.')
      }
      if (!args.form.binaryOutcomeYes.trim() || !args.form.binaryOutcomeNo.trim()) {
        errors.push('Both binary outcomes are required.')
      }
      return errors
    }

    if (args.form.options.length < 2) {
      errors.push('Add at least 2 options for multi-market events.')
    }

    args.form.options.forEach((option, index) => {
      if (!option.question.trim()) {
        errors.push(`Option ${index + 1}: question is required.`)
      }
      if (!option.title.trim()) {
        errors.push(`Option ${index + 1}: title is required.`)
      }
      if (!option.shortName.trim()) {
        errors.push(`Option ${index + 1}: short name is required.`)
      }
      if (!option.slug.trim()) {
        errors.push(`Option ${index + 1}: slug cannot be empty.`)
      }
      if (!option.outcomeYes.trim() || !option.outcomeNo.trim()) {
        errors.push(`Option ${index + 1}: both outcomes are required.`)
      }
    })
  }

  if (step === 3) {
    if (args.form.resolutionSource.trim() && !isValidUrl(args.form.resolutionSource.trim())) {
      errors.push('Resolution source URL is invalid.')
    }

    if (!args.form.resolutionRules.trim()) {
      errors.push('Resolution rules are required.')
    }
    else if (args.form.resolutionRules.trim().length < 60) {
      errors.push('Resolution rules are too short.')
    }

    if (args.creationMode === 'recurring') {
      errors.push(...args.recurringPreviewErrors)
    }
  }

  if (step === 4) {
    if (args.fundingCheckState === 'idle' || args.fundingCheckState === 'checking') {
      errors.push('Run the EOA USDC check first.')
    }
    else if (args.fundingCheckState === 'no_wallet') {
      errors.push('Connect the main EOA wallet to validate USDC balance.')
    }
    else if (args.fundingCheckState === 'error') {
      errors.push('Could not validate EOA USDC balance right now. Try again.')
    }
    else if (args.fundingCheckState !== 'ok') {
      errors.push('Main EOA wallet does not have enough USDC for the reward.')
    }

    if (args.nativeGasCheckState === 'idle' || args.nativeGasCheckState === 'checking') {
      errors.push('Run POL gas check first.')
    }
    else if (args.nativeGasCheckState === 'no_wallet') {
      errors.push('Connect the main EOA wallet to validate POL gas balance.')
    }
    else if (args.nativeGasCheckState === 'error') {
      errors.push('Could not validate POL gas balance right now. Try again.')
    }
    else if (args.nativeGasCheckState !== 'ok') {
      errors.push('Main EOA wallet does not have enough POL for market creation gas.')
    }

    if (args.allowedCreatorCheckState === 'idle' || args.allowedCreatorCheckState === 'checking') {
      errors.push('Run the allowed market creator wallet check first.')
    }
    else if (args.allowedCreatorCheckState === 'no_wallet') {
      errors.push('Connect the main EOA wallet first.')
    }
    else if (args.allowedCreatorCheckState === 'error') {
      errors.push('Could not validate allowed market creator wallets right now.')
    }
    else if (args.allowedCreatorCheckState !== 'ok') {
      errors.push('Main EOA wallet is not in allowed market creator wallets.')
    }

    if (args.slugValidationState === 'idle' || args.slugValidationState === 'checking') {
      errors.push('Run slug availability check first.')
    }
    else if (args.slugValidationState === 'duplicate') {
      errors.push('Slug already exists in your database.')
    }
    else if (args.slugValidationState === 'error') {
      errors.push('Could not validate slug right now.')
    }

    if (args.openRouterCheckState === 'idle' || args.openRouterCheckState === 'checking') {
      errors.push('Run OpenRouter check first.')
      return errors
    }
    else if (args.openRouterCheckState !== 'ok') {
      errors.push('OpenRouter must be active before content AI checker.')
      return errors
    }

    if (args.contentCheckState === 'idle' || args.contentCheckState === 'checking') {
      errors.push('Run content AI checker.')
    }
    else if (args.hasContentCheckFatalError) {
      errors.push('Could not run content AI checker right now. Try again.')
    }
    else if (args.hasPendingAiErrors) {
      errors.push('Content AI checker found issues.')
    }
  }

  return errors
}

export function getAiIssueKey(issue: AiValidationIssue) {
  return `${issue.code}:${issue.step}:${issue.reason}`
}

export function getExplorerTxBase() {
  return `${POLYGON_SCAN_BASE}/tx/`
}

export function getChainLabel() {
  return IS_TEST_MODE ? 'Polygon Amoy' : 'Polygon'
}

export function parseMinTipCapFromError(errorMessage: string): bigint | null {
  const match = errorMessage.match(/minimum needed\s+(\d+)/i)
  if (!match?.[1]) {
    return null
  }

  try {
    return BigInt(match[1])
  }
  catch {
    return null
  }
}

export function isAlreadyInitializedError(message: string): boolean {
  return /already initialized/i.test(message)
}

export function isBigIntSerializationError(message: string): boolean {
  return /json\.stringify.*bigint|serialize bigint/i.test(message)
}

export function mapSignatureFlowErrorForUser(message: string): string {
  if (isBigIntSerializationError(message)) {
    return 'Could not send transaction with this wallet provider. Please retry or switch wallet.'
  }
  if (/too many subrequests|finalize failed \(5\d\d\)|unexpected server error|internal server error/i.test(message)) {
    return 'Could not finalize the market right now. Please wait a few moments and retry the pending plan.'
  }
  if (/request arguments:/i.test(message) || /unknown rpc error/i.test(message)) {
    return 'Could not send transaction right now. Please try again in a few moments.'
  }
  return message
}

export function shouldRetryFinalizeRequest(message: string): boolean {
  return /too many subrequests|finalization in progress|retry finalize to continue|finalize failed \(5\d\d\)|unexpected server error|internal server error|request timed out|failed to fetch|networkerror/i.test(message)
}
