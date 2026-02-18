'use client'

import type { ChangeEvent } from 'react'
import type { MarketMode } from '@/app/[locale]/admin/create-event/_data/marketExamples'
import { useAppKitAccount } from '@reown/appkit/react'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  ExternalLinkIcon,
  ImageIcon,
  ImageUp,
  Loader2Icon,
  PlusIcon,
  SparklesIcon,
  SquarePenIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createPublicClient, formatUnits, getAddress, http, isAddress, keccak256, parseGwei, stringToHex, toHex } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { defaultNetwork } from '@/lib/appkit'
import { CREATE_MARKET_API_BASE_URL } from '@/lib/constants'
import { AMOY_CHAIN_ID, IS_TEST_MODE } from '@/lib/network'
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

const TOTAL_STEPS = 5
const MIN_SUB_CATEGORIES = 4

const USDC_DECIMALS = 6
const FALLBACK_REQUIRED_USDC = 5
const CREATE_EVENT_DRAFT_STORAGE_KEY = 'admin_create_event_draft_v1'
const CREATE_EVENT_SIGNATURE_STORAGE_KEY = 'admin_create_event_signature_flow_v1'
const TITLE_CATEGORY_MIN_LENGTH = 4
const CONTENT_CHECK_PROGRESS_INTERVAL_MS = 1400
const SIGNATURE_COUNTDOWN_INTERVAL_MS = 1000
const SLUG_CHECK_TIMEOUT_MS = 12000
const OPENROUTER_CHECK_TIMEOUT_MS = 12000
const CONTENT_CHECK_TIMEOUT_MS = 45000
const CONTENT_CHECK_PROGRESS = [
  'checking content language...',
  'checking deterministic rules...',
  'checking mandatory fields...',
  'checking event date coherence...',
  'checking resolution source format...',
  'checking market structure consistency...',
  'checking outcomes consistency...',
  'checking final consistency...',
] as const
const MIN_AMOY_PRIORITY_FEE_WEI = parseGwei('25')
const FALLBACK_MAX_FEE_PER_GAS_WEI = parseGwei('30')
const APPROVE_GAS_UNITS_ESTIMATE = 70_000n
const INITIALIZE_GAS_UNITS_ESTIMATE = 700_000n
const GAS_ESTIMATE_BUFFER_NUMERATOR = 13n
const GAS_ESTIMATE_BUFFER_DENOMINATOR = 10n
const POLYGON_MAINNET_CHAIN_ID = 137
const DEFAULT_CREATE_EVENT_CHAIN_ID = IS_TEST_MODE ? AMOY_CHAIN_ID : POLYGON_MAINNET_CHAIN_ID
const EOA_BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

type SlugValidationState = 'idle' | 'checking' | 'unique' | 'duplicate' | 'error'
type FundingCheckState = 'idle' | 'checking' | 'ok' | 'insufficient' | 'no_wallet' | 'error'
type NativeGasCheckState = 'idle' | 'checking' | 'ok' | 'insufficient' | 'no_wallet' | 'error'
type AllowedCreatorCheckState = 'idle' | 'checking' | 'ok' | 'missing' | 'no_wallet' | 'error'
type OpenRouterCheckState = 'idle' | 'checking' | 'ok' | 'error'
type ContentCheckState = 'idle' | 'checking' | 'ok' | 'error'
type SignatureTxStatus = 'idle' | 'awaiting_wallet' | 'confirming' | 'success' | 'error'
type PreSignCheckKey = 'funding' | 'nativeGas' | 'allowedCreator' | 'slug' | 'openRouter' | 'content'

interface CategorySuggestion {
  name: string
  slug: string
}

interface MainCategory {
  id: number
  name: string
  slug: string
  childs: CategorySuggestion[]
}

interface MainTagsApiResponse {
  mainCategories: MainCategory[]
  globalCategories: CategorySuggestion[]
}

interface CategoryItem {
  label: string
  slug: string
}

interface OptionItem {
  id: string
  question: string
  title: string
  shortName: string
  slug: string
  outcomeYes: string
  outcomeNo: string
}

interface FormState {
  title: string
  slug: string
  endDateIso: string
  mainCategorySlug: string
  categories: CategoryItem[]
  marketMode: MarketMode | null
  binaryQuestion: string
  binaryOutcomeYes: string
  binaryOutcomeNo: string
  options: OptionItem[]
  resolutionSource: string
  resolutionRules: string
}

interface SlugCheckResponse {
  exists: boolean
}

interface MarketConfigResponse {
  defaultChainId?: number
  supportedChainIds?: number[]
  chains?: Array<{
    chainId: number
    usdcToken: string
  }>
  requiredCreatorFundingUsdc?: string
  usdcToken?: string
}

interface AllowedCreatorsResponse {
  wallets: string[]
  allowed: boolean
}

interface AiValidationIssue {
  code: 'english' | 'url' | 'rules' | 'mandatory' | 'date'
  reason: string
  step: 1 | 2 | 3
}

interface AiValidationResponse {
  ok: boolean
  checks: {
    mandatory: boolean
    language: boolean
    deterministic: boolean
  }
  errors: AiValidationIssue[]
}

interface AiRulesResponse {
  rules: string
  samplesUsed: number
}

interface OpenRouterStatusResponse {
  configured: boolean
}

interface PreparePayloadOption {
  id: string
  question: string
  title: string
  shortName: string
  slug: string
}

interface PreparePayloadBody {
  chainId: number
  creator: string
  title: string
  slug: string
  endDateIso: string
  mainCategorySlug: string
  categories: CategoryItem[]
  marketMode: MarketMode
  binaryQuestion?: string
  binaryOutcomeYes?: string
  binaryOutcomeNo?: string
  options?: PreparePayloadOption[]
  resolutionSource: string
  resolutionRules: string
}

interface PrepareTxPlanItem {
  id: string
  to: string
  value: string
  data: string
  description: string
  marketKey?: string
}

interface PrepareResponse {
  requestId: string
  chainId: number
  creator: string
  txPlan: PrepareTxPlanItem[]
}

interface PrepareAuthChallengeResponse {
  requestId: string
  nonce: string
  expiresAt: number
  creator: string
  chainId: number
  payloadHash: string
  domain: {
    name: string
    version: string
    verifyingContract: string
  }
  primaryType: 'CreateMarketAuth'
  types: {
    CreateMarketAuth: Array<{
      name: string
      type: string
    }>
  }
}

interface PrepareFinalizeRequestTx {
  id: string
  hash: string
}

interface FinalizeResponse {
  requestId: string
  status: string
}

interface PendingRequestItem {
  requestId: string
  payloadHash: string
  status: string
  creator: string
  chainId: number
  expiresAt: number
  updatedAt: number
  errorMessage: string | null
  prepared: PrepareResponse
  txs: PrepareFinalizeRequestTx[]
}

interface PendingRequestResponse {
  request: PendingRequestItem | null
}

interface SignatureExecutionTx extends PrepareTxPlanItem {
  status: SignatureTxStatus
  hash?: string
  error?: string
}

function readApiError(payload: unknown): string | null {
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

function isAllowedCreatorsResponse(payload: unknown): payload is AllowedCreatorsResponse {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Partial<AllowedCreatorsResponse>
  return Array.isArray(candidate.wallets) && typeof candidate.allowed === 'boolean'
}

function isAiValidationResponse(payload: unknown): payload is AiValidationResponse {
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
}

function isAiRulesResponse(payload: unknown): payload is AiRulesResponse {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Partial<AiRulesResponse>
  return typeof candidate.rules === 'string' && typeof candidate.samplesUsed === 'number'
}

function isOpenRouterStatusResponse(payload: unknown): payload is OpenRouterStatusResponse {
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

function isSignatureTxStatus(value: unknown): value is SignatureTxStatus {
  return value === 'idle'
    || value === 'awaiting_wallet'
    || value === 'confirming'
    || value === 'success'
    || value === 'error'
}

function isSignatureExecutionTx(payload: unknown): payload is SignatureExecutionTx {
  if (!isPrepareTxPlanItem(payload)) {
    return false
  }

  const candidate = payload as Partial<SignatureExecutionTx>
  return isSignatureTxStatus(candidate.status)
    && (candidate.hash === undefined || typeof candidate.hash === 'string')
    && (candidate.error === undefined || typeof candidate.error === 'string')
}

function formatSignatureCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function isPrepareAuthChallengeResponse(payload: unknown): payload is PrepareAuthChallengeResponse {
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

function isFinalizeResponse(payload: unknown): payload is FinalizeResponse {
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

function isPendingRequestResponse(payload: unknown): payload is PendingRequestResponse {
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
    && isPrepareResponse(request.prepared)
    && Array.isArray(request.txs)
    && request.txs.every(item => isPrepareFinalizeRequestTx(item))
}

function isSlugCheckResponse(payload: unknown): payload is SlugCheckResponse {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  return typeof (payload as Partial<SlugCheckResponse>).exists === 'boolean'
}

async function fetchAdminApi(pathname: string, init?: RequestInit) {
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

async function fetchAdminApiWithTimeout(pathname: string, timeoutMs: number, init?: RequestInit) {
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

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
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

function extractTitleCategorySuggestions(title: string): CategorySuggestion[] {
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
    const slug = slugify(word)
    if (!slug || bySlug.has(slug)) {
      return
    }

    bySlug.set(slug, {
      name: word,
      slug,
    })
  })

  return Array.from(bySlug.values())
}

function createOption(id: string): OptionItem {
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

function createInitialForm(): FormState {
  return {
    title: '',
    slug: '',
    endDateIso: '',
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

function buildStepErrors(
  step: number,
  args: {
    form: FormState
    eventImageFile: File | null
    slugValidationState: SlugValidationState
    fundingCheckState: FundingCheckState
    nativeGasCheckState: NativeGasCheckState
    allowedCreatorCheckState: AllowedCreatorCheckState
    openRouterCheckState: OpenRouterCheckState
    contentCheckState: ContentCheckState
    hasPendingAiErrors: boolean
    hasContentCheckFatalError: boolean
  },
): string[] {
  const errors: string[] = []

  if (step === 1) {
    if (!args.form.title.trim()) {
      errors.push('Event title is required.')
    }

    if (!args.form.slug.trim()) {
      errors.push('Event slug is required.')
    }

    if (!args.form.endDateIso) {
      errors.push('Event end date is required.')
    }
    else {
      const parsedEndDate = new Date(args.form.endDateIso)
      if (Number.isNaN(parsedEndDate.getTime())) {
        errors.push('Event end date is invalid.')
      }
      else if (parsedEndDate.getTime() <= Date.now()) {
        errors.push('Event end date must be in the future.')
      }
    }

    if (!args.eventImageFile) {
      errors.push('Event image is required.')
    }

    if (!args.form.mainCategorySlug) {
      errors.push('Main category is required.')
    }

    if (args.form.categories.length < MIN_SUB_CATEGORIES) {
      errors.push(`Select at least ${MIN_SUB_CATEGORIES} sub categories.`)
    }
  }

  if (step === 2) {
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

function getAiIssueKey(issue: AiValidationIssue) {
  return `${issue.code}:${issue.step}:${issue.reason}`
}

function getExplorerTxBase(chainId: number) {
  if (chainId === POLYGON_MAINNET_CHAIN_ID) {
    return 'https://polygonscan.com/tx/'
  }
  if (chainId === AMOY_CHAIN_ID) {
    return 'https://amoy.polygonscan.com/tx/'
  }
  return ''
}

function getChainLabel(chainId: number) {
  if (chainId === POLYGON_MAINNET_CHAIN_ID) {
    return 'Polygon'
  }
  if (chainId === AMOY_CHAIN_ID) {
    return 'Polygon Amoy'
  }
  return `Chain ${chainId}`
}

function parseMinTipCapFromError(errorMessage: string): bigint | null {
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

function isAlreadyInitializedError(message: string): boolean {
  return /already initialized/i.test(message)
}

function isBigIntSerializationError(message: string): boolean {
  return /json\.stringify.*bigint|serialize bigint/i.test(message)
}

function mapSignatureFlowErrorForUser(message: string): string {
  if (isBigIntSerializationError(message)) {
    return 'Could not send transaction with this wallet provider. Please retry or switch wallet.'
  }
  if (/request arguments:/i.test(message) || /unknown rpc error/i.test(message)) {
    return 'Could not send transaction right now. Please try again in a few moments.'
  }
  return message
}

function OutcomeStateDot({ value }: { value: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex size-5 items-center justify-center rounded-full',
        value ? 'bg-emerald-600 text-background' : 'bg-red-600 text-background',
      )}
    >
      {value ? <CheckIcon className="size-3" /> : <XIcon className="size-3" />}
    </span>
  )
}

function CheckIndicator({
  state,
}: {
  state: 'checking' | 'ok' | 'error'
}) {
  return (
    <span
      className={cn(
        'inline-flex size-6 items-center justify-center rounded-full border',
        state === 'checking' && 'border-yellow-500/60 bg-yellow-500/15 text-yellow-500',
        state === 'ok' && 'border-emerald-500/60 bg-emerald-500/15 text-emerald-500',
        state === 'error' && 'border-red-500/60 bg-red-500/15 text-red-500',
      )}
    >
      {state === 'checking' && <Loader2Icon className="size-3.5 animate-spin" />}
      {state === 'ok' && <CheckIcon className="size-3.5" />}
      {state === 'error' && <XIcon className="size-3.5" />}
    </span>
  )
}

function SignatureTxIndicator({ status }: { status: SignatureTxStatus }) {
  if (status === 'success') {
    return (
      <span className="
        inline-flex size-6 items-center justify-center rounded-full border border-emerald-500/60 bg-emerald-500/15
        text-emerald-500
      "
      >
        <CheckIcon className="size-3.5" />
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span className="
        inline-flex size-6 items-center justify-center rounded-full border border-red-500/60 bg-red-500/15 text-red-500
      "
      >
        <XIcon className="size-3.5" />
      </span>
    )
  }

  if (status === 'awaiting_wallet' || status === 'confirming') {
    return (
      <span className="
        inline-flex size-6 items-center justify-center rounded-full border border-yellow-500/60 bg-yellow-500/15
        text-yellow-500
      "
      >
        <Loader2Icon className="size-3.5 animate-spin" />
      </span>
    )
  }

  return (
    <span className="
      inline-flex size-6 items-center justify-center rounded-full border border-muted-foreground/30 bg-muted/20
      text-muted-foreground
    "
    >
      <span className="size-2 rounded-full bg-current" />
    </span>
  )
}

export default function AdminCreateEventForm() {
  const { address: connectedAddress } = useAppKitAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const user = useUser()
  const eoaAddress = useMemo(() => {
    const candidate = connectedAddress ?? user?.address ?? ''
    if (!candidate || !isAddress(candidate)) {
      return null
    }
    return getAddress(candidate)
  }, [connectedAddress, user?.address])

  const [currentStep, setCurrentStep] = useState(1)
  const [maxVisitedStep, setMaxVisitedStep] = useState(1)
  const [form, setForm] = useState<FormState>(() => createInitialForm())
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([])
  const [globalCategories, setGlobalCategories] = useState<CategorySuggestion[]>([])
  const [categoryQuery, setCategoryQuery] = useState('')
  const [eventImageFile, setEventImageFile] = useState<File | null>(null)
  const [optionImageFiles, setOptionImageFiles] = useState<Record<string, File | null>>({})
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
  const [bypassedIssueKeys, setBypassedIssueKeys] = useState<string[]>([])
  const [contentCheckProgressLine, setContentCheckProgressLine] = useState('')
  const [contentCheckError, setContentCheckError] = useState('')
  const [isAddingCreatorWallet, setIsAddingCreatorWallet] = useState(false)
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
  const [previewSiteOrigin, setPreviewSiteOrigin] = useState('https://your-site.com')

  const titleTimeoutRef = useRef<number | null>(null)
  const copyTimeoutRef = useRef<number | null>(null)
  const contentCheckProgressRef = useRef<number | null>(null)
  const contentCheckFinishedTimeoutRef = useRef<number | null>(null)
  const lastPreSignChecksFingerprintRef = useRef<string | null>(null)
  const lastPreSignChecksCompletedRef = useRef(false)
  const lastPreSignChecksResultRef = useRef(false)
  const skipNextSignatureResetRef = useRef(false)
  const pendingResumeKeyRef = useRef<string | null>(null)

  const eventImagePreviewUrl = useMemo(
    () => (eventImageFile ? URL.createObjectURL(eventImageFile) : null),
    [eventImageFile],
  )
  const optionImagePreviewUrls = useMemo(() => {
    const previewUrls: Record<string, string> = {}
    Object.entries(optionImageFiles).forEach(([optionId, file]) => {
      if (file) {
        previewUrls[optionId] = URL.createObjectURL(file)
      }
    })
    return previewUrls
  }, [optionImageFiles])

  const selectedMainCategory = useMemo(
    () => mainCategories.find(category => category.slug === form.mainCategorySlug) ?? null,
    [form.mainCategorySlug, mainCategories],
  )
  const creatorSlugTail = useMemo(
    () => (eoaAddress ? eoaAddress.replace(/^0x/, '').slice(-3).toLowerCase() : '000'),
    [eoaAddress],
  )
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
      resolutionSource: form.resolutionSource.trim(),
      resolutionRules: form.resolutionRules.trim(),
    },
  }), [eoaAddress, form, marketCount, targetChainId])
  const slugSuffix = useMemo(
    () => `${slugSeed}${creatorSlugTail}`,
    [creatorSlugTail, slugSeed],
  )
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

  const stepLabels = useMemo(
    () => ['Event', 'Market Structure', 'Resolution', 'Pre-sign', 'Sign & Create'],
    [],
  )
  const previewEndDate = useMemo(() => {
    if (!form.endDateIso) {
      return 'End date not set'
    }
    const parsed = new Date(form.endDateIso)
    if (Number.isNaN(parsed.getTime())) {
      return form.endDateIso
    }
    return parsed.toLocaleString()
  }, [form.endDateIso])
  const previewMarkets = useMemo(() => {
    if (form.marketMode === 'binary') {
      return [
        {
          key: 'binary',
          title: form.title.trim(),
          question: (form.title || form.binaryQuestion).trim(),
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
    form.title,
    optionImagePreviewUrls,
  ])
  const tradePreviewMarket = useMemo(
    () => previewMarkets[0] ?? null,
    [previewMarkets],
  )
  const previewEventUrl = useMemo(
    () => `${previewSiteOrigin}/event/${form.slug || 'event-slug'}`,
    [form.slug, previewSiteOrigin],
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
  const authPhaseCompleted = Boolean(preparedSignaturePlan)
  const totalSignatureUnits = useMemo(
    () => (preparedSignaturePlan ? signatureTxs.length + 2 : 2),
    [preparedSignaturePlan, signatureTxs.length],
  )
  const completedSignatureUnits = useMemo(
    () => {
      let completed = authPhaseCompleted ? 1 : 0
      completed += completedSignatureCount
      if (signatureFlowDone) {
        completed += 1
      }
      return completed
    },
    [authPhaseCompleted, completedSignatureCount, signatureFlowDone],
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

  const isStepValid = useCallback((step: number) => {
    return buildStepErrors(step, {
      form,
      eventImageFile,
      slugValidationState,
      fundingCheckState,
      nativeGasCheckState,
      allowedCreatorCheckState,
      openRouterCheckState,
      contentCheckState,
      hasPendingAiErrors: pendingAiIssues.length > 0,
      hasContentCheckFatalError: Boolean(contentCheckError),
    }).length === 0
  }, [
    allowedCreatorCheckState,
    contentCheckState,
    eventImageFile,
    form,
    fundingCheckState,
    nativeGasCheckState,
    contentCheckError,
    openRouterCheckState,
    pendingAiIssues.length,
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

  useEffect(() => {
    if (!eventImagePreviewUrl) {
      return
    }

    return () => {
      URL.revokeObjectURL(eventImagePreviewUrl)
    }
  }, [eventImagePreviewUrl])

  useEffect(() => {
    return () => {
      Object.values(optionImagePreviewUrls).forEach((url) => {
        URL.revokeObjectURL(url)
      })
    }
  }, [optionImagePreviewUrls])

  useEffect(() => {
    return () => {
      if (titleTimeoutRef.current !== null) {
        window.clearTimeout(titleTimeoutRef.current)
      }

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

  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.origin) {
      return
    }
    setPreviewSiteOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    if (!authChallengeExpiresAtMs) {
      return
    }

    setSignatureNowMs(Date.now())
    const timer = window.setInterval(() => {
      setSignatureNowMs(Date.now())
    }, SIGNATURE_COUNTDOWN_INTERVAL_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [authChallengeExpiresAtMs])

  useEffect(() => {
    if (currentStep !== 4 && finalPreviewDialogOpen) {
      setFinalPreviewDialogOpen(false)
    }
  }, [currentStep, finalPreviewDialogOpen])

  useEffect(() => {
    setContentCheckState('idle')
    setContentCheckIssues([])
    setBypassedIssueKeys([])
    setContentCheckError('')
    setContentCheckProgressLine('')
  }, [
    form.title,
    form.mainCategorySlug,
    form.categories,
    form.marketMode,
    form.binaryQuestion,
    form.binaryOutcomeYes,
    form.binaryOutcomeNo,
    form.options,
    form.resolutionSource,
    form.resolutionRules,
  ])

  useEffect(() => {
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
  }, [
    eoaAddress,
    eventImageFile,
    optionImageFiles,
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
    targetChainId,
  ])

  useEffect(() => {
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
    slugHasIssue,
    slugValidationState,
  ])

  useEffect(() => {
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const raw = window.localStorage.getItem(CREATE_EVENT_DRAFT_STORAGE_KEY)
    if (!raw) {
      setSlugSeed(Math.floor(Date.now() / 1000).toString())
      return
    }

    try {
      const parsed = JSON.parse(raw) as {
        form?: Partial<FormState>
        currentStep?: number
        maxVisitedStep?: number
        slugSeed?: string
        isBinaryOutcomesEditable?: boolean
        areMultiOutcomesEditable?: boolean
      }

      setSlugSeed(
        typeof parsed.slugSeed === 'string' && parsed.slugSeed.trim()
          ? parsed.slugSeed.trim()
          : Math.floor(Date.now() / 1000).toString(),
      )

      if (parsed.form && typeof parsed.form === 'object') {
        const fallback = createInitialForm()
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
          endDateIso: typeof parsed.form.endDateIso === 'string' ? parsed.form.endDateIso : fallback.endDateIso,
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
      console.error('Error loading create-event draft:', error)
      setSlugSeed(Math.floor(Date.now() / 1000).toString())
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const raw = window.localStorage.getItem(CREATE_EVENT_SIGNATURE_STORAGE_KEY)
    if (!raw) {
      return
    }

    try {
      const parsed = JSON.parse(raw) as {
        preparedSignaturePlan?: unknown
        signatureTxs?: unknown
        signatureFlowDone?: unknown
        signatureFlowError?: unknown
        authChallengeExpiresAtMs?: unknown
      }

      if (!isPrepareResponse(parsed.preparedSignaturePlan) || !Array.isArray(parsed.signatureTxs)) {
        return
      }

      const savedSignatureTxs = parsed.signatureTxs.filter(item => isSignatureExecutionTx(item))
      if (savedSignatureTxs.length !== parsed.preparedSignaturePlan.txPlan.length) {
        return
      }

      const normalizedSignatureTxs = parsed.preparedSignaturePlan.txPlan.map((planned, index) => {
        const saved = savedSignatureTxs[index]
        if (!saved || saved.id !== planned.id) {
          return {
            ...planned,
            status: 'idle' as const,
          }
        }
        return saved
      })

      skipNextSignatureResetRef.current = true
      setPreparedSignaturePlan(parsed.preparedSignaturePlan)
      setSignatureTxs(normalizedSignatureTxs)
      setSignatureFlowDone(Boolean(parsed.signatureFlowDone))
      setSignatureFlowError(typeof parsed.signatureFlowError === 'string' ? parsed.signatureFlowError : '')
      setAuthChallengeExpiresAtMs(
        typeof parsed.authChallengeExpiresAtMs === 'number' ? parsed.authChallengeExpiresAtMs : null,
      )
    }
    catch (error) {
      console.error('Error loading create-event signature flow draft:', error)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const payload = {
      form,
      currentStep,
      maxVisitedStep,
      slugSeed,
      isBinaryOutcomesEditable,
      areMultiOutcomesEditable,
    }

    window.localStorage.setItem(CREATE_EVENT_DRAFT_STORAGE_KEY, JSON.stringify(payload))
  }, [areMultiOutcomesEditable, currentStep, form, isBinaryOutcomesEditable, maxVisitedStep, slugSeed])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (!preparedSignaturePlan) {
      window.localStorage.removeItem(CREATE_EVENT_SIGNATURE_STORAGE_KEY)
      return
    }

    const payload = {
      preparedSignaturePlan,
      signatureTxs,
      signatureFlowDone,
      signatureFlowError,
      authChallengeExpiresAtMs,
    }

    window.localStorage.setItem(CREATE_EVENT_SIGNATURE_STORAGE_KEY, JSON.stringify(payload))
  }, [authChallengeExpiresAtMs, preparedSignaturePlan, signatureFlowDone, signatureFlowError, signatureTxs])

  useEffect(() => {
    if (titleTimeoutRef.current !== null) {
      window.clearTimeout(titleTimeoutRef.current)
      titleTimeoutRef.current = null
    }

    titleTimeoutRef.current = window.setTimeout(() => {
      if (!form.title.trim()) {
        setForm(prev => ({ ...prev, slug: '' }))
        return
      }

      setForm(prev => ({
        ...prev,
        slug: (() => {
          const base = slugify(prev.title)
          return base ? `${base}-${slugSuffix}` : ''
        })(),
      }))
    }, 250)

    return () => {
      if (titleTimeoutRef.current !== null) {
        window.clearTimeout(titleTimeoutRef.current)
        titleTimeoutRef.current = null
      }
    }
  }, [form.title, slugSuffix])

  useEffect(() => {
    if (!form.slug.trim()) {
      setSlugValidationState('idle')
      setSlugCheckError('')
      return
    }

    setSlugValidationState('idle')
    setSlugCheckError('')
  }, [form.slug])

  useEffect(() => {
    if (form.marketMode !== 'binary') {
      return
    }

    setForm((previous) => {
      const nextBinaryQuestion = previous.title
      const nextOutcomeYes = previous.binaryOutcomeYes.trim() ? previous.binaryOutcomeYes : 'Yes'
      const nextOutcomeNo = previous.binaryOutcomeNo.trim() ? previous.binaryOutcomeNo : 'No'

      if (
        previous.binaryQuestion === nextBinaryQuestion
        && previous.binaryOutcomeYes === nextOutcomeYes
        && previous.binaryOutcomeNo === nextOutcomeNo
      ) {
        return previous
      }

      return {
        ...previous,
        binaryQuestion: nextBinaryQuestion,
        binaryOutcomeYes: nextOutcomeYes,
        binaryOutcomeNo: nextOutcomeNo,
      }
    })
  }, [form.marketMode, form.title])

  const showFirstError = useCallback((errors: string[]) => {
    if (errors.length > 0) {
      toast.error(errors[0])
    }
  }, [])

  const handleFieldChange = useCallback(
    <K extends keyof FormState>(field: K, value: FormState[K]) => {
      setForm(prev => ({ ...prev, [field]: value }))
    },
    [],
  )

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

  const handleEventImageUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setEventImageFile(file)
  }, [])

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

  const handleOptionImageUpload = useCallback((optionId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setOptionImageFiles(prev => ({
      ...prev,
      [optionId]: file,
    }))
  }, [])

  const buildAiPayload = useCallback(() => {
    const normalizedMarketMode = form.marketMode
    const normalizedBinaryQuestion = normalizedMarketMode === 'binary'
      ? form.title
      : form.binaryQuestion
    const normalizedOptions = normalizedMarketMode === 'binary'
      ? []
      : form.options.map(option => ({
          question: option.question,
          title: option.title,
          shortName: option.shortName,
          slug: option.slug,
          outcomeYes: option.outcomeYes,
          outcomeNo: option.outcomeNo,
        }))

    return {
      title: form.title,
      slug: form.slug,
      endDateIso: form.endDateIso,
      mainCategorySlug: form.mainCategorySlug,
      categories: form.categories,
      marketMode: normalizedMarketMode,
      binaryQuestion: normalizedBinaryQuestion,
      binaryOutcomeYes: form.binaryOutcomeYes,
      binaryOutcomeNo: form.binaryOutcomeNo,
      options: normalizedOptions,
      resolutionSource: form.resolutionSource,
      resolutionRules: form.resolutionRules,
    }
  }, [form])

  const buildPreparePayload = useCallback((): PreparePayloadBody => {
    if (!eoaAddress) {
      throw new Error('Connect wallet first.')
    }
    if (!form.marketMode) {
      throw new Error('Select a market type.')
    }

    const mergedCategories = (() => {
      const base: CategoryItem[] = [
        {
          label: selectedMainCategory?.name || form.mainCategorySlug,
          slug: form.mainCategorySlug,
        },
        ...form.categories,
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

    const payload: PreparePayloadBody = {
      chainId: targetChainId,
      creator: eoaAddress,
      title: form.title.trim(),
      slug: form.slug.trim(),
      endDateIso: form.endDateIso,
      mainCategorySlug: form.mainCategorySlug.trim(),
      categories: mergedCategories,
      marketMode: form.marketMode,
      resolutionSource: form.resolutionSource.trim(),
      resolutionRules: form.resolutionRules.trim(),
    }

    if (form.marketMode === 'binary') {
      payload.binaryQuestion = form.title.trim()
      payload.binaryOutcomeYes = form.binaryOutcomeYes.trim()
      payload.binaryOutcomeNo = form.binaryOutcomeNo.trim()
      return payload
    }

    payload.options = form.options.map(option => ({
      id: option.id,
      question: option.question.trim(),
      title: option.title.trim(),
      shortName: option.shortName.trim(),
      slug: option.slug.trim(),
    }))
    return payload
  }, [eoaAddress, form, selectedMainCategory, targetChainId])

  const runOpenRouterCheck = useCallback(async () => {
    setOpenRouterCheckState('checking')
    setOpenRouterCheckError('')

    try {
      const response = await fetchAdminApiWithTimeout('/create-event/ai', OPENROUTER_CHECK_TIMEOUT_MS, {
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
      const response = await fetchAdminApiWithTimeout('/create-event/ai', CONTENT_CHECK_TIMEOUT_MS, {
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
      setContentCheckIssues(nextIssues)
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
    const slug = form.slug.trim().toLowerCase()
    setSlugValidationState('checking')
    setSlugCheckError('')

    if (!slug) {
      setSlugValidationState('error')
      setSlugCheckError('Slug is required.')
      return false
    }

    try {
      const response = await fetchAdminApiWithTimeout(`/events/check-slug?slug=${encodeURIComponent(slug)}`, SLUG_CHECK_TIMEOUT_MS, {
        method: 'GET',
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => null) as unknown
      const apiError = readApiError(payload)

      if (!response.ok || apiError || !isSlugCheckResponse(payload)) {
        throw new Error(apiError || `Slug check failed (${response.status})`)
      }

      const exists = payload.exists
      setSlugValidationState(exists ? 'duplicate' : 'unique')
      return !exists
    }
    catch (error) {
      console.error('Error checking slug:', error)
      setSlugValidationState('error')
      setSlugCheckError('Could not validate slug right now.')
      return false
    }
  }, [form.slug])

  const runAllowedCreatorCheck = useCallback(async () => {
    setAllowedCreatorCheckState('checking')
    setAllowedCreatorCheckError('')

    if (!eoaAddress) {
      setAllowedCreatorCheckState('no_wallet')
      return false
    }

    try {
      const response = await fetchAdminApi(`/create-event/allowed-creators?address=${encodeURIComponent(eoaAddress)}`, {
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

    setIsAddingCreatorWallet(true)
    try {
      const response = await fetchAdminApi('/create-event/allowed-creators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address: eoaAddress }),
      })

      const payload = await response.json().catch(() => null) as unknown
      const apiError = readApiError(payload)

      if (!response.ok || apiError || !isAllowedCreatorsResponse(payload)) {
        throw new Error(apiError || `Failed to add allowed creator (${response.status})`)
      }

      toast.success('Wallet added to allowed market creator wallets.')
      await runAllowedCreatorCheck()
    }
    catch (error) {
      console.error('Error adding allowed creator wallet:', error)
      toast.error(error instanceof Error ? error.message : 'Could not add wallet to allowed market creator wallets.')
    }
    finally {
      setIsAddingCreatorWallet(false)
    }
  }, [eoaAddress, runAllowedCreatorCheck])

  const runFundingCheck = useCallback(async () => {
    setFundingCheckState('checking')
    setFundingCheckError('')

    try {
      const response = await fetch(`${CREATE_MARKET_API_BASE_URL}/market-config`, {
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
        chain: defaultNetwork,
        transport: http(defaultNetwork.rpcUrls.default.http[0]),
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
        chain: defaultNetwork,
        transport: http(defaultNetwork.rpcUrls.default.http[0]),
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

  const loadPendingSignaturePlan = useCallback(async (options?: {
    silent?: boolean
    chainId?: number
    expectedPayloadHash?: string
  }) => {
    if (!eoaAddress) {
      return false
    }

    const silent = Boolean(options?.silent)
    setIsLoadingPendingRequest(true)

    try {
      const query = new URLSearchParams({
        creator: eoaAddress,
      })
      if (typeof options?.chainId === 'number' && options.chainId > 0) {
        query.set('chainId', String(options.chainId))
      }

      const response = await fetch(`${CREATE_MARKET_API_BASE_URL}/pending?${query.toString()}`, {
        method: 'GET',
        cache: 'no-store',
      })

      const payload = await response.json().catch(() => null) as unknown
      const apiError = readApiError(payload)
      if (!response.ok || apiError || !isPendingRequestResponse(payload)) {
        throw new Error(apiError || `Pending request lookup failed (${response.status})`)
      }

      if (!payload.request) {
        return false
      }

      const pending = payload.request
      if (!isAddress(pending.prepared.creator) || getAddress(pending.prepared.creator) !== eoaAddress) {
        return false
      }
      if (options?.expectedPayloadHash && pending.payloadHash.toLowerCase() !== options.expectedPayloadHash.toLowerCase()) {
        return false
      }

      applyPreparedSignatureState({
        prepared: pending.prepared,
        confirmedTxs: pending.txs,
        errorMessage: pending.errorMessage,
      })

      if (!silent) {
        toast.success('Recovered pending signature progress from server.')
      }
      return true
    }
    catch (error) {
      console.error('Error loading pending signature plan:', error)
      if (!silent) {
        const message = error instanceof Error ? error.message : 'Could not recover pending signature progress.'
        toast.error(message)
      }
      return false
    }
    finally {
      setIsLoadingPendingRequest(false)
    }
  }, [applyPreparedSignatureState, eoaAddress])

  const persistConfirmedTxs = useCallback(async (requestId: string, txs: PrepareFinalizeRequestTx[]) => {
    if (!eoaAddress || txs.length === 0) {
      return
    }

    const response = await fetch(`${CREATE_MARKET_API_BASE_URL}/tx-confirm`, {
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
      const response = await fetchAdminApi('/create-event/ai', {
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
      toast.success(`Rules generated from ${payload.samplesUsed} Polymarket samples.`)
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
    if (!eventImageFile) {
      throw new Error('Event image is required.')
    }
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

      const authResponse = await fetch(`${CREATE_MARKET_API_BASE_URL}/prepare-auth`, {
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
        throw new Error(`Switch wallet to ${getChainLabel(authPayload.chainId)} before signing auth.`)
      }
      setAuthChallengeExpiresAtMs(authPayload.expiresAt)

      const authSignature = await activeWalletClient.signTypedData({
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
      body.append('eventImage', eventImageFile, eventImageFile.name)

      form.options.forEach((option) => {
        const optionImage = optionImageFiles[option.id]
        if (optionImage) {
          body.append(`optionImage:${option.id}`, optionImage, optionImage.name)
        }
      })

      const response = await fetch(`${CREATE_MARKET_API_BASE_URL}/prepare`, {
        method: 'POST',
        body,
      })

      const responsePayload = await response.json().catch(() => null) as unknown
      const apiError = readApiError(responsePayload)

      if (!response.ok || apiError || !isPrepareResponse(responsePayload)) {
        throw new Error(apiError || `Prepare failed (${response.status})`)
      }

      if (!isAddress(responsePayload.creator) || getAddress(responsePayload.creator) !== eoaAddress) {
        throw new Error('Creator address mismatch between wallet and prepare response.')
      }

      applyPreparedSignatureState({
        prepared: responsePayload,
        confirmedTxs: [],
      })

      if (responsePayload.txPlan.length === 0) {
        toast.success('Auth completed. No creator transactions were returned.')
      }
      else {
        const txCount = responsePayload.txPlan.length
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
    applyPreparedSignatureState,
    buildPreparePayload,
    eoaAddress,
    eventImageFile,
    form.options,
    loadPendingSignaturePlan,
    optionImageFiles,
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
      const response = await fetch(`${CREATE_MARKET_API_BASE_URL}/finalize`, {
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

      const responsePayload = await response.json().catch(() => null) as unknown
      const apiError = readApiError(responsePayload)
      if (!response.ok || apiError || !isFinalizeResponse(responsePayload)) {
        throw new Error(apiError || `Finalize failed (${response.status})`)
      }

      if (responsePayload.requestId !== preparedSignaturePlan.requestId) {
        throw new Error('Finalize response requestId mismatch.')
      }

      setSignatureFlowDone(true)
      setSignatureFlowError('')
      toast.success('All signatures completed. Your created event will be available on your site shortly.', {
        duration: 10000,
      })
    }
    finally {
      setIsFinalizingSignatureFlow(false)
    }
  }, [eoaAddress, preparedSignaturePlan, signatureTxs])

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
      throw new Error(`Switch wallet to ${getChainLabel(preparedSignaturePlan.chainId)} before signing.`)
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
            return await send(overrides)
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
            const rpcHash = await activeWalletClient.request({
              method: 'eth_sendTransaction',
              params: [txRequest],
            }) as unknown
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
    const errors = buildStepErrors(step, {
      form,
      eventImageFile,
      slugValidationState,
      fundingCheckState,
      nativeGasCheckState,
      allowedCreatorCheckState,
      openRouterCheckState,
      contentCheckState,
      hasPendingAiErrors: pendingAiIssues.length > 0,
      hasContentCheckFatalError: Boolean(contentCheckError),
    })

    if (errors.length > 0) {
      if (withToast) {
        showFirstError(errors)
      }
      return false
    }

    return true
  }, [
    allowedCreatorCheckState,
    contentCheckState,
    eventImageFile,
    form,
    fundingCheckState,
    nativeGasCheckState,
    contentCheckError,
    openRouterCheckState,
    pendingAiIssues.length,
    showFirstError,
    slugValidationState,
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
    setForm(createInitialForm())
    setSlugSeed(nextSlugSeed)
    setCategoryQuery('')
    setEventImageFile(null)
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
    setPreparedSignaturePlan(null)
    setSignatureTxs([])
    setSignatureFlowDone(false)
    setSignatureFlowError('')

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CREATE_EVENT_DRAFT_STORAGE_KEY)
      window.localStorage.removeItem(CREATE_EVENT_SIGNATURE_STORAGE_KEY)
    }
  }, [])

  const resetFormDraft = useCallback(() => {
    const nextSlugSeed = Math.floor(Date.now() / 1000).toString()
    const preserveSignatureState = Boolean(preparedSignaturePlan)
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
    setForm(createInitialForm())
    setSlugSeed(nextSlugSeed)
    setCategoryQuery('')
    setEventImageFile(null)
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
    setBypassedIssueKeys([])
    setContentCheckProgressLine('')
    setContentCheckError('')

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CREATE_EVENT_DRAFT_STORAGE_KEY)
      if (!preserveSignatureState) {
        window.localStorage.removeItem(CREATE_EVENT_SIGNATURE_STORAGE_KEY)
      }
    }
  }, [
    authChallengeExpiresAtMs,
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

  const continueFromFinalPreview = useCallback(() => {
    setFinalPreviewDialogOpen(false)
    setCurrentStep(5)
    setMaxVisitedStep(prev => Math.max(prev, 5))
  }, [])

  useEffect(() => {
    if (currentStep !== 4) {
      return
    }

    void runAllPreSignChecks()
  }, [currentStep, runAllPreSignChecks])

  useEffect(() => {
    if (currentStep !== 5 || !eoaAddress || preparedSignaturePlan || isSigningAuth || isPreparingSignaturePlan || isLoadingPendingRequest) {
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
    currentStep,
    eoaAddress,
    isLoadingPendingRequest,
    isPreparingSignaturePlan,
    isSigningAuth,
    loadPendingSignaturePlan,
    preparedSignaturePlan,
  ])

  const goBack = useCallback(() => {
    setCurrentStep(prev => Math.max(1, prev - 1))
  }, [])

  const handleStepClick = useCallback((step: number) => {
    if (!clickableStepMap[step]) {
      return
    }

    setCurrentStep(step)
    setMaxVisitedStep(prev => Math.max(prev, step))
  }, [clickableStepMap])

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
                          <Image
                            src={eventImagePreviewUrl}
                            alt="Event image preview"
                            fill
                            unoptimized
                            className="object-cover"
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
                    <Label htmlFor="event-title">Event title</Label>
                    <Input
                      id="event-title"
                      value={form.title}
                      onChange={event => handleFieldChange('title', event.target.value)}
                      placeholder="Example: Will the U.S. Senate pass the budget by March 31, 2026?"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="event-slug">Slug</Label>
                    <Input id="event-slug" value={form.slug} readOnly />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="event-end-date">End date</Label>
                    <Input
                      id="event-end-date"
                      type="datetime-local"
                      value={form.endDateIso}
                      onChange={event => handleFieldChange('endDateIso', event.target.value)}
                      className="w-full md:max-w-xs"
                    />
                  </div>
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
                              'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs',
                              item.slug === selectedMainCategory?.slug && 'border-primary/40 bg-primary/10',
                            )}
                          >
                            <span>{item.label}</span>
                            {item.slug === selectedMainCategory?.slug && (
                              <span className="text-2xs text-primary">Main</span>
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
                      form.marketMode === 'multi_multiple' ? 'border-primary bg-primary' : 'border-muted-foreground/50',
                    )}
                    >
                      {form.marketMode === 'multi_multiple' && <span className="size-1.5 rounded-full bg-background" />}
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
                      form.marketMode === 'multi_unique' ? 'border-primary bg-primary' : 'border-muted-foreground/50',
                    )}
                    >
                      {form.marketMode === 'multi_unique' && <span className="size-1.5 rounded-full bg-background" />}
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
                  <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem]">
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
                            group relative flex size-28 cursor-pointer items-center justify-center overflow-hidden
                            rounded-xl border border-dashed border-border bg-muted/20 text-muted-foreground transition
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
                                <Image
                                  src={optionImagePreviewUrls[option.id]}
                                  alt={`Option ${index + 1} image preview`}
                                  fill
                                  unoptimized
                                  className="object-cover"
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
                  <Label htmlFor="resolution-rules">Resolution rules</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRulesGeneratorDialogOpen(true)}
                    disabled={isGeneratingRules}
                  >
                    {isGeneratingRules
                      ? <Loader2Icon className="mr-2 size-4 animate-spin" />
                      : <SparklesIcon className="mr-2 size-4" />}
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
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                          <Image
                            src={eventImagePreviewUrl}
                            alt="Event preview"
                            fill
                            className="object-cover"
                          />
                        )
                      : (
                          <Skeleton className="size-full rounded-none" />
                        )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-lg font-semibold text-foreground">{form.title || 'Untitled event'}</p>
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
                                <Image
                                  src={market.imageUrl}
                                  alt={`Market ${index + 1} preview`}
                                  fill
                                  className="object-cover"
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
                    {form.resolutionRules || 'Rules not set.'}
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
                  onClick={() => void addCurrentWalletToAllowedCreators()}
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
                  <p className="font-mono text-sm break-all text-muted-foreground">
                    {form.slug || 'Slug not generated'}
                  </p>
                </div>
              )}
              {slugValidationState === 'duplicate' && (
                <p className="mt-2 text-sm text-destructive">Slug already exists in your database.</p>
              )}
              {slugCheckError && <p className="mt-2 text-sm text-destructive">{slugCheckError}</p>}
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
                        {getChainLabel(preparedSignaturePlan.chainId)}
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
                      <p className="text-sm text-muted-foreground">Sign auth to load tx plan.</p>
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
                      : isSigningAuth || isPreparingSignaturePlan
                        ? 'Awaiting wallet'
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
                    : isSigningAuth || isPreparingSignaturePlan
                      ? 'awaiting_wallet'
                      : signatureFlowError
                        ? 'error'
                        : 'idle'}
                />
              </div>
            </div>

            {signatureTxs.length > 0 && (
              <div className="space-y-2">
                {signatureTxs.map((tx) => {
                  const explorerBase = preparedSignaturePlan ? getExplorerTxBase(preparedSignaturePlan.chainId) : ''
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
                        : isFinalizingSignatureFlow
                          ? 'Validating tx hashes and registering'
                          : signatureFlowError && completedSignatureCount === signatureTxs.length && signatureTxs.length > 0
                            ? 'Failed'
                            : 'Pending'}
                    </p>
                  </div>
                  <SignatureTxIndicator
                    status={signatureFlowDone
                      ? 'success'
                      : isFinalizingSignatureFlow
                        ? 'confirming'
                        : signatureFlowError && completedSignatureCount === signatureTxs.length && signatureTxs.length > 0
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
              onClick={goBack}
              disabled={
                currentStep === 1
                || isLoadingPendingRequest
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
                      (() => {
                        const allChecksOk = isStepValid(4)
                        if (!allChecksOk) {
                          const isChecking = fundingCheckState === 'checking'
                            || allowedCreatorCheckState === 'checking'
                            || slugValidationState === 'checking'
                            || openRouterCheckState === 'checking'
                            || contentCheckState === 'checking'
                          return (
                            <>
                              {isChecking && <Loader2Icon className="mr-2 size-4 animate-spin" />}
                              {isChecking ? 'Re-checking...' : 'Re-check'}
                            </>
                          )
                        }

                        return 'Preview'
                      })()
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
