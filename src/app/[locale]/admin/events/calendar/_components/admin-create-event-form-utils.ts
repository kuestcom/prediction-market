import type { Hex } from 'viem'

import { toHex } from 'viem'

import type { EventCreationDraftRecord } from '@/lib/db/queries/event-creations'
import type { EventCreationAssetRef, EventCreationRecurrenceUnit } from '@/lib/event-creation'

import { normalizeDateTimeLocalValue } from '@/lib/datetime-local'
import { slugifyEventCreationValue as slugify } from '@/lib/event-creation'
import { AMOY_CHAIN_ID, IS_TEST_MODE, POLYGON_MAINNET_CHAIN_ID, POLYGON_SCAN_BASE } from '@/lib/network'

import type {
  AiRulesResponse,
  AiValidationIssue,
  AiValidationResponse,
  AllowedCreatorsResponse,
  CategoryItem,
  CategorySuggestion,
  FinalizeResponse,
  FormState,
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
} from './admin-create-event-form-types'

import { TITLE_CATEGORY_MIN_LENGTH } from './admin-create-event-form-constants'

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

export function resolveCustomSportsSlugMode({
  explicitlyCustom,
  isKnownSlug,
  normalizedSlug,
}: {
  explicitlyCustom: boolean
  isKnownSlug: boolean
  normalizedSlug: string
}) {
  return explicitlyCustom || Boolean(normalizedSlug && !isKnownSlug)
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
  } catch {
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
  return (
    typeof checks.mandatory === 'boolean' &&
    typeof checks.language === 'boolean' &&
    typeof checks.deterministic === 'boolean' &&
    Array.isArray(candidate.errors) &&
    (typeof candidate.warnings === 'undefined' || Array.isArray(candidate.warnings))
  )
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
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.to === 'string' &&
    typeof candidate.value === 'string' &&
    typeof candidate.data === 'string' &&
    typeof candidate.description === 'string'
  )
}

function isPrepareResponse(payload: unknown): payload is PrepareResponse {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Partial<PrepareResponse>
  return (
    typeof candidate.requestId === 'string' &&
    typeof candidate.chainId === 'number' &&
    typeof candidate.creator === 'string' &&
    Array.isArray(candidate.txPlan) &&
    candidate.txPlan.every((item) => isPrepareTxPlanItem(item))
  )
}

export function isPrepareAcceptedResponse(payload: unknown): payload is PrepareAcceptedResponse {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Partial<PrepareAcceptedResponse>
  return (
    typeof candidate.requestId === 'string' &&
    typeof candidate.chainId === 'number' &&
    typeof candidate.creator === 'string' &&
    typeof candidate.status === 'string'
  )
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
  return (
    typeof candidate.requestId === 'string' &&
    typeof candidate.nonce === 'string' &&
    typeof candidate.expiresAt === 'number' &&
    typeof candidate.creator === 'string' &&
    typeof candidate.chainId === 'number' &&
    typeof candidate.payloadHash === 'string' &&
    !!candidate.domain &&
    typeof candidate.domain === 'object' &&
    typeof (candidate.domain as { name?: unknown }).name === 'string' &&
    typeof (candidate.domain as { version?: unknown }).version === 'string' &&
    typeof (candidate.domain as { verifyingContract?: unknown }).verifyingContract === 'string'
  )
}

export function isFinalizeResponse(payload: unknown): payload is FinalizeResponse {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Partial<FinalizeResponse>
  return (
    typeof candidate.requestId === 'string' &&
    typeof candidate.status === 'string' &&
    (candidate.metadataUpdateTxPlan === undefined ||
      (Array.isArray(candidate.metadataUpdateTxPlan) &&
        candidate.metadataUpdateTxPlan.every((item) => isPrepareTxPlanItem(item))))
  )
}

function isPrepareFinalizeRequestTx(payload: unknown): payload is PrepareFinalizeRequestTx {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Partial<PrepareFinalizeRequestTx>
  return (
    typeof candidate.id === 'string' && typeof candidate.hash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(candidate.hash)
  )
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
  return (
    typeof request.requestId === 'string' &&
    typeof request.payloadHash === 'string' &&
    typeof request.status === 'string' &&
    typeof request.creator === 'string' &&
    typeof request.chainId === 'number' &&
    typeof request.expiresAt === 'number' &&
    typeof request.updatedAt === 'number' &&
    (typeof request.errorMessage === 'string' || request.errorMessage === null) &&
    (request.prepared === null || isPrepareResponse(request.prepared)) &&
    Array.isArray(request.txs) &&
    request.txs.every((item) => isPrepareFinalizeRequestTx(item)) &&
    (request.metadataUpdateTxPlan === undefined ||
      (Array.isArray(request.metadataUpdateTxPlan) &&
        request.metadataUpdateTxPlan.every((item) => isPrepareTxPlanItem(item))))
  )
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

function isAbortException(error: unknown) {
  return error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')
}

export async function fetchAdminApiWithTimeout(pathname: string, timeoutMs: number, init?: RequestInit) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const requestSignal = init?.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal

  try {
    return await fetchAdminApi(pathname, {
      ...init,
      signal: requestSignal,
    })
  } catch (error) {
    if (requestSignal.reason === timeoutSignal.reason && isAbortException(error)) {
      throw new Error('Request timed out. Try again in a few moments.')
    }
    throw error
  }
}

export async function resolveStoredAssetFile(
  localFile: File | null,
  asset: EventCreationAssetRef | null,
  label: string,
) {
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

export function extractTitleCategorySuggestions(title: string): CategorySuggestion[] {
  const sanitized = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^\w\s-]/g, ' ')

  const words = sanitized
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= TITLE_CATEGORY_MIN_LENGTH)
    .filter((word) => /[a-z]/.test(word))
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

export function createInitialForm(input?: { title?: string; slug?: string; endDateIso?: string }): FormState {
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
    return (
      candidate?.id === item.id &&
      candidate.question === item.question &&
      candidate.title === item.title &&
      candidate.shortName === item.shortName &&
      candidate.slug === item.slug &&
      candidate.outcomeYes === item.outcomeYes &&
      candidate.outcomeNo === item.outcomeNo
    )
  })
}

export function isEventCreationRecurrenceUnit(value: unknown): value is EventCreationRecurrenceUnit {
  return (
    value === 'minute' ||
    value === 'hour' ||
    value === 'day' ||
    value === 'week' ||
    value === 'month' ||
    value === 'quarter' ||
    value === 'semiannual' ||
    value === 'year'
  )
}

export function getAiIssueKey(issue: AiValidationIssue) {
  return `${issue.code}:${issue.step}:${issue.reason}`
}

export function getExplorerTxBase() {
  return `${POLYGON_SCAN_BASE}/tx/`
}

export function getChainLabel(chainId?: number | null) {
  if (chainId === AMOY_CHAIN_ID) {
    return 'Polygon Amoy'
  }

  if (chainId === POLYGON_MAINNET_CHAIN_ID) {
    return 'Polygon'
  }

  return IS_TEST_MODE ? 'Polygon Amoy' : 'Polygon'
}

export function isAlreadyInitializedError(message: string): boolean {
  return /already initialized/i.test(message)
}

export function isBigIntSerializationError(message: string): boolean {
  return /json\.stringify.*bigint|serialize.*bigint|failed to parse string to bigint|cannot convert .* to a bigint/i.test(
    message,
  )
}

export function buildRpcTransactionRequest(params: {
  from: `0x${string}`
  to: `0x${string}`
  data: `0x${string}`
  value?: bigint
  gas?: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
}) {
  const request: {
    from: `0x${string}`
    to: `0x${string}`
    data: `0x${string}`
    value: Hex
    gas?: Hex
    maxFeePerGas?: Hex
    maxPriorityFeePerGas?: Hex
  } = {
    from: params.from,
    to: params.to,
    data: params.data,
    value: toHex(params.value ?? 0n),
  }

  if (typeof params.gas === 'bigint') {
    request.gas = toHex(params.gas)
  }

  if (typeof params.maxFeePerGas === 'bigint') {
    request.maxFeePerGas = toHex(params.maxFeePerGas)
  }

  if (typeof params.maxPriorityFeePerGas === 'bigint') {
    request.maxPriorityFeePerGas = toHex(params.maxPriorityFeePerGas)
  }

  return request
}

export function mapSignatureFlowErrorForUser(message: string): string {
  if (isBigIntSerializationError(message)) {
    return 'Could not send transaction with this wallet provider. Please retry or switch wallet.'
  }
  if (/too many subrequests|finalize failed \(5\d\d\)|unexpected server error|internal server error/i.test(message)) {
    return 'Could not finalize the market right now. Please wait a few moments and retry the pending plan.'
  }
  if (/creator_whitelist_missing|creator must deploy\/register a proposer whitelist/i.test(message)) {
    return 'Create the resolution proposers whitelist before signing.'
  }
  if (/request arguments:/i.test(message) || /unknown rpc error/i.test(message)) {
    return 'Could not send transaction right now. Please try again in a few moments.'
  }
  return message
}

export function shouldRetryFinalizeRequest(message: string): boolean {
  return /too many subrequests|finalization in progress|retry finalize to continue|finalize failed \(5\d\d\)|unexpected server error|internal server error|request timed out|failed to fetch|networkerror/i.test(
    message,
  )
}
